/**
 * fixService — Layer-3 execution seam for Loop-3 (Fix / Funnel).
 *
 * WHAT: Thin, typed wrappers around the deployed edge functions and owner-scoped
 * Supabase reads that power the Fix loop — getFunnelMap, getWorkItems,
 * getAssetDetail, checkAsset, generateBrief, persistSignature, getDrift — each
 * returning a `FixResult<T>` discriminated `ok | needs_input | error`.
 *
 * WHY: This is the single seam the Fix screens (FunnelMap, WhatNeedsWork,
 * AssetDetailTabs, DriftBanner) share, so they never call edge functions / RLS
 * tables directly or drift on payload shapes. It COMPOSES the existing
 * `SupabaseBrandFunnelService` for the funnel coverage / asset reads + audit (the
 * FE equivalents of the `get_funnel_coverage` / `list_funnel_inventory` /
 * `audit_asset` MCP tools) rather than re-implementing them. Modeled on
 * `analyseService`: the edge invoker + funnel service + metrics reader are
 * INJECTABLE so tests drive the reachable / unreachable / empty / no-data
 * branches without a network.
 *
 * NO FABRICATION: every method degrades to `needs_input` (ask the user — e.g. no
 * avatar yet) or `error` rather than synthesising a status, a score, a brief, or
 * a lift number. Campaign-metrics-based lift ranking only activates when the
 * campaign/analytics migration is applied and real rows exist; until then work
 * items rank by coverage status alone with `estimatedLift: null` — never a
 * made-up number. This mirrors Loop-1/Loop-2's honest degradation.
 *
 * Observability lives in the SCREENS (PostHog funnel events), not this seam —
 * the same split as `analyseService`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  getStages,
  getTouchpoint,
  type ApplicabilityTag,
  type StageId,
} from '@/config/touchpointTaxonomy';
import { SupabaseBrandFunnelService } from '@/services/SupabaseBrandFunnelService';
import { isMember, FREE_TRIAL_PIECE_LIMIT } from '@/lib/entitlement';
import type {
  IBrandFunnelService,
  BrandAsset,
  BrandAssetCreate,
  BrandTest,
  CoverageCell,
  AssetStatus,
} from '@/services/interfaces/IBrandFunnelService';
import {
  FUNNEL_JOBS,
  isDerivedMetric,
  METRIC_META,
  type MetricKey,
  type WindsorSource,
} from '@/config/v4Funnel';
import type {
  AssetDetail,
  BriefSlots,
  DataResult,
  DriftItem,
  FixResult,
  FunnelMapView,
  FunnelPiece,
  PieceAvatarVerdict,
  FunnelStageView,
  JobVerdict,
  MetricCell,
  MetricRange,
  PieceMetrics,
  StoredContent,
  TestLifecycleStage,
  TestRow,
  Touchpoint,
  TouchpointStatus,
  WorkItem,
} from '@/types/v4Fix';

/** Injectable edge invoker (defaults to the deployed Supabase edge functions). */
export type EdgeInvoke = (
  fn: string,
  body: unknown,
) => Promise<{ data: unknown; error: unknown }>;

/**
 * Reads real per-touchpoint lift signals for an avatar. Returns a map of
 * touchpointId → estimated lift. Defaults to a `campaign_metrics` RLS read that
 * returns an EMPTY map until the campaign/analytics migration is applied — so
 * lift ranking is honestly absent rather than fabricated.
 */
export type MetricsReader = (avatarId: string) => Promise<Map<string, number>>;

/** One Signature option as produced by the Signature engine. */
export interface SignatureOption {
  /** 1-based option number as rendered ("Option 1".."Option 4"). */
  option: number;
  /** The candidate Signature sentence. */
  sentence: string;
}

/** Input to persistSignature — the option set + the user's pick. */
export interface PersistSignatureInput {
  options: SignatureOption[];
  /** 1-based option the user chose (must match an option). */
  chosenIndex: number;
  /** Avatar scope; omit/null for the brand-level chain. */
  avatarId?: string | null;
  /** Whether the synthesis was grounded in real reviews. */
  usedReviews?: boolean;
}

const defaultEdgeInvoke: EdgeInvoke = async (fn, body) => {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  return { data, error };
};

/**
 * Per-piece lift reader — intentionally a no-op today. The original design stored an
 * `estimated_lift` on campaign_metrics keyed by `touchpoint_id`, but the SHIPPED schema
 * went a different way: campaign_metrics carries raw metrics per `brand_asset_id`, and
 * realized lift is DERIVED from brand_tests (baseline → result), not stored per piece
 * (see migration 20260627010000 — derivable/lift metrics are computed, not stored). There
 * is therefore no stored per-piece lift column to read, so this returns an empty map and
 * lift ranking via getWorkItems stays coverage-based until a real lift source is wired.
 */
const defaultMetricsReader: MetricsReader = async () => new Map<string, number>();

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const asNumber = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const errResult = (e: unknown, fallback: string): FixResult<never> => ({
  status: 'error',
  error: e instanceof Error ? e.message : fallback,
});

/** Ask for an avatar — the one universal `needs_input` for this loop. */
const needAvatar = (): FixResult<never> => ({
  status: 'needs_input',
  needs_input: [
    {
      slot: 0,
      question: 'Which customer avatar are we fixing the funnel for?',
      why: 'The funnel map and audit are scoped to one avatar — I will not guess which.',
    },
  ],
});

/** Fold the full service-layer status into the four Funnel-Map display statuses. */
function toDisplayStatus(status: AssetStatus): TouchpointStatus {
  switch (status) {
    case 'aligned':
    case 'stale':
    case 'misaligned':
    case 'missing':
      return status;
    // `pending` (uploaded, not yet checked) and `failed` (audit errored) both
    // mean "exists but not known-aligned" → surface as needs-attention.
    default:
      return 'misaligned';
  }
}

/** Severity weight for ranking (higher = more work) when no real metrics exist. */
const SEVERITY: Readonly<Record<TouchpointStatus, number>> = {
  missing: 3,
  misaligned: 2,
  stale: 1,
  aligned: 0,
};

const REASON: Readonly<Record<TouchpointStatus, string>> = {
  missing: 'No asset here yet — this stage of the journey is silent.',
  misaligned: "On-page but off-strategy — it's working against the brand.",
  stale: "Built against an older Signature — it's drifted.",
  aligned: 'On-brand and aligned.',
};

/** `error` shape for the funnel-metrics seam (ok | no_data | error). */
const dataErr = (e: unknown, fallback: string): DataResult<never> => ({
  status: 'error',
  error: e instanceof Error ? e.message : fallback,
});

/** Every valid metric key, derived from the metric catalog (no separate list to drift). */
const isMetricKey = (v: unknown): v is MetricKey =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(METRIC_META, v);

const WINDSOR_SOURCES: readonly WindsorSource[] = [
  'amazon_ads',
  'amazon_sp',
  'facebook',
  'googleanalytics4',
  'tiktok_shop',
  'google_my_business',
  'derived',
  'manual',
];
const isWindsorSource = (v: unknown): v is WindsorSource =>
  typeof v === 'string' && WINDSOR_SOURCES.includes(v as WindsorSource);

/** Fold the full service status into the job-first verdict the funnel map speaks. */
function toJobVerdict(status: AssetStatus): JobVerdict {
  switch (status) {
    case 'aligned':
      return 'doing_job';
    case 'misaligned':
      return 'off_brand';
    case 'missing':
      return 'missing';
    // stale / pending / failed all mean "exists but not known-aligned" → leaking.
    default:
      return 'leaking';
  }
}

/** Severity for the weakest-link funnel rollup (higher = worse / needs more work). */
const VERDICT_SEVERITY: Readonly<Record<JobVerdict, number>> = {
  doing_job: 0,
  leaking: 1,
  off_brand: 2,
  missing: 3,
};

/**
 * The weakest-link rollup across a set of per-avatar verdicts: the WORST verdict
 * wins, so a piece reads `doing_job` only when it does its job for EVERY selected
 * customer. Deterministic — no invented consensus (preserves the no-fabrication bar).
 */
export function weakestLinkVerdict(verdicts: JobVerdict[]): JobVerdict {
  let worst: JobVerdict = 'doing_job';
  for (const v of verdicts) {
    if (VERDICT_SEVERITY[v] > VERDICT_SEVERITY[worst]) worst = v;
  }
  return worst;
}

/**
 * Best-effort, text-only stored content from the asset's pasted copy (Alpha = no
 * live fetch / image). First line → title, the rest → bullets; price/rating/reviews
 * stay null (honest "—") because brand_assets does not carry them.
 */
function parseStoredContent(a: BrandAsset): StoredContent {
  const lines = (a.content_text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const [title, ...bullets] = lines;
  return {
    title: title ?? null,
    bullets,
    price: null,
    rating: null,
    reviewCount: null,
    updatedAt: a.updated_at,
  };
}

/**
 * Read the two experiment-lifecycle milestone dates off a brand_test row. These
 * columns (`asset_created_at` / `asset_live_at`) are added by the additive
 * campaign/analytics migration and are NOT in the generated Database types yet, so
 * we read them through a guarded record view rather than the typed row — absent =
 * honest null, never a fabricated date.
 */
function readMilestones(t: BrandTest): { assetCreatedAt: string | null; assetLiveAt: string | null } {
  const r = t as unknown as Record<string, unknown>;
  return {
    assetCreatedAt: asString(r.asset_created_at),
    assetLiveAt: asString(r.asset_live_at),
  };
}

/**
 * Derive the lifecycle stage deterministically from the milestone dates + result:
 * a measured result is `complete`; a live asset is `measuring` (the re-measure
 * clock is running); a built-but-not-live asset is `asset_created`; otherwise the
 * test is still just an `idea`. Computed, never stored — so the table can't drift.
 */
export function deriveLifecycle(
  assetCreatedAt: string | null,
  assetLiveAt: string | null,
  result: number | null,
): TestLifecycleStage {
  if (result !== null) return 'complete';
  if (assetLiveAt !== null) return 'measuring';
  if (assetCreatedAt !== null) return 'asset_created';
  return 'idea';
}

/** Map a persisted brand_test row into a Testing-&-Lift row. */
function toTestRow(t: BrandTest, pieceLabel: string, name: string): TestRow {
  const { assetCreatedAt, assetLiveAt } = readMilestones(t);
  return {
    id: t.id,
    name,
    pieceId: t.asset_id,
    pieceLabel,
    metric: isMetricKey(t.metric_type) ? t.metric_type : 'cvr',
    baseline: t.baseline_value,
    result: t.result_value,
    status: t.status === 'running' ? 'running' : 'completed',
    // Alpha is standard-only; competitor-informed tests are flag-gated / post-Alpha.
    kind: 'standard',
    assetCreatedAt,
    assetLiveAt,
    lifecycleStage: deriveLifecycle(assetCreatedAt, assetLiveAt, t.result_value),
  };
}

/** Input to openTest — the fix hypothesis + the metric it should move + baseline. */
export interface OpenTestInput {
  /** The funnel piece (brand_asset) under test. */
  pieceId: string;
  /** Everyday label of the piece, for the table (the screen already knows it). */
  pieceLabel: string;
  /** What you'll change and why. */
  hypothesis: string;
  /** The metric the test moves. */
  metric: MetricKey;
  /** Today's value of that metric. */
  baseline: number;
  /** Optional short test name; defaults to the hypothesis. */
  name?: string;
}

export class FixService {
  constructor(
    private readonly funnel: IBrandFunnelService = new SupabaseBrandFunnelService(),
    private readonly invoke: EdgeInvoke = defaultEdgeInvoke,
    private readonly readMetrics: MetricsReader = defaultMetricsReader,
    /** Membership check for the free-trial gate; injectable for tests. */
    private readonly checkMember: () => Promise<boolean> = isMember,
  ) {}

  /**
   * Resolve the BRAND a funnel is scoped to from the active avatar lens. Funnel
   * pieces are the brand's (one inventory shared by all the brand's avatars); the
   * avatar is only the EVALUATION lens. `avatars.brand_id` is NOT NULL (P1), so a
   * real avatar always resolves a brand. Cached per instance to avoid re-querying.
   */
  private readonly brandIdCache = new Map<string, string>();
  private async resolveBrandId(avatarId: string): Promise<string | null> {
    const cached = this.brandIdCache.get(avatarId);
    if (cached) return cached;
    const { data } = await supabase
      .from('avatars').select('brand_id').eq('id', avatarId).maybeSingle();
    const brandId = (data?.brand_id as string | null) ?? null;
    if (brandId) this.brandIdCache.set(avatarId, brandId);
    return brandId;
  }

  /**
   * S-12 — the five-stage Funnel Map. Reads deterministic current-vs-desired
   * coverage (RLS), maps each cell to a display touchpoint, and rolls up counts.
   * `needs_input` when there is no avatar to scope to; never fabricates a status.
   */
  async getFunnelMap(
    avatarId: string | null,
    brandTags: ApplicabilityTag[],
  ): Promise<FixResult<FunnelMapView>> {
    if (!avatarId) return needAvatar();
    const { data, error } = await this.funnel.getCoverage(avatarId, brandTags);
    if (error) return errResult(error, 'Could not read your funnel coverage.');
    if (!data) return errResult(null, 'Funnel coverage came back empty.');

    const stageMeta = getStages();
    const stages: FunnelStageView[] = data.byStage.map((s) => {
      const meta = stageMeta.find((m) => m.id === s.stage);
      return {
        stage: s.stage,
        label: s.label,
        brandTask: meta?.brandTask ?? '',
        touchpoints: s.cells.map((c) => this.toTouchpoint(c)),
      };
    });

    return {
      status: 'ok',
      data: {
        stages,
        counts: data.counts,
        coveragePct: data.coveragePct,
        targetPct: data.targetPct,
      },
    };
  }

  private toTouchpoint(cell: CoverageCell): Touchpoint {
    return {
      touchpointId: cell.touchpointId,
      label: cell.label,
      stage: cell.stage,
      status: toDisplayStatus(cell.status),
      overallScore: cell.overallScore,
      assetId: cell.assetId,
      p0: getTouchpoint(cell.touchpointId)?.p0 ?? false,
    };
  }

  /**
   * S-13 — the impact-ranked "what needs work" list. Takes every non-aligned
   * touchpoint, then ranks by REAL estimated lift when campaign metrics exist,
   * else by status severity + P0 priority. `estimatedLift` is null and
   * `liftBasis` is `coverage` whenever no metrics back the item — never a
   * fabricated lift. `needs_input` when there is no avatar.
   */
  async getWorkItems(
    avatarId: string | null,
    brandTags: ApplicabilityTag[],
  ): Promise<FixResult<WorkItem[]>> {
    if (!avatarId) return needAvatar();
    const map = await this.getFunnelMap(avatarId, brandTags);
    if (map.status !== 'ok') return map;

    const lift = await this.readMetrics(avatarId);
    const cells = map.data.stages.flatMap((s) => s.touchpoints).filter((t) => t.status !== 'aligned');

    const items = cells.map((t): Omit<WorkItem, 'rank'> => {
      const real = lift.get(t.touchpointId);
      const hasMetric = typeof real === 'number';
      return {
        touchpointId: t.touchpointId,
        label: t.label,
        stage: t.stage,
        status: t.status,
        assetId: t.assetId,
        reason: hasMetric
          ? `${REASON[t.status]} Worth roughly +${real} on your numbers.`
          : REASON[t.status],
        estimatedLift: hasMetric ? real : null,
        liftBasis: hasMetric ? 'metrics' : 'coverage',
        p0: t.p0,
      };
    });

    items.sort((a, b) => {
      // Real lift wins when present on either side; otherwise severity then P0.
      const la = a.estimatedLift ?? -1;
      const lb = b.estimatedLift ?? -1;
      if (la !== lb) return lb - la;
      const sevDelta = SEVERITY[b.status] - SEVERITY[a.status];
      if (sevDelta !== 0) return sevDelta;
      return Number(b.p0) - Number(a.p0);
    });

    return { status: 'ok', data: items.map((it, i) => ({ ...it, rank: i + 1 })) };
  }

  /**
   * S-14 — read one asset's working detail (RLS). `needs_input` when no asset is
   * selected; never invents an audit verdict (null until checked).
   */
  async getAssetDetail(assetId: string | null): Promise<FixResult<AssetDetail>> {
    if (!assetId) {
      return {
        status: 'needs_input',
        needs_input: [
          {
            slot: 0,
            question: 'Pick a touchpoint from the funnel to work on.',
            why: 'I can only open an asset you have selected.',
          },
        ],
      };
    }
    const { data, error } = await this.funnel.getAsset(assetId);
    if (error) return errResult(error, 'Could not load that asset.');
    if (!data) return errResult(null, 'That asset could not be found.');
    return { status: 'ok', data: this.toAssetDetail(data) };
  }

  /**
   * S-14 — run the real audit engine against the avatar + Signature and return
   * the asset with its fresh verdict. Surfaces a failed audit as `error`, never
   * a silent / fabricated pass.
   */
  async checkAsset(assetId: string): Promise<FixResult<AssetDetail>> {
    const { data, error } = await this.funnel.auditAsset(assetId);
    if (error) return errResult(error, 'The audit could not be completed.');
    if (!data) return errResult(null, 'The audit returned nothing.');
    return { status: 'ok', data: this.toAssetDetail(data) };
  }

  private toAssetDetail(a: BrandAsset): AssetDetail {
    return {
      assetId: a.id,
      touchpointId: a.touchpoint_id,
      touchpointLabel: getTouchpoint(a.touchpoint_id)?.label ?? a.touchpoint_id,
      stage: a.stage as StageId,
      contextDescription: a.context_description,
      contentText: a.content_text,
      storagePath: a.storage_path,
      status: a.status,
      overallScore: a.overall_score,
      previousScore: a.previous_score,
      audit: a.audit_result,
      signatureVersion: a.signature_version,
      updatedAt: a.updated_at,
    };
  }

  /**
   * S-14 — expand an asset's touchpoint into the 7-slot brief via `export-brief`,
   * running every product claim through the fabrication gate. Passes through the
   * edge fn's `needs_input` (e.g. "compile the Brand Canvas first") unchanged —
   * never fabricates a brief or asserts an unconfirmed claim as fact.
   */
  async generateBrief(input: {
    touchpointId: string;
    avatarId: string;
    context?: string;
  }): Promise<FixResult<BriefSlots>> {
    try {
      const { data, error } = await this.invoke('export-brief', {
        touchpoint_id: input.touchpointId,
        avatar_id: input.avatarId,
        context: input.context,
      });
      if (error) return errResult(error, 'Could not reach the brief engine.');
      const rec = asRecord(data);
      if (!rec) return errResult(null, 'The brief engine returned nothing usable.');
      const ni = this.extractNeedsInput(rec);
      if (ni) return ni;
      const brief = this.parseBrief(rec);
      if (!brief) return errResult(null, 'The brief came back incomplete.');
      return { status: 'ok', data: brief };
    } catch (e) {
      return errResult(e, 'Could not reach the brief engine.');
    }
  }

  /**
   * S-15 — persist the user's chosen Signature (RLS write). Mirrors the
   * `persist_signature` MCP tool's signatures-row write: validates the pick is in
   * range, then inserts the option set + choice scoped to the caller.
   */
  async persistSignature(input: PersistSignatureInput): Promise<FixResult<{ signatureId: string }>> {
    try {
      if (input.options.length === 0) return errResult(null, 'No Signature options to persist.');
      const chosen = input.options.find((o) => o.option === input.chosenIndex);
      if (!chosen) return errResult(null, 'The chosen option is not in the option set.');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return errResult(null, 'You must be signed in to save your Signature.');

      const { data, error } = await supabase
        .from('signatures')
        .insert({
          user_id: user.id,
          avatar_id: input.avatarId ?? null,
          all_options: input.options as unknown as Json,
          chosen_index: input.chosenIndex,
          signature_text: chosen.sentence,
          used_reviews: input.usedReviews ?? false,
          inference: !(input.usedReviews ?? false),
        })
        .select('id')
        .single();
      if (error) return errResult(error, 'Could not save your Signature.');
      return { status: 'ok', data: { signatureId: data.id } };
    } catch (e) {
      return errResult(e, 'Could not save your Signature.');
    }
  }

  /**
   * S-15 — find assets that drifted from the current Signature. An asset drifts
   * when it was aligned under an older Signature than the one now live. Returns
   * an empty list at zero drift (the DriftBanner self-hides). `needs_input` when
   * there is no avatar.
   */
  async getDrift(avatarId: string | null): Promise<FixResult<DriftItem[]>> {
    if (!avatarId) return needAvatar();
    const brandId = await this.resolveBrandId(avatarId);
    if (!brandId) return errResult(null, 'Could not resolve your brand for drift.');
    const [{ data: assets, error }, current] = await Promise.all([
      this.funnel.listBrandAssets(brandId, avatarId),
      this.currentSignatureVersion(avatarId),
    ]);
    if (error) return errResult(error, 'Could not read your assets for drift.');
    if (!current) return { status: 'ok', data: [] };

    const drifted = (assets ?? [])
      .filter(
        (a) =>
          a.status === 'aligned' &&
          a.signature_version != null &&
          a.signature_version !== current,
      )
      .map(
        (a): DriftItem => ({
          assetId: a.id,
          touchpointId: a.touchpoint_id,
          touchpointLabel: getTouchpoint(a.touchpoint_id)?.label ?? a.touchpoint_id,
          stage: a.stage as StageId,
          builtAgainst: a.signature_version,
          currentSignature: current,
        }),
      );
    return { status: 'ok', data: drifted };
  }

  /**
   * Drift across a SET of avatars (multi-avatar funnel analysis): a piece that
   * drifted for ANY selected customer is surfaced once. Each avatar carries its own
   * current Signature, so drift is computed per avatar and unioned by piece id. A
   * single-id set delegates to `getDrift`. Best-effort: a per-avatar read that fails
   * is skipped rather than failing the whole banner.
   */
  async getDriftForSet(avatarIds: string[]): Promise<FixResult<DriftItem[]>> {
    const ids = [...new Set(avatarIds)].filter(Boolean);
    if (ids.length === 0) return needAvatar();
    if (ids.length === 1) return this.getDrift(ids[0]);
    const results = await Promise.all(ids.map((id) => this.getDrift(id)));
    const byAsset = new Map<string, DriftItem>();
    for (const r of results) {
      if (r.status !== 'ok') continue;
      for (const item of r.data) {
        if (!byAsset.has(item.assetId)) byAsset.set(item.assetId, item);
      }
    }
    return { status: 'ok', data: [...byAsset.values()] };
  }

  /** Current Signature version for an avatar: avatar-scoped first, else brand-level. */
  private async currentSignatureVersion(avatarId: string): Promise<string | null> {
    const scoped = await supabase
      .from('signatures')
      .select('id, artifact_id')
      .eq('avatar_id', avatarId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    let sig = scoped.data;
    if (!sig) {
      const brandLevel = await supabase
        .from('signatures')
        .select('id, artifact_id')
        .is('avatar_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      sig = brandLevel.data;
    }
    return sig ? (sig.artifact_id ?? sig.id) : null;
  }

  /** A `needs_input` short-circuit can arrive as the edge body (HTTP 200). */
  private extractNeedsInput(rec: Record<string, unknown>): FixResult<never> | null {
    if (!Array.isArray(rec.needs_input)) return null;
    const items = rec.needs_input
      .map((x) => {
        const r = asRecord(x);
        if (!r) return null;
        return {
          slot: asNumber(r.slot) ?? 0,
          question: asString(r.question) ?? '',
          why: asString(r.why) ?? '',
        };
      })
      .filter((x): x is { slot: number; question: string; why: string } => x !== null);
    return { status: 'needs_input', needs_input: items };
  }

  private parseBrief(rec: Record<string, unknown>): BriefSlots | null {
    const titleRec = asRecord(rec.title_formula);
    const imageRaw = Array.isArray(rec.image_brief) ? rec.image_brief : [];
    const imageBrief = imageRaw
      .map((s) => {
        const sr = asRecord(s);
        if (!sr) return null;
        return {
          slot: asString(sr.slot) ?? '',
          intent: asString(sr.intent) ?? '',
          brief: asString(sr.brief) ?? '',
        };
      })
      .filter((s): s is { slot: string; intent: string; brief: string } => s !== null);
    if (imageBrief.length === 0) return null;

    const bulletsRaw = Array.isArray(rec.bullets) ? rec.bullets : [];
    const bullets = bulletsRaw
      .map((b) => {
        const br = asRecord(b);
        if (!br) return null;
        return {
          element: asString(br.element) ?? '',
          brief: asString(br.brief) ?? '',
          exampleOutput: asString(br.example_output) ?? '',
        };
      })
      .filter((b): b is { element: string; brief: string; exampleOutput: string } => b !== null);

    const ppc = asRecord(rec.ppc_keywords);
    return {
      titleFormula: {
        brief: (titleRec && asString(titleRec.brief)) ?? '',
        exampleOutput: (titleRec && asString(titleRec.example_output)) ?? '',
      },
      bullets,
      imageBrief,
      ppcKeywords: {
        tierA: ppc ? asStringArray(ppc.tier_a) : [],
        tierB: ppc ? asStringArray(ppc.tier_b) : [],
        tierC: ppc ? asStringArray(ppc.tier_c) : [],
      },
      claimGate: this.parseClaimGate(rec),
    };
  }

  private parseClaimGate(rec: Record<string, unknown>): BriefSlots['claimGate'] {
    const raw = Array.isArray(rec.product_truth_claims)
      ? rec.product_truth_claims
      : Array.isArray(rec.claims)
        ? rec.claims
        : [];
    return raw
      .map((c) => {
        const cr = asRecord(c);
        if (!cr) return null;
        const claim = asString(cr.claim);
        if (!claim) return null;
        const confirmed = cr.confirmed === true;
        const item: BriefSlots['claimGate'][number] = {
          claim,
          status: confirmed ? 'confirmed' : 'unconfirmed',
        };
        const slot = asNumber(cr.slot);
        if (slot != null) item.slot = slot;
        if (!confirmed) item.reason = 'Not yet confirmed against your real product facts.';
        return item;
      })
      .filter((c): c is BriefSlots['claimGate'][number] => c !== null);
  }

  // ── Funnel-by-Job seams (ok | no_data | error) ──────────────────────────────

  /**
   * Every funnel piece (= active brand asset) for an avatar, in the unified shape.
   * `no_data` when the avatar has no pieces yet; `error` when not scoped to an
   * avatar or the read fails. Never fabricates a piece.
   */
  async getFunnelPieces(avatarId: string | null): Promise<DataResult<FunnelPiece[]>> {
    if (!avatarId) {
      return { status: 'error', error: 'Pick a customer avatar to load its funnel pieces.' };
    }
    // Pieces are BRAND-scoped (shared across the brand's avatars); the avatar is the
    // evaluation lens. Resolve the brand from the avatar, read pieces by brand with
    // the per-avatar verdict overlaid.
    const brandId = await this.resolveBrandId(avatarId);
    if (!brandId) return dataErr(null, 'Could not resolve your brand for the funnel.');
    const { data, error } = await this.funnel.listBrandAssets(brandId, avatarId);
    if (error) return dataErr(error, 'Could not load your funnel pieces.');
    const assets = data ?? [];
    if (assets.length === 0) {
      return {
        status: 'no_data',
        reason: 'No funnel pieces yet — add your first active brand asset to start the map.',
      };
    }
    return { status: 'ok', data: assets.map((a) => this.toFunnelPiece(a)) };
  }

  /**
   * Funnel pieces for a SET of avatars (multi-avatar funnel analysis). Pieces are
   * BRAND-scoped (shared); each avatar is an evaluation LENS that overlays its own
   * verdict. We read the brand's pieces once per selected avatar (the per-avatar
   * overlay), combine by piece id, attach the per-avatar verdicts, and set the
   * piece `status` to a deterministic WEAKEST-LINK rollup — a piece reads
   * `doing_job` only if it does its job for EVERY selected customer. A single-id
   * set delegates to `getFunnelPieces`. Never fabricates a piece or a verdict.
   */
  async getFunnelPiecesForSet(
    avatarIds: string[],
    avatarNames: Record<string, string>,
  ): Promise<DataResult<FunnelPiece[]>> {
    const ids = [...new Set(avatarIds)].filter(Boolean);
    if (ids.length === 0) {
      return { status: 'error', error: 'Pick at least one customer avatar to load the funnel.' };
    }
    if (ids.length === 1) return this.getFunnelPieces(ids[0]);

    const focus = ids[0];
    const brandId = await this.resolveBrandId(focus);
    if (!brandId) return dataErr(null, 'Could not resolve your brand for the funnel.');

    // Read the brand's pieces once PER avatar — the SAME brand pieces, each with
    // that avatar's verdict overlaid (un-audited pieces come back as 'pending').
    const overlays = await Promise.all(ids.map((aid) => this.funnel.listBrandAssets(brandId, aid)));
    const failed = overlays.find((o) => o.error);
    if (failed?.error) return dataErr(failed.error, 'Could not load your funnel pieces.');

    // Combine by brand-piece id: each avatar contributes its verdict on the same piece.
    const byId = new Map<string, { asset: BrandAsset; verdicts: Map<string, JobVerdict> }>();
    ids.forEach((aid, i) => {
      for (const a of overlays[i].data ?? []) {
        let entry = byId.get(a.id);
        if (!entry) {
          entry = { asset: a, verdicts: new Map<string, JobVerdict>() };
          byId.set(a.id, entry);
        }
        if (aid === focus) entry.asset = a; // prefer the focus avatar's row as representative
        entry.verdicts.set(aid, toJobVerdict(a.status));
      }
    });

    if (byId.size === 0) {
      return {
        status: 'no_data',
        reason: 'No funnel pieces yet — add your first active brand asset to start the map.',
      };
    }

    const pieces: FunnelPiece[] = [];
    for (const { asset, verdicts } of byId.values()) {
      const perAvatar: PieceAvatarVerdict[] = ids.map((aid) => ({
        avatarId: aid,
        avatarName: avatarNames[aid] ?? 'Customer',
        status: verdicts.get(aid) ?? 'leaking',
      }));
      pieces.push({
        ...this.toFunnelPiece(asset),
        status: weakestLinkVerdict(perAvatar.map((p) => p.status)),
        perAvatar,
      });
    }
    return { status: 'ok', data: pieces };
  }

  private toFunnelPiece(a: BrandAsset): FunnelPiece {
    const tp = getTouchpoint(a.touchpoint_id);
    const stage = a.stage as StageId;
    return {
      id: a.id,
      touchpointId: a.touchpoint_id,
      stage,
      channel: tp?.appliesWhen[0] ?? null,
      status: toJobVerdict(a.status),
      job: FUNNEL_JOBS[stage].job,
      storedContent: parseStoredContent(a),
    };
  }

  /**
   * One piece's metrics for a range (wraps `get_funnel_piece_metrics`). Reads the
   * piece's stage first so "no-data" is defined by that stage's JOB metrics, parses
   * the returned rows, derives cvr/aov from primitives, and lists the job metrics
   * still missing as `noData` ("—"). `no_data` when nothing has been pulled yet;
   * `error` on a real failure. A metric value is NEVER fabricated to fill a gap.
   */
  async getPieceMetrics(
    brandAssetId: string,
    range: MetricRange = '30d',
  ): Promise<DataResult<PieceMetrics>> {
    const asset = await this.funnel.getAsset(brandAssetId);
    if (asset.error) return dataErr(asset.error, 'Could not load that piece.');
    if (!asset.data) return dataErr(null, 'That funnel piece could not be found.');
    const stage = asset.data.stage as StageId;

    let raw: { data: unknown; error: unknown };
    try {
      raw = await this.invoke('get-funnel-piece-metrics', {
        brand_asset_id: brandAssetId,
        range,
      });
    } catch (e) {
      return dataErr(e, 'Could not reach the metrics service.');
    }
    if (raw.error) return dataErr(raw.error, 'Could not read this piece’s metrics.');

    const metrics = this.parseMetricCells(raw.data);
    this.deriveMetricCells(metrics);

    if (Object.keys(metrics).length === 0) {
      return {
        status: 'no_data',
        reason:
          'No metrics pulled for this piece yet — connect Windsor and ask Brand Coach to pull them.',
      };
    }

    const noData = FUNNEL_JOBS[stage].primaryMetrics.filter((k) => {
      const cell = metrics[k];
      return !cell || cell.value === null;
    });
    return { status: 'ok', data: { pieceId: brandAssetId, range, metrics, noData } };
  }

  /** Parse the edge metric rows into cells, dropping anything not in the vocab. */
  private parseMetricCells(data: unknown): Partial<Record<MetricKey, MetricCell>> {
    const rec = asRecord(data);
    const rows: unknown[] = Array.isArray(data)
      ? data
      : rec && Array.isArray(rec.metrics)
        ? rec.metrics
        : [];
    const out: Partial<Record<MetricKey, MetricCell>> = {};
    for (const row of rows) {
      const r = asRecord(row);
      if (!r) continue;
      const name = r.metric_name ?? r.name ?? r.key;
      if (!isMetricKey(name)) continue;
      const value = asNumber(r.metric_value ?? r.value);
      const src = r.source;
      out[name] = {
        key: name,
        value,
        source: value === null ? null : isWindsorSource(src) ? src : null,
        derived: isDerivedMetric(name),
      };
    }
    return out;
  }

  /** Derive cvr (orders ÷ clicks) and aov (revenue ÷ orders) when absent. */
  private deriveMetricCells(metrics: Partial<Record<MetricKey, MetricCell>>): void {
    const valOf = (k: MetricKey): number | null => metrics[k]?.value ?? null;
    if (!metrics.cvr || metrics.cvr.value === null) {
      const orders = valOf('orders');
      const clicks = valOf('clicks');
      if (orders !== null && clicks !== null && clicks > 0) {
        metrics.cvr = { key: 'cvr', value: orders / clicks, source: 'derived', derived: true };
      }
    }
    if (!metrics.aov || metrics.aov.value === null) {
      const revenue = valOf('revenue');
      const orders = valOf('orders');
      if (revenue !== null && orders !== null && orders > 0) {
        metrics.aov = { key: 'aov', value: revenue / orders, source: 'derived', derived: true };
      }
    }
  }

  /**
   * Add a funnel piece: create the brand_asset (upload + insert) then audit it.
   * Returns the new piece even if the audit could not run (the piece WAS added);
   * `error` only when the create itself fails. Never fabricates an audit verdict.
   */
  async addPiece(input: BrandAssetCreate): Promise<DataResult<FunnelPiece>> {
    // Create as BRAND inventory: resolve the brand from the avatar so the piece is
    // shared across the brand's avatars (not avatar-keyed). The verdict is then
    // recorded per-avatar via the overlay.
    const brandId = input.brandId ?? (input.avatarId ? await this.resolveBrandId(input.avatarId) : null);
    // Free-trial gate (safety net behind the UI gate): a non-member is held to
    // FREE_TRIAL_PIECE_LIMIT funnel pieces per brand; the rest needs membership.
    if (brandId && !(await this.checkMember())) {
      const existing = await this.funnel.listBrandAssets(brandId, null);
      const count = existing.data?.length ?? 0;
      if (count >= FREE_TRIAL_PIECE_LIMIT) {
        return {
          status: 'error',
          error: `Your free trial covers ${FREE_TRIAL_PIECE_LIMIT} funnel piece to iterate on. Become a member to map and monitor your whole funnel.`,
        };
      }
    }
    const created = await this.funnel.createAsset({ ...input, brandId: brandId ?? undefined });
    if (created.error) return dataErr(created.error, 'Could not add that funnel piece.');
    if (!created.data) return dataErr(null, 'The piece was not created.');
    const audited = input.avatarId
      ? await this.funnel.auditAssetForAvatar(created.data.id, input.avatarId)
      : { data: null };
    const asset = audited.data ?? created.data;
    return { status: 'ok', data: this.toFunnelPiece(asset) };
  }

  /**
   * Re-audit an EXISTING piece from a freshly-uploaded screenshot, scored for the
   * active avatar (in-place — no new version). Returns the piece with its fresh
   * per-avatar verdict; `error` when not scoped to an avatar or the audit fails.
   */
  async reAuditPiece(
    pieceId: string,
    file: File,
    avatarId: string | null,
  ): Promise<DataResult<FunnelPiece>> {
    if (!avatarId) {
      return { status: 'error', error: 'Pick a customer avatar to re-audit this piece for.' };
    }
    const res = await this.funnel.reAuditWithScreenshot(pieceId, file, avatarId);
    if (res.error) return dataErr(res.error, 'Could not re-audit that piece.');
    if (!res.data) return dataErr(null, 'The re-audit returned nothing.');
    return { status: 'ok', data: this.toFunnelPiece(res.data) };
  }

  /**
   * Open a test against a piece (writes to brand_tests via `recordTest`). Returns
   * the new row for the Testing-&-Lift table; `error` when the write fails.
   */
  async openTest(input: OpenTestInput): Promise<DataResult<TestRow>> {
    const { data, error } = await this.funnel.recordTest({
      assetId: input.pieceId,
      hypothesis: input.hypothesis,
      metricType: input.metric,
      baselineValue: input.baseline,
    });
    if (error) return dataErr(error, 'Could not open that test.');
    if (!data) return dataErr(null, 'The test was not created.');
    return { status: 'ok', data: toTestRow(data, input.pieceLabel, input.name ?? input.hypothesis) };
  }

  /**
   * Every test for an avatar (wraps `getAssetRoi`), joined to its piece label.
   * `no_data` when none are open yet; `error` when not scoped / the read fails.
   */
  async listTests(avatarId: string | null): Promise<DataResult<TestRow[]>> {
    if (!avatarId) return { status: 'error', error: 'Pick a customer avatar to load its tests.' };
    const brandId = await this.resolveBrandId(avatarId);
    if (!brandId) return dataErr(null, 'Could not resolve your brand for tests.');
    // Tests span the brand's pieces (brand-scoped); piece labels from the same set.
    const [roi, assets] = await Promise.all([
      this.funnel.getAssetRoiForBrand(brandId),
      this.funnel.listBrandAssets(brandId, avatarId),
    ]);
    if (roi.error) return dataErr(roi.error, 'Could not load your tests.');
    const tests = roi.data ?? [];
    if (tests.length === 0) {
      return {
        status: 'no_data',
        reason: 'No tests opened yet — open one from a funnel piece to track its lift.',
      };
    }
    const labelById = new Map<string, string>();
    for (const a of assets.data ?? []) {
      labelById.set(a.id, getTouchpoint(a.touchpoint_id)?.label ?? a.touchpoint_id);
    }
    return {
      status: 'ok',
      data: tests.map((t) =>
        toTestRow(t, labelById.get(t.asset_id) ?? t.asset_id, t.hypothesis ?? 'Untitled test'),
      ),
    };
  }

  /**
   * Stamp one experiment-lifecycle milestone date on a brand_test (RLS owner-scoped
   * update). The `asset_created_at` / `asset_live_at` columns are added by the
   * additive campaign/analytics migration and are not in the generated Database
   * types, so we write through an untyped view of the client. Idempotent — re-stamps
   * to "now"; returns `error` (honest) when the write fails, never a silent success.
   */
  private async stampMilestone(
    testId: string,
    column: 'asset_created_at' | 'asset_live_at',
  ): Promise<DataResult<{ id: string }>> {
    try {
      const now = new Date().toISOString();
      const untyped = supabase as unknown as SupabaseClient;
      const { error } = await untyped
        .from('brand_tests')
        .update({ [column]: now, updated_at: now })
        .eq('id', testId);
      if (error) return dataErr(error, 'Could not update the test milestone.');
      return { status: 'ok', data: { id: testId } };
    } catch (e) {
      return dataErr(e, 'Could not update the test milestone.');
    }
  }

  /** Stamp the ASSET_CREATED milestone (the experiment's asset was built). */
  async markAssetCreated(testId: string): Promise<DataResult<{ id: string }>> {
    return this.stampMilestone(testId, 'asset_created_at');
  }

  /** Stamp the ASSET_LIVE milestone (the asset went live — starts the re-measure clock). */
  async markAssetLive(testId: string): Promise<DataResult<{ id: string }>> {
    return this.stampMilestone(testId, 'asset_live_at');
  }
}

/** Default instance the screens + integrator import. */
export const fixService = new FixService();

// Standalone function seam (delegates to the default instance) for ergonomic
// imports in screens that don't need a custom invoker.
export const getFunnelMap = (
  avatarId: string | null,
  brandTags: ApplicabilityTag[],
): Promise<FixResult<FunnelMapView>> => fixService.getFunnelMap(avatarId, brandTags);
export const getWorkItems = (
  avatarId: string | null,
  brandTags: ApplicabilityTag[],
): Promise<FixResult<WorkItem[]>> => fixService.getWorkItems(avatarId, brandTags);
export const getAssetDetail = (assetId: string | null): Promise<FixResult<AssetDetail>> =>
  fixService.getAssetDetail(assetId);
export const checkAsset = (assetId: string): Promise<FixResult<AssetDetail>> =>
  fixService.checkAsset(assetId);
export const generateBrief = (input: {
  touchpointId: string;
  avatarId: string;
  context?: string;
}): Promise<FixResult<BriefSlots>> => fixService.generateBrief(input);
export const persistSignature = (
  input: PersistSignatureInput,
): Promise<FixResult<{ signatureId: string }>> => fixService.persistSignature(input);
export const getDrift = (avatarId: string | null): Promise<FixResult<DriftItem[]>> =>
  fixService.getDrift(avatarId);
export const getFunnelPieces = (avatarId: string | null): Promise<DataResult<FunnelPiece[]>> =>
  fixService.getFunnelPieces(avatarId);
export const getPieceMetrics = (
  brandAssetId: string,
  range?: MetricRange,
): Promise<DataResult<PieceMetrics>> => fixService.getPieceMetrics(brandAssetId, range);
export const addPiece = (input: BrandAssetCreate): Promise<DataResult<FunnelPiece>> =>
  fixService.addPiece(input);
export const reAuditPiece = (
  pieceId: string,
  file: File,
  avatarId: string | null,
): Promise<DataResult<FunnelPiece>> => fixService.reAuditPiece(pieceId, file, avatarId);
export const openTest = (input: OpenTestInput): Promise<DataResult<TestRow>> =>
  fixService.openTest(input);
export const listTests = (avatarId: string | null): Promise<DataResult<TestRow[]>> =>
  fixService.listTests(avatarId);
export const markAssetCreated = (testId: string): Promise<DataResult<{ id: string }>> =>
  fixService.markAssetCreated(testId);
export const markAssetLive = (testId: string): Promise<DataResult<{ id: string }>> =>
  fixService.markAssetLive(testId);

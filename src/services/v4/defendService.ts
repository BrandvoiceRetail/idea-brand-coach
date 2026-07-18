/**
 * defendService — Layer-3 execution seam for Loop-5 (Defend).
 *
 * WHAT: Thin, typed wrappers behind the Defend screens — `getStatus` (the
 * Positioning Statement-drift watch + a deterministic defend checklist derived from real
 * loop signals) and `exportWorkbook` (the full-loop workbook via the live
 * `export_workbook` engine). Each async method returns a `DefendResult<T>`
 * discriminated `ok | needs_input | error`.
 *
 * WHY: This is the single seam the Defend screens (DriftWatchCard,
 * DefendChecklist, CompetitorTeaserCard, WorkbookExportCard) and the run-hook
 * integrator share, so they never call edge functions / RLS tables directly or
 * drift on payload shapes. Modeled on `fixService` / `remeasureService`: the
 * drift reader, lift reader, and edge invoker are INJECTABLE so tests drive the
 * ok / needs_input / error branches without a network.
 *
 * NO FABRICATION:
 *  - Drift is the real Loop-3 `getDrift` read (assets aligned to an OLDER
 *    Positioning Statement). Zero drift is a real "done", not a hidden gap.
 *  - The checklist `state` is computed from those real reads; the competitor row
 *    is `coming` (competitor reads are deferred in Alpha) — never `done`/
 *    `attention` against invented competitor data.
 *  - The workbook export invokes the live `export_workbook` engine; until that
 *    surface is wired from this app it returns an honest error/needs_input — a
 *    download link is never fabricated.
 *
 * Observability lives in the SCREENS (PostHog events), not this seam — the same
 * split as the other v4 services.
 */
import { supabase } from '@/integrations/supabase/client';
import { getDrift as defaultGetDrift, getFunnelPieces as defaultGetPieces } from '@/services/v4/fixService';
import { getTrustGapLift as defaultGetLift } from '@/services/v4/remeasureService';
import type { FixResult } from '@/types/v4Fix';
import type { RemeasureResult, TrustGapLift } from '@/types/v4Remeasure';
import type {
  DefendAvatarStatus,
  DefendChecklistItem,
  DefendResult,
  DefendStatus,
  DefendVerdict,
  DriftItem,
  WorkbookExport,
} from '@/types/v4Defend';

/** Injectable edge invoker (defaults to the deployed Supabase edge functions). */
export type EdgeInvoke = (
  fn: string,
  body: unknown,
) => Promise<{ data: unknown; error: unknown }>;

/** Reads the real Positioning Statement-drift list for an avatar (defaults to Loop-3 getDrift). */
export type DriftReader = (avatarId: string | null) => Promise<FixResult<DriftItem[]>>;

/** Reads the real before/after Trust Gap lift (defaults to Loop-4 getTrustGapLift). */
export type LiftReader = (avatarId: string | null) => Promise<RemeasureResult<TrustGapLift>>;

/**
 * Reports whether the avatar has a real baseline to defend — at least one ALIGNED
 * asset. An aligned asset can only exist once it was audited against a Positioning Statement,
 * so a single aligned piece is concrete proof of BOTH real aligned assets and a
 * Positioning Statement; it is NEVER inferred from an empty drift list.
 */
export type BaselineReader = (avatarId: string) => Promise<boolean>;

const defaultEdgeInvoke: EdgeInvoke = async (fn, body) => {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  return { data, error };
};

/** Real baseline check: the avatar has something to defend only once a piece is aligned. */
const defaultReadBaseline: BaselineReader = async (avatarId) => {
  const res = await defaultGetPieces(avatarId);
  return res.status === 'ok' && res.data.some((p) => p.status === 'doing_job');
};

// ── value guards ────────────────────────────────────────────────────────────────
const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const errResult = (e: unknown, fallback: string): DefendResult<never> => ({
  status: 'error',
  error: e instanceof Error ? e.message : fallback,
});

/** Ask for an avatar — the one universal `needs_input` for this loop. */
const needAvatar = (): DefendResult<never> => ({
  status: 'needs_input',
  needs_input: [
    {
      slot: 0,
      question: 'Which customer avatar are we defending the gains for?',
      why: 'The drift watch and workbook are scoped to one avatar — I will not guess which.',
    },
  ],
});

export class DefendService {
  constructor(
    private readonly readDrift: DriftReader = defaultGetDrift,
    private readonly readLift: LiftReader = defaultGetLift,
    private readonly invoke: EdgeInvoke = defaultEdgeInvoke,
    private readonly readBaseline: BaselineReader = defaultReadBaseline,
  ) {}

  /**
   * The Defend status: the real Positioning Statement-drift watch + whether the lift was
   * confirmed (a second real diagnostic run exists) + the derived checklist.
   * `needs_input` when there is no avatar; `error` if the drift read fails. The
   * lift read degrading to needs_input/error is folded into `liftConfirmed:
   * false` (an honest "not yet"), never a fabricated confirmation.
   */
  async getStatus(avatarId: string | null): Promise<DefendResult<DefendStatus>> {
    if (!avatarId) return needAvatar();

    const driftRes = await this.readDrift(avatarId);
    if (driftRes.status === 'error') {
      return errResult(driftRes.error, 'Could not read your assets for drift.');
    }
    const items: DriftItem[] = driftRes.status === 'ok' ? driftRes.data : [];

    // The lift read is best-effort: only an `ok` result confirms the lift. Any
    // degradation (needs a second run, or a read error) is an honest "not yet".
    let liftConfirmed = false;
    try {
      const liftRes = await this.readLift(avatarId);
      liftConfirmed = liftRes.status === 'ok';
    } catch {
      liftConfirmed = false;
    }

    // Is there anything real to defend? Only true once an asset is ALIGNED (which
    // requires a Positioning Statement). A read failure degrades to an honest "nothing yet".
    let hasBaseline = false;
    try {
      hasBaseline = await this.readBaseline(avatarId);
    } catch {
      hasBaseline = false;
    }

    return {
      status: 'ok',
      data: {
        drift: { items, count: items.length },
        liftConfirmed,
        hasBaseline,
        checklist: buildChecklist(items.length, liftConfirmed, hasBaseline),
      },
    };
  }

  /**
   * The Defend status across a SET of customers (multi-avatar Defend). Reads each
   * customer's real `getStatus` (drift + lift + baseline) — N calls of the same
   * per-avatar contract, no schema/edge change — then rolls up the weakest link:
   *   - drift   = UNION of the per-customer drifted assets by id (a piece that
   *               drifted for ANY selected customer surfaces once);
   *   - lift    = confirmed only when confirmed for EVERY customer;
   *   - baseline= there is something to defend if ANY customer has a baseline.
   * The checklist is rebuilt from those rolled-up signals via the existing
   * `buildChecklist`, and `perAvatar` exposes each customer's own posture.
   * A single-id set delegates to `getStatus` (the focus path, byte-identical). A
   * per-avatar read that errors fails the set honestly — never a partial fabrication.
   */
  async getStatusForSet(
    avatarIds: string[],
    avatarNames: Record<string, string>,
  ): Promise<DefendResult<DefendStatus>> {
    const ids = [...new Set(avatarIds)].filter(Boolean);
    if (ids.length === 0) return needAvatar();
    if (ids.length === 1) return this.getStatus(ids[0]);

    const results = await Promise.all(ids.map((id) => this.getStatus(id)));

    // Any per-avatar read that errored fails the set honestly (no partial data).
    const errored = results.find((r) => r.status === 'error');
    if (errored && errored.status === 'error') {
      return errResult(errored.error, 'Could not read your assets for drift.');
    }

    // A customer not yet diagnosed returns `needs_input`. Rolling its null status
    // into the set would fabricate a settled "nothing to defend" (verdict 'none')
    // posture — so surface the needs_input honestly ("diagnose this customer
    // first") instead of inventing a clean bill of health.
    const needsInput = results.find((r) => r.status === 'needs_input');
    if (needsInput) return needsInput;

    const dataOf = (r: DefendResult<DefendStatus>): DefendStatus | null =>
      r.status === 'ok' ? r.data : null;

    // Drift across the set = UNION by asset id (the weakest link surfaces once).
    const byAsset = new Map<string, DriftItem>();
    for (const r of results) {
      for (const item of dataOf(r)?.drift.items ?? []) {
        if (!byAsset.has(item.assetId)) byAsset.set(item.assetId, item);
      }
    }
    const unionItems = [...byAsset.values()];
    const liftConfirmed = results.every((r) => dataOf(r)?.liftConfirmed === true);
    const hasBaseline = results.some((r) => dataOf(r)?.hasBaseline === true);

    const perAvatar: DefendAvatarStatus[] = ids.map((id, i) => {
      const d = dataOf(results[i]);
      const driftCount = d?.drift.count ?? 0;
      const baseline = d?.hasBaseline ?? false;
      return {
        avatarId: id,
        avatarName: avatarNames[id] ?? 'Customer',
        driftCount,
        hasBaseline: baseline,
        liftConfirmed: d?.liftConfirmed ?? false,
        verdict: defendVerdict(driftCount, baseline),
      };
    });

    return {
      status: 'ok',
      data: {
        drift: { items: unionItems, count: unionItems.length },
        liftConfirmed,
        hasBaseline,
        checklist: buildChecklist(unionItems.length, liftConfirmed, hasBaseline),
        perAvatar,
      },
    };
  }

  /**
   * Export the full-loop workbook via the live `export_workbook` engine. Passes
   * through the engine's `needs_input` (e.g. "run the marketing audit first")
   * unchanged. Returns a real `downloadUrl` only when the engine provides one —
   * never a fabricated link.
   */
  async exportWorkbook(avatarId: string | null): Promise<DefendResult<WorkbookExport>> {
    if (!avatarId) return needAvatar();
    try {
      const { data, error } = await this.invoke('export-workbook', { avatar_id: avatarId });
      if (error) return errResult(error, 'Could not reach the workbook engine.');
      const rec = asRecord(data);
      if (!rec) return errResult(null, 'The workbook engine returned nothing usable.');

      // Pass through an engine-side grounding demand unchanged.
      if (Array.isArray(rec.needs_input) && rec.needs_input.length > 0) {
        return {
          status: 'needs_input',
          needs_input: rec.needs_input as DefendResult<never>['needs_input'],
        };
      }

      const note =
        asString(rec.note) ??
        asString(rec.message) ??
        'Your full-loop workbook is ready.';
      const downloadUrl =
        asString(rec.download_url) ?? asString(rec.url) ?? asString(rec.signed_url);
      return { status: 'ok', data: { note, downloadUrl: downloadUrl ?? null } };
    } catch (e) {
      return errResult(e, 'Could not reach the workbook engine.');
    }
  }
}

/**
 * The deterministic per-customer Defend verdict from real signals (pure, no I/O):
 * any drift → `drifted`; else a real baseline → `holding`; else `none` (nothing to
 * defend yet). Never fabricates a state — a `none` says "no baseline", not a green.
 */
export function defendVerdict(driftCount: number, hasBaseline: boolean): DefendVerdict {
  if (driftCount > 0) return 'drifted';
  if (hasBaseline) return 'holding';
  return 'none';
}

/**
 * Build the deterministic defend checklist from real signals. Pure (no I/O) so
 * it is trivially testable and never fabricates a state: the competitor row is
 * always `coming` (deferred in Alpha), drift maps real count → done/attention,
 * and the lift row reflects the real before/after read.
 */
export function buildChecklist(
  driftCount: number,
  liftConfirmed: boolean,
  hasBaseline = true,
): DefendChecklistItem[] {
  return [
    {
      key: 'lift',
      label: 'Lift confirmed on a real re-run',
      detail: liftConfirmed
        ? 'A second diagnostic run is in — your before/after is grounded in real numbers.'
        : 'Re-run the diagnostic in Re-measure so the lift is proven, not assumed.',
      state: liftConfirmed ? 'done' : 'pending',
    },
    {
      key: 'drift',
      label: 'No assets drifted from your positioning',
      detail: !hasBaseline
        ? 'Nothing aligned to your positioning yet — work a fix first and I will watch it for drift.'
        : driftCount === 0
          ? 'Every aligned asset still matches your current Positioning Statement.'
          : `${driftCount} asset${driftCount === 1 ? '' : 's'} built against an older Positioning Statement — re-check ${driftCount === 1 ? 'it' : 'them'} in Fix.`,
      state: !hasBaseline ? 'pending' : driftCount === 0 ? 'done' : 'attention',
    },
    {
      key: 'competitor',
      label: 'Watch competitive pressure',
      detail:
        'Competitor monitoring is coming. Until it is live I will not show competitor data I have not actually pulled.',
      state: 'coming',
    },
    {
      key: 'workbook',
      label: 'File your full-loop workbook',
      detail: 'Export the workbook below to bank the whole Diagnose → Defend run.',
      state: 'pending',
    },
  ];
}

/** Default instance the screens + integrator import. */
export const defendService = new DefendService();

// Standalone function seam (delegates to the default instance) for ergonomic
// imports in screens that don't need custom readers.
export const getDefendStatus = (avatarId: string | null): Promise<DefendResult<DefendStatus>> =>
  defendService.getStatus(avatarId);
export const getDefendStatusForSet = (
  avatarIds: string[],
  avatarNames: Record<string, string>,
): Promise<DefendResult<DefendStatus>> => defendService.getStatusForSet(avatarIds, avatarNames);
export const exportWorkbook = (avatarId: string | null): Promise<DefendResult<WorkbookExport>> =>
  defendService.exportWorkbook(avatarId);

/**
 * FunnelMap (S-12, Funnel-by-Job) — "Your funnel — is each piece doing its job?"
 *
 * WHAT: A presentational, read-only map of the brand's funnel rendered in the
 * job-first language of the v4 mockup. ONE funnel piece = one active brand asset
 * (decision #1), grouped by customer-journey stage in journey order. Each piece
 * card LEADS WITH ITS JOB (from `FUNNEL_JOBS[stage]`), shows a message-continuity
 * chip (↗ holds / ⚠ breaks — derived from the piece's verdict), the 2–3 metrics
 * that actually measure that stage's job (from `FUNNEL_JOBS[stage].primaryMetrics`,
 * read from `metricsByPiece`), and a one-line verdict (✓ doing job / ⚠ leaking /
 * off-brand / missing). Above the stages: a "funnel doing its job" coverage meter
 * and a 4-stat strip (doing job / leaking / off-brand / missing), both derived
 * from the real pieces — never fabricated. A toolbar restores the v2 funnel
 * selections: marketplace / avatar / range selectors, channel filter chips, and
 * an "Add piece" button.
 *
 * WHY: Loop-3 is the spine's "do the work" leg — you can only fix what you can
 * see, and each piece is judged by ITS job, not a generic score. Like the rest of
 * /v4 it NEVER fabricates: a metric with no backing source renders an honest "—",
 * a piece with no asset shows an explicit `missing` slot (tapping it routes to Add
 * a piece), no data at all shows an honest empty state, and a failed read shows a
 * retry — never an invented map or number.
 *
 * Presentational only — the parent/integrator owns the read wiring
 * (`getFunnelPieces` / `getPieceMetrics`) and what "Add piece" opens.
 * Observability: PostHog funnel events fire on first view, on opening a
 * piece, on the toolbar actions, and on channel filtering. Mobile: cards stack to
 * one column at 375px (0 horizontal overflow); all taps are ≥40px.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapIcon, ChevronRight, AlertCircle, RotateCw, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { captureAlphaEvent, type AlphaEventProps } from '@/lib/posthogClient';
import { formatMetricValue } from '@/lib/formatMetric';
import { STAGES, getTouchpoint, type StageId } from '@/config/touchpointTaxonomy';
import {
  FUNNEL_JOBS,
  METRIC_META,
  type MetricKey,
} from '@/config/v4Funnel';
import type { FunnelPiece, JobVerdict, MetricRange, PieceMetrics } from '@/types/v4Fix';
import { FUNNEL_MAP_EVENTS, type FunnelMapEvent } from './funnelMapEvents';

function emitFunnel(name: FunnelMapEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

// ── Job-verdict display vocabulary (Tier-A; v23 status tokens) ─────────────────

interface VerdictMeta {
  /** Status pill text (top-right of the card). */
  pill: string;
  pillClass: string;
  /** One-line verdict shown beside the metrics. */
  verdict: string;
  verdictClass: string;
}

const VERDICT_META: Record<JobVerdict, VerdictMeta> = {
  doing_job: {
    pill: 'Doing job',
    pillClass: 'bg-idea-d/10 text-idea-d',
    verdict: '✓ doing its job',
    verdictClass: 'text-idea-d',
  },
  leaking: {
    pill: 'Leaking',
    pillClass: 'bg-gold-light text-gold-warm',
    verdict: '⚠ leaking',
    verdictClass: 'text-gold-warm',
  },
  off_brand: {
    pill: 'Off-brand',
    pillClass: 'bg-destructive/10 text-destructive',
    verdict: '⚠ off-brand',
    verdictClass: 'text-destructive',
  },
  missing: {
    pill: 'Missing',
    pillClass: 'bg-muted text-muted-foreground',
    verdict: 'not built yet',
    verdictClass: 'text-muted-foreground',
  },
};

/** Stage dot colours mirror the IDEA pillar palette used across /v4. */
const STAGE_DOT: Record<StageId, string> = {
  awareness: 'bg-idea-i',
  consideration: 'bg-idea-e',
  purchase_decision: 'bg-idea-e',
  retention: 'bg-idea-a',
  advocacy: 'bg-idea-d',
};

// ── Channel filter chips (restored v2 selection) ──────────────────────────────

const CHANNELS = ['amazon', 'tiktok', 'email', 'website', 'social'] as const;
type ChannelChip = (typeof CHANNELS)[number];
const CHANNEL_LABEL: Record<ChannelChip, string> = {
  amazon: 'Amazon',
  tiktok: 'TikTok',
  email: 'Email',
  website: 'Website',
  social: 'Social',
};

/**
 * Map a piece's channel tag to a filter chip. Returns null for tags we can't
 * honestly classify — those pieces are NEVER hidden by the channel filter.
 */
function channelBucket(channel: string | null): ChannelChip | null {
  switch (channel) {
    case 'amazon':
      return 'amazon';
    case 'email':
      return 'email';
    case 'shopify':
    case 'dtc_site':
      return 'website';
    case 'organic_social':
    case 'paid_social':
    case 'founder':
      return 'social';
    case 'tiktok':
    case 'tiktok_shop':
      return 'tiktok';
    default:
      return null;
  }
}

// ── Metric formatting (honest "—" when no value) ──────────────────────────────

const RANGES: readonly MetricRange[] = ['7d', '30d', '90d'] as const;
const RANGE_LABEL: Record<MetricRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

// Metric formatting now lives in the shared `@/lib/formatMetric` (imported above)
// so FunnelMap and FunnelPieceDetail can never drift on the percent ×100 scaling.

// ── Roll-up counts (derived from the pieces, never fabricated) ─────────────────

type VerdictCounts = Record<JobVerdict, number>;

function countByVerdict(pieces: FunnelPiece[]): VerdictCounts {
  const c: VerdictCounts = { doing_job: 0, leaking: 0, off_brand: 0, missing: 0 };
  pieces.forEach((p) => {
    c[p.status] += 1;
  });
  return c;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** "Funnel doing its job" meter — gold bar over a muted track; honest 0% at empty. */
function CoverageMeter({ pct }: { pct: number }): JSX.Element {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="min-w-[200px] flex-1" data-testid="funnel-coverage-meter">
      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-foreground">
        <span>Funnel doing its job</span>
        <span data-testid="funnel-coverage-value">{clamped}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Funnel doing its job"
      >
        <div
          className="h-full rounded-full bg-gold-warm transition-[width] duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

/** One cell of the 4-stat summary row. */
function StatCell({
  testId,
  value,
  label,
  accent,
}: {
  testId: string;
  value: number;
  label: string;
  accent: string;
}): JSX.Element {
  return (
    <div className="text-center" data-testid={testId}>
      <div className={`text-xl font-bold leading-none ${accent}`}>{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/** A select styled to the v23 toolbar (presentational scoping control). */
function ToolbarSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
}): JSX.Element {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-9 rounded-md border border-border bg-muted px-2 py-1 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The 2–3 job metrics for a piece — honest "—" when no value backs a metric. */
function JobMetrics({
  metricKeys,
  metrics,
}: {
  metricKeys: MetricKey[];
  metrics: PieceMetrics | undefined;
}): JSX.Element {
  return (
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3">
      {metricKeys.map((key) => {
        const cell = metrics?.metrics[key];
        const hasValue = cell != null && cell.value !== null;
        return (
          <div key={key} className="flex flex-col" data-testid={`funnel-metric-${key}`}>
            <span
              className={
                hasValue
                  ? 'text-base font-bold leading-none text-foreground'
                  : 'text-sm font-bold leading-none text-muted-foreground'
              }
            >
              {hasValue ? formatMetricValue(cell.value as number, METRIC_META[key].format) : '—'}
            </span>
            <span className="mt-1 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              {METRIC_META[key].label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** One funnel piece card — job-first. */
function PieceCard({
  piece,
  metrics,
  onOpen,
}: {
  piece: FunnelPiece;
  metrics: PieceMetrics | undefined;
  onOpen: (piece: FunnelPiece) => void;
}): JSX.Element {
  const meta = VERDICT_META[piece.status];
  const job = FUNNEL_JOBS[piece.stage];
  const label = getTouchpoint(piece.touchpointId)?.label ?? piece.touchpointId;
  // Continuity is the message-handoff signal, derived from the verdict: a piece
  // doing its job holds the message; a leaking / off-brand piece breaks it.
  const continuity =
    piece.status === 'doing_job'
      ? { text: '↗ holds the message', cls: 'bg-idea-d/10 text-idea-d' }
      : piece.status === 'missing'
        ? null
        : { text: '⚠ message breaks', cls: 'bg-gold-light text-gold-warm' };

  return (
    <button
      type="button"
      data-testid={`funnel-piece-${piece.id}`}
      onClick={() => onOpen(piece)}
      className="relative flex min-h-10 w-full flex-col rounded-lg border border-border bg-background p-3 text-left shadow-sm transition-colors hover:border-gold-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${meta.pillClass}`}
        data-testid={`funnel-piece-status-${piece.id}`}
      >
        {meta.pill}
      </span>
      <span className="pr-20 text-sm font-bold text-foreground">{label}</span>
      {piece.channel && (
        <span className="mt-0.5 text-[11px] text-muted-foreground">{piece.channel}</span>
      )}

      <span className="mt-2 flex gap-1.5 text-[11.5px] text-foreground/80">
        <span className="shrink-0 font-bold text-gold-warm">JOB</span>
        <span>{piece.job || job.job}</span>
      </span>

      {continuity && (
        <span
          className={`mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${continuity.cls}`}
          data-testid={`funnel-piece-continuity-${piece.id}`}
        >
          {continuity.text}
        </span>
      )}

      <div className="flex items-end">
        <JobMetrics metricKeys={job.primaryMetrics} metrics={metrics} />
        <span
          className={`ml-auto self-end pb-0.5 pl-2 text-right text-[10.5px] font-bold ${meta.verdictClass}`}
          data-testid={`funnel-piece-verdict-${piece.id}`}
        >
          {meta.verdict}
        </span>
      </div>

      <ChevronRight
        className="absolute bottom-3 right-3 h-4 w-4 text-muted-foreground"
        aria-hidden="true"
      />
    </button>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

/** One avatar option for the toolbar scope selector. */
export interface FunnelAvatarOption {
  id: string;
  name: string;
}

export interface FunnelMapProps {
  /** Funnel pieces (one active brand asset each); `null` while the read is in flight. */
  pieces: FunnelPiece[] | null;
  /** pieceId → its metrics for the active range; absent ⇒ honest "—" for that piece. */
  metricsByPiece?: Record<string, PieceMetrics | undefined>;
  /** Explicit loading flag — also implied by `pieces === null`. */
  loading?: boolean;
  /** Hard error message when the read failed (couldn't reach the coach). */
  error?: string | null;
  /** "Funnel doing its job" %; null ⇒ derive doing_job ÷ total (0% when empty). */
  coveragePct?: number | null;
  /**
   * Avatar scope (restored v2 selection). The whole funnel is scoped to one
   * avatar; selecting another re-scopes via {@link onAvatarChange}. Omit/empty to
   * hide the selector. `selectedAvatarId` is the focus avatar (AvatarContext).
   */
  avatars?: FunnelAvatarOption[];
  selectedAvatarId?: string | null;
  /** Switch the active avatar (parent calls AvatarContext.setCurrentAvatar). */
  onAvatarChange?: (avatarId: string) => void;
  /** Marketplace scope (controlled; parent owns the value). */
  marketplace?: string;
  /** Change the marketplace scope. */
  onMarketplaceChange?: (marketplace: string) => void;
  /** Metric range (controlled; parent threads it into the piece-metrics read). */
  range?: MetricRange;
  /** Change the metric range. */
  onRangeChange?: (range: MetricRange) => void;
  /** Open a piece's detail. The argument is the backing brand_asset id. */
  onSelectPiece: (brandAssetId: string) => void;
  /** Start adding a new funnel piece (parent opens the Add-a-piece dialog). */
  onAddPiece?: () => void;
  /** Retry the read after an error. */
  onRetry?: () => void;
}

export function FunnelMap({
  pieces,
  metricsByPiece,
  loading = false,
  error = null,
  coveragePct = null,
  avatars = [],
  selectedAvatarId = null,
  onAvatarChange,
  marketplace = 'amazon_us',
  onMarketplaceChange,
  range = '30d',
  onRangeChange,
  onSelectPiece,
  onAddPiece,
  onRetry,
}: FunnelMapProps): JSX.Element {
  const isLoading = loading || pieces === null;
  const isEmpty = !isLoading && !error && (pieces?.length ?? 0) === 0;

  // ── Channel-chip filter is the only LOCAL toolbar state; marketplace / range /
  // avatar are controlled by the parent so they drive real reads (no dead control). ──
  const [activeChannels, setActiveChannels] = useState<Set<ChannelChip>>(
    () => new Set(CHANNELS),
  );

  // ── Channel filter: pieces with an unclassifiable channel are never hidden ──
  const visiblePieces = useMemo<FunnelPiece[]>(() => {
    if (!pieces) return [];
    return pieces.filter((p) => {
      const bucket = channelBucket(p.channel);
      return bucket === null || activeChannels.has(bucket);
    });
  }, [pieces, activeChannels]);

  // ── Honest roll-up from ALL pieces (not the channel-filtered view) ──
  const counts = useMemo<VerdictCounts>(
    () => countByVerdict(pieces ?? []),
    [pieces],
  );
  const total = pieces?.length ?? 0;
  const derivedCoverage = total > 0 ? Math.round((counts.doing_job / total) * 100) : 0;
  const displayCoverage = coveragePct ?? derivedCoverage;

  // ── Pieces grouped by stage, in journey order ──
  const stageGroups = useMemo(
    () =>
      STAGES.map((s) => ({
        stage: s,
        pieces: visiblePieces.filter((p) => p.stage === s.id),
      })).filter((g) => g.pieces.length > 0),
    [visiblePieces],
  );

  // ── Observability: fire once when a real map is shown ──
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!isLoading && !error && total > 0 && !viewedRef.current) {
      viewedRef.current = true;
      emitFunnel(FUNNEL_MAP_EVENTS.VIEWED, {
        piece_count: total,
        coverage_pct: coveragePct,
        doing_job: counts.doing_job,
        leaking: counts.leaking,
        off_brand: counts.off_brand,
        missing: counts.missing,
      });
    }
  }, [isLoading, error, total, coveragePct, counts]);

  const openPiece = (piece: FunnelPiece): void => {
    // A missing slot has no asset to open — route to Add a piece instead of
    // opening an empty detail (and never fabricate an asset id).
    if (piece.status === 'missing') {
      emitFunnel(FUNNEL_MAP_EVENTS.ADD_PIECE, { from: 'missing_slot' });
      onAddPiece?.();
      return;
    }
    emitFunnel(FUNNEL_MAP_EVENTS.PIECE_OPENED, {
      piece_id: piece.id,
      status: piece.status,
      has_metrics: Boolean(metricsByPiece?.[piece.id]),
    });
    onSelectPiece(piece.id);
  };

  const handleAddPiece = (): void => {
    emitFunnel(FUNNEL_MAP_EVENTS.ADD_PIECE, { from: 'toolbar' });
    onAddPiece?.();
  };

  const toggleChannel = (chip: ChannelChip): void => {
    setActiveChannels((prev) => {
      const next = new Set(prev);
      const willEnable = !next.has(chip);
      if (willEnable) next.add(chip);
      else next.delete(chip);
      emitFunnel(FUNNEL_MAP_EVENTS.CHANNEL_FILTERED, { channel: chip, enabled: willEnable });
      return next;
    });
  };

  const handleRetry = (): void => {
    emitFunnel(FUNNEL_MAP_EVENTS.RETRY, {});
    onRetry?.();
  };

  // ── The avatar picker is the ONLY way to re-scope the map to a different customer
  // Avatar. It must stay reachable in EVERY state (error/empty included): an active
  // avatar with no pieces would otherwise trap the user on the empty state with no
  // way to switch. Defined once here, used by the toolbar AND the error/empty cards. ──
  const avatarPicker =
    avatars.length > 0 ? (
      <ToolbarSelect
        label="Avatar"
        value={selectedAvatarId ?? ''}
        onChange={(v) => {
          if (!v || v === selectedAvatarId) return;
          emitFunnel(FUNNEL_MAP_EVENTS.AVATAR_CHANGED, { avatar_id: v });
          onAvatarChange?.(v);
        }}
        options={avatars.map((a) => ({ value: a.id, label: a.name }))}
      />
    ) : null;

  // ── Error: honest "couldn't reach the coach" + retry, never a faked map ──
  if (error) {
    return (
      <Card data-testid="funnel-map">
        <CardContent className="py-6">
          {avatarPicker && (
            <div className="mb-4 flex justify-end" data-testid="funnel-map-avatar-switch">
              {avatarPicker}
            </div>
          )}
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground" data-testid="funnel-map-error">
              {error}
            </p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={handleRetry} data-testid="funnel-map-retry">
                <RotateCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Loading: skeleton cards, no numbers ──
  if (isLoading) {
    return (
      <Card data-testid="funnel-map">
        <CardContent className="grid gap-3 py-6 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2" data-testid="funnel-map-loading">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-8 w-1/2" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // ── Empty: no pieces mapped yet — explicit, never invented ──
  if (isEmpty) {
    return (
      <Card data-testid="funnel-map">
        <CardContent className="py-6">
          {avatarPicker && (
            <div className="mb-4 flex justify-end" data-testid="funnel-map-avatar-switch">
              {avatarPicker}
            </div>
          )}
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <MapIcon className="h-8 w-8 text-muted-foreground" />
            <p className="max-w-prose text-sm text-muted-foreground" data-testid="funnel-map-empty">
              No funnel pieces yet for this avatar. Switch avatar above, or add your active brand
              assets — your listing, ads, emails, packaging — and each will appear here in journey
              order, judged by its own job. Nothing is invented.
            </p>
            {onAddPiece && (
              <Button variant="brand" size="sm" className="gap-1.5" onClick={handleAddPiece}>
                <Plus className="h-4 w-4" />
                Add a piece
              </Button>
            )}
            <p className="max-w-prose text-xs text-muted-foreground" data-testid="funnel-map-empty-metrics-hint">
              Metrics appear here once your coach pulls them in Claude.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Populated map ──
  return (
    <Card data-testid="funnel-map">
      <CardContent className="space-y-4 py-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
            <MapIcon className="h-5 w-5 text-gold-warm" />
            Your funnel — is each piece doing its job?
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Every active brand asset, in journey order. Each shows the 2–3 numbers that say whether
            it did <em>its</em> job: held the message from the step before, and moved the customer to
            the next step.
          </p>
        </div>

        {/* Toolbar — restored v2 selections + the two map actions */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-background p-3"
          data-testid="funnel-toolbar"
        >
          <ToolbarSelect
            label="Marketplace"
            value={marketplace}
            onChange={(v) => {
              emitFunnel(FUNNEL_MAP_EVENTS.MARKETPLACE_CHANGED, { marketplace: v });
              onMarketplaceChange?.(v);
            }}
            options={[
              { value: 'amazon_us', label: 'Amazon US' },
              { value: 'amazon_uk', label: 'Amazon UK' },
              { value: 'tiktok_shop', label: 'TikTok Shop' },
              { value: 'website', label: 'Website (DTC)' },
            ]}
          />
          {avatarPicker}
          <ToolbarSelect
            label="Range"
            value={range}
            onChange={(v) => {
              emitFunnel(FUNNEL_MAP_EVENTS.RANGE_CHANGED, { range: v });
              onRangeChange?.(v as MetricRange);
            }}
            options={RANGES.map((r) => ({ value: r, label: RANGE_LABEL[r] }))}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Channels
            </span>
            <div className="flex flex-wrap gap-1" data-testid="funnel-channel-chips">
              {CHANNELS.map((chip) => {
                const on = activeChannels.has(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleChannel(chip)}
                    data-testid={`funnel-channel-${chip}`}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      on
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-muted text-muted-foreground'
                    }`}
                  >
                    {CHANNEL_LABEL[chip]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-9 gap-1.5"
              onClick={handleAddPiece}
              data-testid="funnel-add-piece"
            >
              <Plus className="h-4 w-4" />
              Add piece
            </Button>
          </div>
        </div>

        {/* "Funnel doing its job" meter + 4-stat strip */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border bg-background p-4">
          <CoverageMeter pct={displayCoverage} />
          <div className="flex gap-6" data-testid="funnel-map-stats">
            <StatCell testId="funnel-stat-doing-job" value={counts.doing_job} label="Doing job" accent="text-idea-d" />
            <StatCell testId="funnel-stat-leaking" value={counts.leaking} label="Leaking" accent="text-gold-warm" />
            <StatCell testId="funnel-stat-off-brand" value={counts.off_brand} label="Off-brand" accent="text-destructive" />
            <StatCell testId="funnel-stat-missing" value={counts.missing} label="Missing" accent="text-muted-foreground" />
          </div>
        </div>

        {/* Stages in journey order; each piece card leads with its job */}
        {stageGroups.length === 0 ? (
          <p
            className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground"
            data-testid="funnel-map-filtered-empty"
          >
            No pieces match the selected channels. Re-enable a channel chip to see them.
          </p>
        ) : (
          stageGroups.map(({ stage, pieces: stagePieces }) => {
            const job = FUNNEL_JOBS[stage.id];
            const metricHint = job.primaryMetrics.map((k) => METRIC_META[k].label).join(' · ');
            return (
              <section
                key={stage.id}
                data-testid={`funnel-stage-${stage.id}`}
                className="space-y-2"
              >
                <header className="flex flex-wrap items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${STAGE_DOT[stage.id]}`} aria-hidden="true" />
                  <h3 className="text-sm font-bold text-foreground">{stage.label}</h3>
                  <span className="text-[11px] text-muted-foreground">— {stage.brandTask}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    job metric: {metricHint}
                  </span>
                </header>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {stagePieces.map((piece) => (
                    <PieceCard
                      key={piece.id}
                      piece={piece}
                      metrics={metricsByPiece?.[piece.id]}
                      onOpen={openPiece}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}

        <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-idea-d" /> Doing its job
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gold-warm" /> Leaking / message breaks
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-destructive" /> Off-brand
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Missing
          </span>
          <span>· “—” = no metric pulled yet — ask your coach in Claude to pull them (never faked)</span>
        </div>
      </CardContent>
    </Card>
  );
}

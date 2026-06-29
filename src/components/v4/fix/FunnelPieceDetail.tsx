/**
 * FunnelPieceDetail — Funnel-by-Job "did this piece do its job?" surface.
 *
 * WHAT: One funnel piece (= one active brand asset = one campaign; decision #1)
 * opened into a two-panel detail. Left: the piece's CURRENT VERSION (stored) —
 * text only (title, price, rating, reviews, bullets) with "last updated", an
 * "Update stored copy" affordance, and a "View on <channel> ↗" link (Alpha is
 * stored-text-only — no live fetch, no image; decision #5). Right: DID THIS PIECE
 * DO ITS JOB — the 1–2 primary job metrics for the piece's journey stage shown
 * big, the rest of the available superset as secondary pills, a Windsor sources
 * line, and a coach-insight bar tying the weak metric to the highest-leverage fix.
 * Actions route to the brief / a test / an uploaded-asset check.
 *
 * WHY: A piece only earns its place by doing its job — holding the message from
 * the step before and moving the customer to the next step. This surface answers
 * exactly that for one piece, then hands the user to the fix.
 *
 * NO FABRICATION (the production bar): presentational only — it renders the real
 * values the parent passes. A metric with no backing source renders an honest
 * "—" (never a guessed number); the metrics panel has explicit loading / no-data /
 * error states; the coach insight only shows when one was actually produced. The
 * parent (V4Fix) owns the metric read, the retry wiring, and the action handlers.
 */
import { useEffect, useRef } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  FlaskConical,
  RefreshCw,
  Sparkles,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GroundedStrip, type GroundedField } from '@/components/v4/GroundedStrip';
import { captureAlphaEvent } from '@/lib/posthogClient';
import { formatMetricValue } from '@/lib/formatMetric';
import { STAGES, type StageId } from '@/config/touchpointTaxonomy';
import {
  FUNNEL_JOBS,
  METRIC_META,
  isDerivedMetric,
  type MetricFormat,
  type MetricKey,
  type WindsorSource,
} from '@/config/v4Funnel';
import type {
  DataResult,
  FunnelPiece,
  MetricCell,
  PieceMetrics,
} from '@/types/v4Fix';
import { FUNNEL_PIECE_EVENTS, type FunnelPieceEvent } from './funnelPieceDetailEvents';

/** Everyday journey-stage label, from the taxonomy (Tier-A). */
const STAGE_LABEL: Readonly<Record<StageId, string>> = Object.fromEntries(
  STAGES.map((s) => [s.id, s.label]),
) as Record<StageId, string>;

/** Everyday source labels for the "Sources: … via Windsor" line. */
const SOURCE_LABEL: Readonly<Record<WindsorSource, string>> = {
  amazon_ads: 'Amazon Ads',
  amazon_sp: 'Seller Central',
  facebook: 'Meta',
  googleanalytics4: 'GA4',
  tiktok_shop: 'TikTok Shop',
  google_my_business: 'Google Business',
  derived: 'Derived',
  manual: 'Manual',
};

function emit(name: FunnelPieceEvent, props?: Record<string, string | number | boolean | null>): void {
  captureAlphaEvent(name, props);
}

/**
 * Format a metric value for display — delegates to the shared formatter so the
 * percent ×100 scaling matches FunnelMap (a CVR of 0.05 reads "5.0%", not "0.1%").
 */
const formatMetric = formatMetricValue;

/** "12 Jun" style date; null/invalid → null. */
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
}

export interface FunnelPieceDetailProps {
  /** The funnel piece (one active brand asset) being inspected. */
  piece: FunnelPiece;
  /** Everyday piece name for the header, e.g. "Amazon Listing — TLB216". */
  pieceLabel: string;
  /**
   * This piece's metric readings (or honest absence). `ok` carries the per-metric
   * cells; `no_data` carries why nothing is available (e.g. Windsor not connected);
   * `error` carries a message. Never synthesised.
   */
  metrics: DataResult<PieceMetrics>;
  /** True while the metric read is in flight (renders the right-panel skeleton). */
  metricsLoading?: boolean;
  /** Retry the metric read after an error. */
  onRetryMetrics?: () => void;
  /**
   * Coach insight tying the weak metric to the highest-leverage fix; null = none
   * produced yet (the bar self-hides — never a fabricated insight).
   */
  insight?: string | null;
  /** Brand fields powering downstream output; drives the optional GroundedStrip. */
  grounded?: GroundedField[];
  /** External link to view the piece on its channel; null = not available. */
  viewUrl?: string | null;
  /** Re-paste / refresh the stored text copy. */
  onUpdateStored?: () => void;
  /** Open the design brief for this fix. */
  onGetBrief?: () => void;
  /** Open a test (set the job-metric baseline). */
  onOpenTest?: () => void;
  /** Check an uploaded asset against the avatar + Signature. */
  onCheckAsset?: () => void;
  /** Back to the funnel map. */
  onBack?: () => void;
}

export function FunnelPieceDetail({
  piece,
  pieceLabel,
  metrics,
  metricsLoading = false,
  onRetryMetrics,
  insight = null,
  grounded = [],
  viewUrl = null,
  onUpdateStored,
  onGetBrief,
  onOpenTest,
  onCheckAsset,
  onBack,
}: FunnelPieceDetailProps): JSX.Element {
  const job = FUNNEL_JOBS[piece.stage];

  // One view event per mount.
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    emit(FUNNEL_PIECE_EVENTS.VIEWED, {
      piece_id: piece.id,
      stage: piece.stage,
      status: piece.status,
    });
  }, [piece.id, piece.stage, piece.status]);

  return (
    <div className="space-y-4" data-testid="v4-funnel-piece-detail">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          data-testid="funnel-piece-back"
          className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to funnel
        </button>
      )}

      <header className="space-y-2">
        <span
          className="inline-block rounded-full border border-gold-warm/40 bg-gold-warm/20 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-gold-warm"
          data-testid="funnel-piece-stage"
        >
          {STAGE_LABEL[piece.stage]}
        </span>
        <h1 className="text-xl font-bold leading-tight text-foreground">{pieceLabel}</h1>
        <p className="text-sm text-muted-foreground">
          One active brand asset = one funnel piece. Here&apos;s what&apos;s stored for it and whether
          it did its job.
        </p>
      </header>

      {/* ITS JOB bar */}
      <div
        className="flex flex-col gap-1 rounded-lg bg-foreground px-4 py-3 text-background sm:flex-row sm:items-center sm:gap-3"
        data-testid="funnel-piece-job"
      >
        <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-gold-warm">
          Its job
        </span>
        <span className="text-sm">{piece.job || job.job}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <StoredPanel
          piece={piece}
          channel={piece.channel}
          viewUrl={viewUrl}
          onUpdateStored={onUpdateStored}
        />
        <JobMetricsPanel
          stage={piece.stage}
          metrics={metrics}
          isLoading={metricsLoading}
          onRetry={onRetryMetrics}
        />
      </div>

      {insight && (
        <div
          className="flex gap-3 rounded-lg bg-foreground px-4 py-3 text-background"
          data-testid="funnel-piece-insight"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-gold-warm" aria-hidden="true" />
          <p className="text-sm">{insight}</p>
        </div>
      )}

      {grounded.length > 0 && <GroundedStrip fields={grounded} />}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="brand"
          size="sm"
          className="min-h-10 gap-2"
          onClick={() => {
            emit(FUNNEL_PIECE_EVENTS.BRIEF, { piece_id: piece.id });
            onGetBrief?.();
          }}
          data-testid="funnel-piece-brief"
        >
          <FileText className="h-4 w-4" />
          Get the design brief
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10 gap-2"
          onClick={() => {
            emit(FUNNEL_PIECE_EVENTS.TEST, { piece_id: piece.id });
            onOpenTest?.();
          }}
          data-testid="funnel-piece-test"
        >
          <FlaskConical className="h-4 w-4" />
          Open a test
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10 gap-2"
          onClick={() => {
            emit(FUNNEL_PIECE_EVENTS.CHECK, { piece_id: piece.id });
            onCheckAsset?.();
          }}
          data-testid="funnel-piece-check"
        >
          <ClipboardCheck className="h-4 w-4" />
          Check an uploaded asset
        </Button>
      </div>
    </div>
  );
}

// ── Left: stored content (text only, Alpha) ──────────────────────────────────────

function StoredPanel({
  piece,
  channel,
  viewUrl,
  onUpdateStored,
}: {
  piece: FunnelPiece;
  channel: string | null;
  viewUrl: string | null;
  onUpdateStored?: () => void;
}): JSX.Element {
  const { storedContent } = piece;
  const updated = formatDate(storedContent.updatedAt);
  const channelLabel = channel ? channel.charAt(0).toUpperCase() + channel.slice(1) : 'channel';

  return (
    <Card data-testid="funnel-piece-stored">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <FileText className="h-4 w-4 text-gold-warm" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">Current version (stored)</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {updated ? `last updated ${updated}` : 'no stored copy yet'}
          </span>
        </div>

        <p className="text-sm font-medium leading-snug text-foreground" data-testid="funnel-piece-stored-title">
          {storedContent.title ?? '—'}
        </p>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground">
          <span>
            <span className="text-xs text-muted-foreground">Price </span>
            <span className="font-bold">{storedContent.price ?? '—'}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Rating </span>
            <Stars rating={storedContent.rating} />
            <span className="font-bold">{storedContent.rating ?? '—'}</span>
          </span>
          <span>
            <span className="text-xs text-muted-foreground">Reviews </span>
            <span className="font-bold">
              {storedContent.reviewCount !== null
                ? storedContent.reviewCount.toLocaleString()
                : '—'}
            </span>
          </span>
        </div>

        {storedContent.bullets.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {storedContent.bullets.map((b, i) => (
              <li key={`${i}-${b.slice(0, 16)}`}>{b}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No stored bullet copy — paste it to track this piece.</p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {onUpdateStored && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 gap-2"
              onClick={() => {
                emit(FUNNEL_PIECE_EVENTS.UPDATE_STORED, { piece_id: piece.id });
                onUpdateStored();
              }}
              data-testid="funnel-piece-update-stored"
            >
              <RefreshCw className="h-4 w-4" />
              Update stored copy
            </Button>
          )}
          {viewUrl && (
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-idea-e hover:underline"
              data-testid="funnel-piece-view-link"
            >
              View on {channelLabel}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Alpha: text only, from your last paste/ingest. (Live screenshot + image-diff = post-Alpha.)
        </p>
      </CardContent>
    </Card>
  );
}

/** Up to five stars filled to the rounded rating; honest blank when unknown. */
function Stars({ rating }: { rating: number | null }): JSX.Element | null {
  if (rating === null) return null;
  const filled = Math.round(rating);
  return (
    <span className="inline-flex" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < filled ? 'fill-gold-warm text-gold-warm' : 'text-muted-foreground'}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

// ── Right: did this piece do its job? ────────────────────────────────────────────

function JobMetricsPanel({
  stage,
  metrics,
  isLoading,
  onRetry,
}: {
  stage: StageId;
  metrics: DataResult<PieceMetrics>;
  isLoading: boolean;
  onRetry?: () => void;
}): JSX.Element {
  const job = FUNNEL_JOBS[stage];

  return (
    <Card data-testid="funnel-piece-jobmetrics">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Sparkles className="h-4 w-4 text-gold-warm" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">Did this piece do its job?</span>
          <span className="ml-auto text-xs text-muted-foreground">via Windsor</span>
        </div>

        {isLoading ? (
          <div className="space-y-3" aria-busy="true" data-testid="funnel-piece-metrics-loading">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-8 w-full" />
          </div>
        ) : metrics.status === 'error' ? (
          <div
            className="flex flex-col items-start gap-2"
            data-testid="funnel-piece-metrics-error"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4" />
              Couldn&apos;t read the numbers
            </div>
            <p className="text-sm text-muted-foreground">
              The pull hit a snag and nothing was made up.{metrics.error ? ` (${metrics.error})` : ''}
            </p>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 gap-2"
                onClick={onRetry}
                data-testid="funnel-piece-metrics-retry"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            )}
          </div>
        ) : metrics.status === 'no_data' ? (
          <div className="space-y-2" data-testid="funnel-piece-metrics-empty">
            <p className="text-sm font-medium text-foreground">No numbers for this piece yet</p>
            <p className="text-sm text-muted-foreground">{metrics.reason}</p>
            <p className="text-xs text-muted-foreground">
              Pull this piece&apos;s metrics from Windsor in a Brand Coach chat — we never fake a number.
            </p>
          </div>
        ) : (
          <MetricsBody primary={job.primaryMetrics} data={metrics.data} />
        )}
      </CardContent>
    </Card>
  );
}

function MetricsBody({
  primary,
  data,
}: {
  primary: MetricKey[];
  data: PieceMetrics;
}): JSX.Element {
  const primarySet = new Set(primary);
  const secondary = (Object.keys(data.metrics) as MetricKey[])
    .filter((k) => !primarySet.has(k))
    .map((k) => data.metrics[k])
    .filter((c): c is MetricCell => c !== undefined);

  // Distinct real sources behind any present cell (excluding derived/manual).
  const sources = Array.from(
    new Set(
      Object.values(data.metrics)
        .map((c) => c?.source)
        .filter((s): s is WindsorSource => !!s && s !== 'derived' && s !== 'manual'),
    ),
  ).map((s) => SOURCE_LABEL[s]);
  const anyDerived = Object.values(data.metrics).some((c) => c?.derived);

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="funnel-piece-primary">
        {primary.map((key) => {
          const cell = data.metrics[key] ?? null;
          const meta = METRIC_META[key];
          return (
            <div
              key={key}
              className="rounded-lg border-2 border-gold-warm bg-gold-warm/15 p-3"
              data-testid={`funnel-piece-metric-${key}`}
            >
              <div className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
                {meta.label}
                {isDerivedMetric(key) ? ' (derived)' : ' (its job metric)'}
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {formatMetric(cell?.value ?? null, meta.format)}
              </div>
            </div>
          );
        })}
      </div>

      {secondary.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="funnel-piece-secondary">
          {secondary.map((cell) => {
            const meta = METRIC_META[cell.key];
            return (
              <span
                key={cell.key}
                className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs"
                data-testid={`funnel-piece-pill-${cell.key}`}
              >
                <span className="mr-1.5 uppercase tracking-wide text-muted-foreground">
                  {meta.label}
                </span>
                <span className="font-bold tabular-nums text-foreground">
                  {formatMetric(cell.value, meta.format)}
                </span>
              </span>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground" data-testid="funnel-piece-sources">
        Sources:{' '}
        {sources.length > 0 ? (
          <span className="text-foreground">{sources.join(' · ')}</span>
        ) : (
          '—'
        )}{' '}
        — via Windsor.{anyDerived ? ' CVR & AOV derived.' : ''} A metric with no connected source
        shows &ldquo;—&rdquo; (never faked).
      </p>
    </>
  );
}

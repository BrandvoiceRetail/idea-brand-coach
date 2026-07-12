/**
 * Layer 0 (contract) — row + insert types and Zod vocab for the campaign /
 * numeric-analytics / email-sequence model (migration 20260626000000_campaign_analytics.sql).
 *
 * SSOT for the four tables' enums: the `*_VALUES` const arrays here mirror the SQL CHECK
 * constraints verbatim, the `z.enum(...)` schemas are derived from them, and the TS unions
 * are inferred from the same arrays — so the migration, the Zod input validation, and the
 * service row types can never drift out of sync.
 *
 * Why this lives in `service/` (not `contracts/`): the output-engine `contracts/` dir is a
 * closed `ArtifactKind` registry (Layer 0 artifact schemas only). These are DB row/param
 * shapes for the campaign services, so — like `nativeLedger.ts`'s local `AssetRow`/`EventRow`
 * — they live with the services. Generated `src/integrations/supabase/types.ts` is NEVER
 * hand-edited; the services call `from('campaigns')` on untyped chains and coerce into these
 * interfaces, so no `types.ts` regeneration is needed to compile (matches the house pattern).
 */
import { z } from 'zod';

// ── Vocab (mirrors the SQL CHECK constraints exactly) ─────────────────────────

/** `campaigns.channel` / `campaign_metrics.channel` — 7-value channel vocab. */
export const CAMPAIGN_CHANNEL_VALUES = [
  'blog',
  'social',
  'email',
  'tiktok',
  'amazon',
  'paid',
  'content',
] as const;

/** `campaigns.status` — lifecycle. */
export const CAMPAIGN_STATUS_VALUES = ['draft', 'active', 'paused', 'completed'] as const;

/**
 * `campaign_metrics.metric_name` — numeric metric vocab.
 *
 * The trailing 5 (new_to_brand, repeat_rate, return_rate, units_sold, subscribe_save) are
 * NON-DERIVABLE — Windsor returns them and they need their own storage slots. Rate metrics
 * (new_to_brand, repeat_rate, return_rate) are FRACTIONS 0–1; units_sold / subscribe_save are
 * COUNTS. Derivable metrics (acos, roas, cpc) are NOT stored — they are computed at read-time
 * in getFunnelPieceMetrics, like cvr/aov.
 */
export const METRIC_NAME_VALUES = [
  'impressions',
  'sessions',
  'clicks',
  'opens',
  'ctr',
  'cvr',
  'aov',
  'spend',
  'orders',
  'revenue',
  'engagement',
  'calls_booked',
  'views',
  'new_to_brand',
  'repeat_rate',
  'return_rate',
  'units_sold',
  'subscribe_save',
  // total (organic + paid) sales per period — enables TACoS = spend / total_sales at read time
  'total_sales',
] as const;

/** `campaign_metrics.funnel_stage` — channel purchase-funnel bands (nullable in the DB). */
export const FUNNEL_STAGE_VALUES = [
  'visibility',
  'clicks',
  'orders',
  'revenue',
  'profitability',
] as const;

/**
 * `campaign_metrics.journey_stage` — the CUSTOMER-journey stage of the funnel piece
 * (mirrors `brand_assets.stage`; nullable in the DB). Distinct from `funnel_stage` (the
 * channel purchase funnel). Lets a metric attach to the piece's place in the journey.
 */
export const JOURNEY_STAGE_VALUES = [
  'awareness',
  'consideration',
  'purchase_decision',
  'retention',
  'advocacy',
] as const;

/** `campaign_metrics.granularity`. */
export const METRIC_GRANULARITY_VALUES = ['daily', 'hourly', 'snapshot'] as const;

/** `campaign_metrics.source` — `windsor` = host-Claude read Windsor get_data, then called ingest. */
export const METRIC_SOURCE_VALUES = ['manual', 'spreadsheet', 'warehouse', 'windsor'] as const;

/**
 * `brand_tests` experiment-lifecycle milestones (migration
 * 20260628000000_brand_tests_lifecycle_dates.sql). 'asset_created' stamps
 * `asset_created_at`, 'asset_live' stamps `asset_live_at` — the dates that start the
 * re-measure clock and form the case-study record. NULL = milestone not reached.
 */
export const TEST_MILESTONE_VALUES = ['asset_created', 'asset_live'] as const;

/** `email_sequences.sequence_type` — 6-value sequence vocab. */
export const SEQUENCE_TYPE_VALUES = [
  'welcome',
  'nurture',
  'newsletter',
  'upsell',
  'downsell',
  'abandoned_cart',
] as const;

/** `email_sequences.status` — sequence lifecycle. */
export const SEQUENCE_STATUS_VALUES = ['draft', 'active', 'paused'] as const;

// ── Zod schemas derived from the vocab arrays ─────────────────────────────────

export const campaignChannelSchema = z.enum(CAMPAIGN_CHANNEL_VALUES);
export const campaignStatusSchema = z.enum(CAMPAIGN_STATUS_VALUES);
export const metricNameSchema = z.enum(METRIC_NAME_VALUES);
export const funnelStageSchema = z.enum(FUNNEL_STAGE_VALUES);
export const journeyStageSchema = z.enum(JOURNEY_STAGE_VALUES);
export const metricGranularitySchema = z.enum(METRIC_GRANULARITY_VALUES);
export const metricSourceSchema = z.enum(METRIC_SOURCE_VALUES);
export const sequenceTypeSchema = z.enum(SEQUENCE_TYPE_VALUES);
export const sequenceStatusSchema = z.enum(SEQUENCE_STATUS_VALUES);
export const testMilestoneSchema = z.enum(TEST_MILESTONE_VALUES);

/** `YYYY-MM-DD` date string (maps to a `date` column; UTC). */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected an ISO date (YYYY-MM-DD)');

// ── TS unions (inferred from the same arrays) ─────────────────────────────────

export type CampaignChannel = z.infer<typeof campaignChannelSchema>;
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
export type MetricName = z.infer<typeof metricNameSchema>;
export type FunnelStage = z.infer<typeof funnelStageSchema>;
export type JourneyStage = z.infer<typeof journeyStageSchema>;
export type MetricGranularity = z.infer<typeof metricGranularitySchema>;
export type MetricSource = z.infer<typeof metricSourceSchema>;
export type SequenceType = z.infer<typeof sequenceTypeSchema>;
export type SequenceStatus = z.infer<typeof sequenceStatusSchema>;
export type TestMilestone = z.infer<typeof testMilestoneSchema>;

// ── Row interfaces (the shape the services coerce DB rows into) ────────────────

/** A `public.campaigns` row. */
export interface CampaignRow {
  id: string;
  user_id: string;
  brand_id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** A `public.campaign_metrics` row (append-only fact). */
export interface CampaignMetricRow {
  id: string;
  user_id: string;
  campaign_id: string;
  brand_asset_id: string | null; // the funnel piece this metric measures (decision #1)
  channel: CampaignChannel;
  metric_name: MetricName;
  metric_value: number;
  funnel_stage: FunnelStage | null; // channel purchase funnel
  journey_stage: JourneyStage | null; // customer journey (mirrors brand_assets.stage)
  measured_date: string;
  granularity: MetricGranularity;
  source: MetricSource;
  created_at: string;
}

/** A `public.email_sequences` row. */
export interface EmailSequenceRow {
  id: string;
  user_id: string;
  brand_id: string;
  campaign_id: string | null;
  sequence_type: SequenceType;
  name: string;
  status: SequenceStatus;
  created_at: string;
  updated_at: string;
}

/** A `public.email_steps` row. */
export interface EmailStepRow {
  id: string;
  user_id: string;
  sequence_id: string;
  step_number: number;
  subject: string;
  body: string;
  delay_hours: number;
  email_type: string | null;
  trigger_event: string | null;
  created_at: string;
}

/**
 * The subset of a `public.brand_tests` row the milestone service reads/writes
 * (lifecycle status + the two milestone dates). The competitor/funnel test stores
 * carry far more columns; this is the minimal shape `updateTestMilestone` needs.
 */
export interface BrandTestMilestoneRow {
  id: string;
  status: string;
  asset_created_at: string | null;
  asset_live_at: string | null;
}

// ── Insert types (server-stamped columns omitted) ─────────────────────────────
//
// `user_id` defaults to auth.uid() in the DB and is enforced by RLS; `brand_id` is
// resolved server-side (resolveBrandId), never caller-supplied. `id`/`created_at`/
// `updated_at` are DB-defaulted. The services build these insert objects.

/** Insert shape for `campaigns` (brand_id supplied by the service, not the caller). */
export interface CampaignInsert {
  user_id?: string;
  brand_id: string;
  name: string;
  channel: CampaignChannel;
  status?: CampaignStatus;
  description?: string | null;
}

/**
 * Canonical metric row the ingestion parsers normalise every workbook shape into,
 * before upsert into `campaign_metrics` (onConflict the natural key). `campaign_id`
 * / `user_id` are stamped by the service.
 */
export interface MetricInput {
  channel: CampaignChannel;
  metric_name: MetricName;
  metric_value: number;
  measured_date: string;
  brand_asset_id?: string | null;
  funnel_stage?: FunnelStage | null;
  journey_stage?: JourneyStage | null;
  granularity?: MetricGranularity;
  source?: MetricSource;
}

/** Insert shape for `campaign_metrics` (fully resolved row, service-stamped). */
export interface CampaignMetricInsert {
  user_id?: string;
  campaign_id: string;
  brand_asset_id?: string | null;
  channel: CampaignChannel;
  metric_name: MetricName;
  metric_value: number;
  funnel_stage?: FunnelStage | null;
  journey_stage?: JourneyStage | null;
  measured_date: string;
  granularity?: MetricGranularity;
  source?: MetricSource;
}

/** Insert shape for `email_sequences` (brand_id supplied by the service). */
export interface EmailSequenceInsert {
  user_id?: string;
  brand_id: string;
  campaign_id?: string | null;
  sequence_type: SequenceType;
  name: string;
  status?: SequenceStatus;
}

/** Insert shape for `email_steps`. */
export interface EmailStepInsert {
  user_id?: string;
  sequence_id: string;
  step_number: number;
  subject: string;
  body: string;
  delay_hours?: number;
  email_type?: string | null;
  trigger_event?: string | null;
}

/**
 * The natural-key columns of `uq_campaign_metrics_natural`, as the Supabase
 * `upsert(..., { onConflict })` string. The unique index is on these plain columns with
 * NULLS NOT DISTINCT (PG15+), so this column list matches it exactly and re-upload upserts
 * reconcile (null funnel_stage rows dedupe too). Kept here so the ingest service and any
 * drift test reference one constant.
 */
export const CAMPAIGN_METRICS_CONFLICT_TARGET =
  'campaign_id,brand_asset_id,metric_name,measured_date,granularity,funnel_stage' as const;

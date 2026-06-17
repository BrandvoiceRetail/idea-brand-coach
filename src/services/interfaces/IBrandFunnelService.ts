/**
 * Brand Funnel Tracker — service contract.
 *
 * Interface-first per src/services/AGENTS.md: the UI and orchestrators depend on THIS,
 * not on the concrete Supabase implementation. Row types are declared here explicitly
 * (rather than via Database['public']['Tables']) until the migration is applied and
 * `src/integrations/supabase/types.ts` is regenerated — at which point the impl can
 * switch to the generated Row/Insert types.
 *
 * Mirrors the `{ data, error }` Result convention; methods never throw across the boundary.
 */
import type { StageId, ApplicabilityTag } from '../../config/touchpointTaxonomy';

export type AssetStatus = 'pending' | 'aligned' | 'stale' | 'misaligned' | 'missing' | 'failed';
export type TestStatus = 'running' | 'won' | 'no_lift';
export type DimensionScores = { i: number; d: number; e: number; a: number };

/** The vision-audit verdict persisted to brand_assets.audit_result. */
export interface AuditResult {
  scores: DimensionScores; // 0-100 per IDEA dimension
  rationale: string;
  fix: string; // a concrete, on-strategy fix the coach can act on
  /** How many of the brand's strategy fields the audit was actually able to use. */
  grounding?: { fields_used: number };
}

export interface BrandAsset {
  id: string;
  avatar_id: string;
  touchpoint_id: string;
  stage: StageId;
  context_description: string; // REQUIRED — entered by the user at upload
  storage_path: string | null;
  content_text: string | null;
  signature_version: string | null;
  status: AssetStatus;
  overall_score: number | null;
  previous_score: number | null;
  audit_result: AuditResult | null;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandAssetCreate {
  avatarId: string;
  touchpointId: string;
  /** REQUIRED short context description (min 8 chars). Enforced at form, service, and DB. */
  contextDescription: string;
  /** A screenshot of the touchpoint. Provide this and/or contentText. */
  file?: File;
  /** Pasted copy (for text touchpoints like email/listing). Provide this and/or file. */
  contentText?: string;
}

export interface BrandTest {
  id: string;
  asset_id: string;
  hypothesis: string | null;
  messaging_version_before: string | null;
  messaging_version_after: string | null;
  metric_type: string | null;
  baseline_value: number | null;
  result_value: number | null;
  status: TestStatus;
  source: 'manual' | 'warehouse';
  deployed_at: string | null;
  measured_at: string | null;
  created_at: string;
  updated_at: string;
}

/** One touchpoint's slot on the Funnel Map (taxonomy × the user's asset, if any). */
export interface CoverageCell {
  touchpointId: string;
  label: string;
  stage: StageId;
  applicable: boolean;
  status: AssetStatus; // 'missing' when no asset exists yet
  overallScore: number | null;
  assetId: string | null;
}

export interface FunnelCoverage {
  byStage: Array<{ stage: StageId; label: string; cells: CoverageCell[] }>;
  counts: { aligned: number; stale: number; misaligned: number; missing: number };
  coveragePct: number; // aligned ÷ applicable
  targetPct: number;
}

export interface Result<T> {
  data: T | null;
  error: Error | null;
}

export interface IBrandFunnelService {
  /** Upload the screenshot to the private bucket + insert the brand_assets row. */
  createAsset(input: BrandAssetCreate): Promise<Result<BrandAsset>>;
  listAssets(avatarId: string): Promise<Result<BrandAsset[]>>;
  getAsset(id: string): Promise<Result<BrandAsset>>;
  /** Invoke the `audit-asset` edge function; persists scores/status/fix and returns the asset. */
  auditAsset(assetId: string): Promise<Result<BrandAsset>>;
  /** Save a coach rewrite as a new asset version (supersedes prior) and re-audit it. */
  applyRewrite(asset: BrandAsset, revisedText: string): Promise<Result<BrandAsset>>;
  /** Count the avatar's strategy fields — drives the grounding gate/badge. */
  getAvatarFieldCount(avatarId: string): Promise<number>;
  /** Deterministic current-vs-desired map for an avatar, given its channel tags. */
  getCoverage(avatarId: string, brandTags: ApplicabilityTag[]): Promise<Result<FunnelCoverage>>;
  recordTest(input: {
    assetId: string;
    hypothesis: string;
    metricType: string;
    baselineValue: number;
  }): Promise<Result<BrandTest>>;
  closeTest(testId: string, resultValue: number): Promise<Result<BrandTest>>;
  getAssetRoi(avatarId: string): Promise<Result<BrandTest[]>>;
}

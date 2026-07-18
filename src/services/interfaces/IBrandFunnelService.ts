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
  /**
   * The piece is BRAND-scoped (brand inventory rows have `avatar_id: null`).
   * When a brand-scoped read overlays a per-avatar evaluation, this carries the
   * avatar the verdict belongs to (the evaluation lens); the legacy avatar-keyed
   * reads still set it to the owning avatar.
   */
  avatar_id: string | null;
  /** Brand the piece belongs to (the inventory anchor). Null on legacy rows not yet backfilled. */
  brand_id?: string | null;
  touchpoint_id: string;
  stage: StageId;
  context_description: string; // REQUIRED — entered by the user at upload
  storage_path: string | null;
  content_text: string | null;
  positioning_statement_version: string | null;
  status: AssetStatus;
  overall_score: number | null;
  previous_score: number | null;
  audit_result: AuditResult | null;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandAssetCreate {
  /**
   * Brand the piece belongs to. When provided, the piece is created as BRAND
   * inventory (`brand_id` set, `avatar_id` null) — the funnel-by-job (/v4) path.
   * Legacy /v2 callers omit it and create avatar-keyed rows.
   */
  brandId?: string;
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
  /**
   * BRAND-scoped funnel inventory (the piece is the brand's, not an avatar's), with
   * the per-avatar EVALUATION overlaid: each piece's `status`/`overall_score`/
   * `audit_result` come from the current `brand_asset_audits` row for
   * (piece, avatarId); a piece with no audit for that avatar is `status:'pending'`
   * with null scores. `avatar_id` on the returned asset is the lens avatar.
   * Pass `avatarId: null` to get pieces with no overlay (all `pending`).
   */
  listBrandAssets(brandId: string, avatarId: string | null): Promise<Result<BrandAsset[]>>;
  getAsset(id: string): Promise<Result<BrandAsset>>;
  /** Invoke the `audit-asset` edge function; persists scores/status/fix and returns the asset. */
  auditAsset(assetId: string): Promise<Result<BrandAsset>>;
  /**
   * Per-avatar audit: compute via the `audit-asset` edge fn, then RECORD the verdict
   * into the `brand_asset_audits` overlay for (assetId, avatarId) via the
   * `save_asset_audit_atomic` RPC. Returns the asset with the per-avatar verdict
   * overlaid. This is how the SAME brand piece carries a different verdict per avatar.
   */
  auditAssetForAvatar(assetId: string, avatarId: string): Promise<Result<BrandAsset>>;
  /**
   * Upload a screenshot for an EXISTING piece (in-place — updates the piece's
   * storage_path, no new version) and re-audit it for the given avatar. Returns
   * the asset with the fresh per-avatar verdict overlaid.
   */
  reAuditWithScreenshot(assetId: string, file: File, avatarId: string): Promise<Result<BrandAsset>>;
  /**
   * Upload a screenshot for an EXISTING piece and transcribe its visible copy
   * (verbatim, vision) so "Update stored copy" can pre-fill for review. Returns the
   * extracted text; does not write content_text.
   */
  extractCopyFromImage(assetId: string, file: File): Promise<Result<string>>;
  /**
   * Update an existing piece's stored copy (content_text) in place and re-audit it
   * for the avatar — no new version, no re-selection of the piece.
   */
  updateStoredCopy(assetId: string, contentText: string, avatarId: string): Promise<Result<BrandAsset>>;
  /** Save a coach rewrite as a new asset version (supersedes prior) and re-audit it. */
  applyRewrite(asset: BrandAsset, revisedText: string): Promise<Result<BrandAsset>>;
  /** Count the avatar's strategy fields — drives the grounding gate/badge. */
  getAvatarFieldCount(avatarId: string): Promise<number>;
  /** Deterministic current-vs-desired map for an avatar, given its channel tags. */
  getCoverage(avatarId: string, brandTags: ApplicabilityTag[]): Promise<Result<FunnelCoverage>>;
  /**
   * BRAND-scoped coverage: pieces by brand, per-cell verdict from the per-avatar
   * overlay (read-time stale still derives from the piece's positioning_statement_version).
   */
  getBrandCoverage(
    brandId: string,
    avatarId: string | null,
    brandTags: ApplicabilityTag[],
  ): Promise<Result<FunnelCoverage>>;
  recordTest(input: {
    assetId: string;
    hypothesis: string;
    metricType: string;
    baselineValue: number;
  }): Promise<Result<BrandTest>>;
  closeTest(testId: string, resultValue: number): Promise<Result<BrandTest>>;
  getAssetRoi(avatarId: string): Promise<Result<BrandTest[]>>;
  /** Tests across ALL of a brand's funnel pieces (brand-scoped sibling of getAssetRoi). */
  getAssetRoiForBrand(brandId: string): Promise<Result<BrandTest[]>>;
}

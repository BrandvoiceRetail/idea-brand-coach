/**
 * Competitor Insights Types
 *
 * Feature-local type definitions for the Competitor-Agents feature.
 * Mirrors the brand_asset_competitive_insights and competitor_assets database
 * tables (migration 20260618000000_brand_asset_competitive_insights.sql).
 *
 * The generated src/integrations/supabase/types.ts does NOT include these tables
 * yet; cast at the supabase boundary with a "// TODO(types-regen)" note until the
 * migration is applied to prod and types are regenerated.
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md
 */

/**
 * Canonical IDEA dimension enum — re-exported from the single source of truth
 * (src/config/idea.ts). IDEA = Insight-Driven, Distinctive, Empathetic,
 * Authentic. Re-exported here so existing importers (e.g. src/types/brandDefense.ts)
 * keep working unchanged.
 */
export type { IdeaDimension } from '@/config/idea';

/** Status lifecycle for an insights analysis run. */
export type CompetitiveInsightStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Grounding gate: every competitor claim/score is either anchored to fetched
 * evidence or explicitly flagged as inference. No fabricated competitors/prices/
 * scores/quotes (plan §3).
 */
export type Grounding = 'evidence' | 'inference';

/** A single evidence reference anchoring a competitor claim. */
export interface EvidenceRef {
  /** What kind of evidence (e.g. 'listing', 'review', 'screenshot', 'url'). */
  kind: string;
  /** Pointer to the evidence (url, storage_path, competitor_assets id, etc.). */
  ref: string;
}

/** IDEA Trust-Gap scores for one competitor (each pillar scored 0-25). */
export interface IdeaScores {
  i: number;
  d: number;
  e: number;
  a: number;
}

/**
 * One competitor's IDEA-scored read for a given asset/touchpoint.
 * Shape of each element in brand_asset_competitive_insights.competitors (jsonb).
 */
export interface CompetitorEntry {
  name: string;
  url: string | null;
  idea_scores: IdeaScores;
  rationale: string;
  /** How this competitor compares against our avatar/Signature. */
  gap_to_our_avatar: string;
  /** Evidence anchors; empty/inference-flagged claims must be marked, not invented. */
  evidence_refs: EvidenceRef[];
}

/**
 * Voice-of-customer (VoC) signals mined from competitor reviews (P5 reviews
 * modality), toward avatar S1 vocabulary / S4 objections. Grounded — every term
 * /quote is a verbatim substring of the fetched review corpus. Mirrors the
 * `avatar_s1_vocab` (clusters) + `avatar_s4_objections` (objections) shapes.
 */
export interface VocCluster {
  cluster: string;
  customer_words: string[];
  frequency_signal: string;
  why_it_matters: string;
}

export interface VocObjection {
  hesitation: string;
  verbatim_signal: string;
  resolution: string;
}

export interface VocSignals {
  vocab_clusters: VocCluster[];
  objections: VocObjection[];
  grounding: 'evidence';
  evidence_refs: EvidenceRef[];
}

/**
 * Row of brand_asset_competitive_insights — per-touchpoint IDEA scores per
 * competitor for one brand asset.
 */
export interface BrandAssetCompetitiveInsight {
  id: string;
  avatar_id: string;
  /**
   * Intended FK to brand_assets(id); that table is not yet on this branch
   * (funnel-tracker base unmerged), so this is currently an unconstrained uuid.
   * TODO(competitor-agents:fk-brand-assets)
   */
  asset_id: string | null;
  modality: string;
  competitors: CompetitorEntry[];
  strategic_angle: string | null;
  /**
   * VoC signals (S1 vocab + S4 objections) mined from competitor reviews; null
   * for non-reviews modalities or when nothing survives the grounding gate.
   * Persisted in the voc_signals jsonb column (migration 20260618000200).
   */
  voc_signals: VocSignals | null;
  status: CompetitiveInsightStatus;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Insert payload for brand_asset_competitive_insights. */
export interface BrandAssetCompetitiveInsightCreate {
  avatar_id: string;
  asset_id?: string | null;
  modality: string;
  competitors?: CompetitorEntry[];
  strategic_angle?: string | null;
  status?: CompetitiveInsightStatus;
  analyzed_at?: string | null;
}

/**
 * Row of competitor_assets — per-touchpoint uploaded competitor evidence library.
 */
export interface CompetitorAsset {
  id: string;
  avatar_id: string;
  touchpoint_id: string;
  source_url: string | null;
  storage_path: string | null;
  content_text: string | null;
  created_at: string;
}

/** Insert payload for competitor_assets. */
export interface CompetitorAssetCreate {
  avatar_id: string;
  touchpoint_id: string;
  source_url?: string | null;
  storage_path?: string | null;
  content_text?: string | null;
}

/**
 * The seven competitor-analyzer modality profiles. One parameterized analyzer
 * routes by modality (plan §2 / _BUILD_MANIFEST §2). Marketplace-listing is the
 * only modality wired for evidence gathering in P2; the rest emit needs_input
 * until P5.
 */
export type CompetitorModality =
  | 'marketplace-listing'
  | 'web/store-copy'
  | 'visual/creative'
  | 'email/lifecycle'
  | 'social/content'
  | 'reviews/social-proof'
  | 'program/community';

/**
 * A slot the analyzer needs filled before it can ground a read (grounding gate).
 * Returned instead of a fabricated analysis when no evidence can be gathered.
 */
export interface CompetitorNeedsInput {
  slot: number;
  question: string;
  why: string;
}

/**
 * Request to run a competitor analysis for one brand asset / funnel touchpoint.
 * Mirrors the competitor-analysis-asset edge-function request body. The host
 * loads avatar + Signature + the brand's own asset and passes them in
 * (audit-idea-map stateless pattern).
 */
export interface AnalyzeCompetitorsRequest {
  /** The brand asset being analyzed (currently an unconstrained uuid — see migration). */
  assetId: string;
  /** Touchpoint this asset belongs to (taxonomy id). Required by the edge fn. */
  touchpointId: string;
  /** Modality analyzer to route to. Defaults to marketplace-listing edge-side. */
  modality?: CompetitorModality;
  /** Avatar the insight is scoped to (RLS anchor + persistence ownership). */
  avatarId?: string;
  /** Discover top-N competitors by this category/keyword (marketplace-listing). */
  category?: string;
  /** An explicit competitor ASIN (or the asset's own ASIN as a reference point). */
  asin?: string;
  /** ASINs whose reviews to mine (reviews/social-proof modality — P5). */
  reviewAsins?: string[];
  /** Competitor page URLs (web/store-copy pages; review-page URLs for reviews — P5). */
  competitorUrls?: string[];
  /** Amazon marketplace domain for DataForSEO (e.g. 'amazon.com'). */
  marketplace?: string;
  /** Host-supplied avatar context (object or pre-formatted string). */
  avatarContext?: unknown;
  /** Host-supplied Signature context. */
  signatureContext?: unknown;
  /** The brand's own asset content (for the relative gap read). */
  ourAsset?: unknown;
  /** The asset's prior IDEA audit result, if any. */
  auditResult?: unknown;
}

/**
 * Result of an analysis run, mapped from the competitor-analysis-asset edge fn
 * response. `grounding`/`evidenceRefs` carry the grounding envelope; when no
 * evidence could be gathered, `competitors` is empty and `needsInput` is set.
 */
export interface CompetitorAnalysisResult {
  competitors: CompetitorEntry[];
  strategicAngle: string | null;
  grounding: Grounding;
  evidenceRefs: EvidenceRef[];
  /**
   * VoC signals mined from competitor reviews (reviews modality only); null
   * otherwise or when nothing survives the grounding gate.
   */
  vocSignals: VocSignals | null;
  /** Id of the persisted brand_asset_competitive_insights row, if persisted. */
  insightId: string | null;
  /** Set when the grounding gate could not be satisfied; competitors is empty. */
  needsInput: CompetitorNeedsInput[] | null;
}

// ── P4 lift loop ─────────────────────────────────────────────────────────────

/**
 * The competitor-derived brief that feeds the funnel-rewrite. The insight's
 * `gap_to_our_avatar` + `strategic_angle` make the rewrite an explicit
 * countermeasure (plan §2 step 5 / ST-4).
 */
export interface CompetitorBrief {
  gap_to_our_avatar?: string;
  strategic_angle?: string;
  /** Competitor names for context only — never invented, never put in the copy. */
  competitor_names?: string[];
}

/** Request to the funnel-rewrite edge function. */
export interface DraftCountermeasureRequest {
  /** Touchpoint the asset belongs to (drives the rewrite's format hints). */
  touchpointId?: string;
  /** The asset's current copy (the baseline being rewritten). */
  currentCopy?: string;
  /** The competitor-derived brief — the heart of the countermeasure. */
  competitorBrief: CompetitorBrief;
  /** Host-supplied avatar context. */
  avatarContext?: unknown;
  /** Host-supplied Signature context. */
  signatureContext?: unknown;
}

/** Result of a funnel-rewrite run. */
export interface DraftCountermeasureResult {
  /** The rewritten, on-brand copy (the countermeasure variant). */
  rewrite: string;
  /** One or two sentences on why this beats the competitor gap. */
  angleNote: string;
}

/** Status lifecycle for a brand_tests row. */
export type BrandTestStatus = 'draft' | 'running' | 'completed' | 'inconclusive';

/** One variant of a composed A/B test (mirrors the shared test-design composer). */
export interface BrandTestVariant {
  variant_id: string;
  label: string;
  content: string;
  traffic_share: number;
}

/**
 * Row of brand_tests — an A/B lift test for a funnel asset.
 * `competitor_insight_applied` is the P4 flag: true when the test was informed
 * by a competitor insight (plan ST-4 / LT-5).
 */
export interface BrandTest {
  id: string;
  avatar_id: string;
  asset_id: string | null;
  competitive_insight_id: string | null;
  touchpoint_id: string | null;
  name: string;
  hypothesis: string | null;
  channel: string | null;
  primary_metric: string | null;
  variants: BrandTestVariant[];
  baseline_value: number | null;
  result_value: number | null;
  status: BrandTestStatus;
  competitor_insight_applied: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Request to compose + record an A/B test into brand_tests. The two variants
 * (baseline vs. the competitor-informed rewrite) are composed via the shared
 * test-design composer before insert. When `competitiveInsightId`/`strategicAngle`
 * indicate a competitor origin, `competitor_insight_applied` is set true.
 */
export interface RecordTestRequest {
  /** Avatar the test is scoped to (RLS anchor + ownership). */
  avatarId: string;
  /** The funnel asset under test. */
  assetId?: string | null;
  /** The competitor insight that informed this test, if any. */
  competitiveInsightId?: string | null;
  /** Touchpoint the asset belongs to. */
  touchpointId?: string | null;
  /** Test name. */
  name: string;
  /** The current/baseline copy (Variant A). */
  baselineCopy: string;
  /** The competitor-informed rewrite (Variant B). */
  rewriteCopy: string;
  /** Optional hypothesis; defaults from the composer. */
  hypothesis?: string;
  /** Channel (drives the default primary metric). */
  channel?: string;
  /** Explicit primary metric; defaults from the composer by channel. */
  primaryMetric?: string;
  /**
   * Whether this test was informed by a competitor insight. Defaults to true
   * when a competitiveInsightId is supplied (the P4 countermeasure path).
   */
  competitorInsightApplied?: boolean;
}

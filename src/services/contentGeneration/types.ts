/**
 * Content Generation — shared types for the per-funnel-piece generate interface.
 *
 * A funnel piece (touchpoint) resolves to one or more PieceCapabilities via the
 * capability registry. Each capability names a provider + the engine call that
 * produces that kind of content:
 *   - provider 'pixii'   → async product IMAGES (listing / A+ / main / scale)
 *   - provider 'claude'  → synchronous on-brand COPY (email / listing / generic)
 *   - provider 'palmier' → async short-form VIDEO via the local Palmier MCP app
 *                          (127.0.0.1:19789). Reachable only where Palmier runs;
 *                          when it isn't, the job parks as a ready-to-run brief.
 *   - provider 'fal'     → async short-form VIDEO via the fal.ai cloud queue API.
 *                          Returns a downloadable MP4 persisted to brand-assets, so
 *                          it works in prod for every user (no local app needed).
 *
 * The frontend talks only to edge functions (pixii-generate / brand-copy-generator
 * / palmier-generate / fal-video-generate), so these types are independent of the
 * Deno `_shared/*.ts` modules and of the not-yet-regenerated job row type.
 */

export type ContentProvider = 'pixii' | 'claude' | 'palmier' | 'fal';
export type OutputKind = 'image' | 'copy' | 'video';
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Pixii `listing_type` values usable from the funnel (subset wired to touchpoints). */
export type PixiiListingType =
  | 'amazon_listing' | 'amazon_main_images' | 'amazon_mobile_listing'
  | 'shopify_listing' | 'tiktok_listing';

/** Palmier `aspectRatio` values the funnel offers (free-form on the wire; this is the UI subset). */
export type PalmierAspect = '16:9' | '9:16' | '1:1';

/** One way a given funnel piece can be generated. */
export interface PieceCapability {
  provider: ContentProvider;
  /** Engine-level capability key, e.g. listing_images / main_image / a_plus / scale / email_copy / generic_copy. */
  capability: string;
  outputKind: OutputKind;
  /** Human label for the generate button / section. */
  label: string;
  /** Short helper line shown under the label. */
  hint?: string;
  /** Pixii defaults baked into the touchpoint mapping. */
  pixiiListingType?: PixiiListingType;
  pixiiTypes?: string[];
  /** Video (Palmier / fal) defaults baked into the touchpoint mapping. */
  videoAspect?: PalmierAspect;
  videoDurationS?: number;
  /** Optional default Palmier model id; omitted ⇒ Palmier picks its first available model. */
  palmierModel?: string;
  /** Optional default fal.ai model id; omitted ⇒ the FAL_VIDEO_MODEL edge default applies. */
  falModel?: string;
}

export interface GeneratedImage {
  storage_path: string;
  signed_url: string | null;
  source_url: string;
}

/**
 * A generated video. Two shapes by provider:
 *  - fal     → a real file: persisted to the brand-assets bucket, so `storage_path`
 *              + `signed_url` (and `source_url`, the fal CDN origin) are set.
 *  - palmier → a LOCAL asset inside the user's Palmier project (no downloadable URL
 *              over MCP), so the funnel records a REFERENCE — `palmier_asset_id` —
 *              and `storage_path` stays null.
 */
export interface GeneratedVideo {
  /** Durable storage path in the brand-assets bucket (fal persists the MP4; null for Palmier). */
  storage_path?: string | null;
  signed_url?: string | null;
  /** Provider CDN url the binary was fetched from (fal). */
  source_url?: string | null;
  /** Palmier-only: the local asset id the clip lives under in the user's project. */
  palmier_asset_id?: string | null;
  /** The resolved generation status, if known. */
  generation_status?: 'generating' | 'downloading' | 'failed' | 'ready';
  prompt: string;
  model?: string | null;
  duration_s?: number | null;
  aspect?: string | null;
}

export interface GenerationOutput {
  /** Pixii image results (signed URLs for display, storage paths for persistence). */
  images?: GeneratedImage[];
  /** Palmier video results (asset references; binaries live in the user's Palmier project). */
  videos?: GeneratedVideo[];
  /**
   * Palmier handoff brief — present when Palmier wasn't reachable (e.g. from the
   * cloud), so the user can run the generation in their local Palmier as-is.
   */
  brief?: { prompt: string; model?: string | null; duration_s?: number | null; aspect?: string | null };
  /** Claude copy result. */
  copy?: string;
  /** Optional A/B alternatives from the copy engine. */
  alternatives?: string[];
  /** Per-asset Pixii failures inside an otherwise-completed job. */
  ad_errors?: Array<{ code: string; message: string }>;
  remaining_credits?: number | null;
}

export interface GenerationError {
  code?: string;
  message: string;
  retryAfter?: number;
}

/** The live state of one generation, returned by start() and poll(). */
export interface GenerationJob {
  /** content_generation_jobs row id (present for Pixii; optional for sync copy). */
  jobId?: string;
  externalJobId?: string | null;
  provider: ContentProvider;
  status: GenerationStatus;
  output?: GenerationOutput;
  error?: GenerationError | null;
}

/** Inputs to start a generation. Which fields matter depends on capability.provider. */
export interface GenerationStartInput {
  capability: PieceCapability;
  avatarId: string;
  touchpointId: string;
  // ── Pixii (image) inputs ──
  asin?: string;
  countryCode?: string;
  listingType?: string;
  types?: string[];
  mainImageUrl?: string;
  otherImageUrls?: string[];
  userPrompt?: string;
  // ── Claude (copy) inputs ──
  prompt?: string;
  tone?: string;
  productName?: string;
  // ── Palmier (video) inputs ──
  /** What the video should show. Falls back to `prompt` when omitted. */
  videoPrompt?: string;
  /** Palmier model id; omitted ⇒ Palmier picks its first available model. */
  model?: string;
  durationS?: number;
  aspect?: PalmierAspect;
}

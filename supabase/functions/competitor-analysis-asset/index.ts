import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createRateLimiter, rateLimitKey } from "../_shared/rateLimit.ts";
import {
  getAmazonProductByAsin,
  getAmazonReviews,
  searchTopCompetitors,
  type AmazonProduct,
  type AmazonReview,
} from "../_shared/dataforseo.ts";
import {
  buildReviewCorpus,
  buildSystemPrompt,
  buildUserMessage,
  buildVocSystemPrompt,
  buildVocUserMessage,
  cleanCompetitors,
  enforceVocGrounding,
  formatAvatar,
  formatOurAsset,
  formatSignature,
  parseAnalysis,
  parseVoc,
  renderProductEvidence,
  renderReviewEvidence,
  renderUrlEvidence,
  resolveModality,
  routeModality,
  type CompetitorEvidence,
  type CompetitorReview,
  type Modality,
  type VocSignals,
} from "./lib.ts";
import { getCached, upsertCached, CACHE_TTL } from "../_shared/asinCache.ts";

/**
 * competitor-analysis-asset  (Competitor-Agents P2 — the analyzer engine)
 *
 * Scores EACH competitor on the IDEA Trust-Gap lens {insight, distinctive,
 * empathetic, authentic} (each 0-100) for one brand asset / funnel touchpoint,
 * produces a single strategic angle, and persists to
 * `brand_asset_competitive_insights`.
 *
 * CALCULATION PARITY: this fn reuses the SAME IDEA rubric/prompt scaffold the
 * canonical `audit-asset` edge fn uses to score the brand's OWN asset — the same
 * four-dimension questions, the same persona (Trevor), the same Sonnet 4.6 call,
 * and the same avatar CORE_FIELDS grounding (see lib.AVATAR_CORE_FIELDS /
 * buildSystemPrompt). A competitor read is therefore `audit-asset` pointed at a
 * competitor's asset, plus a gap read vs our avatar/Signature, so a competitor
 * asset is scored identically to how the brand's own asset is scored. Differences
 * from audit-asset are mechanical, not rubric: this fn scores MANY assets
 * (competitors) per call from fetched evidence rather than one uploaded asset, so
 * it emits a JSON array + uses prompt caching, a single user turn (NO assistant
 * prefill — Sonnet 4.6 rejects last-turn prefills with 400), a tolerant defensive
 * parse, and the grounding/evidence_refs/needs_input envelope. The pure
 * scoring/parse/grounding logic lives in ./lib.ts (Deno-free, unit-tested under
 * vitest); this file is the thin Deno edge entry wiring HTTP, auth, DataForSEO
 * and persistence.
 *
 * Context loading mirrors audit-asset: avatar + Signature + the brand's own asset
 * + its audit_result. The host may pass these in the request body (audit-idea-map
 * STATELESS pattern); when avatar_context is absent and an auth header is present,
 * avatar is loaded server-side from user_knowledge_base onto the SAME field_id
 * keys audit-asset grounds on (loadAvatarFromKb -> lib.AVATAR_CORE_FIELDS).
 *
 * GROUNDING GATE (mandatory, plan §3): every competitor, score, price and quote
 * is anchored to fetched evidence (a competitor_evidence item -> evidence_refs)
 * or omitted. When no evidence can be gathered, the fn returns `needs_input`
 * instead of a fabricated read.
 *
 * Request:
 *   { assetId, touchpointId, modality?, competitorUrls?, asin?, category?,
 *     marketplace?, avatarId?, avatar_context?, signature_context?,
 *     our_asset?, audit_result? }
 * Response:
 *   { competitors: [{ name, url, idea_scores:{i,d,e,a}, rationale,
 *                     gap_to_our_avatar, evidence_refs:[{kind,ref}] }],
 *     strategic_angle, grounding:'evidence'|'inference', evidence_refs,
 *     insightId, needs_input? }
 *
 * Modalities wired:
 *  - marketplace-listing (P2)        — DataForSEO (ASIN + category top-N).
 *  - web/store-copy      (P5)        — URL-fetch via Firecrawl on caller-supplied
 *                                       competitor URLs (Shopify-PDP / brand-store /
 *                                       about), extract main content -> IDEA-score.
 *  - reviews/social-proof (P5)       — competitor reviews via DataForSEO reviews
 *                                       (by ASIN) and/or Firecrawl on review URLs;
 *                                       IDEA-scores the review-set AND emits a
 *                                       voice-of-customer (VoC) read toward avatar
 *                                       S1 vocabulary / S4 objections, grounded to
 *                                       the fetched review corpus.
 * The remaining modalities stay stubbed in the `gatherEvidence` switch.
 */

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET_MODEL = 'claude-sonnet-4-6';
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

// ── Abuse controls (mirror diagnostic-interpretation; env-tunable) ───────────
const MAX_BODY_BYTES = Number(Deno.env.get('COMPETITOR_MAX_BODY_BYTES') ?? '32768');
const RATE_LIMIT_MAX = Number(Deno.env.get('COMPETITOR_RATE_LIMIT_MAX') ?? '10');
const RATE_LIMIT_WINDOW_MS = Number(Deno.env.get('COMPETITOR_RATE_LIMIT_WINDOW_MS') ?? '60000');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Per-isolate sliding-window limiter, keyed per user (JWT sub) or per IP.
const rateLimiter = createRateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

interface AnalyzeRequest {
  assetId?: string;
  touchpointId?: string;
  modality?: Modality;
  /** Competitor page URLs (web/store-copy; review pages for reviews modality). */
  competitorUrls?: string[];
  asin?: string;
  /** ASINs whose reviews to mine for the reviews modality. */
  reviewAsins?: string[];
  category?: string;
  marketplace?: string;
  avatarId?: string;
  avatar_context?: unknown;
  signature_context?: unknown;
  our_asset?: unknown;
  audit_result?: unknown;
}

/** Firecrawl v2 scrape envelope (subset; mirrors review-scraper). */
interface FirecrawlScrape {
  success?: boolean;
  data?: { markdown?: string; html?: string; metadata?: { title?: string } };
}

/**
 * Fetch one URL's main content via Firecrawl v2 (web/store-copy + review pages).
 * Mirrors review-scraper's scrape call but requests `onlyMainContent` so we feed
 * the model the page's substantive copy, not nav/footer chrome. Never throws:
 * returns null on any failure so the caller skips the URL (grounding — no
 * fabricated content for a page we could not read).
 */
async function scrapeMainContent(
  url: string,
): Promise<{ title?: string; markdown: string } | null> {
  if (!firecrawlApiKey) return null;
  // Shared cross-tenant cache: a fetched page is the same for every tenant.
  const cacheKey = { source: 'firecrawl', dataKind: 'page', cacheKey: url, marketplace: 'web' };
  const cachedPage = await getCached<{ title?: string; markdown: string }>(cacheKey);
  if (cachedPage && cachedPage.markdown) return cachedPage;
  try {
    const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 30000,
      }),
    });
    if (!response.ok) {
      console.error(`[competitor-analysis-asset] Firecrawl error (${response.status}) for`, url);
      return null;
    }
    const data = (await response.json()) as FirecrawlScrape;
    const markdown = data.data?.markdown;
    if (!markdown || !markdown.trim()) return null;
    const page = { title: data.data?.metadata?.title, markdown };
    await upsertCached(cacheKey, page, CACHE_TTL.page);
    return page;
  } catch (err) {
    console.error('[competitor-analysis-asset] Firecrawl scrape threw for', url, err);
    return null;
  }
}

// ── Evidence gathering by modality (extension points for P5) ─────────────────

/**
 * Result of evidence gathering. `notConfigured` signals the modality's data
 * source has no creds so the caller can surface a fallback message rather than
 * an empty fabricated read. `reviewsByRef` carries the raw scraped reviews for
 * the reviews modality (used for the grounded VoC mine) keyed by evidence ref.
 */
interface GatherResult {
  evidence: CompetitorEvidence[];
  notConfigured: boolean;
  reviewsByRef?: Map<string, CompetitorReview[]>;
}

/**
 * Gather competitor evidence for the requested modality. Returns ONLY real,
 * fetched evidence (grounding gate).
 */
async function gatherEvidence(body: AnalyzeRequest, modality: Modality): Promise<GatherResult> {
  // Dispatch by the shared routing contract (lib.routeModality) so this switch
  // and the unit-tested router never drift.
  switch (routeModality(modality)) {
    case 'dataforseo':
      return gatherMarketplaceEvidence(body);
    case 'firecrawl-url': // -> URL-fetch (Firecrawl) on caller-supplied competitorUrls
      return gatherWebStoreCopyEvidence(body);
    case 'reviews': // -> DataForSEO reviews (by ASIN) + Firecrawl review URLs
      return gatherReviewsEvidence(body);
    // Stub modalities are not yet wired for evidence gathering — they return
    // empty so the caller emits needs_input rather than fabricating.
    case 'stub':
    default:
      console.log(`[competitor-analysis-asset] modality '${modality}' not yet wired for evidence gathering.`);
      return { evidence: [], notConfigured: false };
  }
}

/**
 * web/store-copy modality (P5): URL-fetch via Firecrawl on caller-supplied
 * competitor URLs (Shopify PDP, brand store, about pages). Each page's main
 * content becomes one grounded evidence item. `notConfigured` when Firecrawl has
 * no key (so nothing could be fetched).
 */
async function gatherWebStoreCopyEvidence(body: AnalyzeRequest): Promise<GatherResult> {
  const urls = Array.isArray(body.competitorUrls)
    ? body.competitorUrls.filter((u) => typeof u === 'string' && u.trim()).slice(0, 5)
    : [];
  if (urls.length === 0) return { evidence: [], notConfigured: false };
  if (!firecrawlApiKey) return { evidence: [], notConfigured: true };

  const evidence: CompetitorEvidence[] = [];
  for (const url of urls) {
    const page = await scrapeMainContent(url);
    if (!page) continue;
    const text = renderUrlEvidence(page.title, page.markdown);
    if (!text) continue;
    evidence.push({
      ref: `url:${url}`,
      kind: 'url',
      name: page.title ?? url,
      url,
      text,
    });
  }
  return { evidence, notConfigured: false };
}

/**
 * reviews/social-proof modality (P5): mine competitor reviews. Reviews come from
 * DataForSEO (by reviewAsins/asin) and/or Firecrawl on caller-supplied review
 * URLs. Each competitor's reviews fold into one grounded evidence item AND are
 * kept in `reviewsByRef` for the VoC mine. `notConfigured` when neither source
 * could run.
 */
async function gatherReviewsEvidence(body: AnalyzeRequest): Promise<GatherResult> {
  const evidence: CompetitorEvidence[] = [];
  const reviewsByRef = new Map<string, CompetitorReview[]>();
  const marketplace = body.marketplace;
  let attempted = false;
  let notConfigured = false;

  // DataForSEO reviews by ASIN.
  const asins = [
    ...(Array.isArray(body.reviewAsins) ? body.reviewAsins : []),
    ...(body.asin ? [body.asin] : []),
  ]
    .filter((a) => typeof a === 'string' && a.trim())
    .map((a) => a.trim())
    .slice(0, 5);
  const seenAsin = new Set<string>();
  for (const asin of asins) {
    if (seenAsin.has(asin)) continue;
    seenAsin.add(asin);
    attempted = true;
    const ck = { source: 'dataforseo', dataKind: 'reviews', cacheKey: asin, marketplace: marketplace ?? 'amazon.com' };
    let reviews = await getCached<CompetitorReview[]>(ck);
    if (!reviews) {
      const res = await getAmazonReviews(asin, marketplace, 20);
      if (res.status === 'not_configured') {
        notConfigured = true;
        continue;
      }
      if (res.reviews.length === 0) continue;
      reviews = res.reviews.map((r: AmazonReview) => ({
        reviewerName: r.reviewerName,
        rating: r.rating,
        title: r.title,
        body: r.body,
        verified: r.verified,
        date: r.date,
      }));
      await upsertCached(ck, reviews, CACHE_TTL.reviews);
    }
    if (!reviews || reviews.length === 0) continue;
    const ref = `reviews:asin:${asin}`;
    reviewsByRef.set(ref, reviews);
    evidence.push({
      ref,
      kind: 'review',
      name: asin,
      url: undefined,
      text: renderReviewEvidence(reviews),
    });
  }

  // Firecrawl on caller-supplied review URLs (non-Amazon / fallback).
  const urls = Array.isArray(body.competitorUrls)
    ? body.competitorUrls.filter((u) => typeof u === 'string' && u.trim()).slice(0, 5)
    : [];
  for (const url of urls) {
    attempted = true;
    if (!firecrawlApiKey) {
      notConfigured = true;
      break;
    }
    const page = await scrapeMainContent(url);
    if (!page) continue;
    // One review-page rendered as a single corpus item (parsing individual
    // reviews out of arbitrary pages is review-scraper's job; here we keep the
    // fetched copy verbatim so the VoC substring gate still holds).
    const reviews: CompetitorReview[] = [{ body: page.markdown.replace(/\s+/g, ' ').trim() }];
    const ref = `reviews:url:${url}`;
    reviewsByRef.set(ref, reviews);
    evidence.push({
      ref,
      kind: 'review',
      name: page.title ?? url,
      url,
      text: renderReviewEvidence(reviews),
    });
  }

  return { evidence, notConfigured: attempted && evidence.length === 0 ? notConfigured : false, reviewsByRef };
}

/**
 * Marketplace-listing modality (DataForSEO-backed, the P2 priority).
 * Discovers top-N competitors by category (or a provided ASIN) and renders each
 * listing as grounded evidence.
 */
async function gatherMarketplaceEvidence(body: AnalyzeRequest): Promise<GatherResult> {
  const marketplace = body.marketplace;
  const evidence: CompetitorEvidence[] = [];
  let notConfigured = false;
  const seen = new Set<string>();

  const pushProduct = (p: AmazonProduct): void => {
    if (seen.has(p.asin)) return;
    seen.add(p.asin);
    evidence.push({
      ref: `asin:${p.asin}`,
      kind: 'listing',
      name: p.title ?? p.brand ?? p.asin,
      url: p.url,
      text: renderProductEvidence(p),
    });
  };

  const mkt = marketplace ?? 'amazon.com';

  // Top-N competitor discovery by keyword/category (cache the product set).
  if (body.category && body.category.trim()) {
    const cat = body.category.trim();
    const ck = { source: 'dataforseo', dataKind: 'discovery', cacheKey: cat.toLowerCase(), marketplace: mkt };
    const cached = await getCached<AmazonProduct[]>(ck);
    if (cached) {
      cached.forEach(pushProduct);
    } else {
      const res = await searchTopCompetitors(cat, marketplace, 5);
      if (res.status === 'not_configured') notConfigured = true;
      if (res.products.length > 0) await upsertCached(ck, res.products, CACHE_TTL.discovery);
      res.products.forEach(pushProduct);
    }
  }

  // An explicit competitor ASIN (or the asset's own ASIN as a reference point).
  if (body.asin && body.asin.trim()) {
    const asin = body.asin.trim();
    const ck = { source: 'dataforseo', dataKind: 'product', cacheKey: asin, marketplace: mkt };
    const cached = await getCached<AmazonProduct>(ck);
    if (cached) {
      pushProduct(cached);
    } else {
      const res = await getAmazonProductByAsin(asin, marketplace);
      if (res.status === 'not_configured') notConfigured = true;
      if (res.product) {
        await upsertCached(ck, res.product, CACHE_TTL.product);
        pushProduct(res.product);
      }
    }
  }

  return { evidence, notConfigured };
}

/**
 * Load avatar context server-side from user_knowledge_base when not supplied in
 * the body (mirrors audit-asset's KB read). Strips the `avatar_` prefix so the
 * keys land on the same field_ids audit-asset grounds on (lib.AVATAR_CORE_FIELDS),
 * preserving Calculation Parity. Best-effort; returns '' on any miss.
 */
async function loadAvatarFromKb(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  try {
    const { data, error } = await supabaseClient
      .from('user_knowledge_base')
      .select('field_identifier, content')
      .eq('user_id', userId)
      .eq('is_current', true)
      .like('field_identifier', 'avatar_%')
      .not('content', 'is', null)
      .neq('content', '');
    if (error || !data) return '';
    const obj: Record<string, unknown> = {};
    for (const row of data as Array<{ field_identifier: string; content: string }>) {
      obj[row.field_identifier.replace(/^avatar_/, '')] = row.content;
    }
    return formatAvatar(obj);
  } catch {
    return '';
  }
}

/**
 * Mine voice-of-customer signals (S1 vocab + S4 objections) from the scraped
 * competitor reviews (reviews modality only). EVIDENCE-only and grounded: the
 * model is told to quote verbatim, and `enforceVocGrounding` then drops any term
 * /quote that is not a literal substring of the review corpus. Returns null when
 * there are no reviews or nothing survives grounding (so the caller omits VoC
 * rather than persisting a fabricated read). Uses Haiku — extraction, not
 * scoring — and never throws (a VoC failure must not fail the analysis).
 */
async function mineVoc(
  reviewsByRef: Map<string, CompetitorReview[]>,
): Promise<VocSignals | null> {
  if (!anthropicApiKey || reviewsByRef.size === 0) return null;
  const allReviews: CompetitorReview[] = [];
  const refs: { kind: string; ref: string }[] = [];
  for (const [ref, reviews] of reviewsByRef) {
    refs.push({ kind: 'review', ref });
    for (const r of reviews) allReviews.push(r);
  }
  const { corpus, haystack } = buildReviewCorpus(allReviews);
  if (!corpus) return null;

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 2048,
        system: [{ type: 'text', text: buildVocSystemPrompt(), cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildVocUserMessage(corpus) }],
        temperature: 0.4,
      }),
    });
    if (!response.ok) {
      console.error('[competitor-analysis-asset] VoC Anthropic error:', response.status);
      return null;
    }
    const data = await response.json();
    const parsed = parseVoc(data?.content?.[0]?.text ?? '');
    if (!parsed) return null;
    return enforceVocGrounding(parsed, haystack, refs);
  } catch (err) {
    console.error('[competitor-analysis-asset] VoC mine threw (non-fatal):', err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Per-user when authenticated (key by JWT sub), else per-IP.
  if (rateLimiter.isRateLimited(rateLimitKey(req))) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please slow down and try again shortly.' }),
      {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) },
      },
    );
  }

  if (!anthropicApiKey) {
    return new Response(
      JSON.stringify({ error: 'Anthropic API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({ error: 'Request body too large' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let body: AnalyzeRequest;
    try {
      body = JSON.parse(rawBody) as AnalyzeRequest;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const touchpointId = typeof body.touchpointId === 'string' ? body.touchpointId : '';
    if (!touchpointId) {
      return new Response(
        JSON.stringify({ error: 'touchpointId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const modality: Modality = resolveModality(body.modality);

    // Optional auth: resolve user (for avatar KB fallback + persistence ownership).
    const authHeader = req.headers.get('authorization');
    let supabaseClient: ReturnType<typeof createClient> | null = null;
    let userId: string | null = null;
    if (authHeader) {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } },
      );
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabaseClient.auth.getUser(token);
        if (user) userId = user.id;
      } catch (authErr) {
        console.log('[competitor-analysis-asset] Auth lookup failed (non-fatal):', authErr);
      }
    }

    // Context: prefer host-supplied (audit-idea-map stateless pattern); fall back
    // to a server-side avatar KB read (ai-insight-guidance pattern) when authed.
    let avatarText = formatAvatar(body.avatar_context);
    if (!avatarText && supabaseClient && userId) {
      avatarText = await loadAvatarFromKb(supabaseClient, userId);
    }
    const signatureText = formatSignature(body.signature_context);
    const ourAssetText = formatOurAsset(body.our_asset, body.audit_result);

    // ── Evidence gathering (grounding gate) ───────────────────────────────────
    const { evidence, notConfigured, reviewsByRef } = await gatherEvidence(body, modality);

    if (evidence.length === 0) {
      // No grounded evidence -> never fabricate. Tell the caller what is missing.
      let question: string;
      if (modality === 'marketplace-listing') {
        question = notConfigured
          ? 'The Amazon competitor data source (DataForSEO) is not configured, and no competitor listings could be fetched. Configure DataForSEO credentials or supply competitor ASINs/URLs.'
          : 'No competitor listings could be fetched for this touchpoint. Provide a category or competitor ASIN to analyze.';
      } else if (modality === 'web/store-copy') {
        question = notConfigured
          ? 'The web page fetcher (Firecrawl) is not configured, so no competitor pages could be read. Configure FIRECRAWL_API_KEY.'
          : 'No competitor pages could be read for this touchpoint. Provide one or more competitor page URLs (competitorUrls) to analyze.';
      } else if (modality === 'reviews/social-proof') {
        question = notConfigured
          ? 'No competitor review source is configured. Configure DataForSEO (for Amazon reviews by ASIN) or Firecrawl (for review-page URLs).'
          : 'No competitor reviews could be fetched for this touchpoint. Provide competitor ASINs (reviewAsins) or review-page URLs (competitorUrls) to analyze.';
      } else {
        question = `The '${modality}' modality is not yet wired for evidence gathering. Supply competitor evidence directly, or use the marketplace-listing, web/store-copy, or reviews/social-proof modality.`;
      }
      return new Response(
        JSON.stringify({
          competitors: [],
          strategic_angle: null,
          grounding: 'inference',
          evidence_refs: [],
          needs_input: [{ slot: 1, question, why: 'Every competitor score must be anchored to fetched evidence (grounding gate). With no evidence there is nothing to score.' }],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const evidenceByRef = new Map<string, CompetitorEvidence>();
    for (const e of evidence) evidenceByRef.set(e.ref, e);

    const systemPrompt = buildSystemPrompt();
    const userMessage = buildUserMessage(modality, touchpointId, evidence, avatarText, signatureText, ourAssetText);

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 3072,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        // No assistant prefill — Sonnet 4.6 rejects last-turn prefills (400).
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[competitor-analysis-asset] Anthropic API error:', response.status, errorBody.slice(0, 300));
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.content?.[0]?.text ?? '';
    const parsed = parseAnalysis(rawText);
    if (!parsed) {
      console.error('[competitor-analysis-asset] Unparseable model output.');
      throw new Error('Could not parse the competitor analysis from model output.');
    }

    const competitors = cleanCompetitors(parsed.competitors, evidenceByRef);
    if (competitors.length === 0) {
      console.error('[competitor-analysis-asset] No grounded competitors after the grounding gate.');
      throw new Error('No competitor scores could be grounded in the fetched evidence.');
    }

    const strategicAngle = typeof parsed.strategic_angle === 'string' ? parsed.strategic_angle.trim() : null;

    // Aggregate evidence refs actually used (for the row-level grounding envelope).
    const usedRefs = new Map<string, { kind: string; ref: string }>();
    for (const c of competitors) for (const r of c.evidence_refs) usedRefs.set(r.ref, r);
    const evidence_refs = [...usedRefs.values()];

    // ── Voice-of-customer (reviews modality only) ─────────────────────────────
    // Mine the fetched competitor reviews for avatar S1 vocab / S4 objections.
    // Grounded (verbatim substrings only); null when nothing survives the gate.
    let vocSignals: VocSignals | null = null;
    if (modality === 'reviews/social-proof' && reviewsByRef && reviewsByRef.size > 0) {
      vocSignals = await mineVoc(reviewsByRef);
    }

    // ── Persist (avatar-scoped; only when authed + an avatarId is supplied) ───
    let insightId: string | null = null;
    if (supabaseClient && body.avatarId) {
      try {
        // TODO(types-regen): brand_asset_competitive_insights is not in the
        // generated supabase types yet (migration unapplied to prod) — cast the
        // builder at the boundary. See src/types/competitorInsights.ts.
        const insertRow = {
          avatar_id: body.avatarId,
          asset_id: body.assetId ?? null,
          modality,
          competitors,
          strategic_angle: strategicAngle,
          // VoC signals are persisted INTO the insight record (voc_signals jsonb).
          // The avatar S1/S4 KB write path (user_knowledge_base
          // avatar_s1_vocab / avatar_s4_objections) is owned by the
          // avatar-vocabulary / avatar-objections fns + their host writeback and
          // is intentionally NOT touched from here — writing it would couple this
          // analyzer to that versioned KB contract (is_current / version rows) and
          // risk clobbering the user's own avatar work.
          // TODO(competitor-agents:voc-kb-write): once a safe merge/writeback seam
          // exists, feed vocSignals into avatar_s1_vocab / avatar_s4_objections
          // (de-duped against the user's own reviews) instead of only persisting here.
          voc_signals: vocSignals,
          status: 'completed',
          analyzed_at: new Date().toISOString(),
        };
        const { data: inserted, error: insertError } = await (supabaseClient
          .from('brand_asset_competitive_insights') as unknown as {
            insert: (r: unknown) => {
              select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: unknown }> };
            };
          })
          .insert(insertRow)
          .select('id')
          .single();
        if (insertError) {
          console.error('[competitor-analysis-asset] Persist error:', insertError);
        } else if (inserted) {
          insightId = inserted.id;
        }
      } catch (persistErr) {
        console.error('[competitor-analysis-asset] Persist threw (non-fatal):', persistErr);
      }
    }

    const vocCount = vocSignals ? vocSignals.vocab_clusters.length + vocSignals.objections.length : 0;
    console.log(`[competitor-analysis-asset] Scored ${competitors.length} competitor(s) for touchpoint ${touchpointId} (modality ${modality}, voc_signals=${vocCount}, persisted=${insightId ? 'yes' : 'no'}).`);

    return new Response(
      JSON.stringify({
        competitors,
        strategic_angle: strategicAngle,
        grounding: 'evidence',
        evidence_refs,
        voc_signals: vocSignals,
        insightId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in competitor-analysis-asset function:', error);
    const detail = error instanceof Error ? error.message.slice(0, 200) : 'unknown';
    return new Response(
      JSON.stringify({ error: 'Unable to analyze competitors right now. Please try again.', detail }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

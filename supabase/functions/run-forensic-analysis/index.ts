/**
 * run-forensic-analysis — the forensic Trust Gap engine (signed-in only).
 *
 * Turns one Amazon ASIN into a full forensic IDEA report grounded in the
 * listing's OWN evidence, not the owner's self-assessment. The chain:
 *
 *   1. import-product-data (service-role internal call) scrapes /dp/{asin} and
 *      persists the listing + ~8 reviews under THIS user. The /dp cap means a
 *      thin corpus is normal; the report carries a `thin_corpus` caveat flag.
 *   2. Read the listing + reviews back (service-role, scoped to the verified
 *      user + asin) and build the shared TrustGapEvidence shape
 *      ({listings[], topReviews:["★{rating} — {body}"]}, cap 12, body ≤300) —
 *      mirroring SupabaseProductDataService.buildTrustGapEvidence server-side.
 *   3. DERIVE the four IDEA pillar scores (0-25 each) AND the four-field customer
 *      profile from the corpus via ONE Sonnet call: how well does the LISTING
 *      deliver each pillar, grounded in observable copy + review language, plus a
 *      short read on the real customer (how_they_talk / why_buying_now /
 *      what_builds_trust / what_stops_them). overall = sum (0-100), primary_gap =
 *      lowest pillar. On a thin corpus we MAY blend the scores toward supplied
 *      self-report (labelled inference) and the profile fields stay brief.
 *   4. diagnostic-interpretation-evidence → per-dimension interpretation.
 *   5. identify-decision-trigger → the dominant decision trigger.
 *
 * Auth: verify_jwt = TRUE. The user is derived from the verified Authorization
 * bearer JWT. Steps 1-3 are REQUIRED (a failure ends the run at 422/502). Steps
 * 4 and 5 are best-effort: a single upstream failure degrades that section to
 * null with a `notes` entry rather than failing the whole report.
 *
 * Patterns (auth, Anthropic fetch/headers, defensive JSON parse) cloned from
 * import-product-data / diagnostic-interpretation-evidence / identify-decision-trigger.
 * No PII is logged.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { corsHeaders } from "../_shared/cors.ts";
import { createRateLimiter } from "../_shared/rateLimit.ts";
import { APP_URL } from "../_shared/appUrl.ts";
import { shouldSkipScrape } from "../_shared/forensicFreshness.ts";

// This endpoint is expensive (1 Firecrawl scrape + ~3 Sonnet calls per run), so
// throttle per user. Best-effort per-isolate limiter; overridable via env.
const FORENSIC_RATE_MAX = Number(Deno.env.get("FORENSIC_RATE_LIMIT_MAX") ?? "6");
const FORENSIC_RATE_WINDOW_MS = Number(Deno.env.get("FORENSIC_RATE_LIMIT_WINDOW_MS") ?? "180000"); // 6 / 3 min
const forensicLimiter = createRateLimiter(FORENSIC_RATE_MAX, FORENSIC_RATE_WINDOW_MS);

const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const SONNET_MODEL = "claude-sonnet-4-6";

const ASIN_PATTERN = /^[A-Z0-9]{10}$/i;
/** Shape guard for the optional, observability-only avatar_id (a uuid). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trust Gap evidence caps — mirror SupabaseProductDataService. */
const TRUST_GAP_MAX_REVIEWS = 12;
const TRUST_GAP_REVIEW_BODY_MAX = 300;
/** Below this review count the corpus is thin; UI must show a confidence caveat. */
const THIN_CORPUS_THRESHOLD = 5;
/** Data fresher than this (ms) is reused without re-scraping. */
// 7 days (Matthew, 2026-07-08) — aligned with review-scraper's 7d cache TTL so
// freshness semantics match across the scrape cluster. Env-overridable.
const FRESHNESS_WINDOW_MS = Number(Deno.env.get("FRESHNESS_WINDOW_MS") ?? "604800000");

type Dim = "insight" | "distinctive" | "empathetic" | "authentic";
const DIMS: Dim[] = ["insight", "distinctive", "empathetic", "authentic"];
const DIM_LABELS: Record<Dim, string> = {
  insight: "Insight",
  distinctive: "Distinctiveness",
  empathetic: "Empathy",
  authentic: "Authenticity",
};

// ── Forensic report email (best-effort; sends only when RESEND_API_KEY is set) ──
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FORENSIC_FROM_EMAIL = Deno.env.get("LEAD_FROM_EMAIL") ?? "Trevor <noreply@app.ideabrandconsultancy.com>";
const FORENSIC_CTA_URL = APP_URL;
const BLACK = "#0B0B0C";
const GOLD = "#C9A84C";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

interface SelfReportScores {
  insight: number;
  distinctive: number;
  empathetic: number;
  authentic: number;
  overall: number;
}

/** The customer profile read off the review corpus (demo S5 four fields). */
interface CustomerProfile {
  how_they_talk: string;
  why_buying_now: string;
  what_builds_trust: string;
  what_stops_them: string;
}

interface ForensicRequest {
  asin?: unknown;
  self_report_scores?: unknown;
  /** Optional focus-avatar uuid — observability/forward-readiness only; never persisted here. */
  avatar_id?: unknown;
}

/** A listing row in the shared TrustGapEvidence shape. */
interface TrustGapListing {
  asin?: string;
  title?: string;
  bullets?: string[];
  description?: string;
}
interface TrustGapEvidence {
  listings: TrustGapListing[];
  topReviews: string[];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Type guard: a finite number in [min, max] (after Number coercion). */
function asScore(value: unknown, max: number): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(max, Math.round(n)));
}

/** Parse the optional self_report_scores block; returns null when absent/invalid. */
function parseSelfReport(raw: unknown): SelfReportScores | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const insight = asScore(o.insight, 25);
  const distinctive = asScore(o.distinctive, 25);
  const empathetic = asScore(o.empathetic, 25);
  const authentic = asScore(o.authentic, 25);
  const overall = asScore(o.overall, 100);
  if (insight === null || distinctive === null || empathetic === null || authentic === null) {
    return null;
  }
  return {
    insight,
    distinctive,
    empathetic,
    authentic,
    overall: overall ?? insight + distinctive + empathetic + authentic,
  };
}

/** Defensively lift the first balanced JSON object out of model text. */
function extractFirstObject(text: string): string | null {
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "}") {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start !== -1) return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

/** Format a review row as a "★{rating} — {body}" line, body capped. */
function formatTrustGapReview(rating: number | null, body: string): string {
  return `★${rating ?? 0} — ${body.slice(0, TRUST_GAP_REVIEW_BODY_MAX)}`;
}

/**
 * Check if we have fresh product data with usable reviews for this user/asin pair.
 * Returns true only if:
 * 1. Data exists and was scraped within the freshness window
 * 2. Reviews are actually present (non-zero count)
 *
 * This prevents using stale data OR fresh data with failed review imports.
 */
async function hasRecentData(
  admin: ReturnType<typeof createClient>,
  userId: string,
  asin: string,
): Promise<boolean> {
  // Get product with scraped_at
  const { data: product } = await admin
    .from("user_products")
    .select("id, scraped_at")
    .eq("user_id", userId)
    .eq("asin", asin)
    .single();

  if (!product || !product.scraped_at) return false;

  // Reviews must actually exist before the cache counts as usable — a fresh
  // scraped_at with zero stored reviews means import stored the listing but
  // the review insert failed; on any doubt we scrape.
  const { count } = await admin
    .from("user_product_reviews")
    .select("*", { count: "exact", head: true })
    .eq("product_id", product.id);

  // The decision itself is the unit-tested pure predicate (forensicFreshness).
  return shouldSkipScrape(
    { scraped_at: product.scraped_at, review_count: count ?? 0 },
    FRESHNESS_WINDOW_MS,
  );
}

/**
 * Read this user's persisted listing + reviews for the asin (service-role,
 * filtered to user_id + asin) and assemble the shared TrustGapEvidence shape.
 * Returns the evidence plus the raw review count (for the thin-corpus flag).
 */
async function buildEvidence(
  admin: ReturnType<typeof createClient>,
  userId: string,
  asin: string,
): Promise<{ evidence: TrustGapEvidence; reviewCount: number; hasListing: boolean }> {
  const { data: products, error: prodErr } = await admin
    .from("user_products")
    .select("id, asin, title, bullets, description")
    .eq("user_id", userId)
    .eq("asin", asin);

  if (prodErr) throw new Error(`Failed to read listing: ${prodErr.message}`);

  const rows = (products ?? []) as Array<{
    id: string;
    asin: string;
    title: string | null;
    bullets: unknown;
    description: string | null;
  }>;
  if (rows.length === 0) {
    return { evidence: { listings: [], topReviews: [] }, reviewCount: 0, hasListing: false };
  }

  const listings: TrustGapListing[] = rows.map((r) => ({
    asin: r.asin,
    title: r.title ?? "",
    bullets: Array.isArray(r.bullets) ? r.bullets.filter((b): b is string => typeof b === "string") : [],
    ...(r.description ? { description: r.description } : {}),
  }));

  const productIds = rows.map((r) => r.id);
  const { data: reviews, error: revErr } = await admin
    .from("user_product_reviews")
    .select("rating, body, created_at")
    .in("product_id", productIds)
    .order("created_at", { ascending: false });

  if (revErr) throw new Error(`Failed to read reviews: ${revErr.message}`);

  const reviewRows = (reviews ?? []) as Array<{ rating: number | null; body: string }>;
  const topReviews = reviewRows
    .filter((r) => typeof r.body === "string" && r.body.trim().length > 0)
    .slice(0, TRUST_GAP_MAX_REVIEWS)
    .map((r) => formatTrustGapReview(typeof r.rating === "number" ? r.rating : null, r.body));

  return { evidence: { listings, topReviews }, reviewCount: reviewRows.length, hasListing: true };
}

const SCORING_SYSTEM_PROMPT = `<persona>
You are the forensic scoring engine behind the IDEA Brand Coach Trust Gap diagnostic. You read a seller's Amazon listing and its real customer reviews and score how well the LISTING ITSELF delivers on each of the four IDEA trust pillars. You score the observable evidence, never the owner's opinion of their brand. You are sceptical, specific and grounded.
</persona>

<the-four-pillars>
- Insight (0-25): how well the listing copy shows it understands what really drives this customer, their motivations and emotional triggers, and turns that into messaging. Evidence: does the copy speak to a real need the reviews confirm, or just list features.
- Distinctiveness (0-25): how clearly the listing stakes out a recognisable position instead of blending in with generic category copy. Evidence: a specific, ownable angle in title and bullets, not interchangeable claims.
- Empathy (0-25): how emotionally connected the copy makes the customer feel, whether it speaks to what the customer feels and not just what the product is. Evidence: reviews that echo feeling seen, or copy that names the customer's emotional state.
- Authenticity (0-25): how genuine and credible the listing reads, whether its claims earn belief. Evidence: specifics, proof, transparency; or the opposite, hype the reviews contradict.
</the-four-pillars>

<scoring-discipline>
- Score ONLY from the supplied listing copy and reviews. Do not invent evidence. A thin corpus means lower certainty, not a free high score.
- Each pillar is an integer 0 to 25. 0-9 weak (leaking trust), 10-17 mixed, 18-25 strong.
- A listing that merely lists features with no customer-need language is NOT strong on Insight or Empathy however polished it reads.
- Reviews are the strongest signal: if reviews praise something the copy never claims, that is an Insight/Empathy gap, not a strength.
- CRITICAL GROUNDING RULE: You have access ONLY to the title, bullets, description, and reviews provided. You CANNOT see A+ content, storefront content, videos, or any other Amazon surfaces. Therefore:
  - NEVER assert that a feature, module, or content piece is missing from surfaces you cannot read (A+ content, storefront, videos).
  - When making recommendations about such surfaces, frame them as "I could not access your A+ content, so verify whether..." not as assertions of absence.
  - Base your scoring and claims ONLY on what is present in the provided corpus.
</scoring-discipline>

<customer-profile>
Alongside the scores, sketch a short profile of the real customer behind these reviews. Each field is 1-2 sentences, grounded ONLY in the listing copy and reviews — no invention:
- how_they_talk: how this customer actually speaks about the product. Use their VERBATIM language and phrasing from the reviews where possible.
- why_buying_now: the situation or need that brings them to buy at this moment, drawn from what the reviews reveal about their context.
- what_builds_trust: what makes this customer believe and buy — the specifics, proof, or reassurance that reviews show they respond to.
- what_stops_them: the hesitation, doubt, or friction that holds this customer back, drawn from negative reviews, complaints, or unaddressed concerns.
On a thin corpus, keep these brief and clearly inferred from what little is present; do not pad with invention.
</customer-profile>

<output-format>
Respond with ONLY one JSON object, no code fences, no commentary, exactly these keys. The four pillar values are integers 0-25; the four customer_profile values are short strings (1-2 sentences each):
{"insight":<0-25>,"distinctive":<0-25>,"empathetic":<0-25>,"authentic":<0-25>,"customer_profile":{"how_they_talk":"<1-2 sentences>","why_buying_now":"<1-2 sentences>","what_builds_trust":"<1-2 sentences>","what_stops_them":"<1-2 sentences>"}}
</output-format>`;

/** Build the user message handed to the forensic scoring call. */
function buildScoringMessage(evidence: TrustGapEvidence, thinCorpus: boolean): string {
  const listingXml = evidence.listings
    .map((l) => {
      const bullets = (l.bullets ?? []).map((b) => `    <bullet>${b}</bullet>`).join("\n");
      const desc = l.description ? `\n    <description>${l.description.slice(0, 2000)}</description>` : "";
      return `  <listing>\n    <title>${l.title ?? ""}</title>\n${bullets}${desc}\n  </listing>`;
    })
    .join("\n");
  const reviewsXml = evidence.topReviews.map((r) => `  <review>${r}</review>`).join("\n");
  const corpusNote = thinCorpus
    ? "The review corpus is THIN (fewer than 5 reviews). Score conservatively from what is present; do not reach for high scores you cannot ground."
    : "";
  return `<listings>
${listingXml}
</listings>
<reviews>
${reviewsXml}
</reviews>
${corpusNote}
Score the four IDEA pillars AND sketch the customer profile now as the JSON object, grounded only in the listing copy and reviews above.`;
}

/** One Anthropic Sonnet call. Returns the text + status; never throws. */
async function callSonnet(systemPrompt: string, userMessage: string, maxTokens: number): Promise<{ text: string; status: number | string }> {
  const headers = {
    "x-api-key": anthropicApiKey!,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "prompt-caching-2024-07-31",
    "Content-Type": "application/json",
  };
  const body = JSON.stringify({
    model: SONNET_MODEL,
    max_tokens: maxTokens,
    temperature: 0.3,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage }],
  });
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(CLAUDE_API_URL, { method: "POST", headers, body });
    } catch (err) {
      console.error(`[run-forensic-analysis] Sonnet attempt ${attempt} network error:`, err);
    }
    if (res?.ok) {
      const data = await res.json();
      return { text: data?.content?.[0]?.text ?? "", status: res.status };
    }
    const status = res?.status ?? "network-error";
    const retryable = !res || res.status === 429 || res.status >= 500;
    if (!retryable || attempt === 2) return { text: "", status };
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { text: "", status: "exhausted" };
}

/** Parse + clamp the forensic pillar scores from model text. Null on failure. */
function parseForensicScores(text: string): Record<Dim, number> | null {
  const candidates = [text.trim(), extractFirstObject(text)].filter((c): c is string => !!c);
  for (const candidate of candidates) {
    try {
      const o = JSON.parse(candidate) as Record<string, unknown>;
      const out = {} as Record<Dim, number>;
      let ok = true;
      for (const dim of DIMS) {
        const v = asScore(o[dim], 25);
        if (v === null) {
          ok = false;
          break;
        }
        out[dim] = v;
      }
      if (ok) return out;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** Coerce one customer-profile field to a trimmed string; "" when absent/non-string. */
function asProfileField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Parse the customer_profile block from the SAME scoring-call text. Never throws:
 * a missing/unparseable block (or any missing field) degrades to empty strings,
 * which the UI renders honestly. Reuses the balanced-object extraction so a model
 * that wraps the JSON in prose still yields the profile.
 */
function parseCustomerProfile(text: string): CustomerProfile {
  const empty: CustomerProfile = {
    how_they_talk: "",
    why_buying_now: "",
    what_builds_trust: "",
    what_stops_them: "",
  };
  const candidates = [text.trim(), extractFirstObject(text)].filter((c): c is string => !!c);
  for (const candidate of candidates) {
    try {
      const o = JSON.parse(candidate) as Record<string, unknown>;
      const cp = (o.customer_profile && typeof o.customer_profile === "object")
        ? (o.customer_profile as Record<string, unknown>)
        : null;
      if (!cp) continue;
      const out: CustomerProfile = {
        how_they_talk: asProfileField(cp.how_they_talk),
        why_buying_now: asProfileField(cp.why_buying_now),
        what_builds_trust: asProfileField(cp.what_builds_trust),
        what_stops_them: asProfileField(cp.what_stops_them),
      };
      // Accept the first candidate that yields at least one populated field.
      if (out.how_they_talk || out.why_buying_now || out.what_builds_trust || out.what_stops_them) {
        return out;
      }
    } catch {
      // try the next candidate
    }
  }
  return empty;
}

/**
 * Blend forensic + self-report when the corpus is thin. The forensic read stays
 * dominant (2/3 weight) so the score remains evidence-led; the self-report only
 * nudges it. Always labelled inference upstream by the thin_corpus flag.
 */
function blendThin(forensic: Record<Dim, number>, self: SelfReportScores): Record<Dim, number> {
  const out = {} as Record<Dim, number>;
  for (const dim of DIMS) {
    out[dim] = Math.max(0, Math.min(25, Math.round(forensic[dim] * (2 / 3) + self[dim] * (1 / 3))));
  }
  return out;
}

/** Flatten the TrustGapEvidence into the {listing_copy, reviews} string shape
 *  diagnostic-interpretation-evidence expects (it grades + cites against these). */
function flattenForInterpretation(evidence: TrustGapEvidence): { listing_copy: string; reviews: string } {
  const listing_copy = evidence.listings
    .map((l) => {
      const bullets = (l.bullets ?? []).map((b) => `- ${b}`).join("\n");
      const desc = l.description ? `\n${l.description}` : "";
      return [l.title ?? "", bullets, desc].filter((s) => s.trim().length > 0).join("\n");
    })
    .join("\n\n");
  const reviews = evidence.topReviews.join("\n");
  return { listing_copy, reviews };
}

interface ForensicEmailInput {
  email: string;
  pillars: Record<Dim, number>; // 0-25
  overall: number;              // 0-100
  primaryGap: Dim;
  reviewCount: number;
  thinCorpus: boolean;
  listingTitle?: string;
  trigger: { dominantType?: string; brandAnchor?: string; whyThisTrigger?: string } | null;
}

/** Build the forensic Trust Gap report email (deterministic from the run result). */
function buildForensicEmailHtml(r: ForensicEmailInput): string {
  const band = r.overall <= 39 ? "Weak" : r.overall <= 69 ? "Mixed" : "Strong";
  const rows = DIMS.map((d) => {
    const pct = Math.round((r.pillars[d] / 25) * 100);
    return `<tr>
      <td style="padding:9px 0;font-family:Arial,Helvetica,sans-serif;color:${BLACK};width:150px;vertical-align:top;"><strong>${DIM_LABELS[d]}</strong><br/><span style="font-size:12px;color:#6b7280;">${r.pillars[d]} / 25</span></td>
      <td style="padding:9px 0;vertical-align:middle;"><div style="background:#e9edf2;border-radius:6px;height:14px;width:100%;"><div style="background:${GOLD};border-radius:6px;height:14px;width:${pct}%;"></div></div></td>
    </tr>`;
  }).join("");
  const triggerBlock = r.trigger?.dominantType
    ? `<div style="margin:24px 0 0;padding:18px;border-left:4px solid ${GOLD};background:#fbf8ef;">
         <p style="margin:0 0 6px;font-size:11px;font-weight:bold;letter-spacing:.05em;text-transform:uppercase;color:#9a7b1f;">Your Decision Trigger&#8482;</p>
         <p style="margin:0 0 8px;font-size:17px;font-weight:bold;color:${BLACK};">${escapeHtml(r.trigger.dominantType)}</p>
         ${r.trigger.brandAnchor ? `<p style="margin:0 0 8px;font-size:14px;color:${BLACK};">${escapeHtml(r.trigger.brandAnchor)}</p>` : ""}
         ${r.trigger.whyThisTrigger ? `<p style="margin:0;font-size:14px;line-height:1.5;color:${BLACK};">${escapeHtml(r.trigger.whyThisTrigger)}</p>` : ""}
       </div>`
    : "";
  const thinNote = r.thinCorpus
    ? `<p style="margin:14px 0 0;font-size:13px;color:#9a3412;background:#fff7ed;border-radius:8px;padding:10px 12px;">This read is based on ${r.reviewCount} review${r.reviewCount === 1 ? "" : "s"}, so treat it as directional.</p>`
    : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9f9f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:24px 0;"><tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:${BLACK};padding:28px 32px;">
          <h1 style="margin:0;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:22px;">Your Forensic Trust Gap&#8482; Report</h1>
          <p style="margin:8px 0 0;color:${GOLD};font-family:Arial,Helvetica,sans-serif;font-size:13px;">Read from your listing's real reviews evidence</p>
        </td></tr>
        <tr><td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;color:${BLACK};">
          ${r.listingTitle ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">${escapeHtml(r.listingTitle)}</p>` : ""}
          <div style="text-align:center;margin:0 0 22px;padding:18px;background:#f9f9f9;border-radius:10px;">
            <div style="font-size:40px;font-weight:bold;color:${BLACK};">${r.overall}<span style="font-size:18px;color:#6b7280;">/100</span></div>
            <div style="font-size:13px;color:#6b7280;">Forensic trust score · ${band} · grounded in ${r.reviewCount} real review${r.reviewCount === 1 ? "" : "s"}</div>
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
          <div style="margin:22px 0 0;padding:18px;border-left:4px solid ${GOLD};background:#fbf8ef;">
            <p style="margin:0 0 6px;font-size:14px;color:${BLACK};"><strong>Your biggest opportunity: ${DIM_LABELS[r.primaryGap]}</strong></p>
            <p style="margin:0;font-size:14px;line-height:1.5;color:${BLACK};">${DIM_LABELS[r.primaryGap]} is where your listing leaks the most trust right now. The fastest place to win it back. Close this first and the whole brand lifts.</p>
          </div>
          ${triggerBlock}
          ${thinNote}
          <div style="text-align:center;margin:28px 0 8px;">
            <a href="${escapeHtml(FORENSIC_CTA_URL)}/v5" style="display:inline-block;background:${GOLD};color:${BLACK};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:15px;padding:13px 28px;border-radius:8px;">Open your design brief</a>
          </div>
          <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">You ran a forensic analysis in IDEA Brand Coach. Reply any time and the team will help you read your results.</p>
        </td></tr>
      </table>
    </td></tr></table></body></html>`;
}

/** Send the forensic report via Resend. Best-effort: returns true on a confirmed send. */
async function sendForensicEmail(input: ForensicEmailInput): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FORENSIC_FROM_EMAIL,
        to: [input.email],
        subject: "Your forensic Trust Gap report",
        html: buildForensicEmailHtml(input),
      }),
    });
    if (!res.ok) {
      console.error(`[run-forensic-analysis] resend failed status=${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[run-forensic-analysis] resend error:", err instanceof Error ? err.message : "unknown");
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!anthropicApiKey) return jsonResponse({ ok: false, error: "Anthropic API key not configured" }, 500);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // ── Auth: derive the user from the verified bearer JWT (verify_jwt=true also
  //    gates this at the platform edge; we still resolve the user id here). ──
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await userClient.auth.getUser(token);
  if (!user) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  const userId = user.id;
  const userEmail = typeof user.email === "string" ? user.email : null;

  // Per-user throttle on this expensive endpoint (cost/abuse guard).
  if (forensicLimiter.isRateLimited(`user:${userId}`)) {
    return jsonResponse(
      { ok: false, error: "You're running analyses quickly — please wait a moment and try again." },
      429,
    );
  }

  try {
    // ── Validate input ──
    const body = (await req.json().catch(() => null)) as ForensicRequest | null;
    const asinRaw = typeof body?.asin === "string" ? body.asin.trim() : "";
    if (!ASIN_PATTERN.test(asinRaw)) {
      return jsonResponse({ ok: false, error: "asin must match /^[A-Z0-9]{10}$/i" }, 400);
    }
    const asin = asinRaw.toUpperCase();
    const selfReport = parseSelfReport(body?.self_report_scores);
    // ADDITIVE + OPTIONAL: focus avatar at run time. Shape-only validation (a
    // uuid-shaped string, else null — malformed is ignored). Used ONLY for
    // server-side observability below; never persisted, never alters scoring or
    // the response. A uuid carries no PII, so it is safe to log.
    const avatarId = typeof body?.avatar_id === "string" && UUID_PATTERN.test(body.avatar_id)
      ? body.avatar_id
      : null;

    // Service-role client for the internal import + the scoped read-back.
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── Step 1: Check for recent data first, only import if stale or missing. ──
    const hasFreshData = await hasRecentData(admin, userId, asin);

    if (!hasFreshData) {
      // Data is stale or missing, call import-product-data to refresh
      const importRes = await fetch(`${supabaseUrl}/functions/v1/import-product-data`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ asins: [asin] }),
      });
      if (!importRes.ok) {
        const detail = await importRes.text();
        console.error("[run-forensic-analysis] import-product-data failed", importRes.status, detail.slice(0, 300));
        return jsonResponse({ ok: false, error: "Could not import this listing. Please try again." }, 502);
      }
      const importJson = (await importRes.json()) as { results?: Array<{ asin: string; ok: boolean; error?: string }> };
      const importItem = importJson.results?.find((r) => r.asin?.toUpperCase() === asin);
      if (!importItem || !importItem.ok) {
        return jsonResponse(
          { ok: false, error: importItem?.error ?? "No Amazon listing found for this ASIN. Double-check it and try again." },
          422,
        );
      }
      console.log(`[run-forensic-analysis] fresh scrape for asin=${asin}`);
    } else {
      console.log(`[run-forensic-analysis] reusing cached data for asin=${asin}`);
    }

    // ── Step 2: read back + build TrustGapEvidence (scoped to user + asin). ──
    const { evidence, reviewCount, hasListing } = await buildEvidence(admin, userId, asin);
    if (!hasListing) {
      return jsonResponse({ ok: false, error: "The listing could not be read back after import." }, 422);
    }
    const thinCorpus = reviewCount < THIN_CORPUS_THRESHOLD;

    // ── Step 3: DERIVE forensic IDEA scores + customer profile from the corpus
    //    (ONE Sonnet call — both come back in the same structured JSON). ──
    const scoring = await callSonnet(SCORING_SYSTEM_PROMPT, buildScoringMessage(evidence, thinCorpus), 700);
    let pillars = parseForensicScores(scoring.text);
    if (!pillars) {
      console.error("[run-forensic-analysis] forensic scoring unparseable | upstream=", scoring.status, "| raw=", scoring.text.slice(0, 300));
      return jsonResponse({ ok: false, error: "Could not score this listing right now. Please try again." }, 502);
    }
    // Customer profile from the SAME call; never throws (empty-string fallback per field).
    const customerProfile = parseCustomerProfile(scoring.text);
    // Thin corpus + self-report supplied: blend toward self-report (labelled inference via thin_corpus).
    if (thinCorpus && selfReport) {
      pillars = blendThin(pillars, selfReport);
    }
    const overall = DIMS.reduce((acc, d) => acc + pillars![d], 0); // 0-100
    const primaryGap = DIMS.reduce((lowest, d) => (pillars![d] < pillars![lowest] ? d : lowest), DIMS[0]);

    const forensicScores: SelfReportScores = {
      insight: pillars.insight,
      distinctive: pillars.distinctive,
      empathetic: pillars.empathetic,
      authentic: pillars.authentic,
      overall,
    };

    const notes: string[] = [];

    // ── Step 4: diagnostic-interpretation-evidence (best-effort; degrade to null). ──
    let interpretation: unknown = null;
    try {
      const flat = flattenForInterpretation(evidence);
      const interpRes = await fetch(`${supabaseUrl}/functions/v1/diagnostic-interpretation-evidence`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          scores: { insight: pillars.insight, distinctive: pillars.distinctive, empathetic: pillars.empathetic, authentic: pillars.authentic },
          overall,
          primaryGap,
          evidence: { listing_copy: flat.listing_copy, reviews: flat.reviews },
        }),
      });
      if (interpRes.ok) {
        interpretation = await interpRes.json();
      } else {
        notes.push("Interpretation could not be generated for this run.");
        console.error("[run-forensic-analysis] interpretation degraded", interpRes.status);
      }
    } catch (err) {
      notes.push("Interpretation could not be generated for this run.");
      console.error("[run-forensic-analysis] interpretation error:", err);
    }

    // ── Step 5: identify-decision-trigger (best-effort; 422 on thin corpus → null). ──
    let decisionTrigger: unknown = null;
    try {
      const triggerRes = await fetch(`${supabaseUrl}/functions/v1/identify-decision-trigger`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: `forensic-${asin}`,
          scores: { insight: pillars.insight, distinctive: pillars.distinctive, empathetic: pillars.empathetic, authentic: pillars.authentic },
          evidence,
        }),
      });
      if (triggerRes.ok) {
        decisionTrigger = await triggerRes.json();
      } else if (triggerRes.status === 422) {
        notes.push("Decision trigger needs a richer review corpus than this listing currently has.");
      } else {
        notes.push("Decision trigger could not be derived for this run.");
        console.error("[run-forensic-analysis] decision trigger degraded", triggerRes.status);
      }
    } catch (err) {
      notes.push("Decision trigger could not be derived for this run.");
      console.error("[run-forensic-analysis] decision trigger error:", err);
    }

    // ── Step 6: email the forensic report (best-effort; never fails the run). ──
    let emailed = false;
    if (userEmail) {
      const dt = (decisionTrigger && typeof decisionTrigger === "object")
        ? decisionTrigger as Record<string, unknown>
        : null;
      const triggerForEmail = dt
        ? {
            dominantType: typeof dt.dominantType === "string" ? dt.dominantType : undefined,
            brandAnchor: typeof dt.brandAnchor === "string" ? dt.brandAnchor : undefined,
            whyThisTrigger: typeof dt.whyThisTrigger === "string" ? dt.whyThisTrigger : undefined,
          }
        : null;
      emailed = await sendForensicEmail({
        email: userEmail,
        pillars: pillars!,
        overall,
        primaryGap,
        reviewCount,
        thinCorpus,
        listingTitle: evidence.listings[0]?.title,
        trigger: triggerForEmail,
      });
      if (!emailed) notes.push("We couldn't email your report just now — it's saved in the app above.");
    }

    console.log(
      `[run-forensic-analysis] ok asin=${asin} avatar=${avatarId ?? "none"} reviews=${reviewCount} thin=${thinCorpus} gap=${primaryGap} emailed=${emailed} notes=${notes.length}`,
    );

    return jsonResponse({
      ok: true,
      asin,
      reviews_analyzed: reviewCount,
      thin_corpus: thinCorpus,
      forensic_scores: forensicScores,
      primary_gap: primaryGap,
      interpretation,
      decision_trigger: decisionTrigger,
      customer_profile: customerProfile,
      emailed,
      listing: {
        title: evidence.listings[0]?.title,
        bullets: evidence.listings[0]?.bullets ?? [],
      },
      ...(notes.length > 0 ? { notes } : {}),
    });
  } catch (error) {
    console.error("[run-forensic-analysis] unexpected error:", error);
    return jsonResponse({ ok: false, error: "Unable to run the forensic analysis right now. Please try again." }, 500);
  }
});

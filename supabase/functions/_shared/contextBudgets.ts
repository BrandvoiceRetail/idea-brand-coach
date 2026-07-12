/**
 * Context-budget constants — the "lever" from ADR-CONTEXT-BUDGET-LEVER.
 *
 * Every location that reads an unbounded (or effectively unbounded) collection
 * from the DB and then feeds it into an LLM prompt or an MCP tool response MUST
 * cap it via a NAMED constant from a module like this one — never a bare magic
 * number inline. See docs/architecture/ADR-CONTEXT-BUDGET-LEVER.md for the full
 * rationale and the audit that motivated it.
 *
 * SCOPE OF THIS FILE: Deno edge functions only (`supabase/functions/**`). The
 * Node-side MCP gateway (`src/mcp/**`) is a SEPARATE bundle boundary — it
 * cannot import this file — so it gets its OWN parallel constants module
 * (`src/mcp/service/contextBudgets.ts`) using the SAME naming convention below.
 * This mirrors the existing "twin file" pattern in this repo (parse-amazon.ts /
 * parseAmazonProduct.ts): duplicate the CONVENTION across a hard bundle
 * boundary, don't try to force a shared import that can't exist.
 *
 * NAMING CONVENTION — <SCOPE>_<CONSUMER>_<UNIT>:
 *
 *   INTERNAL_PROMPT_*  Bounds data going into THIS edge function's own LLM
 *                      call. The caller never sees this data directly — only
 *                      the model's output. Failure mode if missing: quality
 *                      dilution (truncation happens implicitly, wherever the
 *                      model's own context window runs out, not where a human
 *                      chose) and invisible $ cost, both easy to miss until
 *                      someone notices a bad answer or a bill. These are
 *                      PROMPT-DESIGN decisions bound to a specific model and
 *                      persona — tune via code review, not an env var. An env
 *                      var invites someone who hasn't read the prompt to
 *                      silently change what "enough evidence" means for a
 *                      scoring or synthesis call.
 *
 *   MCP_RESPONSE_*     Bounds data returned directly in an MCP tool's
 *                      content/structuredContent — i.e. straight into a LIVE
 *                      CALLING AGENT'S conversation context. Failure mode if
 *                      missing: the end user feels it immediately (slower
 *                      replies, faster context exhaustion), not a background
 *                      cost. Caller-supplied values are fine here (the caller
 *                      may legitimately want more or less), but MUST be
 *                      clamped to a hard ceiling constant — never trust caller
 *                      input unclamped. Provide both a DEFAULT and a CEILING
 *                      even when they're numerically equal today; the two
 *                      names document that they're conceptually different
 *                      levers (what most callers get vs. the hard cap) and
 *                      leave room for a future "callers can ask for more, up
 *                      to X" without re-deriving the concept.
 *
 *   PER_ITEM_*         Bounds ONE item's size regardless of destination —
 *                      applies whether that item ends up in an internal
 *                      prompt or an MCP response.
 *
 * When you add a new consumer of review/evidence/KB/conversation data, add its
 * constant HERE with the same discipline (a comment naming what it bounds and
 * which failure mode it guards), then import it — do not inline a new magic
 * number in the consuming function.
 */

// ── run-forensic-analysis (Trust Gap scoring) ──────────────────────────────
// The ONE genuine row-count cap in the review pipeline — applied in
// buildEvidence() BEFORE any prompt is built, so every downstream call in that
// function (the scoring prompt itself, diagnostic-interpretation-evidence,
// identify-decision-trigger) inherits the same small, pre-sliced evidence
// object regardless of how many reviews exist in the DB.
export const INTERNAL_PROMPT_TRUST_GAP_REVIEW_ROWS = 12;
export const INTERNAL_PROMPT_TRUST_GAP_REVIEW_BODY_CHARS = 300;

// ── avatar-vocabulary (Avatar 2.0 Stage 1) / avatar-objections (Stage 4) ───
// Char-budget applied AFTER a full unbounded corpus read/normalise. Shared
// value: both stages mine the same review corpus for a different purpose
// (vocabulary vs. objections) and should stay in sync unless a reason to
// diverge is documented here.
export const INTERNAL_PROMPT_AVATAR_CORPUS_CHARS = 16_000;

// ── reveal-signature ────────────────────────────────────────────────────────
// Char-budget on pasted/resolved reviews feeding Signature synthesis.
export const INTERNAL_PROMPT_SIGNATURE_REVIEW_CHARS = 12_000;

// ── review-scraper ──────────────────────────────────────────────────────────
// The ONE MCP-RESPONSE-facing cap in this chain today: review-scraper's result
// is returned directly in ingest_evidence's structuredContent, so this number
// is conversation-context cost for whoever calls that tool, not just an
// internal prompt budget. DEFAULT and CEILING are both 50 as of 2026-07-12
// (raised from a 20 default — the click-expanded review scrape now regularly
// exceeds 20 reviews per listing, where the old default rarely bound anything).
export const MCP_RESPONSE_REVIEW_SCRAPER_MAX_PER_URL_DEFAULT = 50;
export const MCP_RESPONSE_REVIEW_SCRAPER_MAX_PER_URL_CEILING = 50;

// ── shared review normalisation (amazonReviews.ts: reviewsFromJson) ────────
// Per-item cap on a single review's body — applies to EVERY consumer above,
// regardless of which one reads the result.
export const PER_ITEM_REVIEW_BODY_CHARS = 2_000;

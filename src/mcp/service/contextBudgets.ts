/**
 * Context-budget constants — MCP gateway side (the "lever" from ADR-CONTEXT-BUDGET-LEVER).
 *
 * Twin of `supabase/functions/_shared/contextBudgets.ts` on the Deno side: same naming
 * convention, a SEPARATE file because the Node MCP gateway and the Deno edge functions are
 * different bundle boundaries and cannot share an import (mirrors the parse-amazon twin-file
 * pattern). See `docs/architecture/ADR-CONTEXT-BUDGET-LEVER.md`.
 *
 * NAMING — `MCP_RESPONSE_*` bounds data returned directly in a tool's content/structuredContent,
 * i.e. straight into a LIVE calling agent's conversation context. Caller-supplied values are fine
 * but MUST clamp to a hard ceiling here — the end user feels an unbounded response immediately
 * (slower replies, faster context exhaustion), so this is where the ceiling lives.
 */

// ── mine_reviews (deterministic review counting) ────────────────────────────
// The tool returns a per-keyword theme table + verbatim VOC fragments straight into the caller's
// context, so both the input it processes and the output it emits are bounded here.
//   - MAX_KEYWORDS: the skill designs 6-9 keywords; 12 is the hard ceiling (a caller asking for
//     more is clamped, not trusted). Bounds the theme-table size directly.
//   - MAX_INPUT_REVIEWS: bounds the corpus the engine scans per call (compute + response cost).
//     A Tier-0 /dp sample is ~20-50; a Tier-1 full corpus could be thousands — cap the per-call read.
export const MCP_RESPONSE_MINE_REVIEWS_MAX_KEYWORDS = 12;
export const MCP_RESPONSE_MINE_REVIEWS_MAX_INPUT_REVIEWS = 500;

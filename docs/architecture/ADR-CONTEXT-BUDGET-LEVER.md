# ADR — Context-budget lever: capping data before it reaches an LLM prompt or an MCP response

**Status:** Decided — **build a small, named DIAL layer + a cheap, wide METER layer, kept
separate** (2026-07-12).
**Context trigger:** shipping the Amazon-review click-expansion fix (more reviews scraped per
listing) surfaced that this app already had SIX different, inconsistent, undocumented caps
guarding LLM/MCP context size — discovered one at a time, ad hoc, while tracing that single
change's compute impact. A repo-wide sweep found seven MORE locations with the same shape and
no cap at all. Question: what's the actual convention going forward?

## TL;DR

**Separate the CONTROL layer from the OBSERVABILITY layer — they solve different problems and
should not be conflated into one mechanism.**

- **Dials** (`contextBudgets.ts`): a small, deliberately short list of NAMED constants that
  actually bound something — row counts, char budgets, MCP-response counts. Code-reviewed, not
  env-tunable (these are prompt-design decisions, not ops knobs), one shared module per runtime
  boundary. **Built today**, six constants, migrated from six pre-existing inline magic numbers.
- **Meters** (recommended, not built today): lightweight, wide-coverage instrumentation of
  ACTUAL context/response size at every call — including calls with no dial. This is what tells
  you where a NEW dial is eventually warranted, instead of guessing or dialing everything
  preemptively. The MCP side already has the perfect free extension point:
  `src/mcp/instrument.ts`'s `emitToolLatency`, which already wraps every tool call uniformly
  for latency telemetry — adding a response-size field there costs nothing per-tool.

The insight that shaped this split (Matthew, 2026-07-12): *"there will be fewer context dials
than context meters."* Not every place data flows toward an LLM needs a tunable cap — most just
need someone to be able to SEE how big they are.

## The audit that motivated this

### Six dials already existed, scattered, with no shared vocabulary

| Location | Cap (before) | Unit | Fed |
|---|---|---|---|
| `run-forensic-analysis` `buildEvidence()` | 12 rows × 300 chars | row-count + per-item char | internal prompt |
| `avatar-vocabulary` (S1) | 16,000 chars, inline | char-budget-after-full-read | internal prompt |
| `avatar-objections` (S4) | 16,000 chars, inline | char-budget-after-full-read | internal prompt |
| `reveal-positioning-statement` | 12,000 chars, inline | char-budget-after-full-read | internal prompt |
| `review-scraper` `maxReviewsPerUrl` | 20 default / 50 ceiling | caller-clamped count | **MCP response** |
| `amazonReviews.ts` `reviewsFromJson` | 2,000 chars | per-item | either |

Every one of these was a locally-scoped magic number with zero cross-reference to the others.
Auditing "what's our total context exposure for a review corpus" required reading six files.
Two used three genuinely different truncation strategies (row-count-then-slice,
read-everything-then-char-slice, caller-supplied-clamped-count) with no documentation of which
fits a new case. **Only one of the six** — `review-scraper`'s cap — bounds something that lands
directly in a live calling agent's context (an MCP tool response); the other five bound an
internal edge-function-to-Anthropic call the caller never sees the raw size of. Nothing in the
codebase named this distinction before today, which is exactly why a click-expansion fix that
only obviously affected review-scraper's cap took real tracing to confirm it left the other
five's *cost* unchanged (they have their own fixed ceilings) while making them more likely to
actually *hit* those ceilings.

### Seven more locations have NO cap at all (swept 2026-07-12, not remediated in this ADR)

| Location | Reads | Feeds |
|---|---|---|
| `src/mcp/service/coachConversations.ts` `getConversation` | ALL messages in one chat session, no `.limit()` | **MCP response** (`get_coach_conversation`) — most severe finding, a full unbounded transcript |
| `src/mcp/service/coachConversations.ts` `listConversations` | ALL sessions for the caller | MCP response (`list_coach_conversations`) — metadata only, lower severity |
| `src/mcp/service/contextResolver.ts` `readUserProductReviews` | ALL reviews across ALL the caller's products | internal (resolver slot feeding e.g. `generate_brief`) |
| `src/mcp/service/contextResolver.ts` `readUserProducts` | ALL products for the caller | internal (resolver slot) |
| `supabase/functions/brand-ai-assistant/index.ts` | ALL current KB entries, concatenated with no char cap | internal prompt |
| `src/mcp/service/nativeLedger.ts` `getAssetHistory` | ALL events for one asset | **MCP response** (`get_asset_history`) |
| `supabase/functions/import-product-data/index.ts` `persistProduct` | writes ALL scraped reviews to `user_product_reviews`, no cap | DB write (asymmetric with `review-scraper`'s capped path) |

**Worth citing directly:** `src/mcp/service/nativeLedger.ts`'s `list_assets`
(`.limit(Math.min(params.limit ?? 50, 200))`) independently converged on the exact same
caller-clamped shape as `review-scraper`'s `maxReviewsPerUrl`, without either file referencing
the other. Two unrelated parts of the codebase invented the same pattern in isolation — the
strongest evidence that this needs a named, shared convention rather than continuing to let each
new consumer reinvent it.

None of these seven are fixed by this ADR. They're listed here because the convention below
needs to be judged against the FULL scope of the problem, not just the six that already had a
number. Whether/when to add a dial vs. a meter to each is Matthew's call — see Consequences.

## Decision

### Dial layer — one shared, documented module PER RUNTIME BOUNDARY

`supabase/functions/` (Deno edge functions) and `src/mcp/` (the Node-bundled MCP gateway) are
separate bundle boundaries — Deno edge functions bundle only their own folder + `_shared/`, and
cannot import from `src/`. This is the same hard boundary that already produced this repo's
"twin file" pattern (`parse-amazon.ts` / `parseAmazonProduct.ts` — verbatim-duplicated logic,
mechanically kept in sync by a dedicated test). Rather than force an artificial shared package
across a boundary that can't actually share code, the dial layer follows the SAME precedent:
**one canonical module per boundary, both following the identical naming convention, neither
importing the other.**

- **Deno side (built today):** `supabase/functions/_shared/contextBudgets.ts` — six constants,
  migrated from the six pre-existing magic numbers above, zero behavior change. Every current
  Deno consumer (`run-forensic-analysis`, `avatar-vocabulary`, `avatar-objections`,
  `reveal-positioning-statement`, `review-scraper`, `amazonReviews.ts`) now sources its cap from here.
- **Node/MCP side (not yet created):** `src/mcp/service/contextBudgets.ts`, to be created when
  the first Node-side consumer adopts a dial (none of today's seven newly-found gaps were given
  one in this ADR — see Consequences). Same naming convention, same discipline, separate file.

**Naming convention — `<SCOPE>_<CONSUMER>_<UNIT>`:**

- `INTERNAL_PROMPT_*` — bounds data going into the function's OWN LLM call. The caller never
  sees the raw size, only the model's output. Failure mode if missing: quality dilution
  (truncation happens implicitly, wherever the model's context window runs out, not where a
  human chose) and invisible $ cost. **Not env-tunable** — these are prompt-design decisions
  bound to a specific model and persona; an env var would let someone who hasn't read the prompt
  silently redefine what "enough evidence" means for a scoring or synthesis call.
- `MCP_RESPONSE_*` — bounds data returned directly in an MCP tool's response, landing straight
  in a LIVE calling agent's context. Failure mode if missing: the end user feels it immediately
  (slower replies, faster context exhaustion) — not a background cost. Caller-tunable is fine
  (a caller may legitimately want more or less) but MUST clamp to a hard ceiling constant —
  never trust caller input unclamped. Always define a DEFAULT and a CEILING as separate named
  constants, even when numerically equal today (as `review-scraper`'s are, both 50) — the two
  names document they're conceptually different levers and leave room for a future
  "callers can ask for more, up to X" without re-deriving the concept.
- `PER_ITEM_*` — bounds one item's size regardless of destination.

### Meter layer — recommended, not built in this ADR

Dials are deliberately few. Everything else that flows toward an LLM or an MCP response should
still be OBSERVABLE, even without a dial, so a future decision about where to add one is based
on real usage trending toward a problem rather than a guess. The recommended, near-zero-cost
mechanism:

- **MCP side:** extend `src/mcp/instrument.ts`'s `emitToolLatency` — which ALREADY wraps every
  `registerTool` handler uniformly for the existing `mcp_tool_latency` PostHog event — with a
  response-size field (e.g. `response_size_chars`, computed once from the already-available
  `result` object). This adds metering to EVERY MCP tool, including all of today's seven
  unremediated findings, with no per-tool wiring — the exact mechanism that already makes
  latency telemetry uniform across 28+ tools without editing each one.
- **Edge-function side:** no equivalent uniform wrapper exists for Deno edge functions today —
  that's a real asymmetry between the two runtime boundaries worth naming, not solving here.
  Until one exists, the interim recommendation is the same lightweight pattern several edge
  functions already use ad hoc (`run-forensic-analysis` already logs `reviews=${reviewCount}` in
  its structured console output) — extend that same habit to the newly-found ungated edge-fn
  read (`brand-ai-assistant`) rather than leaving it silent.

## Rationale

**Single Responsibility (actors lens, `SOLID_QUICK_REFERENCE.md`):** a dial changes for one
actor — someone doing prompt design or capacity planning, reviewing a specific number in code
review. A meter changes for a different actor — someone building observability/dashboards,
who wants breadth of coverage over precision of control. Conflating them (e.g. making every cap
env-tunable "for visibility," or trying to make every meter a hard limit "for safety") means one
mechanism now changes for two unrelated reasons — the exact divergent-change smell this
principle warns against. Keeping them as two deliberately different mechanisms, sized
differently (few dials, many meters), avoids that.

**Screaming Architecture:** before this decision, "context budget" had no home — it was an
implicit property of six unrelated functions, discoverable only by reading all of them. Giving
it an explicit module per boundary means the codebase's structure now names this concern instead
of hiding it inside whichever function happened to need a cap first.

**Dependency Rule:** both `contextBudgets.ts` modules are leaf-level, zero-dependency constant
exports — pure inward-facing utility, nothing points outward to a framework or a specific
consumer. No violation risk.

## Consequences

- **Shipped today:** the Deno-side dial module, with all six pre-existing caps migrated
  (zero behavior change) plus the `review-scraper` cap raise (20→50 default, per the click-fix
  work) expressed through it.
- **Not shipped, explicitly flagged for a separate decision:** the seven newly-found ungated
  locations in the audit table above. The most severe — `get_coach_conversation`'s fully
  unbounded chat-transcript MCP response — has no cap of any kind today; whether it needs a dial
  (a message-count or char cap) or should be metered first to see real-world transcript sizes
  before deciding is Matthew's call, not something this ADR resolves.
- **Follow-up work this ADR recommends but does not implement:** (1) extend
  `instrument.ts`'s `emitToolLatency` with a response-size meter field — small, low-risk, and
  the single highest-leverage next step since it covers all MCP-side gaps at once; (2) create
  `src/mcp/service/contextBudgets.ts` when the first Node-side dial is actually needed, rather
  than pre-emptively as an empty file; (3) decide, per newly-found location, dial-first vs.
  meter-first.
- **AGENTS.md propagation:** root, `supabase/functions/`, and `src/mcp/` `AGENTS.md` files now
  instruct that any NEW code reading an unbounded collection into an LLM prompt or an MCP
  response must add a named dial to the relevant `contextBudgets.ts` (or, if no dial is
  warranted yet, at minimum log/meter its actual size) — never inline a fresh magic number.

_Primary sources: this session's own investigation (Amazon-review click-expansion fix, empirical
Firecrawl testing, and a follow-up repo-wide sweep, 2026-07-12). Codebase:
`supabase/functions/_shared/contextBudgets.ts`, `supabase/functions/_shared/amazonReviews.ts`,
`supabase/functions/run-forensic-analysis/index.ts`, `supabase/functions/avatar-vocabulary/index.ts`,
`supabase/functions/avatar-objections/index.ts`, `supabase/functions/reveal-positioning-statement/index.ts`,
`supabase/functions/review-scraper/index.ts`, `src/mcp/service/coachConversations.ts`,
`src/mcp/service/contextResolver.ts`, `src/mcp/service/nativeLedger.ts`, `src/mcp/instrument.ts`,
`supabase/functions/brand-ai-assistant/index.ts`, `supabase/functions/import-product-data/index.ts`._

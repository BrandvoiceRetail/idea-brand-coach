# Context-Gap Audit — 2026-06-09

**Type:** read-and-report. No builds, no deploys, no paid generations. Sources: repo working tree
(`feat/alpha-instrumentation`), git history, live Supabase schema (read-only MCP), the R4 credit-burn
report, and the bundled Claude-API pricing/model reference (cached 2026-05-26).

---

## 1. AI token-usage instrumentation status (HEADLINE)

**Net answer: there is NO measured per-user token cost available from the product today — only
estimated.** *(Measured finding — code-verified across every call site + live schema. High confidence.)*

- **23 LLM call sites** exist, all in `supabase/functions/**` via raw `fetch` (no SDK, no LangChain —
  the AGENTS.md "LangChain RAG" claim is stale). `src/mcp` and `src/services` never call providers
  directly; they go through the edge fns.
- **The `usage` block is read at exactly 1 of 23 sites:** `idea-framework-consultant-claude`
  (non-streaming `index.ts:311–313`; streaming `stream.ts:114–125`). Even there it is only
  `console.log`'d into edge-function logs, which **retain ~24h**. The other 22 sites (reveal-signature,
  diagnostic-interpretation + evidence variant, avatar S1–S4, canvas, brief, audit-idea-map,
  marketing-audit, all legacy Haiku fns, both gpt-4o calls, all embeddings) **discard usage entirely**.
- **Persisted nowhere:** no `token/usage/llm/cost` table in repo migrations **or in the live schema**
  (verified via live `list_tables` — per the migration-drift lesson). `feedback_events` (live, 2 rows)
  carries no token fields. No PostHog property carries tokens; edge fns don't import PostHog at all.
- **Attribution is impossible at the provider too:** every Anthropic call uses the single shared
  `ANTHROPIC_API_KEY`; every OpenAI call the single `OPENAI_API_KEY`. The console can give you
  per-model totals for the key, never per-feature or per-user.

**Lightest-touch instrumentation (sized, not built):**
one migration creating `llm_usage (id, fn_name, model, input_tokens, output_tokens, cache_read_tokens,
user_id nullable, ts)` + one shared helper in `supabase/functions/_shared/` (~40 lines, fire-and-forget
service-role insert) + a 2–3-line call after each call site. That's **~23 insertion points across ~20
functions** plus redeploys. A pragmatic **Alpha cut is 3 functions** (consultant, `reveal-signature`,
`diagnostic-interpretation`) — that covers the entire Alpha flow's spend; the 8 engine fns can follow
at Beta. Non-streaming sites have `usage` sitting on the response already; the one streaming path
already extracts it in `stream.ts`.

**Decision input:** the per-user-cost work is "estimate now, instrument for later." A console Usage
pull (by model, for that key, after tester traffic) ÷ distinct testers converts estimate → actual
without any code.

---

## 2. Per-user runtime cost

**Already produced — a parallel session completed this on 2026-06-09:**
`~/Downloads/per_user_runtime_cost_2026-06-09.md`. *(Code-measured call structure; estimated token
sizes/turn counts/mix. Medium-high confidence on structure, medium on dollar figures.)*

Headline numbers: **light user (Alpha core flow once) ~$0.11; heavy user (+1 full output-engine run)
~$0.33.** Scaled at 80/20 light/heavy with $200/mo fixed build labor: 10 users → $202/mo, 100 → $215,
1000 → $354. **Variable cost doesn't overtake the $200 fixed until ~1,300 users.**

Structural facts that survive any re-estimate (all code-verified):
- Alpha scorecard interpretation = **Haiku 4.5** (cheap); conversation + `reveal-signature` = Sonnet.
  Conversation turn count is ~75% of light-user cost — the dominant lever at low scale.
- `diagnostic-interpretation-evidence` (Sonnet) fires **0× in the Alpha browser flow** (MCP-only).
- Output engine = **exactly 8 Sonnet calls** per both-workbooks run; `export_workbook` = 0 LLM calls.
- Caching only has `cache_control` on system prompt + tools (5-min TTL) → helps within a multi-turn
  conversation, ~nothing across one-shot engine calls. Output tokens ≈70% of each Sonnet call's cost.
- 6/06 drain cross-check: ~$1–2 of metered Sonnet exhausted a near-zero prepaid balance — confirms
  per-run cost is sub-dollar; the risk is the missing cap (see §6), not the unit cost.

Given §1, these stay estimates until instrumentation exists or a console pull is done.

---

## 3. Branch / merge state

*(Measured — git. High confidence.)*

**`origin/main` (2dd7d4f, = PR #2 security fix) contains NONE of the Alpha or MCP code.** Verified by
`ls-tree`: no `src/mcp/`, no `src/components/diagnostic/`, no `src/components/v2/signature/`, no
`reveal-signature` or `diagnostic-interpretation` edge fns. Local `main` is 1 commit behind origin.

| Item | State |
|---|---|
| Output engine (contracts, tools, tests) | **Not even committed** — 54 untracked + 4 modified files under `src/mcp/` on the working tree of `feat/alpha-instrumentation` (90 untracked files repo-wide incl. planning docs + rehearsal scripts) |
| MCP gateway/host | Committed on the branch (7a2095d) + pushed separately as `origin/feat/brand-coach-mcp-host` (15 ahead, not merged) |
| ASIN ingestion `feat/product-data-hookup` | **Not merged** — 23 commits ahead, parked in worktree `.claude/worktrees/product-data` |
| `feat/feature-status-tracker` (block G: C1 + journey + tracker) | **Not merged to main.** Its planning lineage IS contained in `feat/alpha-instrumentation`; the only commit on it that alpha-instrumentation lacks is `cc7ead6` = **PR #3 abuse controls** (merged to that branch by mistake, never deployed — confirms R4) |
| `fix/kb-cross-tenant…` | Content IS on main (PR #2 squash = 2dd7d4f); the branch itself reads "not merged" only because of the squash |
| `feat/alpha-instrumentation` (current) | **18 commits ahead of origin/main and LOCAL-ONLY — no origin remote exists for it.** Carries the entire Alpha lineage: tracker/planning → diagnostic scorecard (f5bf287) → Signature engine (9de686f) → journey wiring F-059 (5d4221c) → MCP gateway → PostHog/feedback instrumentation (156cf18, 0774535) |

**Net:** of the ~28 verified blocks, effectively **zero Alpha-flow blocks are on main**. Everything
Alpha lives on one unpushed local branch, and the output engine exists only as uncommitted working-tree
files on this laptop. "Remaining Alpha" is therefore not just build work — it includes
**commit + push + merge of the whole lineage**, which is currently a single-machine risk.

---

## 4. Output-engine Alpha-vs-Beta scope line

**Alpha's two hypotheses have ZERO hard dependency on the output engine.** *(Measured — code-read of
components, hooks, edge fns, contracts, and the planning docs. High confidence.)*

- **Trust Gap scorecard:** `TrustGapScorecard.tsx` → `useTrustGapInterpretation` → standalone
  `diagnostic-interpretation` edge fn (Haiku, public, scores in request body, zero DB reads). No MCP,
  no context resolver, no artifacts.
- **Signature reveal:** `SignatureReveal.tsx` → `useSignatureReveal` → standalone `reveal-signature`
  edge fn (Sonnet, conversation + field values + optional pasted reviews in body). No avatar stages,
  no artifact chain. The only seam is the optional `persist_signature` MCP write — and Alpha already
  decided on **local persistence** (OVERVIEW.md), so even that is deferred.
- **Beta-only stages:** Avatar S1–S4, Brand Canvas, Export Brief, Audit×IDEA, Marketing
  Audit/Investment Matrix, Rollout Plan, `run_diagnostic_evidence` (the evidence-tiered variant), and
  gold-workbook export/assembly. All require the context resolver, artifact persistence,
  evidence snapshots, and business-facts — none of which Alpha touches.
- Shared inputs (reviews, positioning intent, voice) are *additive paste-in* for Alpha and become
  *stored slots* in Beta — no conflict, no Alpha dependency.
- This matches DIRECTIVE_2026-06-07 ("do not build run_diagnostic / generate_signature / build_avatar
  as MCP tools until after Alpha"). **Do not scope any engine stage into Alpha.**

---

## 5. Routine billing (Claude Code daily routines vs metered key)

**Knowable architecturally — no Anthropic support needed for the core mechanic.** *(Inferred from
key-based billing + confirmed by the 6/06 incident shape. High confidence on the mechanic; the
per-routine inventory is the open part.)*

- The Max plan covers **the routine's own Claude Code session tokens** (its reasoning, tool calls,
  file edits).
- **Any LLM call made inside a deployed edge function bills the metered `ANTHROPIC_API_KEY`,
  regardless of what triggered it.** The edge fn authenticates to Anthropic with the key in Supabase
  secrets; Anthropic bills by key/workspace; plan coverage cannot extend through a third-party HTTP
  hop. So: a routine that drives the app via Playwright, curls an edge fn, or runs a rehearsal script
  is spending metered credits on those legs. A routine that only reads code / writes docs is fully
  plan-covered.
- Consistent with 6/06: edge-fn calls fast-failed on "credit balance too low" while Claude Code
  sessions kept running — two separate billing pools, observed.
- **Open remainder:** I cannot enumerate the cloud routine definitions from this repo (no session
  crons; routines live in the cloud scheduler). To close: review each routine's prompt for steps that
  hit deployed fns or drive the app — those are the metered ones.

---

## 6. Spend cap status

**No evidence it was ever set; treat as still open.** *(Inferred — medium-high confidence. Not
verifiable from the repo: it's an Anthropic Console setting with no API/repo surface here.)*

- Nothing in the repo or planning docs records a cap being set. The R4 report (2026-06-07, §5 and
  "Recommended mechanical guards") still lists it as the first ops to-do, and the 6/06 QA-walk record
  says only the $50 **email notification** exists — which is not a cutoff and lags a fast burn.
- **What closes it (5 minutes, Console):** Plans & Billing → usage/spend limits → set a **hard
  monthly cap** on the workspace holding the edge-fn key; confirm **auto-reload is OFF**; ideally
  isolate the edge-fn key in its own low-cap workspace so a build/rehearsal can't drain the shared
  pool. Until then, every heavy run re-exposes the 6/06 failure mode.

---

## 7. Other flags

1. **🔴 Model retirement — urgent and previously unflagged.** Every chain generator AND the production
   chat consultant run `claude-sonnet-4-20250514`, which is **deprecated and retires 2026-06-15 —
   six days from this audit** (per the current Anthropic model catalog, cached 2026-05-26; replacement
   `claude-sonnet-4-6`, same $3/$15 pricing). After retirement those calls 404 and the entire product
   (chat, Signature, engine) goes down. This is a ~12-function model-string swap + redeploy, and it
   must land before 6/15. Also: `contextual-help` still calls `claude-3-haiku-20240307`, which retired
   **2026-04-19** — that fn is presumably already failing in production and nobody noticed, which is
   itself evidence of the missing error monitoring. *(High confidence on IDs in code; the exact
   retirement dates are from the cached catalog — a 1-minute live Models-API check confirms.)*
2. **PR #3 abuse controls still stranded** on `origin/feat/feature-status-tracker`, never deployed.
   The public, JWT-less `diagnostic-interpretation` fn runs live with no origin allowlist, body cap,
   or rate limit (Haiku, so cheap per call — but it's the open anon surface).
3. **Single-laptop risk** (restating §3 as ops): the Alpha lineage is an unpushed local branch and the
   output engine is uncommitted. "Bank" = commit + push before any other work.
4. **`idea-framework-consultant-claude` proceeds with `userId = null`** (Sonnet, 4k tokens, RAG) —
   confirm its gateway `verify_jwt` flag and require a resolved user; it's the expensive anon-shaped
   surface if open (R4 flag, still unresolved).
5. **Docs drift:** AGENTS.md says "LangChain RAG pipeline" — no LangChain exists in code; all calls
   are raw fetch. Worth fixing so future agents don't search for the wrong abstraction.
6. **Supabase is live today** (tables read fine; `feedback_events` matches spec with 2 rows), but the
   free-tier auto-pause remains a standing pre-check before any diagnostic read or deploy.

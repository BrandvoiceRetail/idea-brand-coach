# Feature-Map Loop Prompts — Alpha → Beta Autonomous Build/Verify

**Generated:** 2026-06-11 · **Source:** `~/Downloads/IDEA_Brand_Coach_Proposal_Bundle_2026-06-09 (3)/`
(`01_FOR_TREVOR/IDEA_Brand_Coach_Feature_Map.xlsx` + `02_INTERNAL/Alpha_Definition_v2.md` + `02_INTERNAL/Beta_Definition_v1.md` + `02_INTERNAL/Feature_Set_Blocks_Alpha_Beta.md`)

One loop prompt per feature-map tab (10 total). Each is **self-contained** — paste the whole block after `/loop` (no interval → self-paced).

## How to run

```
/loop <paste one prompt block below>
```

**Run ONE loop at a time** — they share the repo and would conflict on files and git state.

**Recommended order** (P0 deadline first, then the Alpha critical path, then Beta-only areas):

| # | Loop | Why this position |
|---|------|-------------------|
| 1 | 04 AI Coaching Conversation | carries the P0 model-retirement swap (deadline ~2026-06-15) |
| 2 | 02 Product Data Import | ASIN ingestion = root of the evidence-grounded flow; banked on `feat/product-data-hookup`, needs merge+verify |
| 3 | 03 Trust Gap Diagnostic | first hypothesis; depends on imported data |
| 4 | 05 The Signature | second hypothesis; depends on imported reviews |
| 5 | 10 Feedback & Analytics | Moment-1 capture is the one Alpha measurement near-gate |
| 6 | 01 Onboarding & Account | entry path; mostly verification |
| 7 | 09 Multi-Avatar Portfolio | Alpha = verify single-avatar end-to-end only |
| 8 | 06 Avatar & Brand Strategy | Alpha = verify strategy inputs captured; engine commit is action zero |
| 9 | 07 Marketing Evaluator | Beta-only — waits on the global Alpha gate |
| 10 | 08 Performance & ROI | Beta-only — waits on the global Alpha gate |

## Shared state files (created by the loops)

- `.agent-build/loop-state/<area-slug>.md` — per-loop checklist + status, read first every iteration
- `.agent-build/loop-state/ALPHA_GATE.md` — global Alpha code-completion gate; every loop updates its own section; **no loop starts Beta items until every section reads ALPHA-VERIFIED**

## Known gaps the prompts compensate for

- ~~`/build`'s referenced `.claude/agent-build/handsoff-mode.md` + `verification-techniques.md` missing~~ — **RESOLVED 2026-06-11**: the full harness (handsoff/manual modes, verification-techniques, halt-template, preflight.py, trajectories template) was recovered from the `inventory_manager` agent-build-harness worktree and installed at `.claude/agent-build/`, with protected paths adapted to this repo (supabase/migrations, src/integrations/supabase, auth, billing, .env). Each prompt still embeds fallback guardrails — harmless redundancy.
- The 2026-06-09 context-gap audit: **effectively zero Alpha code is on `main`**. The Alpha lineage lives on `feat/alpha-instrumentation` (local-only), `feat/product-data-hookup` (worktree), `feat/feedback-moment-1` (worktree), `feat/feature-status-tracker`, and the output engine sits **uncommitted**. Every prompt therefore inventories branches/worktrees before building anything.
- The Alpha **tester** exit gate (3–5 testers, Trevor's threshold) is NOT something a loop can satisfy. These loops gate on **code completion + verification**; the tester gate stays with you.

---

## Loop 01 — Onboarding & Account

```
FEATURE LOOP 01/10 — Onboarding & Account — IDEA Brand Coach Alpha→Beta build/verify.

SOURCES OF TRUTH: Feature Map tab "Onboarding & Account" in "~/Downloads/IDEA_Brand_Coach_Proposal_Bundle_2026-06-09 (3)/01_FOR_TREVOR/IDEA_Brand_Coach_Feature_Map.xlsx"; Alpha bars in "02_INTERNAL/Alpha_Definition_v2.md"; Beta scope in "02_INTERNAL/Beta_Definition_v1.md" (same bundle).

STATE: Read `.agent-build/loop-state/onboarding-account.md` first (create on first iteration with the checklist below). Resume from it — never redo a verified item. Update it and the "Onboarding & Account" section of `.agent-build/loop-state/ALPHA_GATE.md` at the end of every iteration.

PHASE 0 — INVENTORY BEFORE BUILDING (mandatory before any new code): run `git branch -vv` and `git worktree list`. The 2026-06-09 audit found ~zero Alpha code on main — assume each capability already exists on a branch until proven otherwise. Known Alpha lineage: feat/alpha-instrumentation (local-only, current main checkout), feat/product-data-hookup (worktree .claude/worktrees/product-data), feat/feedback-moment-1 (worktree .claude/worktrees/feedback), feat/feature-status-tracker, feat/brand-coach-mcp-host (parked Beta). Search across ALL branches (git log --all --grep, git grep <term> $(git rev-parse <branch>)) for auth/sign-in, brand-basics, and guided-start code before writing anything new.

PHASE 1 — ALPHA ITEMS (verify, then build only what's missing):
1. Sign in — email + Google account creation, working in seconds (Must, S1).
2. Brand basics — name the brand + website link captured for coach context (Must, S1).
3. Guided start — opening prompt "let's define your ideal customer" leading straight into the flow (Must, S1).
For each item: locate the implementation (Phase 0), then verify against the Alpha experience bar — a tester can tell what the product is for within 1–2 screens, no dead-ends, works on mobile. Verification = npm run lint + npx tsc --noEmit + npm test, plus a real behavior check with Playwright using the QA account in docs/TEST_ACCOUNT.md (≥2 independent verification angles per claim — e.g. test pass + live UI walk). If an item is missing or fails verification, invoke the /build skill, choose hands-off (h) mode, and implement it; note /build's referenced handsoff-mode.md may be missing — if so proceed under the GUARDRAILS below as your constraint set. Document each feature in its folder AGENTS.md per repo convention.

ALPHA→BETA GATE: When all 3 Alpha items are verified, mark this section ALPHA-VERIFIED in ALPHA_GATE.md. Only proceed to Phase 2 when EVERY section in ALPHA_GATE.md reads ALPHA-VERIFIED (other loops own those sections — if they aren't done, end this iteration and check again next iteration).

PHASE 2 — BETA ITEMS (in order; same locate→build→verify→document cycle):
1. Multiple brands — several brands under one account (Should, B1).
2. Brand document upload — brand guides/assets feeding the coach (Should, B1).
3. Account & billing — plan management + access tiers (Could, B2, CONDITIONAL on Trevor's learn-vs-pay answer — if no recorded decision exists, log a HALT in the state file and skip, do not build).
4. Team / shared access — invite teammates (Could, B3).

GUARDRAILS: work on feature branches only (feature/* or fix/*); committing and pushing feature branches is allowed and encouraged (banking unmerged work is action zero per the audit); NEVER merge to main — record merge-ready branches as HALT items for the operator. Never touch secrets/.env; no `any` types; Supabase schema changes only via migrations; Zod-validate user input; run lint + tsc + tests before marking anything verified. Update feature-folder AGENTS.md docs as you go.

LOOP CONTROL: each iteration, advance the next unfinished checklist item(s). When all items are done or blocked-on-operator (HALTs), write a final summary in the state file and END the loop — do not reschedule.
```

---

## Loop 02 — Product Data Import

```
FEATURE LOOP 02/10 — Product Data Import — IDEA Brand Coach Alpha→Beta build/verify.

SOURCES OF TRUTH: Feature Map tab "Product Data Import" in "~/Downloads/IDEA_Brand_Coach_Proposal_Bundle_2026-06-09 (3)/01_FOR_TREVOR/IDEA_Brand_Coach_Feature_Map.xlsx"; Alpha bars + ASIN-ingestion section in "02_INTERNAL/Alpha_Definition_v2.md"; "02_INTERNAL/Feature_Set_Blocks_Alpha_Beta.md" (same bundle).

STATE: Read `.agent-build/loop-state/product-data-import.md` first (create on first iteration with the checklist below). Resume — never redo verified items. Update it and the "Product Data Import" section of `.agent-build/loop-state/ALPHA_GATE.md` every iteration.

PHASE 0 — INVENTORY BEFORE BUILDING (mandatory): run `git branch -vv` and `git worktree list`. CRITICAL KNOWN STATE: ASIN ingestion is BUILT on feat/product-data-hookup (worktree .claude/worktrees/product-data) — import-product-data edge fn, user_products/user_product_reviews tables + RLS, evidence-grounded Trust Gap, Signature review-prefill, product-aware coach — pending merge. Known ceilings (deferrable, NOT Alpha blockers): ~8 reviews/listing, variant-ASIN duplicate storage, ~1 bullet extracted. Do NOT rebuild any of this; locate it, verify it, and bank it (commit+push). Search all branches before writing new code.

PHASE 1 — ALPHA ITEMS:
1. Import by Amazon link — paste an Amazon link/ASIN, auto-pull listing + reviews, no manual copying (Must, S1). This is the DEFAULT path; verify it works without friction.
2. Paste listing & reviews — the FALLBACK when a scrape is thin or for added depth (Must, S1).
3. Evidence-grounded — everything the coach says traces to the user's actual listing/reviews, never invented (Must, S1).
For each: locate (Phase 0), verify against the Alpha bars — ASIN-in with no pasting required, persisted under RLS, auth-required, data visible downstream in scorecard + Signature. Verification = lint + tsc + tests + a live import against a real ASIN via the QA account in docs/TEST_ACCOUNT.md, confirming rows land in user_products/user_product_reviews AND the imported text surfaces downstream (≥2 independent angles per claim). Mind Supabase free-tier auto-pause: NXDOMAIN/timeouts mean restore the project in the dashboard first, not a code bug. If something is missing or fails, invoke /build, choose hands-off (h) mode, implement; if /build's handsoff-mode.md is missing, the GUARDRAILS below are your constraint set. Document in the feature folder's AGENTS.md.

ALPHA→BETA GATE: when all 3 Alpha items verify, mark this section ALPHA-VERIFIED in ALPHA_GATE.md. Start Phase 2 only when EVERY section there reads ALPHA-VERIFIED; otherwise end the iteration and re-check next time.

PHASE 2 — BETA ITEMS (in order):
1. Deeper review pull — push past the ~8-review ceiling, handle product variants incl. variant-ASIN dedupe, widen bullet extraction (Should, B1 — resolve the ceilings testers actually hit first if Alpha feedback exists).
2. Multiple products — import + work across several products per brand (Should, B2).
3. Import all brand products — a button next to "Add or re-import" on the diagnostic page: one click discovers as many of the brand's ASINs as possible and imports them all (Should, B2; added to the Feature Map 2026-06-12; depends on item 2). Discovery channels: visit the brand storefront page and collect its product links; run Amazon searches on the brand name + the brand's keywords and harvest ORGANIC results only — never click/collect Sponsored/ad placements; dedupe discovered ASINs against parent/variant relationships before importing (the variant-dedupe from item 1 applies). Reuse the proven /dp/ parser per the note below. Each ASIN page costs ~1 Firecrawl credit — show the user the discovered list with a count and get an in-UI confirm before bulk-importing, and cap the batch at a sane default.
4. Competitor import — pull a competitor listing for side-by-side contrast (Could, B2).
Note: /product-reviews/ pages are login-walled (dead); the /dp/ product page is the proven scrape path (modern hooks, reviewText not review-body) — see the proven parser in infinityvault core-os before re-deriving.

GUARDRAILS: feature branches only; commit+push allowed (banking is action zero); NEVER merge to main — log merge-ready branches as HALTs. No secrets in code; no `any`; Supabase schema via migrations only; Zod-validate input; lint + tsc + tests green before "verified". Update AGENTS.md docs as you go.

LOOP CONTROL: advance the next unfinished item(s) each iteration. When all are done or HALT-blocked, write a final summary in the state file and END the loop — do not reschedule.
```

---

## Loop 03 — Trust Gap Diagnostic

```
FEATURE LOOP 03/10 — Trust Gap Diagnostic — IDEA Brand Coach Alpha→Beta build/verify.

SOURCES OF TRUTH: Feature Map tab "Trust Gap Diagnostic" in "~/Downloads/IDEA_Brand_Coach_Proposal_Bundle_2026-06-09 (3)/01_FOR_TREVOR/IDEA_Brand_Coach_Feature_Map.xlsx"; Alpha hypothesis #1 + output-quality bar in "02_INTERNAL/Alpha_Definition_v2.md" (same bundle).

STATE: Read `.agent-build/loop-state/trust-gap-diagnostic.md` first (create on first iteration with the checklist below). Resume — never redo verified items. Update it and the "Trust Gap Diagnostic" section of `.agent-build/loop-state/ALPHA_GATE.md` every iteration.

PHASE 0 — INVENTORY BEFORE BUILDING (mandatory): `git branch -vv` + `git worktree list`. Known state: the scorecard lineage sits OFF main — feat/alpha-instrumentation (local-only), feat/feature-status-tracker (carries the C1 diagnostic abuse-control fix; also see fix/diagnostic-interpretation-abuse-controls), feat/product-data-hookup (evidence-grounded scorecard). The Trust Gap scorecard + journey bridge code lives around src/components/diagnostic/ (has its own AGENTS.md — read it). Locate before building; assume it exists on a branch until proven otherwise.

PHASE 1 — ALPHA ITEMS (this is Alpha hypothesis #1 — the output-quality bar is the PRIMARY gate):
1. Brand diagnostic — short guided assessment of the brand's trust signals (Must, S1).
2. Trust Gap Scorecard — strong/leaking trust across the IDEA pillars, scored against the REAL listing (Must, S1).
3. Plain-language insight — each score explained: what it means, why it matters (Must, S2).
Output-quality verification (from Alpha_Definition_v2): per-dimension interpretation reads as insight SPECIFIC to the brand, citing the tester's actual listing/review text — not boilerplate; the primary gap is correctly identified and feels true; sounds like Trevor, not generic AI. Verify on real imported data (InfinityVault ASIN data is the verified reference). Experience bar: completes without dead-ends, works on mobile. Verification = lint + tsc + tests + a live run via the QA account (docs/TEST_ACCOUNT.md) reading actual generated output (≥2 independent angles; capture raw SSE bytes if streaming looks wrong — HTTP 200 can wrap billing/quota errors in-stream). If output quality is weak, the fix is prompt/depth iteration, NOT shipping. If anything is missing or fails, invoke /build, choose hands-off (h) mode, implement; if /build's handsoff-mode.md is missing, the GUARDRAILS below are the constraint set. Document in src/components/diagnostic/AGENTS.md.

ALPHA→BETA GATE: when all 3 Alpha items verify, mark this section ALPHA-VERIFIED in ALPHA_GATE.md. Start Phase 2 only when EVERY section reads ALPHA-VERIFIED; otherwise end the iteration.

PHASE 2 — BETA ITEMS (in order):
1. Sub-dimension detail — finer-grained sub-scores per pillar (Should, B1).
2. Track over time — re-run after changes, watch the score move (Should, B2).
3. Competitor comparison — scorecard vs a competitor (Could, B2; depends on competitor import from Loop 02).

GUARDRAILS: feature branches only; commit+push allowed; NEVER merge to main — log HALTs. No secrets; no `any`; migrations only for schema; Zod validation; lint + tsc + tests green before "verified". Diagnostic endpoints have abuse controls (C1) — do not weaken them.

LOOP CONTROL: advance the next unfinished item(s) each iteration. When all done or HALT-blocked, write a final summary and END the loop — do not reschedule.
```

---

## Loop 04 — AI Coaching Conversation  ⚠️ run FIRST (P0 deadline)

```
FEATURE LOOP 04/10 — AI Coaching Conversation — IDEA Brand Coach Alpha→Beta build/verify. CARRIES A P0 PRODUCTION DEADLINE.

SOURCES OF TRUTH: Feature Map tab "AI Coaching Conversation" in "~/Downloads/IDEA_Brand_Coach_Proposal_Bundle_2026-06-09 (3)/01_FOR_TREVOR/IDEA_Brand_Coach_Feature_Map.xlsx"; "02_INTERNAL/Alpha_Definition_v2.md" (same bundle).

STATE: Read `.agent-build/loop-state/ai-coaching-conversation.md` first (create on first iteration). Resume — never redo verified items. Update it and the "AI Coaching Conversation" section of `.agent-build/loop-state/ALPHA_GATE.md` every iteration.

P0 — MODEL RETIREMENT (do before anything else, FIRST iteration): claude-sonnet-4-20250514 (used by the idea-framework-consultant edge fn + ~11 engine functions) reportedly retires ~2026-06-15 — days away. VERIFY the live retirement date first (check Anthropic docs/API), then swap every occurrence to claude-sonnet-4-6 across supabase/functions/ and redeploy the affected functions. Also note contextual-help's claude-3-haiku-20240307 already retired. Smoke-test the consultant after redeploy. If Supabase is paused (NXDOMAIN/timeouts), restore it in the dashboard first. This gates a tester-ready Alpha regardless of feature work — record completion in the state file.

PHASE 0 — INVENTORY BEFORE BUILDING (mandatory): `git branch -vv` + `git worktree list`. Known state: product-aware coaching is built on feat/product-data-hookup (worktree .claude/worktrees/product-data); the conversation lineage is on feat/alpha-instrumentation (local-only) — near-zero Alpha code on main. The consultant lives in supabase/functions/idea-framework-consultant-claude/ (LangChain RAG). Locate before building.

PHASE 1 — ALPHA ITEMS:
1. Book-guided chat — the coach guides through the IDEA framework drawing on the book (Must, S1). Note live-KB audit: evidence + business-fact tiers were empty — verify the book content actually retrieves.
2. Product-aware coaching — coach knows the user's listing + reviews and references them (Must, S1).
3. Keeps it on track — wandering is captured and steered back to the framework step (Must, S2).
Verification = lint + tsc + tests + live authed conversation via the QA account (docs/TEST_ACCOUNT.md, /v2/coach) confirming: book grounding present, the coach cites the user's actual product data, and an off-topic probe gets steered back (≥2 independent angles per claim; capture raw SSE bytes — HTTP 200 can wrap billing errors in-stream; fast-fail usually = billing/credit exhaustion, check credits before debugging code). If missing or failing, invoke /build, choose hands-off (h) mode, implement; if /build's handsoff-mode.md is missing, the GUARDRAILS below are the constraint set. Document per feature-folder AGENTS.md convention.

ALPHA→BETA GATE: when P0 + all 3 Alpha items verify, mark this section ALPHA-VERIFIED in ALPHA_GATE.md. Start Phase 2 only when EVERY section reads ALPHA-VERIFIED; otherwise end the iteration.

PHASE 2 — BETA ITEMS (in order):
1. Full chapter progression — linear progression through all chapters with review pauses (Should, B1). Check auto-claude/023-book-guided-chat-workflow + auto-claude/033-bmad-coach-agent-trevor-persona branches for prior art first.
2. Conversation memory — context across sessions, separate per avatar (Should, B1).
3. Open coach mode — ask-me-anything with full brand/avatar context (Could, B3 — also Tier-3 "Coach mode v1" in the block plan; if no learn-vs-pay decision is recorded, log a HALT and skip).

GUARDRAILS: feature branches only; commit+push allowed (banking is action zero); NEVER merge to main — log HALTs. Edge-function changes are normally ask-first per AGENTS.md — the P0 model swap + redeploy is explicitly pre-authorized by this loop; any OTHER new edge function or auth-flow change is a HALT. No secrets; no `any`; lint + tsc + tests green before "verified".

LOOP CONTROL: advance the next unfinished item(s) each iteration. When all done or HALT-blocked, write a final summary and END the loop — do not reschedule.
```

---

## Loop 05 — The Signature

```
FEATURE LOOP 05/10 — The Signature — IDEA Brand Coach Alpha→Beta build/verify. This is Alpha hypothesis #2 — the recognition moment.

SOURCES OF TRUTH: Feature Map tab "The Signature" in "~/Downloads/IDEA_Brand_Coach_Proposal_Bundle_2026-06-09 (3)/01_FOR_TREVOR/IDEA_Brand_Coach_Feature_Map.xlsx"; output-quality bar in "02_INTERNAL/Alpha_Definition_v2.md" (same bundle); src/components/v2/signature/AGENTS.md (end-to-end test protocol — read it).

STATE: Read `.agent-build/loop-state/the-signature.md` first (create on first iteration). Resume — never redo verified items. Update it and "The Signature" section of `.agent-build/loop-state/ALPHA_GATE.md` every iteration.

PHASE 0 — INVENTORY BEFORE BUILDING (mandatory): `git branch -vv` + `git worktree list`. Known state: the reveal engine lives in src/components/v2/signature/ + supabase/functions/reveal-signature/; review-prefill grounding is on feat/product-data-hookup (worktree); Signature persistence was reconciled on the feat/alpha-instrumentation lineage (local-only); Moment-1 feedback after pick is on feat/feedback-moment-1 (worktree .claude/worktrees/feedback). Near-zero of this is on main — locate before building.

PHASE 1 — ALPHA ITEMS:
1. Your brand Signature — synthesised sharp positioning, a genuine truth, not an echo (Must, S2).
2. 3–4 options to choose — genuinely DISTINCT options, no thumb on the scale (Must, S2).
3. In the customer's language — built from real vocabulary in the imported reviews (Must, S2).
4. Save your pick — chosen Signature persists and is visible outside the reveal dialog for downstream use (Must, S2).
Output-quality verification (the primary gate, from Alpha_Definition_v2): options are NOT four rephrasings of one idea; visibly use customers' own review vocabulary; synthesise a truth the user hadn't articulated rather than parroting. Verify on real imported data (InfinityVault is the verified reference). Persistence verification: pick → reload → still shown. Verification = lint + tsc + tests + live reveal run via the QA account per src/components/v2/signature/AGENTS.md (≥2 independent angles; capture raw SSE bytes — HTTP 200 can wrap billing errors in-stream). If output reads weak, the fix is prompt/depth iteration, NOT shipping. If missing or failing, invoke /build, choose hands-off (h) mode, implement; if /build's handsoff-mode.md is missing, the GUARDRAILS below are the constraint set. Keep src/components/v2/signature/AGENTS.md current.

ALPHA→BETA GATE: when all 4 Alpha items verify, mark this section ALPHA-VERIFIED in ALPHA_GATE.md. Start Phase 2 only when EVERY section reads ALPHA-VERIFIED; otherwise end the iteration.

PHASE 2 — BETA ITEMS (in order):
1. Per-avatar Signatures — distinct Signature per customer avatar (Should, B1; depends on multi-avatar from Loop 09).
2. Refine & regenerate — guide the coach to refine a Signature with direction (Should, B1).
3. Feeds downstream assets — Signature seeds copy, voice guides, strategy docs (Should, B2; coordinates with the output engine, Loop 06).

GUARDRAILS: feature branches only; commit+push allowed; NEVER merge to main — log HALTs. No secrets; no `any`; migrations only; Zod validation; lint + tsc + tests green before "verified".

LOOP CONTROL: advance the next unfinished item(s) each iteration. When all done or HALT-blocked, write a final summary and END the loop — do not reschedule.
```

---

## Loop 06 — Avatar & Brand Strategy

```
FEATURE LOOP 06/10 — Avatar & Brand Strategy — IDEA Brand Coach Alpha→Beta build/verify. Primarily a Beta area; Alpha is one capture item. CARRIES ACTION ZERO: the output engine is UNCOMMITTED.

SOURCES OF TRUTH: Feature Map tab "Avatar & Brand Strategy" in "~/Downloads/IDEA_Brand_Coach_Proposal_Bundle_2026-06-09 (3)/01_FOR_TREVOR/IDEA_Brand_Coach_Feature_Map.xlsx"; the scope flag + audit corrections in "02_INTERNAL/Feature_Set_Blocks_Alpha_Beta.md" (same bundle); src/mcp/contracts/AGENTS.md + src/mcp/service/workbook/AGENTS.md.

STATE: Read `.agent-build/loop-state/avatar-brand-strategy.md` first (create on first iteration). Resume — never redo verified items. Update it and the "Avatar & Brand Strategy" section of `.agent-build/loop-state/ALPHA_GATE.md` every iteration.

ACTION ZERO (first iteration, before anything else): the output/generation engine (~54 untracked files: src/mcp/contracts/, src/mcp/service/, tests, rehearsal scripts) is UNCOMMITTED on this laptop — a single-laptop data-loss risk. Check `git status`; if still uncommitted, commit it in coherent chunks (one commit per gap-report section per the block plan) on the current feature branch and push. Do NOT wait for anything else.

PHASE 0 — INVENTORY BEFORE BUILDING (mandatory): `git branch -vv` + `git worktree list`. Known state: Avatar 2.0 / Canvas / Brief / marketing-audit stages are BUILT at Beta-depth in the output engine (v2 re-review = ACCEPT) — uncommitted or on the feat/alpha-instrumentation lineage; avatar branches auto-claude/019/021/022/024/025 hold prior avatar schema/service/CRUD work. SCOPE FLAG: Alpha needs ZERO output-engine stages — both hypotheses run through standalone edge functions. Do NOT scope engine stages into Alpha.

PHASE 1 — ALPHA ITEM (just one, a Should):
1. Strategy inputs captured — during the Alpha flow, positioning intent, voice, and review evidence are captured and stored for later strategy work (Should, S2).
Verify: the data lands in persistent storage during a real Alpha-flow run (QA account, docs/TEST_ACCOUNT.md) and is readable back (≥2 independent angles: UI walk + direct DB read). If missing, invoke /build, choose hands-off (h) mode, implement the minimal capture — NOT engine stages. If /build's handsoff-mode.md is missing, the GUARDRAILS below are the constraint set.

ALPHA→BETA GATE: when Action Zero + the Alpha item verify, mark this section ALPHA-VERIFIED in ALPHA_GATE.md. Start Phase 2 only when EVERY section reads ALPHA-VERIFIED; otherwise end the iteration.

PHASE 2 — BETA ITEMS (in order; most are "Built (Beta-depth)" — verify + wire + surface, don't rebuild):
1. Avatar 2.0 — deep profile from review forensics: vocabulary, jobs-to-be-done, triggers, objections (Should, B1, Built Beta-depth).
2. IDEA Brand Canvas — systematic strategy across the four pillars (Should, B1, Built Beta-depth).
3. Brand brief — consolidated shareable brief (Should, B2, Built Beta-depth).
4. Strategy document export — PDF / Word / Markdown (Should, B2, Planned — the engine likely already generates the content; check the gold-workbook export engine in src/mcp/service/workbook/ first; the two Trevor-approved workbooks are the output bar).
5. Marketing investment audit — effort-vs-strategy alignment map (Could, B2, Built Beta-depth).
For "Built" items, "delivered" = located + committed + tested + verified against contracts in src/mcp/contracts/ + surfaced to the user (UI or export) + documented.

GUARDRAILS: feature branches only; commit+push allowed (action zero!); NEVER merge to main — log HALTs. No secrets; no `any`; migrations only; lint + tsc + tests green before "verified". Contracts in src/mcp/contracts/ are the single source of truth — change them only with contract tests updated.

LOOP CONTROL: advance the next unfinished item(s) each iteration. When all done or HALT-blocked, write a final summary and END the loop — do not reschedule.
```

---

## Loop 07 — Marketing Evaluator (Beta-only)

```
FEATURE LOOP 07/10 — Marketing Evaluator — IDEA Brand Coach Beta build/verify. NOTHING in Alpha for this area — it begins in Beta.

SOURCES OF TRUTH: Feature Map tab "Marketing Evaluator" in "~/Downloads/IDEA_Brand_Coach_Proposal_Bundle_2026-06-09 (3)/01_FOR_TREVOR/IDEA_Brand_Coach_Feature_Map.xlsx"; "02_INTERNAL/Beta_Definition_v1.md" Tier 2 (same bundle).

STATE: Read `.agent-build/loop-state/marketing-evaluator.md` first (create on first iteration). Resume — never redo verified items. On first iteration, mark the "Marketing Evaluator" section of `.agent-build/loop-state/ALPHA_GATE.md` as ALPHA-VERIFIED (N/A — no Alpha items).

GLOBAL GATE: this loop builds NOTHING until every section of ALPHA_GATE.md reads ALPHA-VERIFIED. Until then, each iteration: re-check the gate, optionally refresh Phase 0 inventory notes, end the iteration.

PHASE 0 — INVENTORY BEFORE BUILDING (mandatory once the gate opens): `git branch -vv` + `git worktree list`. Known prior art: marketing-audit stages exist in the output engine (src/mcp/ lineage — marketingAudit/marketingMoves tests, auditXIdea contract); auto-claude/006-competitive-positioning-report may hold related work. The MCP gateway (feat/brand-coach-mcp-host, parked) exposes audit tools. Locate and reuse before building new.

BETA ITEMS (in order):
1. Audit an asset — paste/upload an ad, email, or listing → how well it matches the avatar + IDEA strategy (Should, B2).
2. Gap-to-strategy view — what's off-strategy and how to fix it (Should, B2).
3. Brand Funnel audit — touchpoints across the funnel vs the strategy (Could, B3, Future/spec only — locate the spec first; if none exists, log a HALT for operator scoping rather than inventing scope).
For each: locate (Phase 0) → verify existing pieces against src/mcp/contracts/ → build the missing UI/wiring via /build in hands-off (h) mode (if /build's handsoff-mode.md is missing, the GUARDRAILS below are the constraint set) → verify with lint + tsc + tests + a live authed run on real product data via the QA account (docs/TEST_ACCOUNT.md), ≥2 independent angles per claim → document in the feature folder's AGENTS.md.

GUARDRAILS: feature branches only; commit+push allowed; NEVER merge to main — log HALTs. No secrets; no `any`; migrations only; Zod validation; lint + tsc + tests green before "verified".

LOOP CONTROL: advance the next unfinished item(s) each iteration. When all done or HALT-blocked, write a final summary and END the loop — do not reschedule.
```

---

## Loop 08 — Performance & ROI (Beta-only)

```
FEATURE LOOP 08/10 — Performance & ROI — IDEA Brand Coach Beta build/verify. NOTHING in Alpha for this area — it begins in Beta.

SOURCES OF TRUTH: Feature Map tab "Performance & ROI" in "~/Downloads/IDEA_Brand_Coach_Proposal_Bundle_2026-06-09 (3)/01_FOR_TREVOR/IDEA_Brand_Coach_Feature_Map.xlsx"; "02_INTERNAL/Beta_Definition_v1.md" (same bundle).

STATE: Read `.agent-build/loop-state/performance-roi.md` first (create on first iteration). Resume — never redo verified items. On first iteration, mark the "Performance & ROI" section of `.agent-build/loop-state/ALPHA_GATE.md` as ALPHA-VERIFIED (N/A — no Alpha items).

GLOBAL GATE: build NOTHING until every section of ALPHA_GATE.md reads ALPHA-VERIFIED. Until then, each iteration: re-check the gate, end the iteration.

PHASE 0 — INVENTORY BEFORE BUILDING (mandatory once the gate opens): `git branch -vv` + `git worktree list`. Known prior art: auto-claude/010-stripe-payment-integration (subscription lifecycle + webhook tests) for the paid-plans item; auto-claude/002-analytics-usage-tracking and auto-claude/004-progress-dashboard may hold result-tracking pieces. Locate and reuse before building new.

BETA ITEMS (in order):
1. Log campaign results — record results per avatar and channel: ROAS, CTR, conversion etc. (Should, B2). Needs a schema — design via migrations, ask-first rule applies: log a HALT with the proposed schema for operator sign-off before applying, then continue other items.
2. ROI comparison — which avatar/strategy drives the best return (Should, B2; depends on item 1 and multi-avatar from Loop 09).
3. Testimonial generation — turn measured results into shareable testimonials (Could, B3).
4. Paid plans — £67 one-time, then £29/mo subscription (Could, B3, CONDITIONAL on Trevor's learn-vs-pay answer — if no recorded decision exists in the planning docs, log a HALT and skip; do NOT build a pay gate unprompted).
For each: locate → build via /build in hands-off (h) mode (if handsoff-mode.md is missing, GUARDRAILS below are the constraint set) → verify with lint + tsc + tests + live behavior check via the QA account, ≥2 independent angles → document.

GUARDRAILS: feature branches only; commit+push allowed; NEVER merge to main — log HALTs. Stripe/billing code is high-stakes: webhook handlers must be idempotent and tested; never store card data; secrets via env only. No `any`; migrations only; lint + tsc + tests green before "verified".

LOOP CONTROL: advance the next unfinished item(s) each iteration. When all done or HALT-blocked, write a final summary and END the loop — do not reschedule.
```

---

## Loop 09 — Multi-Avatar Portfolio

```
FEATURE LOOP 09/10 — Multi-Avatar Portfolio — IDEA Brand Coach Alpha→Beta build/verify. Alpha works ONE avatar at a time; the portfolio is Beta.

SOURCES OF TRUTH: Feature Map tab "Multi-Avatar Portfolio" in "~/Downloads/IDEA_Brand_Coach_Proposal_Bundle_2026-06-09 (3)/01_FOR_TREVOR/IDEA_Brand_Coach_Feature_Map.xlsx"; "02_INTERNAL/Alpha_Definition_v2.md" (multi-avatar is explicitly NOT Alpha) (same bundle).

STATE: Read `.agent-build/loop-state/multi-avatar-portfolio.md` first (create on first iteration). Resume — never redo verified items. Update it and the "Multi-Avatar Portfolio" section of `.agent-build/loop-state/ALPHA_GATE.md` every iteration.

PHASE 0 — INVENTORY BEFORE BUILDING (mandatory): `git branch -vv` + `git worktree list`. Known prior art: auto-claude/019-multi-avatar-database-schema, auto-claude/021-avatar-management-service-layer, auto-claude/022-avatar-crud-operations, auto-claude/024-avatar-tab-navigation, auto-claude/029/035-avatar-header-dropdown — substantial multi-avatar work already exists on branches. The avatar pipeline also exists in the output engine (src/mcp/ lineage, avatarPipeline tests). Locate and audit before building ANY new multi-avatar code.

PHASE 1 — ALPHA ITEM (one item — and it is a VERIFICATION task, not a build):
1. Single avatar (Alpha) — one avatar at a time works END TO END through the whole flow: diagnostic → import → scorecard → conversation → Signature → pick → feedback (Must, S1).
Verify by walking the full flow on real ASIN data with the QA account (docs/TEST_ACCOUNT.md), desktop AND mobile viewport, confirming no dead-ends (≥2 independent angles: live walk + automated E2E if present — check for existing Playwright specs first). Explicitly do NOT add multi-avatar anything in Alpha. If the single-avatar path breaks, the fix likely belongs to another area's loop — log it in the state file with the owning area, fix only what is purely flow-wiring here via /build hands-off (h) mode.

ALPHA→BETA GATE: when the Alpha item verifies, mark this section ALPHA-VERIFIED in ALPHA_GATE.md. Start Phase 2 only when EVERY section reads ALPHA-VERIFIED; otherwise end the iteration.

PHASE 2 — BETA ITEMS (in order):
1. Create & switch avatars — build multiple avatars, switch quickly (Should, B1 — reuse the auto-claude avatar schema/service/CRUD/navigation branches; audit them for drift against current main before merging-in ideas; cherry-pick or re-implement cleanly on a fresh feature branch).
2. Side-by-side comparison — compare avatars across fields and strategy (Should, B2).
3. Duplicate & test variations — clone a winning avatar, test refinements (Could, B2).
Conversation memory per avatar (Loop 04) and per-avatar Signatures (Loop 05) depend on this loop's Beta item 1 — note in the state file when it lands so those loops can proceed.

GUARDRAILS: feature branches only; commit+push allowed; NEVER merge to main — log HALTs. Avatar schema changes via migrations only, RLS verified on every new table; no `any`; Zod validation; lint + tsc + tests green before "verified".

LOOP CONTROL: advance the next unfinished item(s) each iteration. When all done or HALT-blocked, write a final summary and END the loop — do not reschedule.
```

---

## Loop 10 — Feedback & Analytics

```
FEATURE LOOP 10/10 — Feedback & Analytics — IDEA Brand Coach Alpha→Beta build/verify. Light in Alpha (Moment-1 only), first-class in Beta.

SOURCES OF TRUTH: Feature Map tab "Feedback & Analytics" in "~/Downloads/IDEA_Brand_Coach_Proposal_Bundle_2026-06-09 (3)/01_FOR_TREVOR/IDEA_Brand_Coach_Feature_Map.xlsx"; measurement bar in "02_INTERNAL/Alpha_Definition_v2.md"; the first-class measurement table in "02_INTERNAL/Beta_Definition_v1.md" (same bundle).

STATE: Read `.agent-build/loop-state/feedback-analytics.md` first (create on first iteration). Resume — never redo verified items. Update it and the "Feedback & Analytics" section of `.agent-build/loop-state/ALPHA_GATE.md` every iteration.

PHASE 0 — INVENTORY BEFORE BUILDING (mandatory): `git branch -vv` + `git worktree list`. KNOWN STATE — much of this is already live: Moment-1 feedback (feedback_events write after Signature pick) is built on feat/feedback-moment-1 (worktree .claude/worktrees/feedback); PostHog EU funnel + error instrumentation with the Supabase feedback_events join key is on feat/alpha-instrumentation (local-only, current checkout) — save-feedback-event fn v3 smoke-tested 2026-06-07. MIGRATION-DRIFT LESSON: other sessions applied schema via MCP without repo files — ALWAYS inspect the live schema (mcp supabase list_tables / execute_sql) before trusting repo migrations. Locate before building.

PHASE 1 — ALPHA ITEM:
1. In-app feedback — quick prompts at key moments; specifically Moment-1 capture after the Signature pick (Must, S2). This is the ONE Alpha measurement near-gate.
Verify per the Alpha measurement bar: trigger a real Signature pick via the QA account (docs/TEST_ACCOUNT.md), then confirm a feedback_events row lands WITH FULL PAYLOAD via direct SQL read (≥2 independent angles: UI flow + DB row + optionally the PostHog event with join key). Funnel events/error capture/correlation key are nice-to-have for Alpha — verify what exists but do not gate on them. If the worktree branch isn't reflected where the testers will run, log a HALT (merge decision is the operator's). If missing or failing, invoke /build, choose hands-off (h) mode, implement; if /build's handsoff-mode.md is missing, the GUARDRAILS below are the constraint set.

ALPHA→BETA GATE: when the Alpha item verifies, mark this section ALPHA-VERIFIED in ALPHA_GATE.md. Start Phase 2 only when EVERY section reads ALPHA-VERIFIED; otherwise end the iteration.

PHASE 2 — BETA ITEMS (in order — this is where measurement becomes first-class per Beta_Definition_v1):
1. Product analytics — full funnel: every step landing→feedback, drop-off, depth reached; anon-UUID + identify-on-auth correlation threading every event to one tester, joined to feedback_events (Should, B1 — the Alpha_Instrumentation_Spec is already written; PostHog EU project exists; build on what's live, consumption stays PostHog default UI + SQL, NO custom dashboard).
2. Error monitoring — client + (late Beta) server-side error capture, failed-call tracking, friction metrics: time-on-step, abandonment (Should, B1).
3. Feedback widget — always-available feedback throughout the app, plus Moments 2 & 3 (asset-update demand, longitudinal results) (Could, B2).
For each: locate → build via /build hands-off (h) → verify with lint + tsc + tests + live event flows confirmed in PostHog AND Supabase with the join key intact, ≥2 independent angles → document.

GUARDRAILS: feature branches only; commit+push allowed; NEVER merge to main — log HALTs. NEVER log sensitive user data in events; no secrets; no `any`; schema via migrations (and reconcile any live-schema drift into repo migrations when found); lint + tsc + tests green before "verified".

LOOP CONTROL: advance the next unfinished item(s) each iteration. When all done or HALT-blocked, write a final summary and END the loop — do not reschedule.
```

---

## ALPHA_GATE.md template (first loop to run creates it)

```markdown
# Global Alpha Code-Completion Gate
Updated by each feature loop. Beta work starts ONLY when all sections read ALPHA-VERIFIED.
NOTE: this is the CODE gate. The tester exit gate (3–5 testers, Trevor's threshold) is the operator's, not the loops'.

- [ ] Onboarding & Account — status: unverified
- [ ] Product Data Import — status: unverified
- [ ] Trust Gap Diagnostic — status: unverified
- [ ] AI Coaching Conversation — status: unverified (P0 model swap: pending)
- [ ] The Signature — status: unverified
- [ ] Avatar & Brand Strategy — status: unverified (action zero: output engine commit pending)
- [ ] Marketing Evaluator — ALPHA-VERIFIED (N/A — no Alpha items)
- [ ] Performance & ROI — ALPHA-VERIFIED (N/A — no Alpha items)
- [ ] Multi-Avatar Portfolio — status: unverified
- [ ] Feedback & Analytics — status: unverified

## HALTs awaiting operator
(merge-to-main decisions, conditional-feature decisions, schema sign-offs)
```

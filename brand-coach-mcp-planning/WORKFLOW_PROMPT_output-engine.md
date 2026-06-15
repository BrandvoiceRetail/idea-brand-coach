# Workflow Prompt — Gold-Workbook Output Engine (phased)

**Paste phases into a Claude Code session one at a time. Each phase is independently shippable and gated; do not start phase N+1 until phase N's gate is green and the operator has reviewed.**

---

## Mission (read first, applies to every phase)

Build the engine that lets the IDEA Brand Coach app + MCP **reliably produce the two Trevor-approved gold outputs**: `IDEA BrandCoach InfinityVault Mockup.xlsx` (Trust Gap → Avatar 2.0 five stages → Signature → Brand Canvas → Export Brief → Audit×IDEA) and `InfinityVault Marketing Investment Audit.xlsx` (tiered investment matrix + 90-day phasing). Both gold files are in `~/Downloads` (also inside `~/Downloads/WhatsApp Chat - Trevor Bradford.zip`).

**Done-when (final gate):** a single MCP session against `mcp:dev` can — for a user whose memory holds the IV context — fill context KB-first, ask only for genuinely missing slots, run the full artifact chain, and `export_workbook` both A and B as .xlsx whose sheet/section structure matches the committed gold fixtures, with every fabrication-gated claim either evidence-backed or owner-confirmed.

**Canonical references (read before any phase):**
- `brand-coach-mcp-planning/OUTPUT_CONTEXT_MANIFEST.md` — the reverse-engineered context manifest: 18 context slots, trust classes, resolver design (§5), fabrication gates (§6), integration points (§7). This is the spec for *inputs*.
- The gold workbooks — the spec for *outputs*.
- `brand-coach-mcp-planning/PLANNING.md` §1a — caveats for the deferred tools (C1, D2/R-015, MF-2, field_source server-set).
- Pattern files: `supabase/functions/reveal-signature/index.ts` (gold prompt skeleton: persona / critical-failure-mode / voice rules / few-shot / evidence-vs-inference branch / strict JSON + prefill), `src/mcp/tools/draftAsset.ts` (never-fail auto-record), `src/mcp/tools/generateConcepts.ts` (EdgeFnClient verbatim-wrap), `src/components/export/MarkdownExportService.ts` (batch/dependsOn/retry orchestration).

**Tooling:** repo = `idea-brand-coach`; work on a branch cut from `feat/alpha-instrumentation` (contains the MCP host + alpha flow). Commands: `npm run typecheck:mcp`, `npm test` (vitest; `--dir src` to avoid the stale worktree poison), `npm run mcp:dev`. Supabase project may auto-pause (free tier) — restore in dashboard before deploys/reads.

**Operational notices (live — check date):**
- **2026-06-06 P3 Agent A handoff (avatar edge fns):** a prior P3-A attempt was killed by a session limit MID-TASK, not by errors. State it left: all four fns `avatar-vocabulary/-jobmap/-triggers/-objections` exist under `supabase/functions/` AND are deployed; live smoke tests passed (S3 3/3 on retry). Known defect it was fixing: the assistant-prefill JSON parse occasionally collides when the model re-emits the leading brace (`[{{...`) → transient 500. It applied a tolerant multi-candidate parser to `avatar-triggers` ONLY. **Continue, don't restart:** read the four fns, port the same tolerant parser to vocabulary/jobmap/objections, redeploy those three, re-run smoke tests (3x each for parse stability), then report. Do not rewrite prompts or contracts that already work.
- **Session limits:** if you see "You've hit your session limit", finish IMMEDIATELY: emit StructuredOutput with current state in notes/blockers so the run resumes from cache.
- **2026-06-06 Anthropic credits: AVAILABLE.** Verified by live probe: `reveal-signature` returned a full Sonnet generation. The account was credit-exhausted on 2026-06-06 earlier (QA walk incident) and was topped up — but **no spend alert exists**, so it can drain again mid-run.
- **If an LLM-backed edge fn fails with a billing-shaped error** — Anthropic `invalid_request_error` mentioning credit balance, "credit balance is too low", instant fast-fail instead of normal latency, or an HTTP 200 whose body/stream wraps a billing/quota error — treat it as **CREDIT EXHAUSTION: an environment blocker, NOT a code bug.** Do not loop fixers on it, do not rewrite working code. Record it verbatim in blockers, mark the gate issue as `[BILLING]`, and finish your structured output so the run can be resumed from cache after a top-up.

**Guardrails (every phase):**
1. Two Claude sessions sometimes edit this repo concurrently — re-read `src/mcp/server.ts` and `src/mcp/__tests__/server.test.ts` immediately before editing; the server test asserts the EXACT tool-name array, every new tool must be added there atomically.
2. Do not break Alpha work (instrumentation, feedback capture, Signature flow). The artifact-chain persistence must SATISFY the Alpha "persist chosen Signature locally" decision, not conflict with it.
3. Fabrication gates per manifest §6: PRODUCT-TRUTH and policy claims never appear in generated output without `filled-evidence` or recorded owner confirmation.
4. Every generator output carries `grounding: evidence|inference` + `evidence_refs[]` (the reveal-signature `usedReviews`/`inference` discipline, generalized).
5. All writes identity-gated (`gateWrite()`); RLS-honoring per-request JWT-bound Supabase client — no service-role unless the operator approves it explicitly.
6. New code follows the 3-layer MCP pattern (service → tool register → server.ts factory) and clones existing skeletons; prefer reuse over new abstractions.

---

## Phase 0 — Gold fixtures + contracts

**Goal prompt:** Extract both gold workbooks into JSON fixtures committed at `src/mcp/__tests__/fixtures/workbook-a.json` and `workbook-b.json` (sheet → section → structured rows; preserve the self-flagged inference notes). Create `src/mcp/contracts/` with one zod module per artifact kind (`diagnostic_interpretation`, `avatar_s1_vocab`, `avatar_s2_jobmap`, `avatar_s3_triggers`, `avatar_s4_objections`, `signature`, `brand_canvas`, `export_brief`, `audit_x_idea`, `marketing_audit`, `rollout_plan`) pairing `{outputSchema, requiredContext: Slot[]}` where Slot ids = manifest §4 numbering. Contracts are the single source of truth imported by tools, resolver, and assembler.

**Use a workflow:** Agent A extracts the two .xlsx into normalized JSON fixtures and verifies cell coverage against the originals; agent B drafts the zod contracts from the fixtures (every gold table column appears in a schema field) and unit-tests fixtures-parse-against-contracts; agent C cross-checks each contract's `requiredContext` slots against manifest §2-§4 and flags any slot the manifest missed.

**Gate:** fixtures committed; `typecheck:mcp` clean; contract unit tests green; operator confirms the fixture extraction is faithful.

---

## Phase 1 — Persistence layer + JWT-bound writes (closes the Alpha Signature item)

**Goal prompt:** One additive migration creating `artifacts` (kind/content jsonb/grounding/evidence_refs/superseded_by; partial unique index on current-per-kind; RLS `user_id = auth.uid()`), `evidence_snapshots`, `signatures`, `marketing_audits` — per the Plan design. Wire the existing-but-empty live tables `user_products` + `user_product_reviews` as the own-evidence store; apply the competitive-analysis migrations to live. Add per-request JWT-bound Supabase client to the MCP host (net-new: `supabaseServer.ts` is anon-key/getUser-only today) and an `artifactStore` service (insert-new + supersede, read-current-chain). Ship `persist_signature` + `generate_signature` tools (generate wraps `reveal-signature` verbatim; persist writes `signatures` + an `artifacts` row).

**Use a workflow:** Agent A writes the migration + RLS and proves it applies on a Supabase branch; agent B builds the JWT-bound client + artifactStore with InMemoryTransport round-trip tests; agent C wires the two signature tools + server.ts/server.test.ts registration and a live persist of a chosen Signature against the QA account (docs/TEST_ACCOUNT.md).

**Gate:** migration applied; 39 existing vitest specs still green + new ones; chosen Signature persists and re-reads; operator reviews schema before any generator work.

---

## Phase 2 — Context resolver + clarification loop ("never ask twice")

**Goal prompt:** Build `src/mcp/service/contextResolver.ts` implementing manifest §5: per-slot resolution order (artifacts → evidence stores → avatar_field_values → user_knowledge_base current → diagnostic_submissions → user_knowledge_chunks RAG → IV-OS [IV tenant only] → ask), statuses `filled-evidence|filled-stated|filled-inferred|missing|conflict|stale`, staleness windows for BUSINESS-FACTs. Add the `business_facts` KB category (structured_data JSONB). Tool surface: `get_context_status` (R: slot fill-map for a target output), `provide_context` (W: accepts answers, writes back to the correct store — evidence→evidence tables, facts→business_facts, intent→avatar_field_values field_source='manual'), and evidence intake: `ingest_evidence` (paste reviews/listing copy → evidence_snapshots + user_product_reviews; optional `/dp/` scrape reusing review-scraper learnings — `/product-reviews/` is dead/login-walled). Generator tools (later phases) return `needs_input: [{slot, question, why, current_guess}]` instead of fabricating.

**Use a workflow:** Agent A builds the resolver + store-on-answer write-backs with table-driven tests per slot class; agent B builds the three tools + registration; agent C seeds a test user's KB with partial IV context and proves: second ask never happens, answers persist, `filled-inferred` items surface for confirmation.

**Gate:** resolver unit tests cover all 6 statuses; live round-trip: ask → answer → stored → re-resolve shows `filled-stated`; operator reviews the question phrasing UX.

---

## Phase 3 — Avatar 2.0 forensic engine (S1–S4)

**Goal prompt:** Four new edge fns cloned from the reveal-signature skeleton — `avatar-vocabulary` (emotion-clustered verbatim terms, every term traces to a real review), `avatar-jobmap` (functional/emotional/identity + villain, grounded in S1), `avatar-triggers` (moment/feeling/search-terms/volume-BAND — labeled estimate, never a fabricated number), `avatar-objections` (hesitation/verbatim-signal/resolution; verbatim MUST be a real quote). Each validates against its Phase-0 contract, runs evidence-mode when the resolver fills reviews, returns `needs_input` otherwise. Host-side `avatarPipeline.ts` orchestrator (clone MarkdownExportService's batch/dependsOn/retry shape) runs S1→S2→S3/S4→S5, persisting each stage as an artifact. Tool: `build_avatar_stage` (stage:'s1'..'s4') + pipeline mode. Ship the MF-2 lock DB trigger migration alongside (first artifact-writing avatar tool). **D2 checkpoint:** generate_signature grounding = context-bundle from persisted evidence artifacts; per the manifest argument this preserves no-parroting (customer vocabulary ≠ founder's words) — operator must explicitly sign off this R-015 reading before the pipeline auto-feeds S5.

**Use a workflow:** Agent A writes the four edge fn prompts + contracts validation with fixture-review inputs; agent B builds the pipeline orchestrator + build_avatar_stage tool + artifact persistence; agent C runs the full S1→S5 chain on the real InfinityVault reviews (paste from gold context), diffs structure vs the gold fixture sheet 4, and adversarially checks every S1 term / S4 verbatim traces to an actual input review.

**Gate:** chain produces 5 artifacts from fixture reviews; zero untraceable quotes; structure diff vs gold acceptable; **operator signs off D2/R-015**.

---

## Phase 4 — Evidence-grounded diagnostic + Canvas + Brief + Audit×IDEA

**Goal prompt:** (a) NEW `diagnostic-interpretation-evidence` edge fn (do NOT edit the existing public one): per-dimension brand-specific read + `where_it_shows_up` citing real listing copy/reviews from resolved slots; falls back to the existing generic fn when evidence is absent (`grounding:'inference'`). Tool `run_diagnostic_evidence` binds identity before the interpretation leg (C1). (b) `brand-canvas` fn synthesizing chosen Signature + S1-S4 + owner-intent slots into the canvas contract. (c) `export-brief` fn: title formula + 5 bullets each carrying `stage_ref`, 7-slot image brief, PPC trigger/identity keyword tiers — **fabrication gate enforced**: any PRODUCT-TRUTH claim (capacity, compatibility, guarantee) must come from a `filled-evidence`/owner-confirmed slot or the fn returns `needs_input`. (d) `audit-idea-map` fn (sheet 7). Tools: `generate_canvas`, `generate_brief`, `generate_audit_idea_map`.

**Use a workflow:** Agent A builds the diagnostic-evidence fn + tool; agent B builds canvas + brief fns with the fabrication gate and contract validation; agent C builds audit-idea-map, then runs all four against the Phase-3 IV artifacts and diffs vs gold fixture sheets 3/5/6/7 — explicitly asserting the "30-DAY GUARANTEE"-class invented claims do NOT appear without confirmation.

**Gate:** all four artifacts produced from the chain; fabrication-gate test proves an unconfirmed policy claim is blocked and surfaces as a question; structure diffs acceptable.

---

## Phase 5 — Output B: marketing-move library + audit generator

**Goal prompt:** Commit the ~22-row marketing-move library (extracted from gold fixture B: move, tier logic, default cost/effort/time, benefit-model) as versioned FRAMEWORK data (system-side, not per-user). New `marketing-audit` edge fn: inputs = library + resolved BUSINESS-FACT slots (revenue, margins, ad metrics, cash timing, channel states, inventory risks — resolver-filled from `business_facts`, else `needs_input`); outputs = the matrix contract (tier/cost/hours/effort/1-3-6-12mo benefit ranges as labeled estimates calibrated to business size) + 90-day rollout phased around the user's cash timeline. Tool `run_marketing_audit` persists to `marketing_audits`.

**Use a workflow:** Agent A extracts the move library from fixture B into versioned data + unit tests; agent B builds the fn + calibration logic + tool; agent C seeds business_facts with IV's gold-era numbers ($10K/mo, ~10% post-ad margin, $618→$450 ad spend, June repayment, May inventory) and diffs the generated matrix + phasing vs gold fixture B.

**Gate:** with seeded facts the matrix reproduces gold-B's tiering and phasing logic; with missing facts every gap surfaces as `needs_input` (nothing silently invented).

---

## Phase 6 — Workbook assemblers + export

**Goal prompt:** Add `exceljs`. `src/mcp/service/workbook/` with `assembleWorkbookA.ts` (sheets ← artifacts: diagnostic, avatar stages+signature, canvas, brief, audit×IDEA), `assembleWorkbookB.ts` (matrix + rollout ← marketing_audits), shared `style.ts`. **Assembly reads persisted artifacts only — no live regeneration** (deterministic, fixture-testable). Tool `export_workbook` (which:'A'|'B') returns a local file path; optional Supabase Storage upload + IV-OS `log_asset` echo behind never-fail flags (clone draftAsset pattern).

**Use a workflow:** Agent A builds assembler A + cell-structure tests vs gold fixture A; agent B builds assembler B + tests vs fixture B; agent C wires export_workbook + registration + a live `mcp:dev` call from Claude Code producing both files, then opens them and visually verifies against the gold originals.

**Gate:** both .xlsx generate from the IV artifact chain; sheet/section structure matches fixtures; live MCP call returns working files.

---

## Phase 7 — End-to-end eval + hardening loop

**Goal prompt:** Full dress rehearsal as a NEW user (empty memory): drive the entire flow through MCP only — context status → clarification Q&A (operator role-plays the customer with IV's real answers) → evidence ingest → chain → both exports. Log every question asked; assert none was answerable from memory (the never-ask-twice audit). Then re-run as the SAME user: assert zero repeat questions and stable regenerated outputs (consistency = two runs produce structurally identical artifacts modulo prose variation). Fix whatever fails; update OUTPUT_CONTEXT_MANIFEST.md + folder AGENTS.md files with learnings (self-annealing).

**Use a workflow:** Agent A runs the fresh-user rehearsal and captures the question log + outputs; agent B runs the repeat-user consistency pass and diffs; agent C audits both against the manifest (slot coverage, fabrication gates, grounding flags) and writes the gap report; operator reviews and the loop repeats until the Mission done-when holds.

**Gate (= Mission done-when):** both workbooks produced end-to-end; no repeat questions; no ungated fabrications; structure matches gold; operator accepts the outputs as "Trevor-bar".

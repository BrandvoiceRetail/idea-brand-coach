# E2E Gap Report — Gold-Workbook Output Engine

**Date:** 2026-06-06
**Author:** Phase 7 Agent C (end-to-end eval + manifest audit)
**Scope:** Audits the P7-A fresh-user rehearsal and the P7-B repeat-user consistency pass
against `OUTPUT_CONTEXT_MANIFEST.md` (the 18-slot manifest, §5 resolver, §6 fabrication
gates) and the Mission done-when in `WORKFLOW_PROMPT_output-engine.md`. Read-only audit —
no `src` was modified. Verified against the live project (`ecdrxtbclxfpkknasmrw`) via
`execute_sql` over the rows the P7-A/P7-B runs persisted.

This is the gate document for the operator's accept/iterate decision and the input to the
commit/PR plan.

---

## 1. Verdict

**The Mission done-when holds for the IV reference user**, with two named carve-outs that
are intentional deferrals (not regressions) and one product defect that blocks same-avatar
*regeneration* (export is unaffected — it re-renders the persisted chain). Detail below.

| Mission done-when clause | Status | Evidence |
|---|---|---|
| Fill context KB-first | PASS | P7-B: `get_context_status(workbook_b)` returns 0 `needs_input`; every slot resolves from a store (business_facts / avatar_field_values / evidence_snapshots / artifacts / framework_static). |
| Ask only for genuinely missing slots | PASS | P7-A: 0 post-answer re-asks. P7-B: workbook_a re-asks only {#2 competitor reviews, #4 ad/support samples} — EVIDENCE never ingested in any run, a true gap, not a repeat. |
| Run the full artifact chain | PASS | Avatar `d6185f56…` carries all 8 current artifact kinds (diagnostic_interpretation, avatar_s1_vocab, signature, brand_canvas, export_brief, audit_x_idea, marketing_audit, rollout_plan). |
| `export_workbook` A and B as .xlsx matching gold structure | PASS | P7-A wrote A (5 gold sheets) + B (Investment Matrix + Recommended Phasing); P7-B structural diff exit 0 (sheet set/order, column-A labels, tiering, phase count identical). |
| Every fabrication-gated claim evidence-backed or owner-confirmed | PASS | All 3 live `export_brief` artifacts: `has_guarantee_claim=false` (the declined guarantee never appeared). "Holds 216 Cards" allowed because slot #6 confirmed 216/432 capacity. |

---

## 2. What passes (verified live)

### 2.1 Grounding flags present on every artifact (manifest §6 / guardrail #4)
`execute_sql` over `artifacts WHERE superseded_by IS NULL` grouped by `(kind, grounding,
evidence_ref_count)`:

- **Every current artifact carries a `grounding` flag** (`evidence` or `inference`) — there
  are no NULL/missing grounding values.
- **Zero evidence-mode artifacts have empty `evidence_refs`** (the
  `grounding='evidence' ⇒ evidence_refs[] non-empty` invariant from `artifactStore.validateArtifact`
  holds in the persisted data — `evidence_mode_with_empty_refs = 0` for every kind).
- Mode split is sensible: `export_brief` persisted as `inference` (it leans on owner-intent /
  confirmed-claim slots, not raw quotes); `signature`, `avatar_s1_vocab`, `marketing_audit`,
  `rollout_plan`, `diagnostic_interpretation` persisted as `evidence`; `brand_canvas` appears
  in both modes across runs (evidence when S1-S4 fed it, inference otherwise) — expected.

### 2.2 Fabrication gate held (manifest §6)
The §6 hazard cases (the gold "30-DAY GUARANTEE" bullet, unconfirmed capacity, PSA-slab
compatibility) are the explicit test. P7-A/P7-B declined the guarantee at slot #6 and asserted
the brief copy contains none. Confirmed live: a regex scan of every persisted `export_brief`
(`title_formula.example_output` + all `bullets[].example_output`) for
guarantee/warranty/refund/return-window phrasing returned **`has_guarantee_claim=false` on all
3 rows**. The deterministic backstop is `claimGate.scanBrief` (re-scans produced copy against
the confirmed-claim allowlist; flags any ungated guarantee/capacity/compatibility/material
claim → `needs_input` instead of persisting) — it does not trust the model's self-report.

### 2.3 Question-log audit ("never ask twice")
- **P7-A (fresh avatar):** the question log records every `needs_input` with a monotonic
  sequence; a violation is an ask whose seq is *after* the slot's answered-seq. Result: **0
  post-answer re-asks**. (Both workbook_a and workbook_b asking the same unanswered slot in
  round 1 is one clarification surfaced from two outputs — correctly not counted as a repeat.)
- **P7-B (same avatar):** every previously-answered slot resolved from memory.
  `workbook_b` re-asked **0** slots; `workbook_a` re-asked only the two never-ingested EVIDENCE
  gaps {#2, #4}. The BUSINESS-FACT store proves the never-ask-twice mechanism: `business_facts`
  holds current rows for slots #6, #7, #8, #9, #10, #11, #16 with single-current-per-field
  invariant intact and KB-style versioning (slot #6 at version 5 across runs).

### 2.4 Slot coverage (all 18 slots resolvable or intentionally deferred)
Every slot has a resolution path in `contextResolver` + `contextWriteback`, except the two
IV-OS-only sources which fall through to `ask` for non-IV tenants (deferred, §3.1):

| # | Slot | Class | Resolves from (live-verified where populated) | Status |
|---|---|---|---|---|
| 1 | Own reviews | EVIDENCE | `user_product_reviews` (24 rows live) | PASS |
| 2 | Competitor reviews | EVIDENCE | `competitor_reviews` / snapshots — never ingested | DEFERRED gap (no scrape; ask-only) |
| 3 | Own listing copy | EVIDENCE | `evidence_snapshots` (8 rows live) | PASS |
| 4 | Ad/support samples | EVIDENCE | `evidence_snapshots` — never ingested (writeback collision, §3) | DEFERRED gap |
| 5 | Product catalog | PRODUCT-TRUTH | `user_products` / IV-OS | DEFERRED (IV-OS) / ask |
| 6 | Product claims | PRODUCT-TRUTH | `business_facts` (v5 live) — fabrication-gated | PASS |
| 7-11,16 | Business facts | BUSINESS-FACT | `business_facts` (all current live) | PASS |
| 12-14 | Owner intent | OWNER-INTENT | `avatar_field_values` (field_source='manual') | PASS |
| 15 | Intake | INTAKE | `diagnostic_submissions` | PASS |
| 17-18 | Framework | FRAMEWORK | `framework_static` (move library + IDEA rubric) | PASS |

---

## 3. What's deferred (intentional — not blocking the IV done-when)

### 3.1 IV-OS slot source (slots #5 catalog, #6 claims, #11 inventory)
The resolver intentionally omits the `ivos_mcp` reader (`contextResolver.ts` READERS map +
`resolveOne` note: "ivos_mcp etc. — skipped (future)"). For the IV tenant these slots would
resolve from the IV-OS MCP (`get_product_catalog`, `get_safe_claims`); for everyone else they
fall through to the next store and ultimately `ask`. IV's catalog/claims were therefore supplied
as ROLE-PLAY answers (provide_context → `business_facts`), which is the correct non-IV behavior.
**Deferred until the IV-OS↔brand-coach consumer boundary is wired** (per
`MEMORY.md project_ivos_brandcoach_mcp_boundary`). No code change needed in this engine; it is a
new reader behind the existing tenant gate.

### 3.2 ASIN scrape stub (slots #1, #2, #3 auto-fetch)
`ingest_evidence` accepts pasted text today; the optional `/dp/` scrape (manifest §2 row 3,
proven `/dp/` parser in infinityvault core-os, `/product-reviews/` login-walled) is **not
wired**. Reviews/listing copy must be pasted. For the rehearsal this is fine (paste path
exercised); for a self-serve user it means slot #1/#2/#3 are paste-only. **Deferred** — the
scrape is additive on top of the working paste intake.

### 3.3 In-app UI consumption
The entire engine is exercised through the MCP transport. The manifest §5 step 4 in-app
surface ("chat prompt cards reusing the field-extraction/field-review UX") and an in-app
"export workbook" affordance are **not built**. The Alpha Signature flow persists locally
(separate, satisfied) but the diagnostic/canvas/brief/audit chain has no in-app entry point.
**Deferred** — out of scope for the MCP output engine; a follow-up app-integration phase.

### 3.4 Slot #4 writeback (ad/support samples) — a real but bounded gap
`contextWriteback.writeEvidence` treats only slots #3/#6 as "listing" and routes every other
EVIDENCE slot (including #4) into the snapshot `reviews` column. A #4 answer therefore lands in
`reviews`, the resolver then sees a reviews source that disagrees with the 24 brand-level
`user_product_reviews`, and flags slot #1 `conflict` — which the avatar pipeline rejects. P7-A
left #4 unanswered (resolves to `ask`) to avoid the collision; the diagnostic's authenticity
read still grounds on the listing copy (#3). **Fix: add a dedicated `ad_support` snapshot column
+ route #4 to it.** Bounded — only slot #4 is affected.

---

## 4. Residual risks (must be on the operator's radar)

### R1 — Same-avatar artifact REGENERATION is blocked (P7-B blocker)
`artifactStore.saveArtifact` is **insert-THEN-supersede** (insert the new row at
`artifactStore.ts:147`, then supersede prior current rows at `:166-170`). On a repeat run a
kind already has a current row, so the new INSERT transiently creates a second
`superseded_by IS NULL` row and the partial unique index `uq_artifacts_current_per_kind`
rejects it (`duplicate key value`). All 6 artifact-writing tools fail to regenerate on the same
avatar; the LLM/edge-fn legs still return 200 — only the persistence write is blocked. Because
`export_workbook` reads the *persisted* chain, it then silently re-renders the PRIOR run's
content (a stale-content hazard: export reports "exported" while the chain underneath is
unchanged).
- **DB invariant verified intact:** `SELECT … GROUP BY avatar_id, kind HAVING count>1 WHERE
  superseded_by IS NULL` returns **zero rows** — failed inserts roll back cleanly, so this is a
  write-ordering bug, not data corruption.
- **Fix (outside Phase-7 ownership):** supersede-BEFORE-insert in `saveArtifact`, or make the
  index a DEFERRABLE constraint. Until then, regeneration requires a fresh avatar.
- **Severity:** HIGH for a self-serve "re-run my analysis" flow; LOW for the one-shot
  rehearsal/demo. **Must be fixed before the engine is offered as a re-runnable product surface.**

### R2 — No retry on three generator tools (transient 500 hazard)
`generate_canvas`, `generate_brief`, `generate_audit_idea_map` have **no built-in retry**; the
LLM-backed edge fns intermittently return HTTP 500 under load. Both rehearsals had to retry at
the *drive* layer (2-3 attempts). A real MCP client without that retry would see spurious
failures. A `needs_input` is correctly NOT retried (not transient). **Fix: add bounded transient
retry inside these tools** (the avatar pipeline + diagnostic already retry). Severity: MEDIUM.

### R3 — `export_workbook` does not `mkdir` its `out_dir`
The tool calls `fs.writeFile` without ensuring `out_dir` exists → ENOENT if the directory is
absent (both rehearsals `mkdirSync` it first as a workaround). Severity: LOW. **Fix: `mkdir
-p` the out_dir before writing.**

### R4 — Anthropic credit exhaustion (environment, not code)
Per the Mission operational notice + `MEMORY.md project_alpha_qa_walk`: the account drained
mid-run on 2026-06-06 (no spend alert exists). A billing-shaped fast-fail / 200-wrapped quota
error is an ENVIRONMENT blocker, not a code bug — do not loop fixers on it. **Operator action:
add a spend alert before any live demo.**

### R5 — Manifest vs implementation: business_facts is a TABLE, not a KB category
Manifest §5/§7 specified "new KB category `business_facts` (structured_data JSONB)". The
implementation diverged because `user_knowledge_base`'s category CHECK constraint forbids that
category, so BUSINESS-FACT/PRODUCT-TRUTH answers land in a **dedicated `business_facts` table**
(migration `20260606000000`) that keeps the same versioning shape (`field_identifier`,
`structured_data`, `is_current`, `version`). Verified live: 0 rows in
`user_knowledge_base WHERE category='business_facts'`, all facts in the dedicated table. This is
a correct adaptation, recorded in the manifest learnings (§ below). Severity: NONE (documentation
only) — but anyone reading the manifest literally will look in the wrong place.

### R6 — Live data is the QA user's, not a clean fixture
The "complete chain" lives under the QA account's avatar `d6185f56…`. There is no seeded clean
demo tenant. A demo against a different account starts empty. Severity: LOW (expected) — note
for demo prep.

---

## 5. Operator checklist

### 5.1 Sign-offs required (gates already named in the workflow)
- [ ] **D2 / R-015 sign-off** (Phase 3 gate): `generate_signature` grounding = context-bundle
  from persisted evidence artifacts; the manifest argument is that this preserves no-parroting
  (customer vocabulary ≠ founder's words). The rehearsals exercised this via
  `build_avatar_stage(pipeline, allow_signature: true)` — `allow_signature` is the explicit
  per-call sign-off flag. **Operator must confirm the R-015 reading before the pipeline
  auto-feeds S5 in any unattended/in-app flow.** (In the MCP flow it is opt-in per call, so the
  gate is satisfied by the flag being false-by-default.)
- [ ] **Operator accepts the outputs as "Trevor-bar"** (Mission final gate): open the P7-A
  outputs (`/tmp/rehearsal-output-engine/{InfinityVault-BrandCoach-Mockup.xlsx,
  InfinityVault-Marketing-Investment-Audit.xlsx}`) against the gold originals in `~/Downloads`.

### 5.2 Commit plan (per phase — the build spans P0→P7; nothing is committed yet)
All P0-P7 build files are currently untracked/modified on `feat/alpha-instrumentation`. Suggested
commit grouping (conventional commits; the project's `Co-Authored-By` trailer):
1. `feat(mcp): gold-workbook contracts + fixtures (P0)` — `src/mcp/contracts/*`,
   `src/mcp/__tests__/fixtures/workbook-{a,b}.json`.
2. `feat(mcp): artifact persistence + JWT-bound writes + signature tools (P1)` —
   migration, `supabaseUser.ts`, `artifactStore.ts`, signature tools.
3. `feat(mcp): context resolver + clarification loop (P2)` — `contextResolver.ts`,
   `contextWriteback.ts`, the three context tools, `business_facts` migration `20260606000000`.
4. `feat(mcp): avatar 2.0 forensic engine S1-S4 + pipeline (P3)` — 4 edge fns,
   `avatarPipeline.ts`, `build_avatar_stage`, MF-2 lock migration.
5. `feat(mcp): evidence diagnostic + canvas + brief + audit-IDEA (P4)` — 4 edge fns,
   `claimGate.ts`, the four tools.
6. `feat(mcp): marketing-move library + audit generator (P5)` — `auditCalibration.ts`,
   `marketing-audit` edge fn, `run_marketing_audit`.
7. `feat(mcp): workbook assemblers + export_workbook (P6)` — `service/workbook/*`,
   `exportWorkbook.ts`, exceljs dep.
8. `test(mcp): e2e rehearsal + consistency harness + gap report (P7)` —
   `scripts/rehearsal-*.ts`, `scripts/lib/xlsx_structural_diff.py`, this report, the AGENTS.md
   files, manifest learnings.

**Note:** `src/mcp/server.ts` + `src/mcp/__tests__/server.test.ts` were edited atomically by
each registrar phase (24-tool array). Keep server.ts changes in the commit of the tool they
register so the test array never goes red between commits.

### 5.3 Pre-merge hardening (recommended order)
1. Fix **R1** (supersede-before-insert) — unblocks re-runnable product surface.
2. Fix **R2** (tool-level retry on canvas/brief/audit-map) — kills spurious failures.
3. Fix **R3** (mkdir out_dir) + **§3.4** (slot #4 column) — small robustness wins.
4. Add **R4** spend alert (ops, not code).
5. Reconcile **R5** in the manifest (done in this PR's learnings append).

### 5.4 PR strategy
- **One PR** for the whole output engine (P0-P7) is the cleanest review unit — the phases are
  interdependent (contracts ← resolver ← tools ← assembler ← export) and the server test asserts
  the full 24-tool array, so a partial PR would ship a red test. Use the per-phase commits above
  as the review narrative inside the single PR.
- Migrations are **additive only** (CREATE TABLE IF NOT EXISTS / new policies / new edge fns) per
  the build's hard rules — safe to land without touching existing Alpha tables.
- Gate the PR on: `npm run typecheck:mcp` (exit 0), `npx vitest run --dir src/mcp` (229 passed),
  `npx vitest run --dir src` (971 passed / 7 documented pre-existing baseline failures — NOT
  introduced by this work).
- Do **not** block the PR on R1/R2/R3 if the operator accepts them as fast-follow; do note them
  in the PR description as known limitations with the fixes scoped above.

---

## 6. Gate evidence (this audit's own checks)

- `npm run typecheck:mcp` → exit 0.
- `npx vitest run --dir src/mcp` → 229 passed / 21 files (matches P6/P7-A/P7-B baseline; the
  24-tool `server.test.ts` array assertion green).
- Baseline `npx vitest run --dir src` failures (pre-existing, NOT from this work, gates ignore):
  6× `src/pages/__tests__/DiagnosticResults.test.tsx` via `useTrustGapInterpretation.ts:106`
  ("Cannot read properties of undefined (reading 'then')"); 1× `posthogClient.test.ts` us-vs-eu
  host. (P7-A/P7-B also report intermittent `ImageUpload` compression/size timeouts — flaky, not
  this work.)
- Live DB (`ecdrxtbclxfpkknasmrw`) read-only checks: artifacts grounding invariant (0
  evidence-mode-with-empty-refs), export_brief guarantee scan (0/3 with claims), per-avatar chain
  coverage (8/8 kinds on `d6185f56…`), single-current invariant (0 duplicate-current rows),
  business_facts populated (slots 6-11,16, single-current per field).

**Correction to the P6 gate note:** P6 reported "ZERO rows in `artifacts`/`marketing_audits` for
any user." That was true at P6 time (fixture-based smoke). The P7-A/P7-B runs DID persist live
rows — `artifacts` now holds the full IV chain and `marketing_audits` has 4 rows. A live
`export_workbook` against persisted data now renders real content, not `needs_input`.

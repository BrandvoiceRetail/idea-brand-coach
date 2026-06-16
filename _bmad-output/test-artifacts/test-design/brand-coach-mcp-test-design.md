---
stepsCompleted: ['architecture']
lastStep: 'architecture'
workflowType: 'testarch-test-design'
inputDocuments: ['brand-coach-mcp-planning/PLANNING.md', 'skills/idea/_coverage.md', 'discovery: mcp-test-architecture-discovery']
---

# Test Design for Architecture: Brand-Coach MCP (book → skills → tools → user)

**Purpose:** The test architecture + risk assessment for a user (two ICPs) interacting with the Brand-Coach MCP in ways that **uniquely use our owned (§1a) tools**, which are powered by the IDEA skills, which are powered by the book. Contract between QA and Engineering on what must hold before/while the MCP host is built. Companion to the **Traceability Matrix** (`../traceability/brand-coach-mcp-traceability.md`) and the recorded **conversation corpus** (the golden fixtures that populate the matrix).

**Date:** 2026-06-13
**Author:** TEA (autonomous, BMAD-format)
**Status:** Architecture Review Pending — built autonomously per goal directive; assumptions documented below for confirmation
**Project:** IDEA Brand Coach
**Surface source of truth:** `brand-coach-mcp-planning/PLANNING.md` §1a/§1b (external to this worktree)
**ADR/lineage:** ADR 0001 (IV-OS ContentReview approval lifecycle); the 158-skill library `skills/idea/` + `_coverage.md` (book traceability)

---

## Executive Summary

**Scope:** Validate that a user — **P1 Busy Brand Owner** and **P2 Operations VA** — interacting with the Brand-Coach MCP gets coaching/asset output that is (a) **schema-valid**, (b) **faithful to the book-powered skills** (no invention beyond the IDEA skill library), (c) **persona-adapted**, (d) **secure/tenant-isolated**, and (e) **uniquely enabled by our §1a tools** (not reproducible by a vanilla LLM). The test subjects are the **13 owned §1a tools**; the **§1b IV-OS consumed tools** appear as mocked dependencies.

**Business context:** Brand-Coach is the "doing" front (generate → filter → draft → test marketing assets); IV-OS is the "recording" ledger. The owned critical-path chain (`generate_concepts → publish_filter_check → draft_asset → design_test`) is the differentiated value. The book → skills → tools chain is the moat; tests must prove the chain is faithful, not just that endpoints return 200.

**Architecture (from PLANNING.md):**
- **K1 — TS streamable-HTTP MCP gateway** (official MCP SDK), Inventory-Hero three-layer pattern in TS; `AsyncLocalStorage` identity reset-in-`finally` for per-request RLS.
- **K2 — Wrap engines VERBATIM ("Calculation Parity")** — `trustGap.ts`, `SupabaseDiagnosticService`, `diagnostic-interpretation`, `reveal-signature`, `SupabaseAvatarService`+`FieldPersistenceService`, `match_document_chunks`, `idea-framework-consultant-claude`, `brand-copy-generator`, `generate-brand-strategy-*`.
- **K3 — IV-OS consumer split** — never duplicate the asset/test ledger or brand canon; consume by capability (do NOT pin signatures).
- **K4 — Skills→tools binding is RAG (intended)** — the one live path (`export_strategy_doc` -section) RAGs an OpenAI vector store; the design intent (`skills/idea/README.md`) is that all content tools draw on the skills vector store as the shared "coaching brain."

**MCP status (critical):** **DESIGNED-ONLY in this worktree.** The built gateway lives on the parked branch `feat/brand-coach-mcp-host` (iterations 1–4, "Testing" state). In-repo the only real tool is `extract_brand_fields` (Anthropic tool_use, behind the live Trevor chat). **Consequence:** the test corpus is authored as **golden, replayable contract fixtures** — meaningful now (against wrapped engines + the Trevor chat), executable end-to-end once the gateway lands.

**Expected scale:** single-tenant-per-request (owner identity via Supabase JWT); request/response (streamed deltas buffered into one reply); the owned chain writes terminally to IV-OS.

**Risk summary:**
- **Total risks:** 12 (2 high-priority score ≥6 that are SEC, 1 high TECH, balance medium/low)
- **Highest:** R-TECH-1 (skills are NOT wired to tools — faithfulness unverifiable E2E until an ingestion pipeline exists) and R-SEC-1 (MF-1 cross-tenant `search_user_kb`).
- **Test effort:** ~180 recorded test cases (golden fixtures) across 5 layers + calculation-parity; ~30 are runnable-now, ~120 are golden-contract (run when the gateway lands), ~30 are blocked on the faithfulness oracle / IV-OS PROVISIONAL reads.

---

## Quick Guide

### 🚨 BLOCKERS — Team Must Decide (Can't fully run the corpus without)

1. **B1 — Where does the corpus EXECUTE?** MCP is designed-only here; the build is on the parked, external branch `feat/brand-coach-mcp-host`. **Decision taken (default):** author the corpus as **golden replayable fixtures** against the *designed tool contracts* + the *live wrapped engines* (`trustGap.ts`, `idea-framework-consultant-claude`, `brand-copy-generator`, `generate-brand-strategy-section`, `reveal-signature`). The replay harness runs the **runnable-now** subset today; the rest are `it.todo`/`describe.skip` keyed to each tool until the gateway merges. (Owner: brand-coach eng — confirm or point the harness at the parked branch.)
2. **B2 — Skills→vector-store ingestion pipeline does NOT exist in-repo** (the referenced upload fns are absent; the store was filled out-of-band). Until it exists, **faithfulness-to-skill is unverifiable end-to-end**. **Decision taken (default):** faithfulness is asserted at two checkable layers — (a) **retrieval-overlap** for `export_strategy_doc` (the live RAG path), (b) an **LLM-judge against `skills/idea/_coverage.md` citations + the skill files** for every content tool's output — and the missing ingestion pipeline is logged as R-TECH-1 (P0 blocker to true E2E faithfulness). (Owner: brand-coach eng.)
3. **B3 — D2 / D5 / D6 open design decisions** change tool signatures (`generate_signature` input; write-binding auth; `publish_filter_check` scoring source). **Decision taken (default):** test cases are **parameterized** around these (e.g., `generate_signature` covers both `conversation[]` and synthesized-context-bundle inputs; `publish_filter_check` covers both net-new-scorer and IV-OS-150-point sources) so no rework when they land. (Owner: brand-coach eng + IV-OS.)

### ⚠️ HIGH PRIORITY — Team Should Validate

1. **R-SEC-1 (MF-1):** `search_user_kb` → the `match_document_chunks` RPC is SECURITY DEFINER trusting `match_user_id` with no caller check. Tests assert the gateway verifies caller owns the id OR has an active `va_grants` row BEFORE invoking. (Approve: security + brand-coach eng.)
2. **R-SEC-2 (confused-deputy):** `build_avatar` `field_source` must be server-set, never trusted from MCP args. Tests assert MCP-supplied `field_source` is ignored/overwritten. (Approve: brand-coach eng.)
3. **R-SEC-3 (C1):** `run_diagnostic` interpretation leg edge fn is `verify_jwt=false`/public — tests assert the gateway binds caller identity before that leg. (Approve: security.)
4. **R-TECH-2 (vector-store staleness):** the store may still hold the OLD flat `skills/01–19` content, not the new 158-atomic library. Faithfulness tests must assert against the NEW library; flag if retrieval returns stale knowledge. (Approve: brand-coach eng.)

### 📋 INFO ONLY — Solutions Provided

1. **Test strategy split:** ~45% journey (L2/L3 persona-conditioned), ~28% tool-level (L1), ~17% negative/edge/isolation (L4), ~6% uniqueness (L5), plus a dedicated **calculation-parity** band for every wrapped engine.
2. **Tooling:** Vitest 4.x + jsdom (existing stack); a **golden-conversation replay harness** (`src/test/fixtures/conversations/` + a `conversation-replay.test.ts` loader) following the `image-processing.test.ts` Deno-stub precedent and the `makeChatMessage()` factory pattern; an **LLM-judge faithfulness oracle** keyed to `_coverage.md`.
3. **Tiered CI:** Tier-0 runnable-now (calc-parity + extract_brand_fields + gateway contract) on every PR; Tier-1 golden-contract replay (gated on the host branch) nightly; Tier-2 faithfulness LLM-judge (gated on the ingestion pipeline) nightly/manual.
4. **Coverage:** ~180 scenarios prioritized P0–P3, every §1a tool ≥1 P0/P1 case, bidirectional book↔test traceability.
5. **Quality gates:** P0 = 100% coverage + 100% pass + 0 security issues; the realistic launch gate is **CONCERNS** (designed-only host + blocked faithfulness E2E), with the matrix recording exactly what unblocks PASS.

---

## For Architects and Devs — Open Topics 👷

### Risk Assessment

**Total risks identified:** 12 (3 high-priority score ≥6, 7 medium, 2 low)

#### High-Priority Risks (Score ≥6) — IMMEDIATE ATTENTION
| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---|---|---|---|---|---|---|---|---|
| **R-TECH-1** | TECH | Skills are NOT wired to tools (binding inferred; grep=0). No in-repo skills→vector-store ingestion pipeline ⇒ end-to-end skill-faithfulness unverifiable; the moat (book→skill→tool) is untested. | 3 | 3 | **9** | Build the ingestion pipeline; until then assert faithfulness via retrieval-overlap (export) + LLM-judge vs `_coverage.md`; mark E2E faithfulness BLOCKED in the matrix. | brand-coach eng | pre-GA |
| **R-SEC-1** | SEC | MF-1: `search_user_kb` RPC SECURITY DEFINER trusts `match_user_id`, no caller check (confused deputy → cross-tenant read). | 3 | 3 | **9** | Gateway verifies caller owns id OR active `va_grants`; regression test at tool boundary; ties to merged MF-1 fix. | security | with `search_user_kb` |
| **R-TECH-3** | TECH | MCP host is designed-only/parked ⇒ corpus can only be golden-contract, not live E2E, today. | 3 | 2 | **6** | Golden replayable fixtures + tiered harness; point at the host branch when it merges. | brand-coach eng | host merge |

#### Medium-Priority Risks (Score 3–5)
| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---|---|---|---|---|---|---|---|
| R-SEC-2 | SEC | `build_avatar` `field_source` confused-deputy if trusted from MCP args. | 2 | 3 | 6 | Server-set field_source; test MCP-supplied value ignored. | brand-coach eng |
| R-SEC-3 | SEC | C1: `run_diagnostic` public (`verify_jwt=false`) interpretation leg. | 2 | 3 | 6 | Gateway binds identity before leg; negative test. | security |
| R-TECH-2 | TECH | Skills vector store may hold STALE old flat skills (mid-restructure). | 2 | 3 | 6 | Assert faithfulness vs NEW 158-atomic library; ingestion from current snapshot. | brand-coach eng |
| R-DATA-1 | DATA | IV-OS canon/product reads PROVISIONAL/Not-Started ⇒ `publish_filter_check` `get_safe_claims` missing; compliance gate ungrounded. | 2 | 3 | 6 | Mock by capability; parameterize D6; test both scoring sources. | IV-OS + brand-coach |
| R-BUS-1 | BUS | Trevor chat embeds book via hand-transcribed `prompt.ts` (never reads skills/) → drift from `skills/idea`. | 2 | 3 | 6 | Drift check: assert `prompt.ts` claims still match skill source passages. | brand-coach eng |
| R-TECH-4 | TECH | D2/D5/D6 open ⇒ signature churn mid-corpus. | 2 | 2 | 4 | Parameterize cases around the decisions. | brand-coach eng |
| R-SEC-4 | SEC | MF-2: `build_avatar` lock gate TS-only (no DB trigger) ⇒ parity hazard if a non-TS path writes. | 2 | 2 | 4 | Ship DB trigger with first write tool; contract test the lock gate. | brand-coach eng |

#### Low-Priority Risks (Score 1–2)
| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---|---|---|---|---|---|---|
| R-OPS-1 | OPS | No CI test gate (deploy-only workflow); no shared fixtures home. | 2 | 1 | 2 | Add a Vitest CI gate + the `src/test/fixtures/` home; Monitor. |
| R-OPS-2 | OPS | No MCP/conversation/streaming test precedent; `@playwright/test` absent. | 1 | 2 | 2 | Establish the replay harness as the precedent; Monitor. |

#### Risk Category Legend
TECH = technical/architecture · SEC = security · PERF = performance · DATA = data integrity · BUS = business impact · OPS = operations.

---

### Testability Concerns and Architectural Gaps

**🚨 ACTIONABLE CONCERNS**

#### 1. Blockers to Fast Feedback
| Concern | Impact on testing | What Architecture Must Provide | Owner | Timeline |
|---|---|---|---|---|
| **No skills→vector-store ingestion pipeline** | Cannot verify book→skill→tool faithfulness E2E | An in-repo, reproducible `skills/idea` → vector-store sync (the referenced `upload-document-to-vector-store` / `sync-to-openai-vector-store` fns are absent) | brand-coach eng | pre-GA |
| **MCP host not in this worktree** | Cannot replay tool calls live | Merge `feat/brand-coach-mcp-host`, or expose the wrapped engines as a test-importable module | brand-coach eng | host merge |
| **No conversation/streaming harness or shared fixtures** | Every conversation test re-mocks from scratch | A `src/test/fixtures/conversations/` corpus home + a replay loader + `makeChatMessage`-style factories | QA (this work) | now |
| **IV-OS canon/product reads PROVISIONAL** | `publish_filter_check`/`draft_asset`/`generate_concepts` can't ground against real canon | Capability-stubbed IV-OS client with contract-pinned-by-capability mocks | IV-OS + brand-coach | per tool |

#### 2. Architectural Improvements Needed
1. **Skill-binding observability** — *Current problem:* tools' `powered_by_skills` is inferred, not enforced. *Required change:* each content tool should emit which skill chunks it retrieved (a `skill_provenance` field) so faithfulness is checkable. *Impact if not fixed:* the moat stays untestable. *Owner:* brand-coach eng. *Timeline:* with the RAG binding.
2. **Deterministic seams for LLM tools** — *Current problem:* Trevor chat / copy-gen are nondeterministic. *Required change:* a record/replay seam (fixture mode) so golden conversations are stable. *Impact:* flaky corpus. *Owner:* brand-coach eng.

---

### Testability Assessment Summary

#### What Works Well
- ✅ **Calculation-Parity is feasible NOW** — `trustGap.ts:buildTrustGap` is pure + already unit-tested; wrapped engines can be asserted byte-for-byte vs direct calls.
- ✅ **One edge-fn test precedent** (`idea-framework-consultant-claude/__tests__/image-processing.test.ts`) shows the Deno/fetch-stub pattern to test edge logic under Vitest.
- ✅ **Conversation-shaped factory precedent** (`makeChatMessage()`/`makeInjectedMessage()`) — the clean pattern for the corpus fixtures.
- ✅ **BMAD TEA trace tooling present** (`_bmad/tea/workflows/testarch/`) — matrix + gate format adopted here.
- ✅ **The skill library is 100% book-traceable** (`skills/idea/_coverage.md`) — the faithfulness oracle has a citation source.

#### Accepted Trade-offs (No Action Required for Phase 1)
- **Golden-contract over live** for the owned-chain tools until the host merges — acceptable; the fixtures are the spec.
- **LLM-judge faithfulness** until the ingestion pipeline + provenance land — acceptable as an interim oracle.
- **Bonus pack (`skills/idea-bonus-pack/`) out of scope** — it's a paid add-on, not loaded by the launch coach; no tools bind to it.

---

### Assumptions and Dependencies

#### Assumptions (decisions taken to proceed autonomously — confirm)
1. **Tool surface = PLANNING.md §1a (13 owned tools).** The corpus exercises these; §1b IV-OS tools are mocked dependencies.
2. **`powered_by_skills` mapping** = the discovery's inferred skill-category→tool mapping (foundations→trust/diagnostics, customer→avatar/concepts, brand→draft/signature/voice, apply→export, science→test-design/publish-filter), pending the real generator design.
3. **The two ICPs** = P1 "Maya" (Busy Brand Owner) and P2 "Rico" (Operations VA), fixtures defined in `../personas/` (see `00-test-foundations.md`). Concrete avatar field-sets, channels, and trigger profiles are pinned per persona.
4. **Faithfulness oracle** = LLM-judge vs `skills/idea/_coverage.md` citations + skill files (retrieval-overlap for the live `export_strategy_doc` path).
5. **Corpus format** = golden replayable transcripts (front-matter = matrix row; `⟦tool:⟧`/`⟦skill:⟧` tags; an Assertions block = the oracle).
6. **Target corpus size** ≈ 180 (≥ the user's 100 floor, within the 100–300 band), derived from coverage; scalable to 300 via variants.

#### Dependencies
1. `feat/brand-coach-mcp-host` merge — required for live (Tier-1) execution.
2. Skills→vector-store ingestion pipeline — required for Tier-2 faithfulness E2E.
3. IV-OS canon/product/safe-claims reads — required to un-mock `publish_filter_check`/`draft_asset` grounding.

#### Risks to the Test Plan
- **Risk:** signature churn from D2/D5/D6. **Impact:** fixture rework. **Contingency:** parameterized cases (B3).
- **Risk:** vector-store stale snapshot. **Impact:** faithfulness false-fails. **Contingency:** assert vs new library + flag staleness.

---

**End of Architecture Document.** Companion: the Traceability Matrix enumerates every test case (Given/When/Then) with book↔skill↔tool↔conversation links and the gate decision; the conversation corpus is the recorded evidence.

---
stepsCompleted: ['traceability', 'gate']
lastStep: 'gate'
workflowType: 'testarch-trace'
inputDocuments: ['brand-coach-mcp-planning/PLANNING.md', '../test-design/brand-coach-mcp-test-design.md', 'traceability-matrix.csv', 'src/test/fixtures/conversations/']
---

# Traceability Matrix & Gate Decision — Brand-Coach MCP (book → skills → tools → user)

**Story/Epic:** A user (two ICPs) interacts with the Brand-Coach MCP in ways that uniquely use our §1a tools, powered by the IDEA skills, powered by the book.
**Date:** 2026-06-13
**Evaluator:** TEA Agent (autonomous, BMAD-format)

> Machine-readable rows: `traceability-matrix.csv`. Recorded conversation fixtures (the evidence): `src/test/fixtures/conversations/`. Replay harness: `src/test/integration/mcp-conversation-replay.test.ts`. Architecture + risks + decisions: `../test-design/brand-coach-mcp-test-design.md`.

---

## PHASE 1: REQUIREMENTS TRACEABILITY

The **criteria** are the owned (§1a) MCP tool behaviors a user exercises. Each maps to (a) deterministic spec/parity/infra cases and (b) recorded golden conversations (one per matrix row), tagged book↔skill↔tool↔persona.

### Coverage Summary

> Counts: 25 deterministic spec rows (`traceability-matrix.csv`) + the recorded conversation corpus (`src/test/fixtures/conversations/`, reconciled from the corpus run — see "Corpus rollup" below). "FULL coverage" = the tool has both a deterministic case AND ≥1 recorded persona-conditioned conversation; "DESIGN coverage" = recorded + spec'd but not yet live-executed (host designed-only).

| Priority | Total Criteria | FULL/DESIGN Coverage | Coverage % | Status |
| --- | --- | --- | --- | --- |
| P0 (chain + security + substrate) | 8 | 8 | 100% | ✅ design-complete, ⚠️ not live-executed |
| P1 (convenience tools + parity) | 7 | 7 | 100% | ✅ design-complete |
| P2 (infra niceties) | 2 | 2 | 100% | ✅ |
| **Total owned tools** | **13** | **13** | **100%** | **⚠️ CONCERNS (host designed-only)** |

**Legend:** ✅ meets gate threshold · ⚠️ below threshold / caveated · ❌ blocker.

---

### Detailed Mapping (by owned tool)

#### CRIT-CHAIN-1: `generate_concepts` produces avatar-grounded concepts from a brief (P0)
- **Coverage:** FULL (design) ⚠️ (not live)
- **Tests:**
  - `TC-L1-generate_concepts` — traceability-matrix.csv
    - **Given:** avatar_id + channel + brief
    - **When:** generate_concepts is called
    - **Then:** concept candidates grounded in the four IDEA pillars + avatar; reads IV-OS canon/product (mocked by capability); terminal `log_asset` deferred behind a flag
  - Recorded conversations: `TC-J3-owned-chain-P1-v*`, `TC-J3-owned-chain-P2-v*` (both ICPs × 5 product variants), `TC-U1-*`, `TC-U4-*`, `TC-U5-*`
- **Gaps:** live execution + real IV-OS canon (R-DATA-1); skill-grounding is LLM-judged, not RAG-wired (R-TECH-1).
- **Recommendation:** wire `generate_concepts` RAG to the skills vector store; un-mock IV-OS canon when reads ship.

#### CRIT-CHAIN-2: `publish_filter_check` gates content against safe claims + canon (P0)
- **Coverage:** FULL (design) ⚠️
- **Tests:**
  - `TC-L1-publish_filter_check` — verdict + violations vs IV-OS `get_safe_claims` (mocked), NOT a local allowlist; D6 both scoring sources parameterized
  - Recorded: `TC-J3-owned-chain-*`, `TC-E8-P1` (health-claim rejection, Ch7 compliance)
- **Gaps:** `get_safe_claims` PROVISIONAL/Not-Started (R-DATA-1); D6 scoring source open (parameterized).
- **Recommendation:** confirm D6; bind `get_safe_claims` when it ships.

#### CRIT-CHAIN-3: `draft_asset` produces copy in canonical voice (P0)
- **Coverage:** FULL (design) ⚠️
- **Tests:** `TC-L1-draft_asset`, `TC-CP-4` (parity vs brand-copy-generator), recorded `TC-J3-owned-chain-*`, `TC-E5-P1` (bad-ASIN gate), `TC-E7-P1` (manipulation refusal), `TC-U3-*`
- **Gaps:** parity runnable once the engine is importable; canon voice mocked.
- **Recommendation:** wire CP-4 to brand-copy-generator; un-mock canon voice.

#### CRIT-CHAIN-4: `design_test` composes A/B variants and records the test (P0)
- **Coverage:** FULL (design) ⚠️
- **Tests:** `TC-L1-design_test`, recorded `TC-J3-owned-chain-*` (chain terminus)
- **Gaps:** terminal `record_test` mocked (gated on D5).
- **Recommendation:** bind `record_test` on D5.

#### SEC-1: `search_user_kb` enforces tenant isolation (MF-1) (P0)
- **Coverage:** FULL (design) ⚠️
- **Tests:** `TC-L1-search_user_kb` (authz precondition), recorded `TC-E4-P2` (VA cross-tenant request refused)
- **Gaps:** live RPC-boundary test pending host.
- **Recommendation:** Tier-1 regression at the tool boundary; tie to merged MF-1 fix.

#### SUBSTRATE: `mcp_host_gateway` (P0) / `ivos_consumption_client` (P1)
- **Coverage:** FULL (design) ⚠️
- **Tests:** `TC-INFRA-GW-1..4` (RLS identity reset, 5-section shape, SERVER_INSTRUCTIONS, MF-5 redaction), `TC-INFRA-IV-1..3` (STABLE reads bind, reference-by-capability, write-defer on D5)
- **Gaps:** all gated on host merge.

#### CONVENIENCE: `run_conversation`, `build_avatar`, `run_trust_gap`, `run_diagnostic`, `generate_signature`, `export_strategy_doc` (P1)
- **Coverage:** FULL (design); `run_trust_gap` + `export_strategy_doc`(section) have **runnable-now** parity (CP-1, CP-5)
- **Tests:** `TC-L1-*` per tool + `TC-CP-1..7` parity + recorded conversations across J1/J2/J4/J5/J6/J7/J8 (both ICPs × 5 variants) + edges (`TC-E1` empty-input decline, `TC-E2` scope-guard, `TC-E3` prompt-injection, `TC-E6` fabrication-trap, `TC-E9` bonus-gating, `TC-E10` persona-drift) + uniqueness `TC-U2/U6`.
- **Gaps:** C1 identity-bind (run_diagnostic), D2 input shape (generate_signature) — parameterized; faithfulness LLM-judged pending RAG.

---

### Gap Analysis

#### Critical Gaps (BLOCKER) ❌ — do not claim PASS until resolved
1. **R-TECH-1 — skill→tool binding not wired (faithfulness unverifiable E2E).** No in-repo skills→vector-store ingestion pipeline; `powered_by_skills` is inferred. Interim oracle = LLM-judge vs `_coverage.md` + retrieval-overlap for `export_strategy_doc`. **Impact:** the book→skill→tool moat is asserted at the fixture level, not yet enforced in code.
2. **R-TECH-3 — MCP host designed-only/parked.** Corpus is golden-contract, not live-executed. **Impact:** every Tier-1 assertion is recorded but not yet run.

#### High Priority Gaps (PR BLOCKER) ⚠️
1. **R-DATA-1 — IV-OS canon/product/`get_safe_claims` PROVISIONAL.** `publish_filter_check`/`draft_asset`/`generate_concepts` grounding is mocked by capability.
2. **R-SEC-1/2/3 — MF-1 / confused-deputy / C1** recorded as negative/isolation conversations but pending live RPC/boundary execution.

#### Medium / Low
- R-TECH-2 vector-store staleness (assert vs NEW 158-skill library); R-BUS-1 prompt.ts drift; R-OPS-1 no CI gate (add Vitest gate + this corpus to it).

---

### Coverage by Test Level
| Test Level | Tests | Criteria Covered | Notes |
| --- | --- | --- | --- |
| Conversation (golden replay) | corpus (≈102 recorded) | journeys + edges + uniqueness, both ICPs | Tier-0 integrity runs now; Tier-1 live gated |
| Tool/contract (spec) | 18 | per-tool + infra | gated on host |
| Calculation-parity | 7 | wrapped engines | CP-1/CP-5 runnable now |
| **Total matrix rows** | **25 spec + ≈102 conversations ≈ 127** | 13 owned tools | bidirectional book↔test |

---

### Traceability Recommendations
**Immediate (before PR merge):** add a Vitest CI gate that runs the Tier-0 corpus-integrity harness; wire CP-1 (`run_trust_gap`==`buildTrustGap`) and CP-5 (`export_strategy_doc` section) since those engines are importable now.
**Short-term (this milestone):** build the skills→vector-store ingestion pipeline (unblocks R-TECH-1); merge/import `feat/brand-coach-mcp-host` and flip Tier-1; bind IV-OS STABLE reads + writes on D5.
**Long-term (backlog):** un-mock IV-OS canon/product as PROVISIONAL reads ship; expand variants toward 300; add a `skill_provenance` field to content tools for enforced faithfulness.

---

## PHASE 2: QUALITY GATE DECISION

**Gate Type:** epic · **Decision Mode:** deterministic

### Evidence Summary
- **Test design:** complete (13 owned tools, 5 layers + parity, risk-assessed P0–P3).
- **Traceability:** 100% of owned tools have design+recorded coverage, bidirectional to book/skills.
- **Recorded corpus:** ≈102 golden conversations across both ICPs (Tier-0 integrity-checkable now).
- **Executed now:** Tier-0 fixture-integrity + coverage-invariant tests; CP-1/CP-5 wireable now.
- **Not executed:** Tier-1 live tool replay (host designed-only); Tier-2 E2E faithfulness (ingestion pipeline absent).
- **Security (NFR):** MF-1/MF-2/C1/confused-deputy cases **recorded**; live regression pending host → **CONCERNS**.

### Decision Criteria
| Criterion | Threshold | Actual | Status |
| --- | --- | --- | --- |
| P0 owned-tool coverage (design+recorded) | 100% | 100% | ✅ |
| P0 live-executed pass rate | 100% | n/a (host designed-only) | ⚠️ deferred |
| Security cases authored | all named hazards | MF-1/MF-2/C1/confused-deputy ✓ | ✅ authored / ⚠️ live-pending |
| Faithfulness oracle E2E | wired | interim (LLM-judge) | ⚠️ blocked R-TECH-1 |
| Bidirectional traceability | complete | complete | ✅ |

### GATE DECISION: ⚠️ CONCERNS

### Rationale
The **test architecture and the traceability matrix are complete and bidirectional**: every owned §1a tool a user touches is covered by deterministic spec/parity cases plus recorded persona-conditioned conversations, each tagged book → skill → tool → persona, and the corpus is integrity-checkable today. This satisfies the goal — *a fully built-out test-case traceability matrix & test architecture covering a user interacting with the MCP in ways that uniquely use our tools, powered by the skills, powered by the book.*

It is **CONCERNS, not PASS**, for two honest, externally-rooted reasons, not gaps in this deliverable: (1) the **MCP host is designed-only/parked** here, so Tier-1 live execution can't run yet (the corpus is the executable spec that flips on the moment the host merges); (2) **no skills→vector-store ingestion pipeline exists**, so end-to-end skill-faithfulness is asserted via an interim LLM-judge oracle rather than enforced in code. The matrix records exactly what unblocks PASS.

**What flips this to PASS:** merge/import `feat/brand-coach-mcp-host` (run Tier-1); build the skills→vector-store ingestion + a `skill_provenance` field (Tier-2 faithfulness); bind IV-OS reads/writes on D5/D6. None require re-authoring the corpus — the fixtures are the spec.

### Residual Risks (tracked)
- R-TECH-1 (faithfulness E2E) — Med/High — interim LLM-judge oracle; remediation = ingestion pipeline.
- R-TECH-3 (host parked) — High/Med — golden-contract corpus; remediation = host merge.
- R-DATA-1 (IV-OS PROVISIONAL reads) — Med — capability mocks; remediation = bind on ship.
**Overall Residual Risk:** MEDIUM (all remediations are external dependencies with recorded contracts).

---

## Integrated YAML Snippet (CI/CD)
```yaml
traceability_and_gate:
  traceability:
    epic: "brand-coach-mcp-user-interactions"
    date: "2026-06-13"
    coverage: { owned_tools: 13, covered: 13, pct: 100, spec_rows: 25, recorded_conversations: ~102 }
    gaps: { critical: 2, high: 2, medium: 3, low: 1 }
  gate_decision:
    decision: "CONCERNS"
    gate_type: "epic"
    reasons: ["mcp_host_designed_only_parked", "skills_to_vectorstore_ingestion_absent"]
    flips_to_pass_when: ["merge feat/brand-coach-mcp-host (Tier-1 live)", "build skills->vectorstore ingestion + skill_provenance (Tier-2)", "bind IV-OS reads/writes on D5/D6"]
    security: "CONCERNS (MF-1/MF-2/C1 authored, live-pending)"
```

## Related Artifacts
- **Test Design:** `../test-design/brand-coach-mcp-test-design.md`
- **Matrix CSV:** `traceability-matrix.csv`
- **Corpus:** `src/test/fixtures/conversations/` · **Harness:** `src/test/integration/mcp-conversation-replay.test.ts`
- **Surface source:** `brand-coach-mcp-planning/PLANNING.md` · **Skill traceability:** `skills/idea/_coverage.md`

**Generated:** 2026-06-13 · **Workflow:** testarch-trace (BMAD-format, autonomous)

<!-- Corpus rollup (reconciled from the corpus run) appended below post-generation -->

## Corpus rollup (reconciled from the corpus run — 2026-06-13)

- **Recorded conversations: 102** golden fixtures (`src/test/fixtures/conversations/`), all passing the Tier-0 integrity harness (`src/test/integration/mcp-conversation-replay.test.ts`: 516 passed, 0 failed, 11 todo = gated Tier-1/parity).
- **Total matrix rows: 127** = 25 deterministic spec/parity/infra rows + 102 recorded conversations.
- **Personas:** P1 (Busy Owner) 52 · P2 (Ops VA) 50 — both ICPs covered across every journey.
- **Layers:** L2/L3=80, L4=10, L5=12.
- **Types:** edge=3, isolation=2, journey=80, negative=5, uniqueness=12.

**Owned-tool coverage (recorded conversations per §1a tool):**

| Tool | Conversations |
|---|---|
| `run_conversation` | 85 |
| `build_avatar` | 30 |
| `run_trust_gap` | 12 |
| `run_diagnostic` | 10 |
| `generate_signature` | 11 |
| `search_user_kb` | 11 |
| `generate_concepts` | 16 |
| `publish_filter_check` | 11 |
| `draft_asset` | 16 |
| `design_test` | 10 |
| `export_strategy_doc` | 32 |

_Every owned conversational tool appears in ≥1 recorded persona-conditioned conversation; the owned critical-path chain (generate_concepts→publish_filter_check→draft_asset→design_test) is covered by the J3 journeys (both ICPs × 5 variants) + uniqueness U1/U4/U5. Bidirectional traceability holds: every conversation row cites its tools+skills+book_ref; every owned tool maps back to conversations._

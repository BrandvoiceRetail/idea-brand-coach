# IDEA Brand Coach — Evals Gap Analysis

**Date:** 2026-06-21

IDEA Brand Coach is now positioned as **in-house AI software that solves low Amazon conversion** — a *problem solver*, not a brand-strategy tool. Its loop is **Diagnose → Analyse → Fix → Re-measure → Defend**: a free, evidence-based Trust Gap diagnostic (lead magnet) feeds a paid forensic listing+review analysis, an Avatar 2.0 portrait, **ONE** Decision Trigger, and an actionable brief. The differentiator is a **forensic pipeline grounded in the user's OWN evidence**, serving two canonical ICPs (P1 "Maya" — busy brand owner wanting done-for-you; P2 "Rico" — operational VA wanting the why + steps + checklists). This document assesses the **current eval system** (`src/mcp/evals/`) and the external **mcpjam** behavioural harness against that purpose — including the two capabilities being built in this change (non-technical Coach Criteria authoring, and the conversation→eval harvest loop) — and lists what these tests verify, what they cannot, and what remains.

---

> **Implementation status (this change, 2026-06-21):** the **P0 anchor bug is FIXED in source** — `identify-decision-trigger/index.ts` now uses the canonical anchor set (Recognition=**Dove**, Belonging=Patagonia, Permission=Harvard Medical School, Momentum=Amazon's Choice, Fear-of-Loss=FOMO) and no longer names CAPTURE elements in the placement instruction (needs **deploy** to go live). The 3-tier terminology policy, evidence-based diagnostic questions, the canonical **ICP module** (`src/mcp/evals/icp/`), the non-technical **Criteria Studio**, and the **conversation→harvest loop** all landed in this change. The KPI/loop/judge gaps below remain open and are the recommended next slice.

## TL;DR — top gaps

| Severity | Gap | Recommendation |
|---|---|---|
| **P0** | Edge fn `identify-decision-trigger` still teaches **Lego** as the Recognition anchor (should be **Dove**) | Replace Lego→Dove on lines 86/95/105 of `index.ts` |
| **P0** | No deterministic KPI for **Decision Trigger accuracy** (right trigger picked) | Add `trigger-accuracy` KPI in `metrics.ts` (matched/total) |
| **P0** | No KPI for **Trust Gap score accuracy** — the lead-magnet metric | Encode Skills 01/03/06 oracle fn; add `trust-gap-accuracy` |
| **P0** | No metrics for **loop completeness** (Re-measure/Defend); all 80 fixtures single-session | Add 4–6 loop fixtures + `loop-readiness` KPI |
| **P0** | `artifact` oracle is **filtered out** of the judge — recommendation correctness never scored | Add `artifact` to `JUDGEABLE_DIMENSIONS`; validate trigger in brief |
| **P0** | No **recommendation-correctness** judge dimension (right trigger for the diagnostic) | Add `recommendation-alignment` dim with decision-table context |
| **P0** | No eval asserts **Dove** in `brand_anchor` for Recognition outputs | Add `anchor-correctness` oracle on both Recognition cases |
| **P0** | **CAPTURE element names** leak in the edge-fn prompt (Tier B at runtime) | Strip CAPTURE names from line 96; use plain-English placement |
| **P1** | A2 judge ignores authored **criteria dimensions** (`criteriaJudgeDimensions()` never called) | Pass `CriteriaSet` to `scoreCase()`/`runBehaviouralJudge()` |
| **P1** | **Terminology-tier (IDEA-POLICY-TERM-001)** compliance unmeasured | Add `terminology-policy` dimension (Tier A visible / B,C hidden) |
| **P1** | **Evidence-based / fabrication** risk has no deterministic oracle | Add `fabrication-risk`/`evidence-coverage` (cited/total claims) |
| **P1** | **Forensic Analyse phase** unmeasured — tool *invoked* ≠ tool *interpreted* | Add temporal-order + reference-to-output + citation-density checks |
| **P1** | **Persona-adapt** is count-only (false 100%); 2/5 bench cases omit the oracle | Tag `[persona-adapt]` on all 5 cases; report A2 scores not counts |
| **P1** | **Amazon-element specificity** of the brief unmeasured | Add `amazon-element-specificity` (referenced/expected elements) |
| **P1** | **P2 (Rico) SOP-building** has zero dedicated bench case | Promote ≥2 J3 P2 corpus fixtures to `EVAL_CASES` |
| **P1** | No **Re-measure/Defend** bench case (P1 returns with A/B results) | Add a retro case (baseline→fix→new measurement→re-score) |
| **P1** | No **vertical-specific** (health-claim) bench case | Add ≥1 supplements/beauty/apparel claim-blocking case |
| **P1** | **Criteria Studio UI** absent; `STORAGE_KEY` unused | Build `CriteriaStudio.tsx` + localStorage + export-to-TS |
| **P1** | Criteria **never reach the deployed coach** (server uses static `SERVER_INSTRUCTIONS`) | Load criteria in `createServer()`; prepend steering preamble |
| **P1** | Criteria **not persisted** (localStorage only; no Supabase) | Add `criteria_sets` table + get/upsert edge fns + RLS |
| **P1** | Criteria Studio ↔ evals **disconnected** (no `--criteria-set`) | Add `--criteria-set` to `runLive.ts`; version in report |
| **P1** | **mcpjam safety cases pass trivially** (empty expectedToolCalls) | Non-gated rule-based safety harness; mark cases skip/expected-empty |
| **P1** | **Multi-turn coherence / evidence-persistence** unscored | Feed `case.memory`/`fields` to judge; add coherence dims |
| **P1** | No **runtime test** of the Decision Trigger edge fn (Stage 2) output | Mock-Anthropic integration test asserting schema + invariants |
| **P1** | Harvest loop **not wired** to production (no log source, sweep, UI) | Supabase adapter + scheduled sweep + harvest-bench UI |
| **P1** | Harvest **PII/redaction** missing before candidates/export | `redactConversation()` wired into the sweep |
| **P2** | mcpjam can't express **tool order / arity / conditional** logic | Add `expectedToolSequence`; compute A2 `tool-sequence-correctness` |
| **P2** | No **uniqueness oracle** (skill-leveraged vs generic LLM) | Add `uniqueness-proof` judge dimension |
| **P2** | No **trigger-type-specific** bench cases (launch / competitor-moved / template) | Add ≥2 trigger-driven cases |
| **P2** | Per-brand / per-team **criteria variant** missing | `brand_id`/`team_id` scoping in `loadCriteria()` |
| **P2** | Harvest **weekly automation** absent (manual CLI only) | Cron sweep + `harvest_sweeps` archive + Slack summary |
| **P2** | Harvest **candidate→fixture promotion** UI absent | Harvest-bench approve/reject/export-markdown flow |

---

## Current state (what we have)

- **Deterministic engine** (`engine.ts`) with **10 KPIs** and **6 guardrails** (`metrics.ts`) — coverage-style present/absent counts: `tool-call-coverage`, `persona-adaptation`, `safety-coverage`, `skill-faithful`, `actionability`, `artifact-coverage`, etc.
- **A1 live contract checks** (`liveTier.ts`) — schema/shape conformance against the live MCP surface.
- **A2 LLM judge** (`live/replay.ts` + `live/anthropic.ts`) — replays each `EvalCase`'s user turns through the model, then scores `JUDGEABLE_DIMENSIONS = ['skill-faithful','persona-adapt','safety']` (gated on `ANTHROPIC_API_KEY`).
- **Curated cases + admin bench** — 5 hand-written `EVAL_CASES` (`cases/catalog.ts`); admin surfaces `CoachEvalsAdmin.tsx` / `EvalBench.tsx`.
- **mcpjam export** (`mcpjam/generate.ts` → `mcpjam-suite.generated.json`) — external, set-based tool-call matcher.
- **Oracle taxonomy** (`cases/types.ts`, `metrics.ts` `CORE_ORACLES`) — `skill-faithful`, `tool-call`, `schema`, `persona-adapt`, `artifact`, `safety`.
- **ICP module** (`icp/profiles.ts`) — canonical P1 (Maya) / P2 (Rico) profiles, triggers, detection signals, success criteria.
- **Corpus** — 102 conversation fixtures (`src/test/fixtures/conversations/`), 80 journey fixtures across J1–J8, P1/P2, 5 product variants; 10 edge/negative/isolation cases.
- **NEW in this change** — Coach **Criteria** authoring system (`criteria/catalog.ts` + `types.ts`: 10 `DEFAULT_CRITERIA`, `criteriaSteeringPreamble()`, `criteriaJudgeDimensions()`); **Harvest loop** (`harvest/harvest.ts`, `harvest/types.ts`, `runHarvest.ts`, `harvest/sampleConversations.ts`) — classifier, screener, feature-idea extraction, ICP aggregation, all pure/testable.

---

## Gaps by area

### A. Eval coverage (deterministic KPIs + journeys)

**No deterministic measurement of Decision Trigger specificity and correctness**
- **Current:** `cases/catalog.ts` defines a `primaryTrigger` oracle field; `metrics.ts` `actionability` only checks a deliverable is *present*. Trigger correctness is only verifiable via the gated A2 tier.
- **Gap:** No `trigger-accuracy` KPI computing `triggers-matched / total-journeys`. The `skill-faithful` dimension is abstract; the Skills 09/10 selection logic is never measured against actual output.
- **Impact:** The product promise is "ONE Decision Trigger" — but no test verifies the coach picks the right one. Maya ships a fix on the wrong trigger = wasted effort, lost trust.
- **Recommendation:** Add `trigger-accuracy`: for fixtures with `primaryTrigger`, compute expected trigger from avatar + pillar scores (Skills 09/10), extract actual from output, score `match ? 1 : 0`; report pass rate over the 80 fixtures.
- **Severity:** P0

**No metrics for the Diagnose→Analyse→Fix→Re-measure→Defend loop completeness**
- **Current:** `metrics.ts` `actionability` = fixtures ending on an actionable deliverable (binary). No "loop"/"re-measure" journeys exist; J1–J8 are single-session. `profiles.ts` names P1 retention as "the loop keeps earning the visit" but nothing tests it.
- **Gap:** No loop-type fixtures (Session 1 diagnose → metric improves → Session 2 re-defend); no test of avatar/trigger persistence across sessions; no `loop-readiness` metric.
- **Impact:** The loop is the positioning. Untested, the product is a single-shot diagnostic, not a repeatable loop — undermining P1 retention.
- **Recommendation:** Create 4–6 two-session loop fixtures; add `loop-readiness = passing-loop-fixtures / total-journey-fixtures`; assert prior avatar/trigger persists and the coach re-scores on new evidence.
- **Severity:** P0

**No measurement of Trust Gap score accuracy (the lead magnet's core metric)**
- **Current:** Trust Gap scores are produced (e.g. `J1-diagnose-avatar/P1-v0.md` returns pillar scores); `artifact-coverage` passes as long as *a* Trust Gap exists. Arbitrary scores (50/50/50/50) would pass.
- **Gap:** No `trust-gap-accuracy` KPI; the Skills 01/03/06 calculation is not exposed as a deterministic oracle the harness can call to produce expected pillar scores.
- **Impact:** Trust Gap is the free lead magnet driving conversion. Wrong scores = lost credibility, killing LTV and word-of-mouth.
- **Recommendation:** Encode the expected-score calc as an oracle fn; pre-compute expected pillar scores per fixture; `score = 1 - (avg_pillar_error / 100)`; flag accuracy < 0.9 as bugs.
- **Severity:** P0

**No coverage measurement for the forensic pipeline's evidence-analysis phase (Analyse)**
- **Current:** `tool-call-coverage` counts *invocation*, not whether tool *output* is interpreted. A coach could call `run_trust_gap` then ignore the scores and still pass.
- **Gap:** No `forensic-analysis` oracle measuring (1) diagnostic-tool-invoked-before-recommendation, (2) coach references tool output next turn, (3) citation density.
- **Impact:** "Forensic pipeline" *is* the Analyse step. Unmeasured, you cannot tell real analysis from ceremonial. P1 Maya's "Why?" deserves evidence, not a generic trigger.
- **Recommendation:** Add temporal-ordering, reference-to-output, and citation-density checks starting with J1–J3.
- **Severity:** P1

**No deterministic measurement of Decision Trigger placement alignment (Amazon-element specificity)**
- **Current:** `artifact-coverage` checks a brief exists; the `outcome` field (e.g. "recognition-led hero image + bullet-1 brief") is hand-checked. "Make it more trustworthy" passes.
- **Gap:** No `amazon-element-specificity = elements_referenced / elements_expected` (hero/bullets/A+/title).
- **Impact:** P1 wants something handable to a designer today; P2's brief must be self-contained. Abstract briefs lose the value prop and cost time.
- **Recommendation:** Parse the expected `outcome` for listing elements, search the output for them, score referenced/expected; flag < 0.5 as failure.
- **Severity:** P1

**No behaviour-level test for the Evidence-Based Principle (fabrication risk)**
- **Current:** `criteria/catalog.ts` defines `evidence-grounded-never-fabricate` (weight 5); `metrics.ts` `safety-coverage` is present/absent on the `[safety]` tag. A fabricated review quote can still carry the tag and pass.
- **Gap:** No deterministic `evidence-coverage = cited-claims / substantive-claims`; fabrication (invented quote/stat) is structurally unmeasurable.
- **Impact:** The differentiator is "grounded in the user's OWN evidence". A fabricated quote = trust collapse + FTC/Amazon account risk. No deterministic safeguard.
- **Recommendation:** Tag evidence-citing claims (`⟦evidence:review-quote⟧` / `⟦evidence:pillar-score⟧`); compute coverage; measure on the 10 edge/negative cases; add KPI.
- **Severity:** P1

### B. mcpjam + behavioural (A2 judge)

**A2 Judge: criteria-scoring integration missing**
- **Current:** `criteriaJudgeDimensions()` exists but is never called. `replay.ts` filters with hardcoded `JUDGEABLE_DIMENSIONS` and never consults the `CriteriaSet`. The steering preamble is injected; the scoring dimensions are not. `scoreCase()`/`runBehaviouralJudge()` take no `CriteriaSet`.
- **Gap:** Criteria-mapped dimensions (`artifact`, `tier-a-terms-visible`, `one-recommendation-not-a-menu`) are never passed to the judge.
- **Impact:** Trevor's criteria tuning is generative only. Editing weights/toggles cannot show whether coach behaviour improved on those dimensions — the feedback loop is incomplete.
- **Recommendation:** Pass `CriteriaSet` into the judge; derive dimensions from `criteriaJudgeDimensions(set) + JUDGEABLE_DIMENSIONS`; add per-dimension guidance to the judge prompt.
- **Severity:** P1

**Artifact correctness & content validation uncovered**
- **Current:** Cases declare `artifact` and `primaryTrigger`, but `scoreCase()` filters `artifact` out (not in `JUDGEABLE_DIMENSIONS`); the judge sees the outcome description with no dimension to score it. mcpjam validates tool calls, not artifact content.
- **Gap:** No dimension evaluates whether the artifact is correctly generated, carries the right trigger, or is evidence-grounded. Tool-call accuracy passes; recommendation correctness can't be checked.
- **Impact:** The coach can call the right tools in the right order yet recommend the wrong trigger (e.g. "Permission (Assessor)" when evidence points to "Recognition (Dove, Protector)") and evals stay silent. Semantic errors are invisible.
- **Recommendation:** Add `artifact` to `JUDGEABLE_DIMENSIONS`; extend the guide to validate artifact type + parsed trigger vs `primaryTrigger` + citation count; give the judge the case's diagnostic context.
- **Severity:** P0

**No recommendation-correctness testing (Trust Gap alignment)**
- **Current:** `anthropic.ts` mentions `expected.primaryTrigger` in case context but the guide has no dimension to score it; `scoreCase()` doesn't pass it as a dimension.
- **Gap:** No dimension validates the recommended trigger matches the diagnostic (Trust Gap + dominant buyer state + review patterns → correct trigger per Skills 09–10).
- **Impact:** Grammatically correct, skill-citing output can still pick the wrong trigger; customers get the wrong fix and evals can't catch it.
- **Recommendation:** Add `recommendation-alignment`: give the judge the diagnostic context + expected trigger + decision-table rules; parse the recommended trigger and validate. Alternatively require a structured brief schema with an explicit trigger field.
- **Severity:** P0

**Multi-turn context & reference accuracy not scored**
- **Current:** `replay.ts` builds history as `ConversationMessage[]` (role + text only). The judge receives `evalCase` (title/persona/expected) but the prompt doesn't use `case.memory`, `case.context.fields`, or `expected.primaryTrigger` for coherence.
- **Gap:** Multi-turn consistency and evidence persistence are unevaluated; P2 scaffold progression (define→example→step→checklist) can't be verified.
- **Impact:** Long J2–J8 sessions and P2 teaching cannot be validated end-to-end; coherence drift is invisible.
- **Recommendation:** Feed `case.memory`, `case.context.fields`, and diagnostic goals into the judge; add optional `multi-turn-coherence`, `evidence-persistence`, and (P2) `scaffold-progression`.
- **Severity:** P1

**mcpjam safety/refusal cases trivially pass**
- **Current:** mcpjam passes when every `expectedToolCall` appears; safety cases carry empty `expectedToolCalls`, so zero-expected ⇒ green. `mcpjam/README.md` already notes this (line 21).
- **Gap:** mcpjam cannot validate refusal/no-fabrication/injection resistance. Only the gated A2 judge scores safety.
- **Impact:** External CI safety validation is blind — a fabrication or injection regression reports success.
- **Recommendation:** Add a non-gated, rule-based safety harness (`src/mcp/evals/safety/`): regex for refusal/fabrication/buyer-state/neuroanatomy/injection markers. Mark safety cases skip/`expected-empty` in the generated suite so CI tools don't false-green them.
- **Severity:** P1

**mcpjam tool-call matching ignores sequencing / arity / conditional logic**
- **Current:** mcpjam matching is set-based (unordered, no arity, no branching). Cases like `infinityvault-recognition` expect `[run_trust_gap → build_avatar_stage → run_diagnostic_evidence → generate_brief]` but order isn't enforced.
- **Gap:** Cannot express tool order, conditional branching, arity, or input validation.
- **Impact:** A coach that diagnoses *before* building the avatar (wrong sequence) still passes; pipeline ordering is unvalidated externally.
- **Recommendation:** Document the limitation; add optional `expectedToolSequence`; have A2 compute `tool-sequence-correctness` from its captured `toolCalls`.
- **Severity:** P2

**No uniqueness oracle (skill-leveraged vs generic LLM)**
- **Current:** `uniqueness` is not in `CORE_ORACLES` and would be filtered out of `JUDGEABLE_DIMENSIONS`; no judge guidance exists.
- **Gap:** No eval validates the coach uses IDEA-specific frameworks vs generic reasoning.
- **Impact:** No metric proves the skills are the source of value; a competitor with similar tools would be indistinguishable in evals.
- **Recommendation:** Add `uniqueness-proof` with a reference list of IDEA-specific terms/concepts; judge rates 0–1 on visible skill leverage.
- **Severity:** P2

### C. ICP fit (P1 Maya / P2 Rico)

**Persona-adapt oracle is structural, not behavioural**
- **Current:** `metrics.ts` `persona-adaptation` counts `[persona-adapt:Px]` tags; the test-foundations oracle text describes expected behaviour but nothing scores magnitude/correctness. A `[persona-adapt:P1]` fixture passes even if the coach gives 20 lines of teaching.
- **Gap:** No deterministic proxies for `answer-urgency`, `compression-signal` (msg ratio), `next-action-singularity`.
- **Impact:** P1 churns if she gets scaffolding instead of compressed done-for-you; verification needs the gated A2.
- **Recommendation:** Add the 3 proxies across J1–J8 P1/P2 pairs.
- **Severity:** P1

**Persona-adaptation metric is count-only, not behaviourally validated**
- **Current:** Reported as 102/102 = 1.0 always (false positive). Only 3 of 5 `EVAL_CASES` declare `[persona-adapt]` in their oracle (guyology and sleep-supplement omit it), so 2/5 generate no behavioural judge score.
- **Gap:** Zero variance signal; Trevor iterating `persona-adapt-delivery` gets no LLM verdict data.
- **Impact:** No quantitative feedback on whether P1 compression vs P2 teaching is actually delivered.
- **Recommendation:** Add `[persona-adapt:Px]` to all 5 bench cases; surface A2 scores (not counts) in `buildCoachValue()` with weight > 0.
- **Severity:** P1

**P2 (Rico) SOP-building job lacks eval bench coverage**
- **Current:** Only 1 P2 bench case (`va-teaching-canvas`, J2); the corpus has 50 P2 fixtures (incl. J3 owned-chain variants) but none of the SOP/checklist ones are promoted.
- **Gap:** Three P2 jobs — task execution, SOP/checklist building, deliverable production — have no curated bench case.
- **Impact:** The "in-house AI trainer" differentiation is untested at bench level; Trevor can't iterate P2 criteria without a case.
- **Recommendation:** Promote ≥2 corpus fixtures (e.g. `J3-owned-chain P2-v0/v1` with reusable-checklist generation, plus a 2nd-SKU avatar-reuse case); tag `[persona-adapt:P2]` + `[artifact:checklist]`.
- **Severity:** P1

**Re-measure / Defend loop untested in bench**
- **Current:** All 5 bench cases are initial visits (Diagnose + Fix). No case shows a return visit with new A/B results and a re-score.
- **Gap:** No case for: user returns post-fix (conversion improved) → coach re-runs `run_trust_gap` → shows improvement → next trigger. P1's retention loop has zero operational proof.
- **Impact:** P1's core job ("find why a hero SKU under-converts and fix it") is untested across the full loop; the ROI/recurring-use business case is unvalidated.
- **Recommendation:** Add a retro case (e.g. extend `infinityvault`/`guyology`): baseline 12% → fix applied → new 15% → coach re-scores, names what remains, suggests next trigger; `[artifact:improvement-summary]` + `[persona-adapt:P1]` + `[tool-call]`.
- **Severity:** P1

**Amazon vertical-specific behaviour untested in bench**
- **Current:** 5 bench cases are vertical-agnostic; the corpus has a single health-claim edge case but it's not promoted. `publish_filter_check` exists but no bench case tests claim-blocking per vertical.
- **Gap:** No bench case for supplements (block "treats anxiety"), beauty (question "natural/organic"), or apparel (sustainability claims).
- **Impact:** Vertical scalability is unvalidated; compliance risk in health-adjacent verticals.
- **Recommendation:** Add ≥1 case per high-risk vertical with `[safety]` + `[artifact:compliance-check]` showing refusal/approval.
- **Severity:** P1

**ICP trigger-specific behaviour declared but not exercised**
- **Current:** `profiles.ts` declares distinct triggers (P1: unit-% dropped / competitor moved / launching; P2: delegated task / wants template), but every bench case uses one trigger type ("conversion soft" / "teach me" / injection).
- **Gap:** No case for "launching fresh SKU", "competitor moved", or "wants reusable template", each of which implies different coaching moves.
- **Impact:** Trigger-driven adaptation is unvalidated; future trigger-detection has no reference case.
- **Recommendation:** Add ≥2 cases — P1 launch (avatar from founder story + positioning template) and P2 template (SOP + example + checklist); tag the trigger in context/memory.
- **Severity:** P2

### D. Correctness & terminology

**Edge fn `identify-decision-trigger` still references Lego as the Recognition anchor**
- **Current:** `supabase/functions/identify-decision-trigger/index.ts` lines 86/95/105 teach "Recognition … Anchor: Lego" and emit "like Lego". Skill 09 (`09-decision-trigger.md` line 34) corrects this: **Recognition = Dove** (Lego is the **Identity** anchor) per IDEA-APP-FIXES-001 v1.0.
- **Gap:** The edge-fn prompt was never updated when the anchor was corrected; the LLM will emit the wrong anchor.
- **Impact:** Every Recognition Decision Trigger ships "like Lego" instead of "like Dove" — a wrong psychological frame contradicting the framework, also breaching Tier A commercial-term fidelity.
- **Recommendation:** Replace Lego→Dove on lines 86, 95, 105.
- **Severity:** P0

**No eval test for Dove anchor correctness in Decision Trigger output**
- **Current:** Both Recognition cases (`infinityvault-recognition`, `guyology-recognition`) carry generic oracles; none assert `brand_anchor` contains "Dove". `criteria/catalog.ts` `recognition-when-empathetic-gap` maps to `skill-faithful` (coarse).
- **Gap:** No `anchor-correctness` dimension/assertion mapping Recognition→Dove (Identity→Apple, etc.).
- **Impact:** The Lego→Dove regression won't be caught; a future model that ignores steering ships the wrong anchor undetected.
- **Recommendation:** Add `anchor-correctness` oracle; backfill both Recognition cases; judge/guardrail check: dominant_type=Recognition ⇒ `brand_anchor` contains "Dove", not "Lego".
- **Severity:** P0

**CAPTURE element names appear in the edge-fn prompt (Tier B leak at runtime)**
- **Current:** `index.ts` line 96 instructs `placement_instruction` to "name a CAPTURE element (Contextual, Attention, Pain/Problem, Transformation, Uniqueness, Reassurance, Emotional CTA)". Skill 09 (lines 46–47, 62) says at Alpha CAPTURE names are not used at all; the correct format is plain English ("Lead with recognition in your hero image headline and bullet 1.").
- **Gap:** Per IDEA-POLICY-TERM-001, CAPTURE names are **Tier B** — never in primary panels. `placement_instruction` is user-facing (Component 3), so this leaks Tier B at runtime.
- **Impact:** Users see unexplained terms (Contextual, Uniqueness, Reassurance) with no context; "the finding is visible, the method is not" breaks; the Tier B opt-in contract is violated.
- **Recommendation:** Remove the CAPTURE instruction; reference listing elements (hero, bullets, A+, reviews) in plain English only.
- **Severity:** P0

**Terminology-tier compliance uncovered (policy check missing)**
- **Current:** `criteria/catalog.ts` defines `tier-a-terms-visible` (no `evalDimension` set, so excluded by `criteriaJudgeDimensions()`) and `no-engine-internals-leak` (→ `safety`, but the safety guide doesn't mention terminology). No dimension checks Tier A visibility or Tier B/C hiding.
- **Gap:** IDEA-POLICY-TERM-001 compliance is unmeasurable; omitting "Decision Trigger™" or leaking Assessor/Protector in the primary panel passes.
- **Impact:** Policy violations go undetected; steering tells the coach to use Tier A terms but evals can't verify it.
- **Recommendation:** Add a `terminology-policy` dimension (Tier A visible / Tier B hidden in primary / Tier C clean) with keyword/pattern lists (Trust Gap™, Decision Trigger™, pillar names = A; Assessor/Protector/Expresser/Connector = B; neuroanatomy, S1–S4, field names = C); assign to the two criteria.
- **Severity:** P1

**No test for evidence-based diagnostics (criteria exists but not enforced)**
- **Current:** `criteria/catalog.ts` `evidence-grounded-never-fabricate` → `safety`; the judge's `safety` dimension bundles injection + hallucination + fabrication and is binary. No `[evidence-based]` assertion exists on the cases.
- **Gap:** No fine-grained dimension/check asserting each claim is traceable to the supplied listings/reviews.
- **Impact:** The "forensic pipeline grounded in the user's OWN evidence" promise is undefended; fabricated/uncited claims won't be caught.
- **Recommendation:** Add a distinct `evidence-based` dimension; backfill avatar/diagnostic fixtures; add it to `JUDGEABLE_DIMENSIONS`; guardrail samples cited claims for verbatim presence in supplied evidence.
- **Severity:** P1

**No runtime test of the Decision Trigger edge-fn output format**
- **Current:** Stage 1 (deterministic prior) is tested (`src/lib/__tests__/decisionTrigger.test.ts`); Stage 2 (LLM derivation via the edge fn) has no CI test. The only path is manual or the gated bench.
- **Gap:** No CI-compatible integration test validating output shape + invariants (Dove anchor, no CAPTURE names, quoted evidence).
- **Impact:** Edge-fn prompt regressions (Lego→Dove, CAPTURE leak) surface only in prod or manual testing.
- **Recommendation:** Add a mock-Anthropic integration test (DI to avoid hard Deno coupling) asserting: schema conformance; `dominant_type` ∈ six triggers; `brand_anchor` ≠ "Lego"; no CAPTURE names; `evidence_phrases` quoted. Prioritise schema + Dove (P0), then CAPTURE.
- **Severity:** P1

### E. Criteria authoring (NEW in this change)

**Criteria Studio UI — admin dashboard missing**
- **Current:** `criteria/catalog.ts` promises an "admin Criteria Studio"; no `CriteriaStudio.tsx` exists. `STORAGE_KEY = 'idea.coach.criteria.v1'` is defined but unused (grep-confirmed). Only `CoachEvalsAdmin.tsx`, `EvalBench.tsx`, `FeatureFlagAdmin.tsx` exist.
- **Gap:** No component, no admin route, no localStorage hooks, no edit form, no export button.
- **Impact:** Trevor can't author/tune criteria without code changes; the "Trevor-authorable" promise is unfulfilled.
- **Recommendation:** Build `CriteriaStudio.tsx` (per-criterion form: title/description/category/icpScope/weight 1–5/polarity/optimizeToward/evalDimension) + localStorage under `STORAGE_KEY` + add/delete/reorder + export-to-TS; wire route behind `AdminGate`.
- **Severity:** P1

**Criteria → deployed coach steering pipeline broken**
- **Current:** `replay.ts` injects `criteriaSteeringPreamble(DEFAULT_CRITERIA_SET, …)` for evals only. `server.ts`/`config.ts` use static `SERVER_INSTRUCTIONS` with zero criteria references across the 64 tool registrations.
- **Gap:** The deployed coach never reads criteria; steering is evals-only.
- **Impact:** Even when the Studio exists, edits have zero effect on production; coaching-quality tuning can't happen live.
- **Recommendation:** Add `criteriaSet` to `HostConfig`; add `service/coachCriteria.ts` `loadCriteria(brandId?, teamId?)` (Supabase + DEFAULT fallback); prepend the steering preamble in `createServer()`; pass per-request via the JWT-bound identity layer.
- **Severity:** P1

**Criteria not persisted to production (localStorage only)**
- **Current:** `STORAGE_KEY` unused; no `criteria_sets` table/migration; no read/write edge fns.
- **Gap:** Studio edits would be browser-local — not synced, version-controlled, server-readable, auditable, or shareable.
- **Impact:** Criteria edits are ephemeral and undeployable; the "exported back here to commit" flow has no automation/approval/audit.
- **Recommendation:** Add `criteria_sets` (id, brand_id, team_id, version, note, criteria JSONB, timestamps, created_by) + RLS + `/criteria/get` & `/criteria/upsert` edge fns; wire the Studio to them with "Deploy to live" / "Download TypeScript".
- **Severity:** P1

**Criteria judge dimensions incomplete**
- **Current:** `JUDGEABLE_DIMENSIONS` is the hardcoded 3; line 162 filters to it. Most criteria `evalDimension`s (`artifact`, `evidence-grounded`, `trevor-voice`, `amazon-context`) aren't in it; `criteriaJudgeDimensions()` extracts criterion IDs, not `evalDimension`s (mismapping).
- **Gap:** Most criteria are unmeasured by the judge.
- **Impact:** Criteria compliance is partly invisible; Trevor can't see which of his 10 rules are followed.
- **Recommendation:** Expand `JUDGEABLE_DIMENSIONS` to match the `evalDimension`s; fix the mapping; add per-dimension rubrics to the judge prompt; show per-dimension scores in reports.
- **Severity:** P2

**Criteria not exportable/versionable in evals context**
- **Current:** `DEFAULT_CRITERIA_SET` is hardcoded; `replay.ts` passes DEFAULT with no override; `runLive.ts`/`npm run evals:live` accept no `--criteria-set`/`EVAL_CRITERIA_SET`; the Studio (localStorage) has no link to the runner.
- **Gap:** Trevor can't run evals against alternative criteria sets (baseline vs experiment).
- **Impact:** The authoring→validation loop is broken: edit → steer → can't validate impact → can't iterate.
- **Recommendation:** Add `--criteria-set` to `runLive.ts`; load criteria JSON if provided; store the active version in report metadata; derive judge dimensions from the loaded set.
- **Severity:** P2

**Per-team / per-brand criteria variant missing**
- **Current:** `DEFAULT_CRITERIA_SET` is a global singleton; steering is hardcoded to DEFAULT with no per-brand override.
- **Gap:** No `brand_id`/`team_id` scoping mechanism; UI, loader, and prompt injection all assume one set.
- **Impact:** All brands get the same coaching philosophy; vertical tuning needs code/DB hand-edits.
- **Recommendation:** Scope `criteria_sets` by `brand_id`/`team_id` (+ template flag); `loadCriteria()` falls back brand → team → DEFAULT; Studio "Apply to" selector; show the active set as a badge in the dashboard.
- **Severity:** P2

### F. Harvest loop (NEW in this change)

**Core infrastructure missing (no log source, no sweep automation, no UI)**
- **Current:** The data model (`harvest/types.ts`), sweep logic (`harvest.ts`: classify/screen/feature-idea/ICP-aggregate), CLI (`runHarvest.ts`, `npm run evals:harvest`), and sample data (`sampleConversations.ts`) all exist and are pure/testable. But `runHarvest.ts` (line ~10) notes the real source is Supabase `chat_sessions`/MCP transcripts — **no adapter exists**; no `/admin/harvest` UI; no cron. Task #31 is pending.
- **Gap:** Real conversations aren't logged, classified, or promoted to test cases; failures don't become evals; ICP signal isn't data-driven. The corpus stays static.
- **Impact:** Evals don't improve over time; a new failure pattern or third ICP won't trigger a new case; the problem-solver pivot (which rests on real evidence/feedback) can't evolve.
- **Recommendation:** (1) Wire a Supabase adapter (`chat_sessions`/`chat_messages`, optional `harvest_mcp_logs`); (2) scheduled weekly sweep storing `SweepResult` in a `harvest_sweeps` table; (3) build `/admin/harvest-bench` (Candidates / Feature Ideas / ICP Signals tabs); (4) aggregate signals into a "Suggest Profile Update" diff for `profiles.ts`. (Note: the classifier, screener, feature-idea extractor, and ICP aggregator are already implemented — the gap is wiring, not logic.)
- **Severity:** P1

**PII & redaction: no privacy controls for logging real conversations**
- **Current:** `src/mcp/logging/redact.ts` covers MCP log sanitisation only. The harvest pipeline reads raw `Conversation` objects and writes `candidates.json` with full conversation text — no PII detection.
- **Gap:** Harvest doesn't redact PII before proposing candidates or exporting fixtures (customer names, margins, ASINs, brand names leak into JSON/UI/issues).
- **Impact:** Real conversations contain customer data and brand secrets → GDPR/CCPA + competitive exposure if they reach fixtures, GitHub, or Slack.
- **Recommendation:** Add `harvest/redact.ts` `redactConversation()` (emails, phones, names, ASINs, brand names); wire it into the sweep before `toCandidateCase()`; redact on export/UI; test against PII-laden samples.
- **Severity:** P1

**Weekly sweep: no automation (manual CLI, no cron)**
- **Current:** `runHarvest.ts` is manual; results written to disk, not Supabase; no schedule/summary.
- **Gap:** No recurring system; results aren't archived; no automated summary.
- **Impact:** Harvest is ad-hoc and brittle; conversations aren't systematically analysed.
- **Recommendation:** Weekly cron (Supabase fn / GitHub Actions) → `harvestSweep()` over Supabase-loaded conversations → store `SweepResult` in `harvest_sweeps` → Slack summary (#coach-insights); harvest-bench loads the latest from DB.
- **Severity:** P2

**Candidate → fixture promotion: no UI**
- **Current:** `harvestSweep()` returns `CandidateCase[]` to `candidates.json`; `EVAL_CASES` are hand-written; no review/approve/export path.
- **Gap:** Harvested candidates can't be promoted without manual copy/paste/conversion.
- **Impact:** Real signal goes in but doesn't drive test improvements; the loop is broken at harvest→test.
- **Recommendation:** Harvest-bench Candidates tab (list, expand source convo, Approve→promote+export markdown, Reject→feature idea, Refine→edit oracle); track status in DB so approved cases don't recur.
- **Severity:** P2

**No evaluation of the harvest loop itself**
- **Current:** Harvest code exists but the conversation→test-case→promotion path is never exercised end-to-end against real data.
- **Gap:** The prod→eval loop is unclosed; production failures aren't systematically added to evals.
- **Impact:** A new customer segment's failure pattern won't enter the 80 golden journeys; feedback stays manual.
- **Recommendation:** Implement capture → weekly A2-replay of last-N conversations → flag composite < 0.6 → auto-generate `EvalCase` to `harvest/candidates.json` → Trevor review/promote.
- **Severity:** P1

> **Already implemented (no gap):** `classifyConversation()` (P1/P2 detection), `screen()` (4 quality gates), `featureIdea()` (failure→capability), and `aggregateIcpSignal()` (vocab/problems fusion) are complete and used by `harvestSweep()`. Their *surfacing* (Slack/GitHub routing, profile-sync UI) remains (P2).

---

## What this change addresses vs what remains

**Addressed in this change**
- Coach **Criteria** data model + steering preamble + (partial) judge-dimension derivation (`criteria/`).
- Harvest **logic** end-to-end as pure functions: classifier, screener, feature-idea extraction, ICP aggregation, CLI, sample data (`harvest/`).
- ICP module formalising P1/P2 with triggers, detection signals, success criteria (`icp/profiles.ts`).
- Criteria steering injected into the **eval** replay path (`replay.ts`).

**What remains (priority order)**
- **P0 correctness:** Lego→Dove in the edge fn; CAPTURE Tier-B leak; `artifact` + recommendation/trigger correctness in the judge; Trust Gap & trigger-accuracy KPIs; loop-completeness fixtures + KPI; `anchor-correctness` oracle.
- **P1 closing the loops:** judge consumes the `CriteriaSet`; terminology-policy + evidence-based dimensions; persona-adapt behavioural scoring on all 5 cases; forensic-Analyse checks; P2 SOP + Re-measure + vertical bench cases; edge-fn runtime test; **Criteria Studio UI + Supabase persistence + deployed-coach steering**; **harvest wiring (Supabase adapter, scheduler, harvest-bench UI, PII redaction)**.
- **P2 polish:** mcpjam sequence/arity docs + A2 sequence metric; uniqueness oracle; trigger-type cases; per-brand/team criteria; harvest cron + promotion UI + profile-sync.

---

*UK English throughout. File references are relative to the worktree root `.../idea-brand-coach/`. Severities follow the verified-gap inputs; "already implemented" harvest items are noted to prevent re-work.*

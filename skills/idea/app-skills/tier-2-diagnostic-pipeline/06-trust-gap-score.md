---
skill: "06"
name: The Trust Gap Score
tier: 2 — Diagnostic Pipeline
scope: Alpha
user_facing: true
internal_only: false
always_in_context: false
trigger: "Phase 1: self-reported diagnostic (free, no account). Phase 2: cross-referenced with review corpus after listing upload (paid)."
depends_on: "07, 05"
status: complete
type: framework
doc_ref: IDEA-APP-SKILLS-001 v1.0
---

# SKILL — The Trust Gap Score

## Purpose
How to score a brand across the four IDEA pillars, what the score means at different ranges, how to identify the primary gap, and how to write **Component 0** — the plain-language primary conversion problem statement. Out of 100; each pillar out of 25.

---

## 1. The two phases (this distinction governs the paygate)

| Phase | How it works | What the user receives |
|---|---|---|
| **Phase 1 — Free diagnostic** | **Evidence-based self-scoring** (NOT self-assessment): one question per pillar that the user answers by *observing their own listing* (hero, bullets, trust signals), 1–5 scale. No corpus. ~10 minutes. The instruction primes observation: *"Look at your listing as a first-time shopper would. Score what you actually see — not what you intended to show."* | Trust Gap Score /100, four pillar scores /25, primary gap identified, plain-language explanation. **No Decision Trigger at this phase.** |
| **Phase 2 — Full analysis** | Data-driven. Pillar scores cross-referenced against the review corpus analysis and buyer-state classification; enriched and potentially adjusted by evidence. | Enriched Trust Gap Score, **Component 0**, primary **Decision Trigger**, design brief. The paid-tier output. |

## 2. Scoring the four pillars
Each pillar /25; total /100.

Questions are **evidence-based** (IDEA-APP-FIXES-001 Fix 1) — answerable by looking at the listing, not by consulting the owner's beliefs. The old subjective wording produced a confidence score, not a Trust Gap; every downstream output depends on this score being grounded in observable reality.

| Pillar | Diagnostic question (Phase 1 — observe your listing) | Score 1 → 5 | Phase 2 corpus cross-reference |
|---|---|---|---|
| **I — Insight** | Look at your hero image headline and first bullet. Do they describe what the product *does* — or *why* the customer needs it right now? | All specs/claims → Speaks to the emotional moment | Review vocabulary depth/specificity; emotional-driver vs feature-only language. |
| **D — Distinctive** | Remove your brand name from your listing. Could it belong to any of your top three competitors? | Could be anyone in the category → Impossible to confuse with anyone else | Presence of identity/aspiration language; absence of comparison language (high comparison = not distinctive enough). |
| **E — Empathetic** | Read your bullet points aloud. Do they describe what the product does — or how the customer *feels* when they need it? | Pure feature list → Customer sees themselves in every line | Ratio of emotional to rational language in reviews referencing brand communication; Protector-state frequency. |
| **A — Authentic** | Count the trust signals a first-time visitor can see in your hero image before they scroll or read a review. How many? | None visible → Three or more strong trust anchors | Trust-signal references; absence of credibility complaints in 3-star reviews; Connector-state frequency. |

## 3. Score interpretation

| Range | Diagnostic | What it means |
|---|---|---|
| **80–100** | Strong trust base | Primary gap is narrow. Improvement comes from trigger optimisation, not gap-closing — focus Momentum or Fear-of-Loss. |
| **60–79** | Moderate gap | One or two pillars meaningfully weak. Primary gap identifiable and addressable. Most common range for functioning brands with conversion problems. *Guyology Labs reference: 62.* |
| **40–59** | Significant gap | Multiple weak pillars. Brand likely competing on price/search position, not trust. More than one round of fixes needed. Prioritise the lowest pillar first. |
| **Below 40** | Wide gap | Foundational trust signals not yet established. Focus on the single most urgent fix; explicitly advise against ad spend until the gap narrows. |

## 4. Component 0 — the primary conversion problem statement
The user-facing expression of the Skill 05 buyer-state classification. **One sentence**, plain English, telling the brand owner what is happening in their customer's mind at the point of decision — **without naming the buyer state, framework terminology, or neuroscience.** It sits **above** the Decision Trigger panel and **below** the Avatar profile: the bridge between diagnosis (Trust Gap) and prescription (Decision Trigger). Generated from the `copy_calibration_direction` field, translated into the user's context using review evidence + the score.

| Primary gap | Component 0 output |
|---|---|
| **Empathetic (E)** | "Your customer has almost certainly tried products like yours before and been let down. Before they will listen to your evidence, they need to feel that you understand exactly where they are." |
| **Insight (I)** | "Your brand is communicating at the surface level. Your customer buys for reasons they may not be able to articulate, and your current messaging does not reach those reasons." |
| **Distinctive (D)** | "Your customer cannot give a clear answer to the question: why this brand over the others? Until that is solved, all your other trust signals are competing on a level playing field." |
| **Authentic (A)** | "Your brand has not yet established enough visible credibility for a first-time visitor to commit without hesitation. The gap is not in what you offer — it is in the evidence that you are who you say you are." |

> Component 0 must never contain: buyer-state names, framework terminology, academic references, or language requiring knowledge of the IDEA Framework to interpret. Written for a brand owner reading their results for the first time.

## Coaching Application
Phase 1: produce the score and primary gap from self-report and explain it plainly. Phase 2: after Skills 07 + 05, enrich the score from the corpus, write Component 0 from `copy_calibration_direction`, then hand off to the Decision Trigger (Skill 09). Never invent pillar scores — if a Phase-1 input is missing, ask for it.

Related: [[01-idea-framework-core]] · [[05-four-buyer-states-engine]] · [[07-review-corpus-analysis]] · [[09-decision-trigger]]

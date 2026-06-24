---
skill: "05"
name: The Four Buyer States Engine
tier: 2 — Diagnostic Pipeline
scope: Alpha
user_facing: false
internal_only: true
always_in_context: false
trigger: Automatically after Skill 04 completes. Output consumed by Skills 06 and 09.
depends_on: "04, 07, 06"
status: complete
type: framework
doc_ref: IDEA-APP-SKILLS-001 v1.0
---

# SKILL — The Four Buyer States Engine

## Purpose
The **invisible** classification layer (Layer 2 of the Avatar 2.0 engine). Classifies the dominant buyer state from the review corpus (language attribute classifiers) and the Trust Gap Score (pillar scores as tiebreaker), producing two internal outputs that sharpen Skills 06 and 09. **Never produces user-facing text directly.**

> **Hard rule:** the state names — The Assessor, The Protector, The Expresser, The Connector — must never appear in any output the user sees. Internal taxonomy only. The user sees the *consequence* of the classification, not the classification.

---

## 1. The four buyer states

| State | Brain region | IDEA pillar | Review language pattern | Copy calibration direction | Maps to trigger |
|---|---|---|---|---|---|
| **The Assessor** | Left thinking | Insight (I) | Comparison, research, specification: "after trying several", "I did my research before choosing", "wanted to understand the difference" | Lead with evidence and authority — credentials, data, comparison. Not emotional language. | Permission |
| **The Protector** | Left emotion | Empathetic (E) | Fear, regret, scepticism, past hurt: "I was sceptical", "tried everything", "wish I found this sooner", "nothing worked until" | Mirror the fear before offering the solution — trust signals, guarantees, sceptic testimonials. | Recognition |
| **The Expresser** | Right emotion | Distinctive (D) | Identity, impulse, aspiration: "this is exactly me", "feel like a different person", "finally a brand that gets it" | Lead with personality and visual identity. Brand energy converts; features are secondary. | Identity |
| **The Connector** | Right thinking | Authentic (A) | Values, community, mission: "love what this brand stands for", "feel part of something", "I trust these people" | Brand story and mission before product — founder story, sourcing, purpose-led copy. | Belonging |

## 2. Classification logic (apply in order; stop at first rule that resolves)

| Step | Condition | Action |
|---|---|---|
| 1 | One pillar score clearly lowest (≥3 points below next lowest) | Classify the state mapped to that pillar (Insight=Assessor, Empathetic=Protector, Distinctive=Expresser, Authentic=Connector). |
| 2 | Two pillar scores equally low | Use review-language classifiers — the most frequent pattern wins (see §3 disambiguation). |
| 3 | All four pillars above 18/25 | Derive from review-language classifiers alone (strong brand; trigger driven by customer psychology, not brand weakness). |
| 4 | Comparison/research language dominates **and** review count high (200+) | Flag **Momentum** as candidate trigger regardless of pillar scores; pass to Skill 09 to confirm. |
| 5 | Regret/delay language dominates in a time-sensitive category | Flag **Fear-of-Loss** as candidate trigger; pass to Skill 09 to confirm. |

## 3. Disambiguation: Recognition vs Belonging
These produce superficially similar language; the rule is **directional**.

| State → trigger | Directional signal | Characteristic language |
|---|---|---|
| The Protector → **Recognition** | Inward-facing. The brand reflects something already true about the customer. First-person singular + self-referential + relief. | "Finally a brand that gets it." "This is exactly what I needed." "I feel seen." (register: relief) |
| The Connector → **Belonging** | Outward-facing. The customer orients toward a group. First-person singular referencing a collective + aspiration/confirmation. | "People like me use this." "I found my community." "This is what serious [category] people choose." (register: inclusion) |

**Tiebreaker:** if language is ambiguous, the Trust Gap pillar score decides. Low Empathetic = Protector/Recognition. Low Authentic = Connector/Belonging. **Pillar score always wins over language ambiguity.**

## 4. Internal output fields (never user-facing)

| Field | Type | Description |
|---|---|---|
| `dominant_buyer_state` | string | Assessor \| Protector \| Expresser \| Connector. Internal only. |
| `state_confidence` | string | high \| medium \| low. From clarity of signal. Never surfaced in UI. |
| `copy_calibration_direction` | string | One plain-language sentence on how to address this state in copy (user's language, not the framework's). Consumed by Skill 06 to generate the Component 0 primary conversion problem statement. Example (Protector): *"Your customer has almost certainly tried this category before and been disappointed. They need to feel understood before they will listen to your evidence."* |

## Coaching Application
Run silently after the Avatar profile. Produce `dominant_buyer_state` + `copy_calibration_direction`, hand them to Skills 06 and 09, and discard the taxonomy from anything the user sees. Enforce the gate: Skills 06 and 09 must not run without this classification.

Related: [[04-avatar-2.0-forensic-portrait]] · [[06-trust-gap-score]] · [[09-decision-trigger]] · [[../tier-4-science-engine/15-bolte-taylor-four-buyer-states]]

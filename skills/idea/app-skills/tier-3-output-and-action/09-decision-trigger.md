---
skill: "09"
name: The Decision Trigger
tier: 3 — Output and Action
scope: Alpha
user_facing: true
internal_only: false
always_in_context: false
trigger: Activated after Skill 05 (buyer-state classification) and Skill 06 (Trust Gap Score) complete. The primary conversion output of the Alpha build.
depends_on: "05, 06, 07"
status: complete
type: framework
doc_ref: IDEA-APP-SKILLS-001 v1.0
---

# SKILL — The Decision Trigger™

## Purpose
The single most powerful lever for improving conversion for a specific brand at a specific moment, derived from the intersection of the Trust Gap Score, the buyer-state classification, and the review corpus evidence. **Six triggers; one is primary.** A prescription, not a menu — the coach identifies one trigger and never presents all six for the user to choose. Rebuilt from the v2.20 spec. Feeds directly into Skill 10 (Design Brief Generator).

---

## 1. The six triggers

| Trigger | Primary pillar | Brand anchor | When it applies |
|---|---|---|---|
| **Permission** | I — Insight | Harvard Medical School | Brand hasn't demonstrated sufficient expertise/authority. Customer in rational evaluation mode, can't find the proof. Low Insight score. |
| **Recognition** | E — Empathetic | Dove | Brand isn't mirroring the customer's emotional reality. Protector-state language dominates. Most commonly weak pillar in Trust Gap diagnostics. |
| **Identity** | D — Distinctive | Apple | Customer buys who they want to be, not what the product does. Expresser-state language dominates. No clear identity territory. |
| **Belonging** | A — Authentic | Patagonia | Customer wants values alignment and community before committing. Connector-state language dominates. Low Authentic score. |
| **Momentum** | All pillars elevated | Amazon's Choice | Customer has researched a while, ready to commit, needs the final nudge of social-proof volume. High review count + comparison/research language. Cross-state. |
| **Fear-of-Loss** | All pillars elevated | FOMO signal | Customer motivated by the cost of inaction. Regret/delay language in a time-sensitive category. Frame the cost of waiting, not the benefit of buying. Cross-state. |

> **Brand anchors are fixed permanently.** Permission = Harvard Medical School · Recognition = **Dove** (the Real Beauty campaign — emotional *mirroring*, not identity aspiration) · Identity = Apple · Belonging = Patagonia · Momentum = Amazon's Choice · Fear-of-Loss = FOMO signal. Do not substitute, personalise, or contextualise — they are cultural shorthand, not benchmarks. *(Recognition was corrected Lego→Dove per IDEA-APP-FIXES-001 v1.0 — Lego is the Identity anchor.)*

## 2. The three-component output panel
User-facing. Appears after Component 0 (from Skill 06).

**Component 1 — Trigger label.** The trigger name in prominent type, the brand anchor in smaller type alongside; one line on what this customer needs to see before they buy.
Format: `DECISION TRIGGER™ / [Trigger Name] — [one-line brand analog]`.
Example: *DECISION TRIGGER™ / Recognition — Like Dove, your customer needs to feel that the brand truly understands their situation before they'll engage with anything else you have to say.*

**Component 2 — Evidence.** Two to three **verbatim** phrases from the product's own review corpus. Quoted exactly. No paraphrase, no interpretation.
Example (Recognition, Guyology Labs): *"I was sceptical but I thought I would give it one more try."* / *"I wish I had found this two years ago."* / *"I have tried so many products and nothing worked until this."*

**Component 3 — Placement instruction.** One specific sentence (max two) naming the CAPTURE element where the primary change must happen and the exact placement. The bridge to Skill 10.
Example (Recognition, Guyology Labs): *Lead with recognition in your hero image headline and bullet 1. Your customer needs to feel understood before they are ready to hear your evidence — the clinical data belongs in bullet 3, not bullet 1.*

## 3. Selection rules (apply in order; first rule that resolves is the decision)

| Priority | Condition | Selection |
|---|---|---|
| 1 | Empathetic < 12/25 **and** Protector language dominates | **Recognition** (most common). Confirm via scepticism, past-failure, regret language. |
| 2 | Insight < 12/25 **and** Assessor language dominates | **Permission**. Confirm via comparison, research, specification language. |
| 3 | Distinctive < 12/25 **and** Expresser language dominates | **Identity**. Confirm via self-expression, aspiration, impulse language. |
| 4 | Authentic < 12/25 **and** Connector language dominates | **Belonging**. Confirm via values, community, mission language. |
| 5 | All pillars > 18/25 **and** high review count **and** comparison/research language | **Momentum**. Customer ready to commit; social-proof volume is the final lever. |
| 6 | All pillars > 18/25 **and** time-sensitive category **and** regret/delay language | **Fear-of-Loss**. Frame cost of inaction. No false scarcity. |

## 4. What appears, and what never appears (per IDEA-POLICY-TERM-001 — three tiers)
- **Tier A — always present:** the proprietary commercial terms **Decision Trigger™, Trust Gap™, and the four pillar names** appear in the panel. They are what makes this output distinctive from a generic AI response — do not strip them.
- **Tier B — not in the primary three-component panel:** buyer-state names (Assessor, Protector, Expresser, Connector) and CAPTURE element names. They may appear only in an optional "Why this finding" expansion panel if the user opts in. At Alpha, CAPTURE element names are not used in the placement instruction at all (the user has no context for them yet).
- **Tier C — never, in any user-facing surface:** engine internals — neuroanatomical framing, S1–S4 stage labels, field names (`dominant_buyer_state`, `copy_calibration_direction`), academic citations (Bolte Taylor, Kahneman, Zaltman).
- Also never: all six triggers listed together (one trigger, one panel, one action); a confidence percentage/score on the classification; an invitation for the user to choose a different trigger.

> The output must feel like a **finding**, not a calculation.

## Coaching Application
After Skills 05 + 06, run the selection rules to pick exactly one primary trigger, then render Components 1–3 with verbatim corpus evidence and a single placement instruction. Hand the trigger + placement to Skill 10. Never offer a menu; never expose the engine.

Related: [[06-trust-gap-score]] · [[05-four-buyer-states-engine]] · [[10-design-brief-generator]] · [[01-idea-framework-core]]

## Connector: Skill 09 in conversational mode

In the Connector the brand owner may ask about their trigger, paste a listing, or describe what they are communicating and ask what to change. Skill 09 can operate from partial inputs where the full app pipeline has not run.

| Input available | How the coach responds |
|----------------|----------------------|
| Full Trust Gap Score and buyer state from app pipeline | Names the trigger directly. Quotes the verbatim evidence. Gives the placement instruction. Offers to generate the design brief. |
| Pasted listing copy only | Reads the listing against the four pillars. Identifies the most likely weak pillar. Names the probable trigger with appropriate confidence. Asks for review data to confirm. |
| Review phrases only | Classifies the emotional register of the language using the Four Buyer States attribute classifiers. Names the probable trigger. States what is missing to confirm it and asks for the Trust Gap Score or listing. |
| No data, general question about triggers | Explains the trigger concept in plain commercial language. Names the most commonly fired trigger (Recognition) and explains why it is most common. Does not list all six sequentially. |

### Connector output example (Recognition trigger)

> Your primary trigger is Recognition. Your customer arrives at your listing already carrying past disappointment in this category. Before they will engage with your evidence, your specifications, or your guarantee, they need to feel that you understand exactly where they are. Your reviews confirm this: "nearly didn't buy", "tried everything", "finally one that works". Lead with recognition in your hero image headline and your opening bullet point. That is where the change will move the number first.

**Connector rule:** One trigger, named clearly. The evidence quoted verbatim. The placement instruction in one sentence. Then offer the design brief. Never present multiple triggers or ask the brand owner to choose.

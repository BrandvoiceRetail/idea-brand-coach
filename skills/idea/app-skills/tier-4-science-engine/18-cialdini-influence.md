---
skill: "18"
name: "Cialdini: The Six Principles of Influence"
tier: 4 — Science Engine
scope: Alpha
user_facing: false
internal_only: true
always_in_context: false
trigger: Background knowledge. Loaded to inform precision; never surfaced to the user.
depends_on: none
status: summary
detailed_doc_pending: true
type: science
doc_ref: IDEA-APP-SKILLS-001 v1.0
---

# SKILL — Cialdini: The Six Principles of Influence

> Draft from Trevor's ideas + the book — pending his authoritative detailed doc + book expansion.

## Purpose
**Reciprocity, commitment, social proof, authority, liking, scarcity** — mapped to the Decision Trigger architecture (Skill 09) and the CAPTURE Framework (Skill 11). How each principle surfaces in review language; which principles are most active for each buyer state; and the line between ethical influence and manipulation. This is the persuasion layer the book reaches for to **embed trust and urgency into messaging** — used as an engine for precision, never as a vocabulary the user sees.

This skill sharpens *which lever a given trigger should lean on* and keeps the resulting brief on the ethical side of the line. It adds no step the user sees: the principle disappears, the precision remains.

---

## Status — partly in the book, six-principle frame is the app's extension
The book cites Cialdini directly — **reciprocity, social proof, authority, scarcity** are named, and *Influence: The Psychology of Persuasion* is in its Suggested Further Reading. But the book does **not** lay out the full canonical six (it does not name *commitment/consistency* or *liking* as Cialdini principles, and it folds scarcity into loss aversion rather than into Cialdini's list). The master architecture (IDEA-APP-SKILLS-001 v1.0, §3) names this skill as "The Six Principles of Influence"; the four-to-six bridge below is the app's faithful extension of the book's own framing, not a book claim.

**Trevor's authoritative detailed Cialdini document is pending.** Treat everything below the line as a first draft assembled from (a) the master-table description in this file's Purpose, (b) the book's two Cialdini citations (pp. 69–70 and p. 139) and the customer-journey biases list, and (c) the trigger and CAPTURE machinery already locked in Skills 09 and 11. The deep-dive add-ons in the paid bonus pack (`behavioral-science-deep-dives/15-cialdini-influence.md` and `19-cialdini-presuasion.md`) are the intended source of the per-principle detail; until they land, **do not invent persuasion claims beyond the cited corpus.** When Trevor's doc arrives, reconcile any drift against Skills 09 and 11.

## Internal-only — hard rule (Tier C)
Tier 4, Tier C under the terminology policy. **Never named, cited, or referenced in any user-facing output.** No "Cialdini", no "six principles", no "reciprocity / commitment / social proof / authority / liking / scarcity" framing in anything the user sees — not even in opt-in expansion panels (`_manifest.json` → `hard_rules`). The user sees the *consequence* — a sharper trigger, a more specific placement instruction, copy that earns trust faster — never the principle that produced it. The science is the engine, not the pitch.

> The book's own rule applies: Cialdini's principles **amplify** an emotional trigger; they do not replace it. Pick the trigger first (Skill 09), then choose the principle that carries it.

---

## 1. The six principles → the Decision Triggers
Each principle is the persuasion mechanism a given Decision Trigger (Skill 09) leans on once the trigger is selected. The trigger names *what the customer needs to see*; the principle names *the form of evidence that delivers it*. The book grounds the four it cites (authority, social proof, reciprocity, scarcity); the other two (commitment, liking) are the app's faithful extension, mapped to the triggers they most naturally serve.

| Cialdini principle | In the book? | What it does in copy | Primary Decision Trigger it carries | Buyer state *(internal)* |
|---|---|---|---|---|
| **Authority** | Yes (p. 139, "authority bias") | Expert, certification, institutional credibility — the proof a rational evaluator is hunting for. | **Permission** | The Assessor |
| **Social proof** | Yes (pp. 69–70; p. 139) | Reviews, counts, "others like you chose this" — reduces uncertainty by showing the herd. | **Momentum** (volume) · supports **Belonging** | Cross-state · The Connector |
| **Scarcity** | Yes (pp. 69–70, "Limited edition"; folded into loss aversion p. 139) | Limited time/stock — the cost of *waiting*, framed honestly. | **Fear-of-Loss** | Cross-state |
| **Reciprocity** | Yes (pp. 69–70) | Give first (sample, guide, value) so the buyer feels the pull to give back. | **Recognition** · **Belonging** (relationship-building) | The Protector · The Connector |
| **Commitment / consistency** | App extension | Small first yes → larger yes; align the offer with who the buyer already says they are. | **Identity** | The Expresser |
| **Liking** | App extension | Shared values, warmth, founder/brand affinity — we trust people and brands we like. | **Belonging** | The Connector |

> **Trust levers vs urgency levers** (the book's own split, pp. 69–70 ↔ p. 139): reciprocity, social proof, authority and liking build **trust**; scarcity (loss aversion) builds **urgency**. Use the right lever for the stage — trust early, urgency only once the buyer is ready. This is why scarcity belongs to **Fear-of-Loss** and **Momentum** (late-stage, all pillars elevated) and never to a cold Recognition buyer who has not yet been made to feel understood.

## 2. Which principles are most active for each buyer state
Read top-down from the buyer state Skill 05 classifies. The dominant state predicts which principle will land — and which will misfire. This carries no new operational claim; it explains the trigger selection Skill 09 already makes.

| Buyer state *(Skill 05)* | IDEA pillar | Principle that lands | Principle that misfires (and why) |
|---|---|---|---|
| **The Assessor** | Insight (I) | **Authority** — credentials, data, specification | Liking/scarcity alone read as fluff or pressure to a verifier who wants proof. |
| **The Protector** | Empathetic (E) | **Reciprocity** + sceptic-to-convert **social proof** | Scarcity *first* spikes the loss-averse alarm — it raises the guard before it is lowered. |
| **The Expresser** | Distinctive (D) | **Commitment/consistency** — "this is who you are" | Heavy authority slows an identity-led, present-tense buyer who is not in evaluation mode. |
| **The Connector** | Authentic (A) | **Liking** + **social proof** (community, shared values) | Hard scarcity undercuts the values relationship the Connector is buying into. |

> The single most reliable consequence: low **Empathetic** scores point to **Recognition**, and a Protector at the till responds to **reciprocity and proof of safety, not urgency** — mirror the fear before you reach for scarcity. Scarcity on a guarded buyer is the most common way an otherwise correct trigger backfires.

## 3. How the principles surface in review language
The review corpus (Skill 07) is the evidence base. The principle a brand is *missing* often shows up as the gap the reviews keep naming; the principle that *worked* shows up as the relief reviewers express. This makes the classifier in Skills 05/07 more precise — it never adds language the user sees.

- **Authority gap** → comparison, research, "couldn't find the proof", specification-hunting language (Assessor). The brand has not supplied the authority the Permission trigger needs.
- **Social-proof presence** → "everyone recommends this", high-volume corroboration, "so many reviews said the same" (Momentum signal — the buyer is ready and the herd is the final nudge).
- **Reciprocity / safety relief** → "I was sceptical but gave it one more try", "wish I'd found this sooner", "they actually helped me first" (Protector → Recognition).
- **Liking / belonging** → "love what this brand stands for", "feels like they get people like me" (Connector → Belonging).
- **Scarcity / regret** → "almost didn't, glad I didn't wait", delay-and-regret language in a time-sensitive category (Fear-of-Loss).

## 4. The principles → CAPTURE weighting
When CAPTURE (Skill 11) ships at Beta, the chosen principle sets *which evidence form* fills the trigger-weighted element — it tunes the same sequence Skill 11 already runs, it does not add an element. This is the book's rule made operational: the principle amplifies the dominant trigger's element; it never stacks a second trigger on top.

| Dominant trigger | CAPTURE element carrying the weight (Skill 11) | Principle that fills it |
|---|---|---|
| **Permission** | Reassurance (authority forward) | **Authority** — credentials/data up front |
| **Recognition** | Pain → Reassurance | **Reciprocity** + sceptic-to-convert **social proof** |
| **Identity** | Transform / Uniqueness | **Commitment/consistency** — "this is who you are" |
| **Belonging** | Context / Uniqueness (values) | **Liking** + community **social proof** |
| **Momentum** | Reassurance (volume) → Escalate | **Social proof** at scale |
| **Fear-of-Loss** | Escalate (cost of inaction) | **Scarcity** — honest urgency only |

## 5. The ethical line — influence vs manipulation
The book is explicit that these principles *embed trust* and that scarcity/urgency are powerful — which is exactly why the engine must hold the line. The test for every brief: the principle must reflect something **true** about the product and the customer's reality.

- **Authority** must be *real* credentials — never a borrowed or implied authority the brand has not earned.
- **Social proof** must be *genuine* corroboration — never invented counts or fabricated reviews.
- **Scarcity** must be *honest* — frame the genuine cost of waiting; **never false scarcity** (this is the hard rule carried straight from Skill 09 §3 and the Fear-of-Loss trigger).
- **Reciprocity** must be a *real* gift of value, not a hook with strings the buyer cannot see.

> The principle amplifies a true emotional trigger; it never manufactures one. If a lever would only work by deceiving the buyer, it is out — every time, regardless of conversion lift. Ethical influence makes the right decision *easier* for a buyer who would benefit; manipulation makes a wrong decision *likelier* for a buyer who would not.

## Coaching Application
Background knowledge only. Once Skill 09 has selected the single primary trigger, use this skill to choose the persuasion principle that carries it (§1), check it against the dominant buyer state (§2), and confirm the review corpus actually contains the evidence the principle needs (§3). When CAPTURE is live, let the principle fill the trigger-weighted element (§4). Hold the ethical line (§5) on every brief. Output the *consequence* — a sharper trigger and a more specific, honest placement instruction — never the principle. If you are ever tempted to justify a recommendation by naming a principle of influence, stop: the science has done its job the moment the recommendation is precise and true. The user gets the precision; the persuasion theory disappears.

## Source material
The book corpus this draft is grounded in (all Tier C / internal — the book cites Cialdini but never names the full six to the reader):
- [[../../framework/04-science-and-research/01-behavioral-science/02-cialdini-influence-principles]] — the primary source: reciprocity & social proof embedding trust and urgency (pp. 69–70); social proof / authority / loss aversion as journey biases (p. 139); *Influence* in the further-reading list.
- [[../../framework/01-customer/01-customer-journey/01-the-five-stages-and-signposts/01-cognitive-biases-and-heuristics]] — the p. 138–139 heuristics list (social proof, authority bias, loss aversion), framing effect, and belonging/social identity — the journey-stage view of the same principles.
- [[../../framework/00-foundations/02-idea-framework/02-emotional-triggers/00-the-emotional-triggers-table]] — Trust & Credibility, and Survival & Fear of Loss / loss aversion: the emotional triggers the principles amplify; "pick one dominant trigger".
- [[../../framework/00-foundations/02-idea-framework/02-emotional-triggers/01-five-triggers-in-brand-messaging]] — single-trigger-as-brand case studies behind the "amplify, don't stack" rule.
- [[../../framework/00-foundations/02-idea-framework/01-the-science-of-emotional-buying/00-decisions-are-subconscious]] — the 95% subconscious / post-hoc rationalisation foundation the principles operate on.

The operational skills this grounds (where the precision is applied):
- [[../tier-3-output-and-action/09-decision-trigger]] — the six triggers; this skill chooses the principle each trigger leans on.
- [[../tier-3-output-and-action/11-capture-framework]] — the copy engine; the principle fills the trigger-weighted CAPTURE element.

Deep-dive add-ons (paid bonus pack — intended source of the per-principle detail, pending): `../../idea-bonus-pack/behavioral-science-deep-dives/15-cialdini-influence.md` and `19-cialdini-presuasion.md`.

Related Tier-4 science skills: [[17-kahneman-system-1-and-2]] · [[19-shotton-behavioural-economics]] · [[20-lindstrom-sutherland-sensory-irrational]]

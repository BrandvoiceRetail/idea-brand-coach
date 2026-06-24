---
skill: "04"
name: "Avatar 2.0: Forensic Portrait"
tier: 2 — Diagnostic Pipeline
scope: Alpha
user_facing: true
internal_only: false
always_in_context: false
version: v1.1
trigger: Activated when a listing is uploaded and review corpus analysis is complete. Layer 1 of the three-layer Avatar 2.0 engine.
depends_on: "07"
status: complete
type: framework
doc_ref: IDEA-APP-SKILLS-001 v1.0
supersedes: The book's five-field Avatar 2.0 (buyer intent / motivation / emotional-triggers / shopper types / demographics) in ../../framework/01-customer/00-avatar-2.0. The app Avatar 2.0 is a four-field forensic portrait; demographics are removed from the portrait (see §5).
---

# SKILL — Avatar 2.0: Forensic Portrait

## Purpose
The four-field forensic portrait of the customer, derived from review corpus analysis. The first user-facing output of the diagnostic pipeline. **Not a demographic profile, not a persona** — a forensic portrait of how the customer thinks and behaves in the specific context of buying *this* product. Layer 1 of the three-layer Avatar 2.0 engine. (v1.1: §5 Demographics added; all other sections unchanged from v1.0.)

---

## 1. Purpose & principle
The portrait answers four questions demographics cannot: what language the customer uses, why they are buying today, what would make them trust the brand, and what is stopping them right now.

> The Avatar is not *who* the customer is. It is *how* the customer thinks and behaves in the specific context of buying this product. The same person buying hair-growth products and fantasy card-storage binders runs a completely different Avatar for each. Demographics do not change. Purchase context does.

## 2. The four fields

**Field 1 — Customer vocabulary** · Source: S1 · UI label: **How your customer talks**
The exact words and phrases customers use for their problem, the product, and the outcome. Verbatim. Not paraphrased, not categorised. *Why it matters:* copy in the customer's own vocabulary converts higher — they unconsciously recognise their own language as evidence the brand understands them. *Output:* 10–20 verbatim phrases in quotation marks, themed if the corpus warrants. No interpretation.

**Field 2 — Purchase motivation** · Source: S2 (enriched by Skill 08) · UI label: **Why they're buying today**
The specific situational trigger that sent this customer searching *now*. Not the general category motivation. *Output:* one to two sentences, written as a situation, never a demographic, never "Jobs-to-be-done". Example: *"Your customer has typically tried multiple alternatives over an extended period and is making what feels like a last serious attempt before accepting the problem as permanent."*

**Field 3 — Trust signals needed** · Source: S3 · UI label: **What builds trust for them**
The specific evidence, credentials, social proof, and risk-removal mechanisms the customer needs before committing. Derived from what customers cite as the reason they trusted the brand (positive) **and** what three-star reviews say was missing (gap evidence). *Output:* a ranked list of four to six trust signals, most-referenced first, each as a *specific requirement* — not "reviews" but "reviews that reference scepticism overcome"; not "clinical data" but "specific percentage or measurement claims from a named source".

**Field 4 — Top objection** · Source: S4 · UI label: **What stops them buying**
The single most common barrier between intent and purchase, derived primarily from three-star reviews. *Output:* one sentence as the customer would say it. Example: *"I nearly didn't buy because I had no way of knowing whether this would be any different from the other five products I had already tried."* — not *"Lack of sufficient clinical evidence."*

## 3. What the Avatar profile is **not**
- Not a demographic profile (age, gender, income, location do not appear in the portrait).
- Not a persona card with a name, stock photo, and lifestyle description.
- Not a general category description — every field is specific to this brand's customers and gaps.
- Not a strategy document — it feeds the Trust Gap Score and Decision Trigger; it is not the final deliverable.

## 4. UI presentation
Panel heading: **Your customer profile**. Sub-heading: *What your reviews are really telling you.* Each field shown with its UI label, not its internal name. Presented as a portrait — continuous, readable, human; not a data table, not a form. The panel appears **before** Component 0 and the Decision Trigger panel, establishing the customer context that makes the trigger credible. **No framework terminology** in the panel (no IDEA, no Trust Gap, no pillar names, no buyer-state references).

## 5. On demographics — why they are separated from the portrait
The original Avatar 2.0 included "Relevant Demographics" as a fifth field. The instinct (surface only what changes the strategic output) was correct; removing demographics from the forensic portrait *refines* it rather than contradicting it.

**5.1 Why removed from the four-field portrait**
- **They describe *who*; the portrait describes *how*.** A 28-year-old and a 52-year-old shopping for hair growth have near-identical purchase motivation, trust-signal needs, objections, and buyer-state language. The demographic difference produces no actionable difference in copy, image brief, or Decision Trigger.
- **They are available everywhere; the portrait is not.** Amazon, Helium 10, DataDive et al. already provide demographics. The differentiating capability is deriving behavioural/emotional insight from what customers actually say.
- **The Four Buyer States model makes demographics structurally irrelevant to the portrait.** The Protector state (most common at the point of decision) correlates with past category experience, scepticism, and emotional weight — not age/gender/income.
- **They can actively mislead.** "Female, 35–55, £40–70k" describes millions who will never buy and gives no guidance on copy, hero image, or trust-signal architecture. Specificity without actionability.

**5.2 Where demographics live**

| Where | What they enable | Implementation |
|---|---|---|
| **Brand Context profile** | Media buying / paid-social targeting | A separate user-account section, user-populated, not system-generated. Accessible anytime; not surfaced in the diagnostic flow. |
| **CAPTURE copy generator (Beta)** | Channel-specific targeting parameters | The CAPTURE generator pulls from Brand Context when generating social-ad outputs. At Alpha (listing brief), demographics are not referenced. |

**5.3 The distinction to communicate:** *Demographics tell you who might buy. The Avatar 2.0 forensic portrait tells you what is stopping them from buying right now.* The app answers the second question.

**5.4 Build note (Matthew):** Demographics are **not** a field in the Avatar 2.0 output object — they are a separate data structure (Brand Context). The Avatar 2.0 pipeline does not read from or write to them. The CAPTURE generator (Beta) reads them for social-ad copy. No UI connection between the Avatar panel and Brand Context demographics is required at Alpha.

## 6. Acceptance criteria
Accepted when all hold: all four fields populated with specific, evidence-based content (no generic placeholders); vocabulary is verbatim; purchase motivation is a situation, not a demographic/benefit; trust signals is a ranked list of specific requirements; top objection is in the customer's voice; **no demographic data and no framework terminology anywhere in the panel**; the Guyology Labs test case classifies **The Protector** and surfaces scepticism, past-failure, and relief language in the corpus evidence.

## Coaching Application
After Skill 07 completes, produce the four fields verbatim from the corpus and present them as a plain-language portrait before any scoring or trigger. If asked why there are no demographics, give the Skill-04 §5.3 answer. Never fabricate fields when the corpus is thin — flag confidence (see Skill 07 thin-corpus protocol).

Related: [[07-review-corpus-analysis]] · [[08-purchase-motivation]] · [[05-four-buyer-states-engine]] · [[06-trust-gap-score]] · [[../../framework/01-customer/00-avatar-2.0/00-what-is-avatar-2.0]]

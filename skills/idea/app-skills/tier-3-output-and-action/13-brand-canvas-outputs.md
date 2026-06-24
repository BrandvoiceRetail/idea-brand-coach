---
skill: "13"
name: Brand Canvas Outputs
tier: 3 — Output and Action
scope: Beta
user_facing: true
internal_only: false
always_in_context: false
trigger: Beta. A back-end benefit derived from the Avatar 2.0 output and Trust Gap Score — never the front-end promise.
depends_on: "04, 06"
status: summary
detailed_doc_pending: true
type: framework
doc_ref: IDEA-APP-SKILLS-001 v1.0
---

# SKILL — Brand Canvas Outputs

> Draft from Trevor's ideas + the book — pending his authoritative detailed doc + book expansion.

## Purpose
The eight Brand Canvas elements and how they are derived from the Avatar 2.0 output and the Trust Gap Score. **The canvas is a back-end benefit, not the front-end promise** — presented as a *consequence* of the diagnostic findings, never as the goal.

---

## Scope & status
- **Beta.** Not in Alpha. At Alpha this appears as a locked feature with a waitlist CTA (architecture §5.3).
- **Critical positioning rule (red line):** the coach must never produce a brand canvas, positioning statement, or brand-values document as the **primary** output of a session (Skill 02 red-line list; Skill 01 §5 — "Not a brand canvas generator. The canvas is a back-end benefit, not the front-end promise"). The canvas emerges from the diagnostic; it is never the destination.
- **Authoritative description** above is from the master architecture (IDEA-APP-SKILLS-001 v1.0, Tier 3). **The detailed Brand Canvas Outputs document is pending from Trevor (BrandVoice).** The body below is grounded in the book's canvas chapter (Chapter 5 — *The IDEA Brand Canvas*) under `../../framework/02-brand/01-brand-canvas/` and the diagnostic skills it depends on (04, 06). Do not invent derivation logic beyond the book + the architecture spec.

## 1. What the Brand Canvas is
In the book the IDEA Brand Canvas is a fill-in-the-box worksheet that "distils emotional triggers, Avatar 2.0, and the IDEA Framework into a single, systematic brand-strategy document" (`00-canvas-overview-and-instructions`). It is built in a non-optional order:

> **Avatar 2.0 → IDEA Framework canvas → Brand Statements.** "You need to go through the Avatar 2.0 and IDEA processes … and fill in those sections of the worksheet BEFORE you proceed to the Brand Statements … so that you have the foundations for your brand established and ready to go."

For the app this sequence **is** the derivation rule. The two front canvas tables are not new work for the user — they are already produced by the diagnostic pipeline:

| Book canvas input | App source | Skill |
|---|---|---|
| IDEA Customer Avatar 2.0 table (7 rows) | Avatar 2.0 forensic portrait (the four fields) | 04 |
| IDEA Framework canvas (4 pillar rows) | Trust Gap Score (pillar scores + primary gap + Component 0) | 06 |
| Brand Statements (the canvas *outputs*) | Generated **from** the two inputs above | this skill |

So the canvas elements are not asked for up front. They are a **back-end consequence**: once the diagnostic has produced the Avatar portrait and the Trust Gap Score, the statements can be written *from* that evidence — which is exactly why the canvas is a downstream benefit, not the front-end promise.

## 2. The eight canvas elements
The book's Chapter 5 defines a set of brand statements written *after* the two input tables are complete. **Eight of them are generated outputs**; the ninth (Target audience) is the carried-over distillation of the Avatar 2.0 table, not a net-new statement (`04-target-audience` — "This statement is not a fresh demographic guess — it is the distillation of the completed Avatar 2.0 table"). The eight generated elements, grouped as the book groups them (foundational → positioning → expression):

| # | Element | Book definition (verbatim source) | Derived primarily from |
|---|---|---|---|
| 1 | **Brand purpose** | The "why" behind the brand's existence, beyond selling products. | Avatar purchase motivation + Insight pillar |
| 2 | **Brand vision** | An aspirational statement about the future impact the brand seeks to make. | Avatar post-purchase emotional state + Distinctive pillar |
| 3 | **Brand mission** | The actionable steps taken to fulfil the brand's purpose and vision. | Avatar trust signals needed + Authentic pillar |
| 4 | **Brand values** | The guiding principles that shape how the brand interacts with customers, employees and stakeholders. | Avatar emotional drivers + Authentic pillar |
| 5 | **Positioning statement** | How the brand stands out in the market and why it is the best choice for the target audience. | Trust Gap primary gap + Distinctive pillar |
| 6 | **Value proposition** | A clear, compelling statement of why a customer should buy from the brand instead of a competitor. | Avatar top objection + Trust Gap primary gap |
| 7 | **Brand personality** | The human-like traits that influence how the brand speaks, interacts and resonates with its audience. | Avatar emotional drivers + Empathetic pillar |
| 8 | **Brand voice** | The tone, language and communication style the brand uses across all platforms. | Avatar customer vocabulary + Empathetic pillar |

(The **Target audience** statement is the ninth book element but is sourced directly from Avatar 2.0 rather than generated — carry it through unchanged; do not re-derive demographics. Per Skill 04 §5, demographics live in the Brand Context profile, not in the forensic portrait.)

Every element is held to the **four Key IDEA Principles** the book attaches to it (Insight-Driven, Distinctive, Empathetic, Authentic). For example, a value proposition that lists only features fails the Empathetic test, and one with only feelings fails the practical-value test (`01-value-proposition`).

## 3. How the diagnostic findings feed the elements
The derivation is evidence-in, statement-out. Two diagnostic artefacts are the raw material:

**3.1 From Avatar 2.0 (Skill 04 — the forensic portrait).** The four fields map onto the book's 7-row Avatar canvas table and seed the customer-facing half of every statement:
- *Customer vocabulary* → the literal language of **brand voice** (Empathetic: "matches the communication style customers respond to best").
- *Purchase motivation* → the need-beyond-the-product behind **brand purpose** and the audience reality behind **positioning**.
- *Trust signals needed* → the credibility commitments behind **brand mission** and **brand values** (Authentic: "ensures the brand's actions consistently reflect its promises").
- *Top objection* → the "why buy instead of a competitor" the **value proposition** must answer.

**3.2 From the Trust Gap Score (Skill 06 — pillar scores + primary gap).** The IDEA Framework canvas table is the four pillar rows; the primary gap directs *which* statements do the heavy lifting. The book's "Authentic" prompt — "What is the source of our authority/credibility … Professional experience? Expertise? Studies? Research? Social Proof?" — is answered straight from the Authentic pillar evidence. If the Authentic box has no concrete source, "the brand has an authenticity gap to fix before writing statements" (`01-idea-framework-canvas-table`).

**3.3 The primary-gap → emphasis mapping.** The same pillar→implication logic that drives Component 0 (Skill 06 §4) tells the canvas which element to lead with:

| Primary gap | Canvas elements to strengthen first |
|---|---|
| **Insight (I)** | Brand purpose, brand voice — reach the reason-beyond-the-product the messaging currently misses. |
| **Distinctive (D)** | Positioning statement, brand personality — establish the identity territory and reason-to-choose. |
| **Empathetic (E)** | Brand voice, value proposition (emotional half), brand personality — mirror the customer's reality before the evidence. |
| **Authentic (A)** | Brand mission, brand values — name real, demonstrable credibility sources, not adjectives. |

## 4. Coherence — the canvas is one document, not eight boxes
The book's closing synthesis (`02-canvas-brings-strategy-to-life`) reframes the whole worksheet: the completed canvas is "the single source of truth you feed to an AI" so every generated message is aligned and on-brand — "A coherent canvas produces a coherent AI; a fragmented one produces fragmented output." So the acceptance bar for canvas outputs is not eight individually-good statements but **eight statements that tell the same story**: purpose ↔ vision ↔ mission ↔ values ↔ positioning ↔ value proposition ↔ personality ↔ voice all cohering. The book's worked examples are deliberately one coherent eco/sustainable brand — match that internal consistency, never five (or eight) disconnected sentences.

## 5. Worked shape (book sample, one coherent brand)
The book's sample brand shows the target standard — reproduce this *shape*, never these contents:

| Element | Sample output (book) |
|---|---|
| Brand purpose | "To inspire and empower individuals to embrace sustainable living, making eco-friendly choices accessible to everyone." |
| Positioning | "For eco-conscious millennials, our brand provides stylish, sustainable clothing that combines innovative design with ethical practices … empowering them to make a positive impact on the planet." |
| Value proposition | "Our innovative product line combines modern aesthetics, affordability, and eco-friendly materials to provide guilt-free solutions for everyday living." |
| Brand personality | "Warm, innovative, approachable, and bold. Our brand is the friendly guide helping customers transition to a sustainable lifestyle, one simple choice at a time." |
| Brand voice | "Optimistic, conversational, and empowering. We speak with clarity and enthusiasm, making sustainability feel exciting and accessible to all." |

## Coaching Application
Offer the canvas only as a downstream consequence once the diagnostic + trigger are done — never let it become the session's stated goal. If a user asks for a canvas, a positioning statement or a brand-values document up front, reframe to the commercial problem first (Skill 03), run the diagnostic, and let the canvas emerge from the findings.

When the canvas *is* warranted (Beta): do not re-interview the user — pull the inputs that already exist. Use the Avatar 2.0 forensic portrait (Skill 04) and the Trust Gap Score + primary gap (Skill 06) as the two front canvas tables, then write the eight statements from that evidence, leading with the elements the primary gap calls for (§3.3). Hold every statement to its four Key IDEA Principles and to the book's worked-example standard for brevity and concreteness; carry Target audience through from Avatar 2.0 unchanged. Finally, check the eight cohere as one document (§4) — that coherence is the deliverable, and it is what makes the canvas usable as the brand's AI training source (Chapter 5 → Chapter 7). Keep all IDEA / Trust Gap / buyer-state terminology out of the user-facing canvas — the canvas shows the *consequence* of the diagnosis, not the machinery.

## Source material
- [[../../framework/02-brand/01-brand-canvas/00-canvas-overview-and-instructions]] — the worksheet rationale and the non-optional Avatar 2.0 → IDEA → Statements sequence.
- [[../../framework/02-brand/01-brand-canvas/01-the-canvas-tables/00-avatar-2.0-canvas-table]] — the 7-row Avatar input table.
- [[../../framework/02-brand/01-brand-canvas/01-the-canvas-tables/01-idea-framework-canvas-table]] — the four-pillar input table.
- [[../../framework/02-brand/01-brand-canvas/01-the-canvas-tables/02-brand-statements-canvas-table]] — the statements grid (Description / Example / Your Statement).
- [[../../framework/02-brand/01-brand-canvas/02-foundational-statements/00-brand-purpose]] · [[../../framework/02-brand/01-brand-canvas/02-foundational-statements/01-brand-vision]] · [[../../framework/02-brand/01-brand-canvas/02-foundational-statements/02-brand-mission]] · [[../../framework/02-brand/01-brand-canvas/02-foundational-statements/03-brand-values]] · [[../../framework/02-brand/01-brand-canvas/02-foundational-statements/04-target-audience]]
- [[../../framework/02-brand/01-brand-canvas/03-positioning-statements/00-positioning-statement]] · [[../../framework/02-brand/01-brand-canvas/03-positioning-statements/01-value-proposition]]
- [[../../framework/02-brand/01-brand-canvas/04-expression-statements/00-brand-personality]] · [[../../framework/02-brand/01-brand-canvas/04-expression-statements/01-brand-voice]] · [[../../framework/02-brand/01-brand-canvas/04-expression-statements/02-canvas-brings-strategy-to-life]]

Related: [[04-avatar-2.0-forensic-portrait]] · [[06-trust-gap-score]] · [[01-idea-framework-core]] · [[02-trevors-voice-and-coaching-philosophy]] · [[03-commercial-problem-frame]]

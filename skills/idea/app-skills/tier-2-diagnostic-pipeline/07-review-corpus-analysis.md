---
skill: "07"
name: Review Corpus Analysis
tier: 2 — Diagnostic Pipeline
scope: Alpha
user_facing: false
internal_only: false
always_in_context: false
trigger: Activated when a listing is uploaded. Runs before Skills 04, 05, and 06.
depends_on: none
status: complete
type: framework
doc_ref: IDEA-APP-SKILLS-001 v1.0
---

# SKILL — Review Corpus Analysis

## Purpose
The primary data source for the entire Avatar 2.0 pipeline: the forensic reading of customer reviews to extract vocabulary, motivations, trust signals, objections, and emotional-state language that powers every downstream output. **Not sentiment analysis** — a structured forensic extraction (S1–S4).

> The most important reviews are **three-star and below.** Five-star reviews confirm what works; three-star reviews reveal what is broken and what the customer needed but did not find — the primary source of trust-gap evidence.

---

## 1. The four extraction stages

**S1 — Vocabulary extraction.** Exact words/phrases for the problem, product, and outcome. Verbatim, not paraphrased. Look for: the specific words naming the pain (not the category name), outcome/success language, and unexpected highly-specific vocabulary that reveals emotional depth. *Output:* 10–20 verbatim phrases → Customer vocabulary field + the language bank for all copy.

**S2 — Purchase motivation.** Why the customer bought *at this moment*. Look for: situational language (what triggered the search), timing language (urgency, deadline, life event), and the gap between what they had tried and what they sought. *Output:* one or two sentences → Purchase motivation field. Always a situation, never a demographic. (Enriched by Skill 08.)

**S3 — Trust signals needed.** What customers cite as the reason they trusted the brand: authority signals (clinical data, expert endorsement, certification, brand story), social proof (review count, community, repeat purchase), risk removal (guarantees, returns, transparency) — **and** what is conspicuously absent. *Output:* a ranked list of trust signals referenced + a secondary list of trust signals wanted-but-not-found → Trust signals needed field.

**S4 — Top objection.** The single most common barrier between intent and purchase: hesitation language in three-star reviews, "nearly didn't buy because of…", the objection appearing most consistently. One objection only, the most common and impactful. *Output:* expressed as the customer would say it → Top objection field.

## 2. Buyer-state language classifiers
As the corpus is read, classify the dominant emotional register (translated from the Four Buyer States neuroanatomical research into commercial language).

| Buyer state | Language attributes | Common phrases |
|---|---|---|
| **The Assessor** | Analytical, comparative, specification-focused, detail-oriented, seeks differences, concise | "After comparing several options" · "I read everything before buying" · "Better than X because" · "Exactly as described" |
| **The Protector** | Fear-based, cautious, past pain, doubts, tried-and-true, critical | "I was sceptical" · "Tried everything" · "Wish I found sooner" · "Nearly didn't bother" · "Been let down before" |
| **The Expresser** | Present-moment, expansive, creative, impulse-driven, identity-focused, sharing | "Exactly me" · "Feel different" · "Finally a brand" · "Love the vibe" · "Bought on a whim" · "I tell everyone" |
| **The Connector** | Values-led, collective, grateful, big-picture, seeks similarities | "Love what they stand for" · "Part of something" · "Brand I trust completely" · "Aligned with my values" · "Been with them for years" |

## 3. Thin corpus protocol
When fewer than 50 reviews, supplement in order:
1. Extract from the user's own reviews first, regardless of count.
2. Expand to the top three competitors — competitor reviews reveal category-level trust gaps and trigger language that applies to the user's brand.
3. Use the Trust Gap self-assessment scores as a proxy where corpus data is insufficient to classify buyer state from language alone.
4. **Flag thin corpus explicitly** in the output so the user knows the confidence level.
5. For new brands with fewer than 20 reviews, the competitor corpus is the primary source and the diagnostic Trust Gap Score is the primary classification input. Review evidence in the output panel must be drawn from competitor corpora and **labelled as category evidence**, not brand-specific.

## Coaching Application
Run first in the pipeline. Produce S1–S4 verbatim outputs and a dominant-register read; hand vocabulary to Skill 04, motivation to Skill 08, trust signals + objection to Skill 04, and the language register to Skill 05. Never fabricate evidence — when the corpus is thin, follow the protocol and label category evidence honestly.

Related: [[04-avatar-2.0-forensic-portrait]] · [[08-purchase-motivation]] · [[05-four-buyer-states-engine]] · [[../../framework/04-science-and-research/00-research-guide/01-customer-reviews-and-feedback]]

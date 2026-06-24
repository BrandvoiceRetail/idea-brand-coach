---
skill: "14"
name: Competitor Trust Gap Analysis
tier: 3 — Output and Action
scope: Beta
user_facing: true
internal_only: false
always_in_context: false
trigger: Beta. Requires a stable core pipeline first. Output is a comparative brief, not a general competitive landscape.
depends_on: "06, 07"
status: summary
detailed_doc_pending: true
type: framework
doc_ref: IDEA-APP-SKILLS-001 v1.0
---

# SKILL — Competitor Trust Gap Analysis

> Draft from Trevor's ideas + the book — pending his authoritative detailed doc + book expansion.

## Purpose
How to run a Trust Gap Score on a competitor listing, compare competitor scores against the user's own, and identify where competitors are stronger and weaker. **Output: a comparative brief, not a general competitive landscape.**

---

## 1. What this skill is — and is not
This skill takes the same Trust Gap™ instrument the diagnostic pipeline runs on the user's own listing (Skill 06) and applies it to a competitor's listing. It then sets the two side by side and produces a **comparative brief**: a short, ranked statement of where the competitor is building trust faster than the user, and where the competitor has left a gap the user can take.

It is **not** a market scan, a category report, or a competitor league table. The governing principle of the whole skill set still applies: every output exists to help the brand owner understand **why their customer is not buying and what to fix first**. A landscape survey does not answer that question — a focused "here is where they beat you, here is where you can beat them" brief does.

| This skill produces | This skill does not produce |
|---|---|
| A pillar-by-pillar comparison of one (or a few) named competitors against the user | A ranked table of every seller in the category |
| A short list of where the competitor is stronger (defend) and weaker (attack) | A keyword/BSR/price market scan |
| A feed back into the user's Decision Trigger and Component 0 | A standalone "competitor intelligence" deliverable with no link to the user's fix |
| Category-level trust evidence the user can borrow | A general "state of the niche" essay |

## 2. Why competitor trust evidence matters (book grounding)
Two ideas from the book make competitor scoring worth the build:

- **Mistrust is the default state.** The customer arrives cynical and assumes the worst until proven otherwise (`00-mistrust-is-the-default-state`). When two listings sit side by side in search results, the one that defuses that cynicism *faster* wins the click and the sale. A competitor that out-scores the user on a pillar is, in practice, closing the customer's Trust Gap before the user gets the chance.
- **Amazon is not an even playing field.** A Western seller cannot win the low-cost game against a state-subsidised factory seller (`02-the-amazon-landscape/00-amazon-uneven-playing-field`). Price is a losing axis. The only winnable axis is trust — so the only competitor comparison that matters is a *trust* comparison, pillar by pillar, not a price or feature comparison.

Together these set the frame: the competitor brief measures the one thing the user can actually win on, and ignores the things they cannot.

## 3. Method — scoring a competitor listing
Score the competitor with the **same four-pillar, evidence-based Trust Gap instrument** used in Skill 06 — never a subjective read. The questions are answerable by *observing the competitor's listing* (hero image, headline, bullets, visible trust signals), exactly as the user's own Phase-1 diagnostic is. Apply the same 1–5 scale per pillar, /25 per pillar, /100 total.

| Pillar | What to read on the competitor's listing | Stronger-than-user signal |
|---|---|---|
| **I — Insight** | Does the hero headline and first bullet speak to *why* the customer needs it now, or only to specs? | Competitor reaches the emotional driver; user is still describing features. |
| **D — Distinctive** | Strip the competitor's brand name — could the listing belong to anyone? | Competitor is unmistakably itself; user is interchangeable in the category. |
| **E — Empathetic** | Do the bullets mirror how the customer *feels*, or just what the product does? | Competitor makes the customer feel seen first; user leads with the rational case. |
| **A — Authentic** | How many trust signals are visible above the fold before any review is read? | Competitor shows credibility immediately; user's is absent, weak, or inconsistent. |

Use the **Review Corpus Analysis** discipline (Skill 07) on the competitor's reviews as the second source: three-star-and-below reviews on a competitor reveal the category-level trust gaps and the trust signals customers *wanted but did not find* — evidence the user can act on even when their own corpus is thin. (Skill 07's thin-corpus protocol already treats the top-three competitors as a legitimate, clearly-labelled source of category evidence.)

Triangulate, do not assume. The research-detective stance applies: gather from more than one source — the listing surface *and* the competitor review corpus — before asserting where a competitor is genuinely stronger (`00-research-detective-mindset`). The standard Amazon sources (reviews, Q&A, BSR, search terms) feed this without becoming a landscape survey: pull only what sharpens the head-to-head, not a full market scan (`02-amazon-specific-research`).

## 4. Output — the comparative brief
The deliverable is a single focused brief, not a dashboard. Structure:

1. **Headline verdict** — one plain-language sentence: where the competitor is currently winning the trust race and where they have left an opening. No buyer-state names, no framework jargon, no numeric certainty claims.
2. **Pillar comparison** — the four pillars, user score vs competitor score, with the *direction* called out (competitor stronger / level / competitor weaker). The point is relative position, not absolute scores.
3. **Where they are stronger → defend.** The pillar(s) on which the competitor out-builds trust. This is what the user is losing the customer to *today*. Each item names the observable thing the competitor does that the user does not.
4. **Where they are weaker → attack.** The pillar(s) on which the competitor has left a gap. This is the user's most direct route to taking the customer — the same logic as the user's own primary-gap fix, turned outward. Each item names a concrete, ownable move.
5. **The one move** — feed the single highest-leverage gap straight into the user's **Decision Trigger** (Skill 09) and **Component 0** (Skill 06). The brief never ends as "here is the situation"; it ends as "here is the one thing to do next."

> **Comparative, not exhaustive.** If the brief reads like a competitor report card with no instruction for the user, it has failed. Every line must trace back to a defend-or-attack move on the user's own listing.

## 5. Scope, cadence and guardrails
- **Beta.** Not in Alpha. High value, but it requires the stable core pipeline first. At Alpha this is a locked feature with a waitlist CTA (architecture §5.3).
- **Weekly cadence, not always-on polling.** This ships alongside **Brand Defence / Market Watch** as a periodic comparison, not a live API feed (Avatar2 dev brief §8). The user does not need a real-time competitor monitor; they need a periodic "here is where you stand and what to fix" read.
- **One or a few named competitors, not the whole category.** Default to the user's stated top three (the same set Skill 07 already uses for category evidence). Adding more competitors turns the brief back into a landscape survey — the exact thing this skill must not become.
- **Same instrument, same honesty.** Score the competitor with the evidence-based Trust Gap questions, never a subjective impression. Where competitor corpus evidence is thin, label it as category evidence (Skill 07 protocol) — never fabricate a competitor's strength or weakness to make the brief tidier.
- **Engine stays invisible.** No buyer-state names, no academic citations, no numeric certainty indicator on the user-facing brief (architecture hard rules). The user sees the comparison and the move, never the machinery.

## Coaching Application
When Beta ships: pick the user's named competitor(s), score each competitor listing with the **same Skill 06 evidence-based method**, read the competitor review corpus with the **Skill 07 discipline**, then present the result as a focused brief — *where they beat you (defend), where you can beat them (attack)* — and feed the single highest-leverage gap into the **Decision Trigger** and **Component 0**. Keep it comparative and actionable, never a landscape survey, and keep the science engine invisible. Frame the whole exercise around trust, not price: on an uneven, low-cost-driven marketplace, trust is the only axis the user can actually win on.

## Source material
- [[../../framework/00-foundations/01-ecommerce-landscape/00-mistrust-is-the-default-state]] — the customer starts cynical; the faster-trust listing wins.
- [[../../framework/00-foundations/01-ecommerce-landscape/02-the-amazon-landscape/00-amazon-uneven-playing-field]] — why the comparison must be a trust comparison, not a price one.
- [[../../framework/00-foundations/01-ecommerce-landscape/01-the-borrowed-trust-trap/04-four-ways-to-own-your-trust]] — owned-credibility moves that turn an "attack" gap into a defensible advantage.
- [[../../framework/04-science-and-research/00-research-guide/00-research-detective-mindset]] — triangulate across sources before asserting where a competitor is genuinely stronger.
- [[../../framework/04-science-and-research/00-research-guide/01-customer-reviews-and-feedback]] — competitor reviews surface the category's raw pain and desire language.
- [[../../framework/04-science-and-research/00-research-guide/02-amazon-specific-research]] — Amazon sources (reviews, Q&A, BSR, search) feed the head-to-head without becoming a market scan.

Related: [[06-trust-gap-score]] · [[07-review-corpus-analysis]] · [[09-decision-trigger]] · [[12-listing-analysis]] · [[01-idea-framework-core]]

---
skill: "21"
name: PPC Efficiency Audit
tier: 3 — Output and Action
scope: Alpha
user_facing: true
internal_only: false
always_in_context: false
trigger: Triggered when the seller asks about ad spend, ACOS/TACOS, wasted spend, or "run a PPC review". Powers run_ppc_audit.
depends_on: "06, 12"
status: summary
detailed_doc_pending: true
type: framework
doc_ref: IDEA-APP-SKILLS-001 v1.0
method_source: AdLabs published Amazon PPC methodology (methods/formulas only, paraphrased + attributed)
---

# SKILL — PPC Efficiency Audit

> Grounds `run_ppc_audit`. Method concepts adapted, in our own words, from AdLabs' publicly
> published Amazon PPC framework (RPC bidding, ACOS/TACOS split, search-term harvest/negate,
> weekly cadence, dayparting). Formulas and definitions are industry-standard; we paraphrase and
> attribute — never reproduce their prose, tables, or checklists. **The engine is deterministic:
> no number in a PPC finding is ever invented — every figure derives from the seller's own
> ingested ad data, and is omitted (not guessed) when the inputs aren't there.**

## What this skill is for

The seller's ads and their listing are two different problems, and the whole point of this skill is
telling them apart. It runs an **optimizer** (fix the bids and the wasted spend) AND a **Trust-Gap
on-ramp** (when the ads are fine but the listing isn't, stop tuning bids and go fix the listing).

## Core method (paraphrased from AdLabs)

- **RPC white-box bidding.** The governing formula is **Suggested Bid = RPC × Target ACOS**, where
  **RPC (Revenue Per Click) = ad sales ÷ clicks**. Apply changes off the **actual current CPC**, not
  the current bid — always calculate from real performance, never from bid status.
- **ACOS vs TACoS.** **ACOS = ad spend ÷ ad-attributed sales** (efficiency of the ad only).
  **TACoS = ad spend ÷ TOTAL (organic + paid) sales** — the growth-health metric. A rising TACoS
  means ads are carrying more of the sales than they should; a falling TACoS means organic is
  taking over (healthy). Report both; TACoS needs total sales (the seller's Seller-Central figure).
- **Search-term harvest & negate.** Review the search-term report on a cadence: **harvest** the
  converting terms into dedicated exact-match campaigns so you can bid them precisely; **negate**
  the terms that spend with **zero orders** (the leak). This is where most wasted spend hides.
- **Campaign structure.** Group products together only when they share budget, placement
  performance, dynamic-bid settings, and ACOS goals; **split** when any of those diverge. Keep
  **brand** and **non-brand** terms in separate campaigns (very different ACOS expectations).

## The bid-problem vs conversion-problem split (the on-ramp)

For each funnel piece with enough clicks to judge:

- **Insufficient data** — too few clicks to conclude anything; give it traffic first.
- **Conversion problem** — real clicks, poor conversion (low CVR). **The ads are doing their job;
  the listing isn't.** Do NOT tune bids — route to the **Trust Gap** (Skill 06) and the listing /
  creative fix. Buying more clicks for a listing that doesn't convert just buys more non-converters.
- **Bid problem** — it converts acceptably, but ACOS is over target. You're overpaying per click:
  lower the bid toward `RPC × Target ACOS`, applied off the current CPC.
- **Healthy** — on target; hold the bid and move freed budget to pieces with headroom.

## Operating rhythm (paraphrased)

A simple weekly cadence keeps it disciplined: bid optimization → search-term review → harvest &
negate → budget/placement review → reporting. Dayparting (bidding by hour/day) is a later,
separate lever once the basics are clean.

## Output discipline

Every finding names the piece, the metric with its real value, and ONE next action (a bid figure, a
term to harvest/negate, or "fix the listing — run the Trust Gap"). When a figure can't be computed
(no total sales → no TACoS; too few clicks → no verdict), say so plainly and name the one input that
would sharpen it. Never present a menu; commit to the highest-impact fix first.

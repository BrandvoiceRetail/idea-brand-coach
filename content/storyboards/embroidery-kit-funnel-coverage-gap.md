---
title: The Amazon Funnel Gap Nobody Audits
pain: connection
funnel: packaging_unboxing
tool: get_funnel_coverage
format: product_demo
duration: 15s
aspect: 9:16
persona: Founder of an embroidery kit brand who assumed the funnel was fully built.
---

## Strategy

Her own words: *"Ads, listing copy, welcome email — all built, all checked off. I thought I was done."* The felt pain isn't a bad number; it's the false confidence of a funnel that looks complete on a checklist.

The funnel position she never checked is `packaging_unboxing`. `get_funnel_coverage` runs the audit across every touchpoint and shows exactly where the map is empty — sitting blank between the shipping email and the customer's first actual use of the kit.

Hook trigger: **momentum** — every bit of excitement she paid to build through ads, listing, and email dies the moment that box opens to nothing.

## Hook variants

1. **Momentum:** "Ads, listing, email — checked. Then I found the one gap where all of it dies."
2. **Recognition:** "I thought my funnel was done. I hadn't looked at what happens after the box opens."
3. **Permission:** "You don't need another touchpoint. You need to know the one you're already missing."

## Scene-by-scene

1. [0-3s] VISUAL: Founder at her desk, a checklist on screen — "Ads ✓, Listing copy ✓, Welcome email ✓" — all in green. | VO: "Ads, listing, email. I thought my funnel was done." | TEXT ON SCREEN: "3 for 3. Funnel: 'done.'"
2. [3-6s] VISUAL: She opens IDEA Brand Coach and runs `get_funnel_coverage` across her full funnel, a loading state on screen. | VO: "So I ran the coach's coverage audit, just to confirm it." | TEXT ON SCREEN: "get_funnel_coverage — running…"
3. [6-9s] VISUAL: The coverage map resolves — a visual funnel chart, every touchpoint filled green except one block, `packaging_unboxing`, sitting empty between the shipping email and first use. | VO: "One gap. Right between the shipping email and the customer actually using it." | TEXT ON SCREEN: "Gap: packaging_unboxing — empty"
4. [9-12s] VISUAL: Close on the empty box graphic in the coverage map, a callout reading "Momentum ends here." | VO: "Every bit of excitement I built up dies the second that box opens to nothing." | TEXT ON SCREEN: "Momentum: builds, then dies here"
5. [12-15s] VISUAL: End card — IDEA Brand Coach wordmark on a clean dark background. | VO: "Find your own gap. Free funnel audit." | TEXT ON SCREEN: "ideabrandcoach.com/diagnostic"

## Production notes (Higgsfield)

- **Mode:** Storyboard-image mode (one multi-panel storyboard image → one video job) — the ad is desk-and-screen continuity throughout, well suited to a single coherent panel set.
- **Reference kit:** Founder character sheet for continuity across scenes 1 and 4; screen-UI mock of the coach dashboard and the `get_funnel_coverage` coverage-map visualization; real embroidery-kit product photo for the box graphic in scene 4.
- **Negative prompt / no-text-in-frame:** No legible dashboard chrome or coverage-map labels baked into generated frames beyond flat reference; every TEXT ON SCREEN line is added as a post overlay. Do not let the model invent extra funnel touchpoints or coverage percentages beyond what's specified.
- **Diegetic audio:** Quiet desk ambience and keyboard clicks under scenes 1-3, a single soft "gap found" chime under scene 3's reveal, no music bed until the end-card sting.

## CTA & measurement

**End card copy:** "Find your own gap. Free funnel audit." **Destination:** ideabrandcoach.com/diagnostic. **Metrics that prove it worked:** hook rate and click-through rate to `/diagnostic` prove the momentum angle landed; the metric that proves the connection problem itself is fixed is repeat rate once `packaging_unboxing` is filled — whether customers who now get a real unboxing moment come back for a second kit.

*Persona is a composite, fictional founder portrayed by an actor — not a verified buyer. No real business, revenue, or conversion outcome is claimed as fact; all figures are illustrative.*

---
title: The Funnel Audit Found My Buy Box Was the Actual Leak
pain: cvr
funnel: trust_badges_social_proof
tool: run_funnel_audit
format: problem_solution
duration: 15s
aspect: 9:16
persona: Founder of a melatonin-free sleep-gummy brand chasing a conversion problem she assumed was pricing.
---

## Strategy

The felt pain, in her words: "I was ready to drop my price again. That's my go-to move when conversion dips — cut the price, hope it's enough." Price is the lever every founder reaches for first, because it's the one they can pull without asking anyone else's permission.

The specific funnel position surfaced is `trust_badges_social_proof`. `run_funnel_audit`'s weakest-link scan clears pricing entirely — her price is competitive — and instead flags the buy box: no third-party testing badge visible, where every one of her three closest competitors shows one.

Hook trigger: **fear_of_loss** — every shopper who scrolls past the buy box looking for proof and finds none is a sale walking to a competitor who has it.

## Hook variants

1. **fear_of_loss:** "I almost cut my price again. The audit found the actual leak was three inches above the buy button."
2. **recognition:** "My price was fine the whole time. I just never looked at what was missing next to it."
3. **momentum:** "One badge. That's the whole fix. Not another price drop."

## Scene-by-scene

1. [0-3s] VISUAL: Founder-actor at a desk, cursor hovering over the "edit price" field on her Amazon listing dashboard, about to lower it again. | VO: "I was ready to drop my price again. That's always my first move." | TEXT ON SCREEN: "About to cut price. Again."
2. [3-6s] VISUAL: She pauses, opens the coach chat instead, runs `run_funnel_audit` against her funnel and avatar. | VO: "Instead I ran a funnel audit first, just to check." | TEXT ON SCREEN: "run_funnel_audit"
3. [6-10s] VISUAL: The audit overlay renders — pricing/positioning scores clean, but `trust_badges_social_proof` flags red; a side-by-side shows her buy box with no badge next to three competitor buy boxes each showing a third-party testing seal. | VO: "Pricing came back clean. My buy box didn't — no testing badge, while every competitor has one." | TEXT ON SCREEN: "Flagged: trust_badges_social_proof — no cert badge"
4. [10-13s] VISUAL: Founder closing the price-edit tab instead, satisfied — the real fix is now specific and cheap. | VO: "Not a price problem. A missing badge, right where it mattered." | TEXT ON SCREEN: "One badge, not another discount."
5. [13-15s] VISUAL: End card — IDEA Brand Coach wordmark over a faint gummy-jar silhouette. | VO: "Free trust gap diagnostic — find your actual leak." | TEXT ON SCREEN: "ideabrandcoach.com/diagnostic"

## Production notes (Higgsfield)

- **Mode:** Per-scene precision. The competitor buy-box comparison in scene 3 needs to render as a clean, legible-at-a-glance three-way layout, which storyboard-image mode risks compressing.
- **Reference kit:** Persona character sheet for the founder-actor (home-office setting, consistent wardrobe); product reference sheet for the sleep-gummy jar from real product photography; screen-UI mocks of the Amazon price-edit field (scene 1) and the funnel-audit overlay with the buy-box comparison against three competitors (scene 3).
- **Negative prompt / no-text-in-frame:** Do not render legible price values, badge iconography, or competitor listing text inside generated frames — supply the buy-box comparison as a flat reference image and add every TEXT ON SCREEN line as a post overlay. On-screen disclosure required: "Actor portrayal. Composite scenario for illustration."
- **Diegetic audio:** Quiet home-office ambience throughout; a hesitant trackpad click under scene 1 (the near-miss on cutting price); a firmer, more confident click under scene 2; no music bed, single continuous VO take.

## CTA & measurement

End card copy: "Free Trust Gap diagnostic. Find your actual leak." Destination: `ideabrandcoach.com/diagnostic`. The one metric that proves this ad worked: **diagnostic-start rate among ad-attributed clicks** — the ad's pitch is "the fix might not be price," so the proof is whether that fear_of_loss-and-relief framing gets a founder who's about to discount to check her buy box first instead.

*Persona is a composite, fictional founder portrayed by an actor — not a verified buyer. No real business, revenue, or CVR outcome is claimed as fact; all figures are illustrative.*

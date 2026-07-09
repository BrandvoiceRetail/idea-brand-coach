---
title: Every Touchpoint Scored Fine Except One. Here's the Overlay.
pain: cvr
funnel: displayed_reviews
tool: run_funnel_audit
format: product_demo
duration: 15s
aspect: 9:16
persona: Founder of a plant-based protein-powder brand running a full-funnel check before a relaunch push.
---

## Strategy

The felt pain, in her words before she ran anything: "I'm about to push real spend behind a relaunch. I don't want to find out after launch that one piece of my funnel was quietly leaking the whole time." She wasn't chasing a known problem — she was trying to find the unknown one before she paid to amplify it.

The specific funnel position surfaced is `displayed_reviews`. `run_funnel_audit`'s per-avatar overlay checks every touchpoint — ad creative through to reviews — against her real customer avatar, and the surfaced reviews are the single flagged position: the reviews shown don't match what her actual avatar segment cares about (plant-based digestibility and mixability, not just "tastes good").

Hook trigger: **momentum** — a screen-share confidence check before spend, not a post-mortem after it.

## Hook variants

1. **momentum:** "Before I push relaunch spend, I want to know which piece of my funnel is quietly leaking."
2. **recognition:** "Everything scored fine. Except the one section I'd never once double-checked."
3. **fear_of_loss:** "I almost put ad spend behind a funnel with a hole in it I hadn't found yet."

## Scene-by-scene

1. [0-3s] VISUAL: Founder-actor at a desk, screen-recording her own screen, relaunch calendar and ad-spend plan visible in a browser tab behind the coach chat. | VO: "I'm about to push real spend into a relaunch. I want to know what's actually working first." | TEXT ON SCREEN: "Relaunch in 6 days"
2. [3-6s] VISUAL: She opens the IDEA Brand Coach chat and runs `run_funnel_audit` against her avatar; a loading state, then a full touchpoint list renders. | VO: "So I ran a full funnel audit against my real customer, not a guess." | TEXT ON SCREEN: "run_funnel_audit"
3. [6-10s] VISUAL: The per-avatar overlay renders across every touchpoint — ad creative, amazon_main_image, amazon_listing_copy, displayed_reviews — each scoring green except one, `displayed_reviews`, flagged red. | VO: "Every touchpoint scored fine. Except one." | TEXT ON SCREEN: "Flagged: displayed_reviews"
4. [10-13s] VISUAL: Close on the finding: her surfaced reviews all praise taste, none mention digestibility or mixability — the two things her plant-based avatar actually searches reviews for. | VO: "My reviews were answering a question nobody in my real segment was asking." | TEXT ON SCREEN: "Reviews say 'tastes good.' Avatar asks 'does it mix.'"
5. [13-15s] VISUAL: End card — IDEA Brand Coach wordmark over a faint protein-scoop silhouette. | VO: "Free trust gap diagnostic — check your funnel before you spend." | TEXT ON SCREEN: "ideabrandcoach.com/diagnostic"

## Production notes (Higgsfield)

- **Mode:** Storyboard-image default — this is a clean single-location screen-share demo, one multi-panel storyboard image into one video job keeps the desk-and-screen continuity simple across scenes.
- **Reference kit:** Persona character sheet for the founder-actor (home-office setting, consistent wardrobe); product reference sheet for the protein-powder tub from real product photography; screen-UI mock of the coach chat and the funnel-audit per-touchpoint overlay with the flagged `displayed_reviews` card.
- **Negative prompt / no-text-in-frame:** Do not render legible touchpoint labels, review text, or score values inside generated frames — supply the overlay and review-comparison states as flat reference images and add every TEXT ON SCREEN line as a post overlay. On-screen disclosure required: "Actor portrayal. Composite scenario for illustration."
- **Diegetic audio:** Quiet home-office ambience throughout; trackpad clicks and a soft notification tone as the audit results render in scene 2; a slight pause (no music sting) on the single-red-flag reveal in scene 3.

## CTA & measurement

End card copy: "Free Trust Gap diagnostic. Check your funnel before you spend." Destination: `ideabrandcoach.com/diagnostic`. The one metric that proves this ad worked: **diagnostic-start rate among ad-attributed clicks** — the ad's pitch is "check before you spend, not after," so the proof is whether that momentum framing gets a founder mid-launch-planning to run the audit on her own funnel first.

*Persona is a composite, fictional founder portrayed by an actor — not a verified buyer. No real business, revenue, or CVR outcome is claimed as fact; all figures are illustrative.*

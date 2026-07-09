---
title: I Audited My Own Listing Like a Stranger Would Read It
pain: cvr
funnel: amazon_listing_copy
tool: audit_asset
format: ugc_review
duration: 15s
aspect: 9:16
persona: Founder of a non-slip yoga-mat brand who hadn't re-read her own listing copy in over a year.
---

## Strategy

Her own words: "I wrote that listing copy over a year ago. I haven't read it since — I just assumed it still worked." She knows her CVR has been sliding, but the copy reads fine to her because she already knows what the mat does. She's not the shopper anymore; she's the founder who forgot what it's like not to know.

The specific funnel position is `amazon_listing_copy`. `audit_asset` scores that one asset against her actual customer avatar — not against her own familiarity with the product — and returns a concrete mismatch: the copy leads with "textured surface," but her avatar's real fear (from her own ingest_evidence reviews) is slipping mid-pose on a hot studio floor, and the hero image sells that grip visually while the copy never names the moment it happens in.

Hook trigger: **recognition** — the exact "I assumed it still worked because I wrote it" feeling any founder has about copy they haven't looked at since launch.

## Hook variants

1. **recognition:** "I wrote this listing a year ago. Just assumed it worked."
2. **permission:** "You don't need a rewrite. You need the one costly line."
3. **fear_of_loss:** "Every day that mismatch sits there, a shopper finds a reason to leave."

## Scene-by-scene

1. [0-3s] VISUAL: Founder-actor on a yoga mat in a home studio, phone propped up, reading her own Amazon listing off her laptop screen out loud, frowning slightly. | VO: "I wrote this listing a year ago. Just assumed it worked." | TEXT ON SCREEN: "Written once. Never re-read."
2. [3-6s] VISUAL: Close on the laptop — the listing's first bullet, "textured surface for better feel," highlighted. | VO: "It reads fine. It just doesn't say what she's afraid of." | TEXT ON SCREEN: "Textured surface. But afraid of what?"
3. [6-9s] VISUAL: Screen-share of the IDEA Brand Coach chat running `audit_asset` against the `amazon_listing_copy` asset and her customer avatar. | VO: "So I ran the coach's audit against my real customer avatar." | TEXT ON SCREEN: "audit_asset — amazon_listing_copy"
4. [9-12s] VISUAL: Close on the audit output — score 58/100, flagged line: "Copy never names the moment: slipping mid-pose on a hot studio floor." | VO: "Her real fear was slipping mid-pose. My copy never said it." | TEXT ON SCREEN: "58/100 — the fear has a name. The copy doesn't."
5. [12-15s] VISUAL: End card — IDEA Brand Coach wordmark over a soft yoga-mat silhouette. | VO: "Free trust gap diagnostic — see what your listing's really saying." | TEXT ON SCREEN: "ideabrandcoach.com/diagnostic"

## Production notes (Higgsfield)

- **Mode:** Marketing-studio preset (UGC review). Talking-head-to-camera with a laptop-screen cutaway matches the preset's target shape exactly — persona on mat, one screen-share insert.
- **Reference kit:** Persona character sheet for the founder-actor (same face, studio wardrobe, home-studio setting throughout); product reference sheet for the yoga mat from the real product photo; a clean mock-UI reference of the listing text and the `audit_asset` output card for scenes 2-4.
- **Negative prompt / no-text-in-frame:** Do not render legible listing copy or audit UI text inside generated frames — supply those as flat reference images and add every TEXT ON SCREEN line as a post overlay. On-screen disclosure required: "Actor portrayal. Composite scenario for illustration." — fictional founder persona, never labeled or implied as a verified buyer.
- **Diegetic audio:** Quiet room tone (home studio) under scene 1; a soft trackpad click under scenes 2-4; VO is one continuous take, no music bed.

## CTA & measurement

End card copy: "Free Trust Gap diagnostic. See what your listing's really saying." Destination: `ideabrandcoach.com/diagnostic`. Two things prove this worked. **CTR to `/diagnostic`** is the ad's own metric — did the recognition moment get a founder to click through and check her own listing. But the metric that proves the diagnosis mattered is **sessions-to-orders on `amazon_listing_copy`** — once the copy names the fear instead of the feature, that ratio is what should move, not just clicks to the diagnostic.

*Persona is a composite, fictional founder portrayed by an actor — not a verified buyer. No real business, revenue, or CVR outcome is claimed as fact; all figures are illustrative.*

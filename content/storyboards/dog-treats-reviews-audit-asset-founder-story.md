---
title: I Thought My Reviews Section Was Doing Its Job. It Wasn't.
pain: cvr
funnel: displayed_reviews
tool: audit_asset
format: founder_story
duration: 30s
aspect: 9:16
persona: Founder of a grain-free dog-treats brand confident her reviews section was pulling its weight.
---

## Strategy

Her own words: "It had stars. It had volume. I never questioned it." She'd looked at the review count and the average rating and moved on — those numbers looked healthy, so she assumed the section itself was converting for her.

The specific funnel position is `displayed_reviews`. `audit_asset` scores that one asset against her actual customer avatar and comes back low — not because the reviews are bad, but because none of the surfaced reviews speak to allergy-prone dogs, the exact worry segment her real customer avatar is built around. Volume and stars said "healthy." The audit said something different.

Hook trigger: **identity** — she wasn't just wrong about a number, she was wrong about which dog owner she thought she was talking to.

## Hook variants

1. **identity:** "Turns out my reviews were talking to the wrong dog owner."
2. **recognition:** "Good stars, good volume. Never asked who they were for. Sound familiar?"
3. **fear_of_loss:** "Every day the wrong reviews sit on top, my most anxious shopper scrolls past."

## Scene-by-scene

1. [0-4s] VISUAL: Founder-actor at a kitchen table, dog treats bag in frame, a dog nearby, laptop open to her Amazon listing's reviews section. | VO: "It had stars, it had volume — I never once questioned it." | TEXT ON SCREEN: "4.6★. 900+ reviews. Never questioned."
2. [4-9s] VISUAL: Close on the reviews section — scrolling through several 5-star reviews, all generic ("my dog loves these!"). | VO: "They were good reviews. Just not the ones my real customer needed." | TEXT ON SCREEN: "Good reviews. Wrong reviews."
3. [9-14s] VISUAL: Cut to founder pulling up her customer avatar notes — sticky notes or a document showing "allergy-prone dogs" as the core worry segment. | VO: "My actual avatar wasn't 'dog owners' — it was owners worried about allergic reactions." | TEXT ON SCREEN: "The real worry: allergic reactions"
4. [14-19s] VISUAL: Screen-share of the IDEA Brand Coach chat running `audit_asset` on the `displayed_reviews` asset against her customer avatar. | VO: "So I ran the coach's audit on this section, against that avatar." | TEXT ON SCREEN: "audit_asset — displayed_reviews"
5. [19-24s] VISUAL: Close on the audit score — 33/100, flagged miss: "No surfaced review addresses allergy reactions." | VO: "The score came back low. Not one review spoke to the fear stopping the sale." | TEXT ON SCREEN: "33/100 — none speak to allergy-prone dogs"
6. [24-27s] VISUAL: Founder sitting back, looking at the screen, dog treats bag still in frame. | VO: "Stars said it worked. The audit said for whom." | TEXT ON SCREEN: "Stars ≠ the right voice"
7. [27-30s] VISUAL: End card — IDEA Brand Coach wordmark over a soft dog-treats-bag silhouette. | VO: "Free trust gap diagnostic — see what your listing's really saying." | TEXT ON SCREEN: "ideabrandcoach.com/diagnostic"

## Production notes (Higgsfield)

- **Mode:** per-scene precision. The founder_story format's arc (confident open → doubt → discovery → audit → verdict → reflection → close) needs distinct staging per beat rather than one compiled storyboard image.
- **Reference kit:** Persona character sheet for the founder-actor and her dog (same faces, kitchen setting, wardrobe throughout all 7 scenes); product reference sheet for the treats bag from real product photography; screen-UI mocks of the reviews section, the avatar notes, and the `audit_asset` score card for scenes 2, 3, 4-5.
- **Negative prompt / no-text-in-frame:** Do not render legible review text, avatar notes, or audit UI text inside generated frames — supply all as flat reference images, add every TEXT ON SCREEN line as a post overlay. On-screen disclosure required: "Actor portrayal. Composite scenario for illustration." — fictional founder persona, never implied as a verified buyer.
- **Diegetic audio:** Warm kitchen room tone throughout; a dog-tag jingle or soft bark under scene 1; trackpad clicks under scenes 4-5; VO is one continuous reflective take, light ambient bed only (no music hook).

## CTA & measurement

End card copy: "Free Trust Gap diagnostic. See what your listing's really saying." Destination: `ideabrandcoach.com/diagnostic`. Two things prove this worked. **CTR to `/diagnostic`** is the ad's own metric — did that identity-level recognition get a founder with "good" reviews to click through and check who those reviews are actually speaking to. But the metric that proves the diagnosis mattered is **sessions-to-orders on `displayed_reviews`** — surfacing reviews that speak to allergy-prone dogs, not just "dog owners," is what should move that ratio, not the star average.

*Persona is a composite, fictional founder portrayed by an actor — not a verified buyer. No real business, revenue, or CVR outcome is claimed as fact; all figures are illustrative.*

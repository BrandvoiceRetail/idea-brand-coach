---
title: "My Brand Store \"About\" Page Passed Every Vibe Check but One"
pain: cvr
funnel: brand_store_about
tool: audit_asset
format: problem_solution
duration: 15s
aspect: 9:16
persona: Founder of an embroidery-starter-kit brand who liked her Brand Store About page but couldn't say why it wasn't converting.
---

## Strategy

Her own words: "It reads well. It looks nice. I just can't tell you why it's not converting." She'd checked the page against every aesthetic and tone standard she had — and it passed all of them — which is exactly why she couldn't diagnose the problem herself: it wasn't a quality issue, it was a missing beat.

The specific funnel position is `brand_store_about`. `audit_asset` scores that page against her actual customer avatar and returns the miss: nothing on the page tells a total beginner they belong here — her avatar is a first-time embroiderer intimidated by a craft that looks expert-only, and the copy speaks fluent hobbyist without ever saying "you can start here too."

Hook trigger: **belonging** — the page needed to tell a nervous beginner she was welcome, and it never did.

## Hook variants

1. **belonging:** "It read well. It never told a beginner she belonged."
2. **recognition:** "It passed every vibe check I had. Still couldn't say why. Sound familiar?"
3. **permission:** "It's not a rewrite. It's one line you left out."

## Scene-by-scene

1. [0-3s] VISUAL: Founder-actor at a craft table with embroidery hoops and thread, laptop open to her Brand Store About page, looking genuinely puzzled. | VO: "Reads well. Looks nice. Couldn't tell you why." | TEXT ON SCREEN: "Reads well. Looks nice. Not converting."
2. [3-6s] VISUAL: Close on the About page — polished hobbyist language, confident tone, clearly written for people who already embroider. | VO: "It passed every check I had. It wasn't talking to her." | TEXT ON SCREEN: "Written for hobbyists. Read by beginners."
3. [6-9s] VISUAL: Screen-share of the coach running `audit_asset` on the `brand_store_about` page against her customer avatar. | VO: "So I ran the coach's audit against her — a total beginner." | TEXT ON SCREEN: "audit_asset — brand_store_about"
4. [9-12s] VISUAL: Close on the audit's flagged miss — score 66/100: "Nothing on this page tells a beginner she belongs here." | VO: "Nothing told her she belonged. That was the whole gap." | TEXT ON SCREEN: "66/100 — missing line: 'you can start here'"
5. [12-15s] VISUAL: End card — IDEA Brand Coach wordmark over a soft embroidery-hoop silhouette. | VO: "Free trust gap diagnostic — see what your listing's really saying." | TEXT ON SCREEN: "ideabrandcoach.com/diagnostic"

## Production notes (Higgsfield)

- **Mode:** storyboard-image mode (ONE multi-panel storyboard image compiled to ONE video job) — the problem_solution format's tight diagnose-then-name-the-fix arc fits a single compiled sequence without per-scene precision needs.
- **Reference kit:** Persona character sheet for the founder-actor (same face, craft-table setting, wardrobe throughout); product reference sheet for the embroidery kit from real product photography; screen-UI mock of the Brand Store About page and the `audit_asset` verdict card for scenes 2-4.
- **Negative prompt / no-text-in-frame:** Do not render legible About page copy or audit UI text inside generated frames — supply as flat reference images, add every TEXT ON SCREEN line as a post overlay. On-screen disclosure required: "Actor portrayal. Composite scenario for illustration." — fictional founder persona, never implied as a verified buyer.
- **Diegetic audio:** Quiet craft-room tone under scene 1; soft thread/hoop handling sound under scene 1-2; trackpad clicks under scenes 3-4; one continuous VO take, no music bed.

## CTA & measurement

End card copy: "Free Trust Gap diagnostic. See what your listing's really saying." Destination: `ideabrandcoach.com/diagnostic`. Two things prove this worked. **CTR to `/diagnostic`** is the ad's own metric — did that recognition get a founder who "can't say why" to click through and find out. But the metric that proves the diagnosis mattered is **sessions-to-orders on `brand_store_about`** — adding the one line that tells a beginner she belongs is what should move that ratio, not another design pass.

*Persona is a composite, fictional founder portrayed by an actor — not a verified buyer. No real business, revenue, or CVR outcome is claimed as fact; all figures are illustrative.*

---
title: Why Your Five-Star Reviews Still Don't Sell
pain: connection
funnel: review_request_flow
tool: build_avatar_stage
format: ugc_review
duration: 15s
aspect: 9:16
persona: Founder of a dog joint-chews brand watching five-star reviews say nothing about the brand.
---

## Strategy

The felt pain, in the founder's words: *"Three hundred and forty reviews. All five stars. 'Good product, fast shipping.' Not one of them would make a stranger buy."* The rating looks perfect. The reviews underneath it are empty — proof the product works, but nothing that carries the next dog owner across the line.

The funnel position is `review_request_flow`: the ask itself. A generic "leave a review" prompt gets a generic answer back. `build_avatar_stage` runs the forensic build (vocabulary → job map → triggers → objections) against her actual customers and surfaces the real emotional job underneath every purchase — guilt, watching a dog slow down, and the relief of watching it move again. That's the feeling the ask never names.

The hook runs on **recognition** — she already senses her reviews aren't pulling their weight; the ad names the exact reason (the ask is asking for the wrong thing) instead of telling her to "get more reviews."

## Hook variants

1. **Recognition:** "Three hundred and forty five-star reviews. Not one of them would make a stranger buy."
2. **Fear_of_loss:** "Every review that says 'good product, fast shipping' is a stranger scrolling past you to the next listing."
3. **Permission:** "You don't need more reviews. You need to ask a different question."

## Scene-by-scene

1. [0-3s] VISUAL: Customer-actor at home, dog resting beside her, holding the joint-chews bag, delivering a flat review straight to camera. | VO: "Five stars. Good product. Fast shipping." | TEXT ON SCREEN: "5.0★ · 340 reviews"
2. [3-6s] VISUAL: Cut to the founder at her laptop, scrolling page after page of nearly identical short reviews, uneasy. | VO: "Three hundred and forty reviews like that. None of them sell the next buyer." | TEXT ON SCREEN: "340 reviews. Zero story."
3. [6-9s] VISUAL: Founder opens IDEA Brand Coach and runs `build_avatar_stage`; the UI steps through the stages, landing on S3 with a flagged trigger: guilt watching a dog slow down. | VO: "So I ran the coach's avatar build on my actual customers." | TEXT ON SCREEN: "build_avatar_stage → S3 trigger: guilt"
4. [9-12s] VISUAL: Split screen — the old review-request prompt ("Leave us a review!") beside a new one that names the feeling directly ("Tell us: is your dog moving easier?"). | VO: "Now the ask names the thing they actually feel." | TEXT ON SCREEN: "New ask, same request"
5. [12-15s] VISUAL: End card — IDEA Brand Coach wordmark on a clean dark background. | VO: "Find the feeling behind your five stars — free." | TEXT ON SCREEN: "ideabrandcoach.com/diagnostic"

## Production notes (Higgsfield)

- **Mode:** Marketing-studio preset (UGC review) for scene 1 — a persona-on-camera testimonial with the product in hand is exactly that preset's target shape; scenes 2-4 switch to per-scene precision for the founder's screen-capture beats.
- **Reference kit:** Persona character sheet for the customer-actor and her dog (consistent face/setting for the review beat); separate founder character sheet for scenes 2-4; screen-UI mock of the coach's chat and the `build_avatar_stage` stage-progression panel; real product photo of the joint-chews bag.
- **Negative prompt / no-text rule:** No legible review-platform chrome, star widgets, or UI text baked into generated frames — supply those as flat reference and add every TEXT ON SCREEN line as a post overlay. On-screen disclosure required: "Actor portrayal. Composite scenario for illustration." — never labeled or implied as a verified buyer.
- **Diegetic audio:** Warm living-room room tone under scene 1 with a light paw-tap or collar jingle, laptop trackpad clicks under scenes 2-4, no music bed until the end-card sting.
- **Edit-before-regenerate:** if the `build_avatar_stage` stage-progression panel needs a copy fix after review, edit that generation directly rather than re-rendering the founder scenes from scratch, so her face/setting stay consistent scene to scene.

## CTA & measurement

**End card copy:** "Find the feeling behind your five stars. Free diagnostic." **Destination:** ideabrandcoach.com/diagnostic. **Ad-level metric:** click-through rate from the ad to /diagnostic — proof the recognition hook landed with founders who already suspect their "good" reviews aren't actually selling anything. **Connection-level metric:** open/click rate on the new review-request ask itself (did the emotionally specific question get engaged with, versus the old generic prompt), plus the repeat-purchase rate among customers who received it — proof the ask, not just the review copy, is building a reason to come back.

*Persona is a composite, fictional founder and customer portrayed by actors — not verified buyers. No real business, revenue, or conversion outcome is claimed as fact; all figures are illustrative.*

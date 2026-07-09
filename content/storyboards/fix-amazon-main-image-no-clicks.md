---
title: Impressions Up, Clicks Flat? Fix Your Amazon Main Image
pain: ctr
funnel: amazon_main_image
tool: generate_main_image_title_plan
format: product_demo
duration: 15s
aspect: 9:16
persona: Kitchen-gadget founder selling a $40 electric kettle; Sponsored Products impressions climbing, clicks flat for three weeks.
---

## Strategy

The felt pain, in Priya's words: "I'm paying more to be seen, and fewer people are clicking. That's not a traffic problem, that's a listing problem I can't see." Her Sponsored Products dashboard is doing exactly what it's supposed to — impressions up 40% — and the number that matters, clicks, hasn't moved in three weeks. ACOS is creeping toward breakeven because she's now paying for exposure that isn't converting to a click.

The specific funnel position is `amazon_main_image` — the exact spot where a shopper's scroll either stops or doesn't. Everything upstream (the ad, the keyword, the bid) is working; the connection breaks at the image itself, because it isn't making a specific, distinctive case for the click. `generate_main_image_title_plan` solves that by forcing the main image and the title to make ONE positioning statement instead of two disconnected ones.

Hook trigger: **fear_of_loss** — she is actively paying to lose the click to a competitor's kettle, every single day this keeps running.

## Hook variants

1. **fear_of_loss:** "Every day my ads run, I'm paying to lose the click to someone else's kettle."
2. **recognition:** "You know the exact moment — impressions climbing, clicks not moving. I lived that for three weeks."
3. **momentum:** "I didn't need a new photo shoot. I needed eleven better words on the image I already had."

## Scene-by-scene

1. [0-3s] VISUAL: Priya at her kitchen counter, laptop open to her Amazon Ads dashboard — an impressions line climbing sharply next to a click line sitting flat. | VO: "Every day my ads run, I'm paying to lose the click to someone else's kettle." | TEXT ON SCREEN: "Impressions +40%. Clicks: flat."
2. [3-6s] VISUAL: Close on the dashboard as her ACOS line ticks upward toward a highlighted breakeven marker. | VO: "Three weeks of this, and my ACOS is creeping past breakeven." | TEXT ON SCREEN: "ACOS climbing"
3. [6-9s] VISUAL: Screen recording — Priya opens the IDEA Brand Coach chat, pastes her ASIN, and runs `generate_main_image_title_plan`; a plan document renders on screen. | VO: "So I ran the coach's main image and title plan — it forces the image and the title to say ONE thing." | TEXT ON SCREEN: "generate_main_image_title_plan"
4. [9-12s] VISUAL: The rendered plan highlights its formula — brand, the real keyword, and the one difference that matters — laid over her current main image and title. | VO: "Brand, the real keyword, and the one difference that matters — right there in the first eighty characters." | TEXT ON SCREEN: "Brand + keyword + difference"
5. [12-15s] VISUAL: End card — IDEA Brand Coach wordmark over a faint kettle silhouette. | VO: "Free trust gap diagnostic — see what your own listing is doing right now." | TEXT ON SCREEN: "ideabrandcoach.com/diagnostic — free, 6 questions, no account"

## Production notes (Higgsfield)

- **Mode:** Per-scene precision. Scenes 1-2 (dashboard) and scenes 3-4 (coach chat + rendered plan) each depend on a specific mock UI staying legible and consistent across the cut — storyboard-image compression risks blurring chart lines and the plan's callouts.
- **Reference kit:** Persona character sheet for Priya (same face, kitchen wardrobe, lighting across all scenes); a clean mock-UI reference image of the Amazon Ads dashboard (impressions/clicks/ACOS lines); a clean mock-UI reference of the coach chat + `generate_main_image_title_plan` output card; product reference sheet for the kettle built from the real product photo.
- **Negative prompt / no-text-in-frame:** Do not let the model generate legible chart labels, UI copy, or dashboard text inside the frame — those are hallucination-prone. Feed the dashboard/plan mock-ups as clean flat reference images and add every TEXT ON SCREEN element as a post overlay. On-screen disclosure required: "Actor portrayal. Composite scenario for illustration." — Priya is a fictional composite founder, not a verified customer or real case study.
- **Diegetic audio:** Quiet kitchen ambience under scenes 1-2 (fridge hum, a spoon set down); soft trackpad/click sounds under scenes 3-4 as Priya navigates the plan; VO is a single continuous take, not a voiceover-over-music read.

## CTA & measurement

End card copy: "Free Trust Gap diagnostic. 6 questions. No account. See what your listing is actually saying." Destination: `ideabrandcoach.com/diagnostic`. The one metric that proves this ad worked: **the ad's own CTR to `/diagnostic`** (link clicks ÷ impressions) — an ad about paying for impressions instead of clicks has to prove itself on that exact same line, not on views or watch time.

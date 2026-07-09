---
title: Permissioned UGC Unused? A Candle Brand's 90 Clips
description: Permissioned ugc unused in a folder? A candle brand collects diligently, but get_funnel_coverage finds exactly where that footage should actually run.
date: 2026-06-29
updated: 2026-07-09
category: Funnel
funnel: ugc_repost_permissions
tools: get_funnel_coverage, run_funnel_audit
keywords: permissioned ugc unused, ugc repost strategy amazon, funnel coverage candle brand, deploy customer video across funnel, home fragrance brand ugc
slug: permissioned-ugc-sitting-unused-candle-brand
cluster: paid-social-ugc-ads
role: supporting
primary_keyword: permissioned ugc unused
secondary_keywords: ugc repost strategy amazon, deploy customer video across funnel, home fragrance brand ugc
---

## Permissioned UGC Unused: The Number That Looks Wrong

Permissioned UGC unused in a shared drive is one of the most common, and most fixable, gaps an Amazon brand owner can have: real customer proof, properly cleared, sitting exactly where it can't help a single shopper decide. Priya found this out running a home-fragrance brand - hand-poured candles, a tidy little scent line, a customer base that films unboxings without being asked. She's been diligent about the unglamorous part: getting written permission, tagging clips by scent, filing everything in a shared drive labeled by month. Say the drive holds ninety usable clips by now.

Here's the number that doesn't add up. Her main image is still a studio shot. Her storefront About page is still a paragraph of brand copy with no faces in it. Her paid social is still running the same three static product images from launch. Ninety pieces of real customer proof exist, and not one of them has left the folder.

## Why the usual fix fails

The instinct is to collect more. Priya considered running a giveaway to get another wave of UGC, on the theory that the problem is volume. It isn't. She already has more usable footage than she's ever deployed anywhere. Collecting a second folder on top of an unused first folder doesn't fix a routing problem - it just makes the folder bigger.

The other instinct is to post more often on social and call that "using" the UGC. Priya does post occasionally. But posting to a feed that maybe a few hundred people see isn't the same as putting proof in front of every single shopper who lands on the listing or the storefront - the places where a purchase decision actually gets made.

There's a quieter version of the same trap too: treating the drive itself as the finish line. Getting permission and filing a clip feels like progress, and it is - but it's the collection step, not the deployment step. A folder of ninety well-organized, completely unused clips looks tidy on a spreadsheet and does exactly nothing for a shopper who has never seen any of them.

## The diagnosis lens

The question worth asking isn't "how do I get more UGC" - it's "where in my funnel is there a decision-making moment with zero UGC presence, when UGC already exists to fill it." That's exactly what `get_funnel_coverage` checks: which canonical funnel positions have a touchpoint live, and which are blank, position by position.

Run against Priya's funnel, the coverage map showed `amazon_main_image`, `brand_store_about`, and `paid_social_creative` all still running studio-only content, with zero permissioned-UGC presence in any of them - despite ninety clips sitting one folder over.

*What the coach said:* "You don't have a content problem. You have a routing problem. The proof exists. It's just never been told where to go."

This is the shape a real ugc repost strategy amazon sellers can act on takes: not "make more," but "find the blank position and deploy customer video across funnel gaps that already exist."

![Ninety permissioned clips exist. Three funnel positions have zero UGC presence — that's the gap, not a content shortage](/blog/assets/permissioned-ugc-sitting-unused-candle-brand--funnel-position.svg "The proof already exists. It just needs a position to run in.")

## The working session

Knowing which positions were blank told Priya where a gap existed, but not which gap mattered most to fix first. That's where `run_funnel_audit` came in - the per-avatar audit overlay that checks each funnel position against the actual customer avatar and ranks which weak link would move the needle hardest for this specific buyer.

For Priya's avatar - someone buying a gift-adjacent, sensory product mostly sight-unseen on a search grid - the audit ranked `amazon_main_image` as the highest-leverage gap. A shopper deciding whether to click has no way to judge scent or ambiance from a studio bottle shot; a real customer's lit-candle, cozy-room clip does work a static photo can't.

*What the coach said, reviewing the ranking:* "Your storefront gap matters too, but almost nobody reaches the storefront who hasn't already clicked past the image. Fix the position that decides whether they click at all, first."

The next step wasn't producing anything new. It was selecting three existing clips that matched the main-image gap specifically - warm-light, lit-candle footage - and routing them into the image slot and, separately, into the paid social rotation, rather than letting them age further in the drive.

Priya also flagged the `brand_store_about` gap for a second pass once the main-image test settled, since the audit ranked it real but lower-leverage - a case where the fix list is now ordered instead of everything feeling equally urgent at once.

## The Higgsfield handoff

Where an existing clip needs reframing for a different placement - a vertical phone clip that needs to sit in a square main-image gallery slot, say - the move is `reframe` on the real clip rather than commissioning a new shoot. The customer's actual room and actual candle stay intact; only the aspect ratio changes for where it needs to run.

## What to measure

After routing clips into the main-image and paid-social gaps, watch `amazon_main_image` CTR and paid social CTR separately, each against its own prior baseline - not against each other, since they're different traffic and different intent. Give it two to three weeks before drawing a conclusion; a single spike or dip in either channel doesn't confirm the routing worked.

## FAQ

### Why does permissioned UGC sit unused even after a brand asks for it correctly?

Because collecting and filing a clip feels like progress, and it is, but it's the collection step, not the deployment step. Most brands never run a check like `get_funnel_coverage` to see which specific funnel positions are blank, so the footage waits for a routing decision nobody's made yet.

### What's the fastest way to find where unused UGC should go?

Run `get_funnel_coverage` against your funnel positions to see which ones are running studio-only content with zero UGC presence. Then run `run_funnel_audit` against your actual customer avatar to rank which of those blank positions matters most to fill first.

### Is more UGC the fix if what I have isn't converting?

Usually not. If you already have permissioned ugc unused in a drive, collecting a second wave on top of an unused first wave doesn't fix a routing problem, it just makes the folder bigger. Fix where the existing clips run before asking for more.

### Can I reuse a vertical UGC clip in a square listing image slot?

Yes. Use `reframe` on the real, permissioned clip rather than commissioning a new shoot. The customer's actual room and actual product stay intact; only the aspect ratio changes for the placement it needs to run in.

## The next action

If you're sitting on a UGC library that never leaves the drive, don't shoot more. Run `get_funnel_coverage` to see exactly which positions in your funnel are still running studio-only content despite permissioned ugc unused one folder over, and start with the one closest to the purchase decision. The free [diagnostic](/diagnostic) is a faster first look if you haven't mapped your funnel positions yet at all.

For the fuller framework this permissioned ugc unused problem sits inside, see [the ground-up guide to Amazon brand UGC ad strategy](/blog/amazon-ugc-ad-strategy-guide/). The same routing discipline applies before you shoot anything new: check whether [a winning ad is fading for a reason no fresh footage will fix](/blog/paid-social-ad-fatigue-new-trigger-angle/), whether [the hook you're running was ever built for this audience](/blog/paid-social-hook-mismatched-audience/), and whether [three untested concepts are quietly splitting a budget too thin to read](/blog/paid-social-testing-three-creative-concepts-blind/). And if your influencer seeding looks like [ten identical clips all saying the same generic thing](/blog/influencer-ugc-generic-love-this-content/), that's the collection-side version of the exact problem permissioned UGC unused in a drive creates on the deployment side.

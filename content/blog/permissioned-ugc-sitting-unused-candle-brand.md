---
title: Your Best Customer Videos Are Sitting in a Folder
description: A candle brand collects permissioned UGC diligently, but it never leaves the folder. get_funnel_coverage finds where it should actually run.
date: 2026-06-29
category: Funnel
funnel: ugc_repost_permissions
tools: get_funnel_coverage, run_funnel_audit
keywords: permissioned ugc unused, ugc repost strategy amazon, funnel coverage candle brand, deploy customer video across funnel, home fragrance brand ugc
slug: permissioned-ugc-sitting-unused-candle-brand
---

## The number that looks wrong

Priya runs a home-fragrance brand - hand-poured candles, a tidy little scent line, a customer base that films unboxings without being asked. She's been diligent about the unglamorous part: getting written permission, tagging clips by scent, filing everything in a shared drive labeled by month. Say the drive holds ninety usable clips by now.

Here's the number that doesn't add up. Her main image is still a studio shot. Her storefront About page is still a paragraph of brand copy with no faces in it. Her paid social is still running the same three static product images from launch. Ninety pieces of real customer proof exist, and not one of them has left the folder.

## Why the usual fix fails

The instinct is to collect more. Priya considered running a giveaway to get another wave of UGC, on the theory that the problem is volume. It isn't. She already has more usable footage than she's ever deployed anywhere. Collecting a second folder on top of an unused first folder doesn't fix a routing problem - it just makes the folder bigger.

The other instinct is to post more often on social and call that "using" the UGC. Priya does post occasionally. But posting to a feed that maybe a few hundred people see isn't the same as putting proof in front of every single shopper who lands on the listing or the storefront - the places where a purchase decision actually gets made.

There's a quieter version of the same trap too: treating the drive itself as the finish line. Getting permission and filing a clip feels like progress, and it is - but it's the collection step, not the deployment step. A folder of ninety well-organized, completely unused clips looks tidy on a spreadsheet and does exactly nothing for a shopper who has never seen any of them.

## The diagnosis lens

The question worth asking isn't "how do I get more UGC" - it's "where in my funnel is there a decision-making moment with zero UGC presence, when UGC already exists to fill it." That's exactly what `get_funnel_coverage` checks: which canonical funnel positions have a touchpoint live, and which are blank, position by position.

Run against Priya's funnel, the coverage map showed `amazon_main_image`, `brand_store_about`, and `paid_social_creative` all still running studio-only content, with zero permissioned-UGC presence in any of them - despite ninety clips sitting one folder over.

*What the coach said:* "You don't have a content problem. You have a routing problem. The proof exists. It's just never been told where to go."

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

## The next action

If you're sitting on a UGC library that never leaves the drive, don't shoot more. Run `get_funnel_coverage` to see exactly which positions in your funnel are still running studio-only content, and start with the one closest to the purchase decision. The free [diagnostic](/diagnostic) is a faster first look if you haven't mapped your funnel positions yet at all.

If your advocacy stage has a similar blind spot one stage further down, [Reviews and Referrals Covered. Loyalty Is the Gap](/blog/loyalty-community-blind-spot-snack-brand/) covers the same pattern in the loyalty position. For a case where the gap sits earlier, in referral messaging entirely, see [The Referral Touchpoint Missing From Your Skincare Funnel](/blog/referral-program-missing-from-skincare-funnel/). And if referrals are running but still underperforming rather than absent, [Why Your Protein Brand's Referral Program Underperforms](/blog/referral-program-underperforming-protein-brand/) walks through that diagnosis.

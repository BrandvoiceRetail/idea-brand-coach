---
title: Your 'Cyclist' Brand Story Isn't Talking to Your Buyer
description: A bike-mount brand writes its Brand Story for sport cyclists while most buyers are commuters dodging potholes. build_avatar_stage finds the real audience.
date: 2026-01-24
category: Customer
funnel: amazon_brand_story
tools: build_avatar_stage
keywords: build_avatar_stage amazon, amazon brand story audience mismatch, avatar triggers amazon, cycling accessory listing
slug: brand-story-wrong-cyclist-audience
---

## The morning number that doesn't match the copy

Say search term reports show phrases like "bike phone mount commute" and "bike mount pothole" driving most of your traffic, while your Brand Story talks about race day and gear ratios. That's the mismatch Marcus found sitting in his own Search Query Performance report for a bike phone mount he's sold for two years. CVR has held around 4% since launch, and he'd been chalking that up to "cycling accessories just convert lower," without ever checking whether his page was actually written for the person searching those terms.

It wasn't. His Brand Story opens with a photo of a cyclist in full kit on an open road, copy about "gear that keeps up with your training," and a founder note about racing years ago. It's a well-made page for a sport cyclist. The problem is his real buyer, by his own search data, is mostly someone commuting to work who wants their phone visible for navigation and doesn't want to look down at potholes and traffic.

## Why "add more cycling content" doesn't fix this

Marcus's first idea was to lean further into the cycling angle — more gear detail, more performance claims, on the theory that if the current cycling story isn't converting, it needs to be a *better* cycling story. That's solving the wrong problem entirely. The issue isn't that his cycling story is weak. It's that it's a story for a person who isn't mostly buying the product.

A sport cyclist and an urban commuter share a bike and not much else. One is optimizing performance on a planned ride; the other is trying to get through a daily commute without a near-miss because they glanced at a phone screen instead of a mount. Writing a punchier version of the racing story just makes a more polished page for the wrong reader.

## The diagnosis lens: the avatar doing the buying isn't the avatar being written for

This is a Customer-side gap before it's a copy gap. The fix isn't a pillar score — it's confirming who's actually buying and what they're actually afraid of, because right now the Brand Story is built on an assumption (sport cyclist, performance-motivated) rather than evidence. Getting the trigger right for the wrong person doesn't help; the audience itself is off.

## The working session

Marcus brings the coach his search term data and the honest admission that he wrote the Brand Story from his own experience as a rider, not from actual buyer research.

The coach runs `build_avatar_stage`, working through the stages in order. S1 pulls the real vocabulary from his reviews and Q&A — "commute," "pothole," "traffic," "don't want to look down" show up repeatedly; "training," "cadence," "race day" barely appear at all. S2 maps the job-to-be-done: getting navigation visible during a daily ride through unpredictable city conditions, not tracking performance on a planned route. S3 surfaces the real trigger underneath that job — fear, specifically the fear of a near-miss or a dropped phone at exactly the wrong moment in traffic.

What the coach said: *"Your Brand Story is solving for a rider optimizing a training ride. Your actual buyer is trying to survive a commute without looking down at the wrong second. Those are different fears, and right now you're addressing neither of theirs."*

S4 adds the objections that go with that trigger — mainly whether the mount holds through real potholes, not smooth training-road vibration, which is a different durability claim than the one currently on the page.

## The Higgsfield handoff

The avatar work changes the brief for everything downstream, not just the words. Once the commuter's real trigger and objections are documented, rebuilding the Brand Story's opening image through `generate_aplus_content_plan` means specifying a commuter scene — city street, traffic, the exact moment of glancing at a map instead of a screen — rather than the open-road racing shot currently doing the job badly. That new scene becomes a Higgsfield generation job built from a reference kit anchored to the real mount and a believable urban setting, not a stock cycling photo.

If your own listing copy is talking past your real buyer in a different way, using the product's vocabulary instead of the customer's, [Why Your Bullet Points Don't Sound Like Your Customer](/blog/bullet-points-wrong-customer-words/) covers the copy-vocabulary version of this same avatar mismatch. And if your featured reviews are curated around the wrong story entirely, [Your Featured Reviews Don't Mention Why Parents Actually Buy](/blog/featured-reviews-miss-real-trigger/) is the same audience-mismatch pattern showing up in review curation instead of Brand Story copy — while [Buyers Aren't Talking About What Your Reviews Highlight](/blog/review-highlights-wrong-vocabulary/) is the vocabulary version of that same miss.

## What to measure after

Segment CVR by search term cluster before and after the rewrite — commute-intent terms versus performance-intent terms — rather than watching overall CVR alone. If the fix landed, the commuter segment should move first and fastest, since that's the traffic the new copy is actually built for.

Not sure whether your own listing is talking to the buyer who's actually searching for it? The free [diagnostic](/diagnostic) takes six questions and no account, and is a fast way to check before you commission new avatar research.

## The one next action

Pull your last thirty search terms from Search Query Performance and read your Brand Story's opening line against them, as if you were the person who typed "bike mount pothole" and clicked through. If the copy doesn't match the fear behind that search, that's your signal — run `build_avatar_stage` before you touch the copy again.

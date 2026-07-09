---
title: The Referral Ask That Became a Dog-Treat Brand's Best Ad
description: A pet brand's refer-a-friend email is functional but reads like a coupon nobody shares. generate_ugc_ad_plan turns that same ask into an ad worth sharing.
date: 2026-06-21
category: Creative
funnel: referral_program
tools: generate_ugc_ad_plan, build_avatar_stage
keywords: referral program ugc ad, higgsfield ugc video referral, dog treat brand advocacy, pet brand word of mouth ad, referral hook script
slug: referral-ask-turned-into-ugc-ad-dog-treats
---

## The morning number that never moves

Say your refer-a-friend email gets opened at a normal rate — 22%, nothing unusual — and produces almost no forwards. That's the number a pet-treats founder we'll call Bex has been watching for months. The email technically works. It sends. It's tracked. It just never gets shared, and forwards are the entire point of a referral email — an email a customer opens and reads alone isn't doing the job an email that gets passed to a friend does.

Bex has rewritten the subject line four times. Open rate barely moves either direction. The problem isn't getting people to open it. It's that once they do, there's nothing in there worth forwarding.

## Why tweaking the coupon doesn't fix a sharing problem

The natural fix for a referral email that isn't converting is to sweeten the deal — bigger discount, free shipping, a bonus item. Bex tried a version with a slightly better offer. Open rate held. Forward rate stayed flat. That's the tell that this isn't a pricing problem: nobody forwards a coupon to a friend because the coupon got 3% better. People forward things that are worth saying out loud, and Bex's email, however functional, reads exactly like what it is — a discount code with a "share this" button bolted on. Nothing in it sounds like something a dog owner would actually say to another dog owner.

## The diagnosis lens: this is a belonging trigger with no voice behind it

The fix here isn't a better offer. It's recognizing that a referral message for this category runs on belonging — being part of the "my dog only eats this now" tribe — and that trigger has to be spoken in a real voice, not printed as marketing copy in an email template. A coupon code can't carry an emotional trigger. A specific sentence in a specific person's voice can.

## The working session

Bex brings the flat forward rate to a session without a fixed idea of the fix — just the observation that the email "feels like a coupon, not something anyone would actually say."

The coach starts with `build_avatar_stage`, pulling the S3 trigger and S4 objection work already built for this avatar. The trigger confirmed here is belonging — specifically the "part of the pack" feeling that shows up unprompted in Bex's own review data, where customers describe finding a treat their notoriously picky dog will actually eat as something worth telling other dog owners about, not just a purchase worth rating.

What the coach said: *"Your email is asking people to share a transaction. Nobody shares a transaction. They share a story about the one thing that finally worked for their dog after four other brands failed. That's the sentence you're missing."*

With the trigger and a real sentence pattern identified, the coach runs `generate_ugc_ad_plan` — not to rewrite the referral email itself, but to turn the referral moment into a piece of shareable creative that carries the belonging trigger the way a text message between two dog owners actually sounds: *"I told my sister because her dog wouldn't touch the vet-recommended stuff."* That's a real-sounding hook, not ad copy, and it's built with three trigger-angled variants so Bex isn't betting the whole idea on one line landing.

The output is a script-level UGC ad plan — persona cast from the real customer avatar, the spoken hook built around belonging, claim-gated talking points so nothing overstates what the treats actually do, and a skeptic-flip structure ("I thought my dog just wouldn't eat treats at all, but...") that opens with doubt instead of praise, the way a real recommendation between friends actually starts.

## The Higgsfield handoff

The `generate_ugc_ad_plan` output is the script and the shot-level direction — it doesn't render anything itself. That plan goes to Higgsfield to actually produce the video: a UGC-style clip built from the reference-kit discipline (real product, a real-sounding presenter reading the belonging-angled hook, the skeptic-flip line delivered before any praise), so the finished ad looks like something a real customer sent a friend, not a studio ad wearing a UGC filter. The referral email's underlying trigger — belonging, not discount — now exists as paid creative too, which is a very different asset than the email that started this.

## What to measure after

The number that actually matters here isn't open rate on the referral email — it's forward rate specifically, since that's the one metric that tells Bex whether the belonging trigger is doing its job versus just being read and ignored. On the paid-creative side, `ingest_content_performance` on the new UGC ad tells her whether the skeptic-flip hook is holding attention past the first three seconds, which is where most scroll-past decisions happen.

This same "the trigger needs a real voice, not marketing copy" pattern shows up in a few adjacent spots worth checking: [turning a semi-viral customer unboxing clip into ad-ready script](/blog/turning-a-fan-video-into-a-paid-ugc-ad/), [deciding which of forty permissioned customer videos actually deserves a repost](/blog/which-customer-video-to-repost-detailing-brand/), and [building the unboxing reaction moment into a real ad plan](/blog/unboxing-video-ad-plan-kitchen-gadget/) instead of a vague "make it feel authentic" brief. If your welcome series or winback flow has the same problem — technically sent, never actually felt — [adding a founder story video to a text-only welcome series](/blog/add-brand-story-video-welcome-series/) and [rebuilding a winback message around the trigger customers actually forgot](/blog/winback-video-reminding-lapsed-customers-why/) both start from the same diagnosis.

If you're not sure whether your own funnel's weak point is a missing trigger or a missing touchpoint entirely, the free [diagnostic](/diagnostic) gives you a starting read in a few minutes, no account required.

## The one next action

Pull one line from a real review or DM that describes why a customer actually recommended you — not a rating, an actual sentence — and run it through `generate_ugc_ad_plan` before you touch your referral email's discount amount again.

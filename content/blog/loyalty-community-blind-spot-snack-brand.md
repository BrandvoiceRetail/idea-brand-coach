---
title: Reviews and Referrals Covered. Loyalty Is the Gap
description: Reviews and referrals are covered, but loyalty_community is a total blank. get_funnel_coverage finds the gap costing a snack brand repeat revenue.
date: 2026-07-04
category: Funnel
funnel: loyalty_community
tools: get_funnel_coverage, run_funnel_audit
keywords: loyalty community amazon brand, advocacy funnel coverage gap, snack brand repeat customers, retention touchpoint amazon, funnel audit loyalty
slug: loyalty-community-blind-spot-snack-brand
---

## The number that looks wrong

Dev sells a specialty-snack line - a small batch of flavored nut mixes with a genuinely loyal following. His `review_request_flow` is dialed in; review volume climbs steadily. His `referral_program` is live and generating a trickle of new customers every month. On paper, Dev feels like he's covered the advocacy side of his funnel. Repeat purchase revenue, though, has been flat for two quarters, and he can't figure out why - everything he's supposed to have built is built.

## Why the usual fix fails

The instinct when repeat revenue stalls despite "having advocacy covered" is to push harder on the two things already live - ask for reviews more aggressively, sweeten the referral incentive. Dev tried bumping the referral reward. New-customer volume from referrals ticked up slightly. Repeat purchase from existing customers didn't move at all, because the referral program was never built to talk to people who'd already bought - it's a new-customer acquisition tool wearing an advocacy-stage label.

Reviews and referrals are both real advocacy touchpoints. But "advocacy" isn't one box you check twice. It's a stage with several distinct jobs, and having two of them covered can feel like coverage while a third, entirely different job sits completely empty.

Dev's other instinct - the one he didn't act on, but almost did - was to assume the flat repeat number was a product problem. Maybe the third flavor wasn't landing. Maybe fulfillment was slow. Both were worth ruling out, but neither explained why the drop-off was specifically in second-and-third purchases rather than complaints or returns. The pattern pointed at a missing touchpoint, not a broken product.

## The diagnosis lens

The way to check this isn't gut feel about what "feels handled" - it's running `get_funnel_coverage` across the whole Advocacy stage: `review_request_flow`, `referral_program`, `ugc_repost_permissions`, `loyalty_community`, checked position by position for whether a live touchpoint actually exists.

For Dev's funnel, the coverage map came back exactly as suspected on two positions and blank on a third: `loyalty_community` had zero coverage. Not underperforming - absent. No welcome-back messaging, no repeat-buyer perk, no touchpoint of any kind aimed at someone who's already purchased and might purchase again.

*What the coach said:* "Reviews turn buyers into public proof. Referrals turn buyers into recruiters. Neither one gives a repeat buyer a reason to come back themselves. You've built two doors and left the third one off the building."

## The working session

Knowing the position was blank told Dev where the gap sat, but not how much it actually mattered relative to his other priorities. That's what `run_funnel_audit` answers - the per-avatar overlay that checks each funnel position against the real customer avatar and ranks which gap costs the most.

Run against Dev's avatar data, the audit flagged something specific: his highest-LTV segment is repeat snack buyers who reorder every six to eight weeks once they're in the habit - and that segment is the one with literally no touchpoint speaking to it anywhere in the funnel. New customers get onboarded. Reviewers get asked. Referrers get rewarded. The person actually driving the most lifetime value gets nothing built for them at all.

*What the coach said, looking at the audit:* "This is your best customer, and right now she's the only one you're not talking to on purpose. Referrals will keep bringing new people in the top. They were never going to fix a hole at the bottom."

The direction that came out of the session: a simple repeat-buyer perk tied to reorder cadence - recognition for hitting a streak, not a discount-first mechanic - sized to close specifically the `loyalty_community` gap the audit flagged, rather than another tweak to the referral incentive that was never the right lever for this problem.

The point isn't that Dev needs an elaborate loyalty platform. The audit's job was narrower than that - confirm the gap exists, confirm which segment it costs the most, and stop him from spending another quarter improving the two touchpoints that were never going to touch it.

## What to measure

Once a `loyalty_community` touchpoint goes live, the metric to watch is repeat-purchase rate among customers who've already bought twice, tracked against the flat baseline of the last two quarters - not total revenue, which referrals will keep nudging regardless. Give it a full reorder cycle or two, since a snack brand's repeat window is measured in weeks, not days, before judging whether the gap actually closed.

Keep review volume and referral signups on their own separate dashboards throughout. If the new touchpoint works, repeat-purchase rate should move on its own line without borrowing credit from - or getting blamed on - the two channels that were already running fine before this gap was found.

## The next action

If your advocacy metrics look "covered" but repeat revenue is flat anyway, don't tune the levers you already have. Run `get_funnel_coverage` across the whole stage and check for a position that's simply empty. The free [diagnostic](/diagnostic) is a fast way to see where your funnel's weakest link sits if you haven't mapped positions yet.

For the same routing problem showing up in a different advocacy position, see [Your Best Customer Videos Are Sitting in a Folder](/blog/permissioned-ugc-sitting-unused-candle-brand/). If your About page has quietly been asked to cover for gaps like this one, [Your About Page Is Trying to Do the Whole Funnel's Job](/blog/storefront-about-carrying-whole-funnel/) is worth a read. And for a case where the fix everyone reaches for turns out to be the wrong touchpoint entirely, see [You're About to Fix the Wrong Part of Your Storefront](/blog/fixing-wrong-touchpoint-storefront/).

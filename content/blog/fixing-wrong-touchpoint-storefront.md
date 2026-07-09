---
title: You're About to Fix the Wrong Part of Your Storefront
description: A travel-gear founder is sure the About page is underperforming. run_funnel_audit finds the real weak link sits at a different touchpoint entirely.
date: 2026-02-20
category: Funnel
funnel: brand_store_about
tools: run_funnel_audit
keywords: run_funnel_audit amazon, weakest link funnel amazon, storefront about page audit, travel brand amazon storefront
slug: fixing-wrong-touchpoint-storefront
---

## The number that doesn't add up

Marco sells a car trunk organizer, and his repeat-purchase rate has been sliding for three months — not dramatically, but consistently, the kind of slow leak that's hard to trace to a single cause. He'd landed on a theory: the Storefront About page is too generic, doesn't explain the brand's actual difference, and needs a full rewrite. He'd blocked out a week to redo it, on gut instinct, before bringing it to the coach as a sanity check rather than a real question.

## Why rewriting the About page (probably) won't fix it

Here's the trap Marco was about to walk into: a slipping metric and a plausible-sounding cause don't mean the cause is correct. The About page felt like the obvious target because it's the piece Marco personally looks at most and has the most opinions about. That's a common bias — founders tend to suspect the touchpoint they're most emotionally invested in, not necessarily the one the data actually implicates.

A full week rewriting a page that isn't the problem doesn't just waste the week. It also means the actual weak link keeps leaking the entire time, untouched, because everyone's attention is pointed somewhere else.

There's a version of this mistake most founders have made at least once: something feels wrong, you pick the touchpoint you happen to be looking at that morning, and you commit real time to it before checking whether it's actually the right target. It's an understandable instinct — doing *something* feels better than sitting with an unsolved problem — but it's exactly the instinct that turns a one-week fix into a month of rewriting the wrong pages one at a time until something finally moves.

## The diagnosis lens: find the weakest link before touching anything

This is a funnel-position question, not a copywriting question, and it needs a different tool entirely. Rewriting a touchpoint on a hunch skips the step where you check that touchpoint against the *actual* customer avatar and against every other touchpoint in the funnel, to see which one is genuinely underperforming relative to what it's supposed to do. Without that comparison, "which page is weak" is just a guess wearing confidence.

## The working session

Marco brought the coach his plan to rewrite the About page and asked for a quick review before he committed the week to it. The coach asked a different question first: has this actually been checked against anything, or is it a hunch?

The coach ran `run_funnel_audit`, the per-avatar audit overlay that scores every touchpoint in the funnel against the real customer avatar and surfaces which one is actually the weakest link — not which one a founder suspects, which one the evidence points to.

> What the coach said: "Your About page scores fine for this avatar — it answers the questions your actual buyer has at that stage. Your weakest link is packaging and unboxing. Your avatar's biggest post-purchase worry is whether this thing actually fits their specific trunk, and nothing in your unboxing experience addresses that at all. That's where retention is leaking, not the storefront."

That was the opposite of Marco's plan. The About page — the thing he was ready to spend a week rewriting — turned out to be doing its job. The real gap was downstream, at a touchpoint he hadn't even considered checking, because it wasn't the one he happened to be looking at that morning.

## Why the About page can score fine and still feel wrong

Part of what made this hard for Marco to accept was that a "fine" score on the About page didn't match how he felt about it. He'd read it a hundred times and could always find another sentence to tighten. That's a founder's relationship with their own copy — there's always another edit available, which can feel like proof the page needs one. `run_funnel_audit` doesn't score against that standard. It scores against what the specific avatar at that specific funnel position actually needs answered, and by that standard, the About page had already cleared the bar. The remaining edits Marco wanted to make were preference, not diagnosis.

## Redirecting the fix to where it belongs

Marco cancelled the About page rewrite and redirected the week toward the actual weak link instead. That meant taking a hard look at [whether the unboxing experience was actually affecting repeat purchase](/blog/does-unboxing-experience-affect-repeat-purchase/) the way `run_funnel_audit` suggested, and checking whether an [insert card built for the wrong moment](/blog/one-insert-card-underperforms-for-one-avatar/) was quietly reinforcing the same gap instead of closing it. The same instinct — assuming the touchpoint you're staring at is the broken one — is exactly what leaves [a storefront's other sections uncovered while one page absorbs all the attention](/blog/storefront-about-carrying-whole-funnel/); a coverage gap and a misdiagnosed touchpoint look almost identical from the founder's chair, and both get solved the same way: check before you rewrite.

Marco also flagged something else the audit surfaced in passing — a [loyalty community touchpoint that simply didn't exist yet](/blog/loyalty-community-blind-spot-snack-brand/) further down the funnel, which he added to the list rather than the week's priority, since `run_funnel_audit` had already told him where the actual leak was.

If you're carrying your own hunch about which touchpoint is underperforming, the free [Trust Gap diagnostic](/diagnostic) is a fast way to sanity-check it before committing real time to a rewrite that might be aimed at the wrong page.

## What to measure after

Once the fix lands on the actual weak link, watch the metric it's actually supposed to move — for Marco, that's repeat-purchase rate over the following one to two purchase cycles, not storefront traffic or About-page engagement, since those were never broken. Give it enough time to cover at least one full replenishment window before judging. If repeat-purchase rate stabilizes, the audit found the right link. If it doesn't, run the audit again — a funnel can have more than one weak point, and fixing the first one sometimes exposes the next.

## The one next action

Before you rewrite the touchpoint you're most convinced is broken, run it against the rest of your funnel first. The one you're staring at is rarely the one the evidence actually points to.

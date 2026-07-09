---
title: Lapsed Customers Open Your Winback Emails But Don't Reorder
description: A pet-treats founder's winback sequence gets opens but no reorders. get_sequence_performance finds the break; identify_decision_trigger finds the missing lever.
date: 2026-05-08
category: Retention
funnel: winback_replenishment
tools: get_sequence_performance, identify_decision_trigger
keywords: winback email not converting, lapsed customer email sequence, reorder email amazon brand, fear of loss email copy
slug: winback-emails-opened-not-reordering
---

Priya checks her winback sequence's stats the way most founders check anything that's supposed to be quietly working in the background: rarely, and only when something else prompts her to. This month it was a Klaviyo digest email. Open rate on the winback flow for her freeze-dried liver treats: a healthy 38%. Reorder rate off the back of it: close enough to zero that she almost didn't trust the number. People are opening. Say two in five lapsed customers open the first email. Almost none of them buy again.

The instinct that follows is nearly universal — the email isn't converting, so sweeten the offer. Priya's draft fix was to bump the discount from 10% to 20% in email two and add a countdown timer to email three. It's the move everyone makes when a sequence "isn't working" and the metric everyone reaches for is open rate, because it's the easiest one to see. But open rate was never the problem here. Something is breaking downstream of the open, and no one had actually looked at where.

## Why the usual fix fails

A bigger discount treats "won't reorder" as a price objection. That's a reasonable guess if you have nothing else to go on, but it's a guess, and it's an expensive one — margin given away permanently to solve a problem that might not be about price at all. If the real issue is that the emails aren't making anyone *feel* anything about running out, no amount of percentage-off is going to fix that. You'll just be discounting your way toward the same flat number, one email at a time.

There's also a sequencing problem hiding in "the emails aren't converting." A winback flow usually has three to five sends. Treating it as one undifferentiated block means you can't tell whether people are dropping after email one, or opening every email and still not acting, or clicking through and abandoning at checkout. Those are three different fixes. Guessing which one you have is how you end up rewriting copy that was never the part that was broken.

## The diagnosis lens

This is a decision-trigger problem sitting behind a sequence-structure problem. Before touching language, you need to know *where* in the flow the drop happens — that's a funnel-mechanics question. Then you need to know *why* people who open aren't moving — that's a psychology question, and for most winback flows it comes down to one of six real levers: permission, recognition, identity, belonging, momentum, or fear of loss. Priya's copy was quietly assuming price was the lever. For a treat her dogs "genuinely go crazy for," it almost certainly isn't.

## The working session

Priya starts with `get_sequence_performance` on the winback flow itself, pulled apart by email, not blended into one number. The report shows something she hadn't noticed scrolling a single dashboard total: opens hold steady across all three emails, but clicks fall off a cliff after email one — say from a reasonable 9% click rate down to under 2% by email three. People aren't ignoring the sequence. They're reading it, deciding "not now," and not being given a reason strong enough to act sooner rather than eventually.

What the coach said, more or less: *"Your emails are getting read. That rules out subject lines and timing as the main problem. What you don't have is a reason for someone to reorder this week instead of next month — and a bigger discount doesn't create urgency, it just makes the eventual purchase cheaper."*

That's the reframe. The problem isn't that people won't reorder — it's that nothing in the sequence gives them a reason to reorder *now*, before the bag is actually empty and the dog is staring at them.

From there, Priya runs `identify_decision_trigger` against her winback audience and the product itself. The tool names fear_of_loss as the real lever — not fear for the dog's health in some dramatic sense, but the much smaller, much more real fear of running out of the one treat that reliably works for training or calming an anxious dog, and having to scramble for a substitute the dog won't touch. That's a completely different email than "here's 20% off."

The rewrite that comes out of the session doesn't touch the discount at all in email one. It opens with a version of "your last order was six weeks ago — most dogs finish a bag by week five" and lets the customer do the math on how close they probably are to empty. Email two keeps the same trigger and adds urgency that's earned rather than manufactured: a note that treats made from real ingredients don't get restocked in huge batches, so a lapsed order sometimes means waiting on the next run. Email three, the one that had been carrying the countdown timer, becomes the only place a modest discount shows up — framed as "so you're not stuck without them this week," not as a blanket price cut.

## What to measure

The number to watch isn't open rate, which was already fine and will probably stay fine. It's click-through by email position, matched against the reorder rate for the flow as a whole over the next full cycle of lapsed customers — not the first week, since winback timing means results trickle in over a month or more as different cohorts hit their lapse window. If click-through on email one climbs from that roughly 9% baseline and reorder rate moves up without a matching jump in redeemed-discount volume, that's the sign the trigger did the work instead of the price cut. If reorders only rise alongside heavier discount usage, the trigger call was wrong and it really was a price story — worth knowing either way, but better to know it from evidence than from a first guess.

## The next action

If a sequence gets opened and doesn't convert, don't reach for the discount lever first — pull `get_sequence_performance` broken out by email to find where people actually stop moving, then run `identify_decision_trigger` before you rewrite a single subject line. If you haven't run a full diagnosis on where your funnel is actually leaking, the free [diagnostic](/diagnostic) is a faster starting point than guessing at which email is the problem.

If your winback list itself might be mixing customers who were never going to reorder in with real repeat buyers, that's a related and often earlier problem covered in [your winback list is full of people who never meant to reorder](/blog/winback-list-includes-gift-buyers/). If text-only winback emails are the whole flow and you're wondering whether a short video could carry the trigger better, see [a winback video that reminds lapsed customers why](/blog/winback-video-reminding-lapsed-customers-why/). For the welcome side of this same "how many emails, in what order" question, [how many emails should a welcome series actually have](/blog/how-many-emails-welcome-series-amazon-brand/) and [your welcome email is missing a decision trigger](/blog/welcome-email-missing-decision-trigger/) cover the same structural mistake earlier in the customer lifecycle.

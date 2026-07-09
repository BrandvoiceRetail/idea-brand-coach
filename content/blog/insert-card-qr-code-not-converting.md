---
title: Your Insert Card QR Code Gets Scanned. Nobody Signs Up
description: A building-block toy founder's QR insert card gets scans but the list stays empty. get_funnel_piece_metrics and run_funnel_audit find the broken handoff.
date: 2026-05-18
category: Measure
funnel: insert_cards
tools: get_funnel_piece_metrics, run_funnel_audit
keywords: qr code insert card not converting, email signup from packaging insert, funnel coverage gap amazon, insert card to email list
slug: insert-card-qr-code-not-converting
---

Nadia sells building-block toy sets for kids, the kind parents buy in twos and threes as their kid ages into bigger sets. Every box has an insert card with a QR code — "scan for bonus building guides and 10% off your next set" — and she's had it in place for months. The Amazon side of the data looks encouraging: scan counts are decent and climbing slowly with volume, roughly in line with units shipped. Her email list, meanwhile, has barely grown at all over the same stretch. Two numbers that should move together are moving completely independently of each other, and that mismatch is the actual signal, not either number on its own.

The easy read is "the QR code isn't working" or "parents don't want another email." Both are plausible on their face. Neither one explains why people are scanning at a normal rate and then, apparently, vanishing.

## Why the usual fix fails

The instinct when a signup mechanism underperforms is to make the offer better — bigger discount, flashier bonus content, a clearer call to action on the card itself. That's a reasonable move if the card is the thing that's broken. But Nadia's data already shows the card is doing its job: it's getting picked up and scanned at a rate consistent with the boxes shipped. Rewriting the card's copy or sweetening its offer doesn't touch a problem that isn't sitting on the card. If the break is somewhere between the scan and the signup, no amount of card-copy polish will show up as more names on the list, because the people generating those scans never had a real path to becoming a name on the list in the first place.

This is the trap with any multi-step funnel piece: it's tempting to judge the whole thing by the metric you can see, which here is scans. The metric that actually matters — signups — lives one step further downstream, and a gap between the two means something in that one step is quietly eating conversions.

## The diagnosis lens

This is a funnel-coverage problem, not a card-design problem. The insert card is a single touchpoint feeding into another touchpoint, the welcome-series signup — and a scan-to-signup mismatch this large points at a broken handoff between the two, not a weak asset at either end. Before rewriting anything creative, the actual question is mechanical: where, specifically, does the number drop, and is anything even sitting there to catch it?

## The working session

Nadia starts with `get_funnel_piece_metrics` on the insert card itself, isolated from the rest of the funnel. The report confirms scan volume is healthy and holding steady relative to shipped units — the card, on its own metric, is performing exactly as expected. That rules out the card as the villain and narrows the search to whatever happens immediately after a scan.

From there she runs `run_funnel_audit` across the handoff from `insert_cards` into `welcome_series`, which checks coverage across the touchpoints an avatar is meant to move through rather than judging any single piece in isolation. The audit surfaces the actual gap: the QR code lands on a generic bonus-content page with no signup form on it at all — a leftover from an earlier version of the page that was supposed to be temporary and never got replaced. Scans register. Nobody ever sees a place to leave an email address, because there isn't one.

What the coach said, more or less: *"Your card isn't the problem and your offer isn't the problem. You have a step missing entirely — people are doing exactly what you asked, scanning the code, and then landing somewhere with no way to take the next step you actually wanted. This isn't a copywriting fix. It's a page that needs a form on it."*

That's the kind of gap that's invisible if you only ever look at each piece's own numbers — the card looks fine, and there was never a "signup form missing" metric to trip an alarm, because the form was never there to have a metric at all.

## What to measure

The immediate fix is mechanical — add an actual signup form to the landing page the QR code resolves to — but the number that proves it worked is scan-to-signup conversion specifically, not list growth in general, since list growth has other inputs too. Watch it over the same volume-adjusted window used to catch the original mismatch: if scan volume holds where it was and signup volume now tracks a meaningful fraction of it instead of sitting near zero, the handoff is repaired. If scans stay flat but signups still lag badly behind them, that points to a second issue on the page itself — friction in the form, unclear value, or a mismatch between what the card promised and what the page delivers — worth a second `run_funnel_audit` pass once the missing step is actually in place.

## The next action

If a touchpoint's own metric looks fine but the number one step downstream never moves, don't rewrite the touchpoint — pull `get_funnel_piece_metrics` on it in isolation first, then run `run_funnel_audit` across the handoff to the next stage before assuming the creative is the problem. If you don't know where your funnel actually has coverage gaps like this one, the free [diagnostic](/diagnostic) is a fast way to find out.

This same "test the decision, don't guess at the fix" discipline shows up in related measurement questions — see [is your ad selling identity when buyers want belonging](/blog/paid-social-identity-vs-belonging-trigger-test/), [should you actually invest in seo content this quarter](/blog/seo-content-investment-worth-it-test/), [stop guessing at bullet copy changes, test them instead](/blog/ab-testing-bullet-copy-without-guessing/), and [which trust element to test first](/blog/which-trust-element-to-test-first/) — four different funnel positions where a structured check beat a rewrite done on a hunch.

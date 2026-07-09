---
subject: The tool that reads your reviews for you
preview: 400 reviews, one recurring phrase, zero hours spent reading
week: 28
send: a
theme: tool_spotlight
funnel: displayed_reviews
tools: ingest_evidence, build_avatar_stage
---

A dog-joint-chew founder has 400 reviews sitting on her listing and has read maybe thirty of them, ever. Not from laziness — there's genuinely no time in a week to sit and mine that much text for patterns by hand.

Which means the most honest research she has about her customer, the reviews people wrote unprompted, in their own words, is basically unread. That's not a small gap. Reviews are the one place customers describe the product in language nobody at the company wrote for them.

`ingest_evidence` closes that gap without the reading marathon. Point it at the ASIN and it parses the actual review text straight in — no copy-paste, no summarizing by hand, no skimming the first page and assuming it's representative.

Once the reviews were in, `build_avatar_stage` did the part that actually matters: it pulled out the phrases that kept repeating, not just the star ratings. One line showed up again and again, in different words each time but the same underneath: "he's finally not limping on stairs." Not "improved mobility." Not "joint support." Limping. Stairs. Finally.

Here's the mini-lesson for `displayed_reviews`: the words your customers actually use are almost never the words on your listing, because your listing was written by someone describing the product, and the review was written by someone describing what changed in their house. `build_avatar_stage` turns that second kind of language into vocabulary the listing can borrow verbatim — not paraphrased into something more "on-brand," the actual phrase.

She hadn't written "limping on stairs" anywhere. Now she has a bullet that does.

If you've got reviews you've never properly mined, that's the one input sitting there unused right now. Run `ingest_evidence` by ASIN before you write another word of copy from a guess.

https://ideabrandcoach.com/diagnostic

— The IDEA Brand Coach team

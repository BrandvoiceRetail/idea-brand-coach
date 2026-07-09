---
subject: Her Trust Gap score, a year later
preview: The lift calculation found the one fix that actually moved it.
week: 46
send: a
theme: story
funnel: displayed_reviews
tools: run_trust_gap, compute_trust_gap_lift
---

Renata, a no-pull-harness founder we'll call her, ran `run_trust_gap` in January mostly out of curiosity. The score that came back wasn't the one she expected: Empathetic at 41, the lowest of her four pillars, sitting right at her displayed_reviews position.

Her listing had reviews. Plenty of them, star rating solid, nothing obviously wrong. The gap wasn't in whether the reviews existed — it was in whether they made a nervous new dog owner feel understood before reading a single line of copy.

She made two changes over the year, one at a time. First she swapped the hero image near the reviews for one showing the actual felt moment: a dog walking calmly past a distraction, owner's hand loose on the leash. Months later, she rewrote the review-response copy to acknowledge the specific worry buyers kept naming — not the harness's features, their dog pulling them into traffic.

She ran `run_trust_gap` again after the image swap, then once more in December after the copy went live.

`compute_trust_gap_lift` gave her two deltas instead of one guess. The felt-moment image accounted for nearly all the movement on Empathetic — the copy rewrite added almost nothing on top of it, though she'd assumed it was doing the heavier work all year.

That's the part worth sitting with. She'd have kept polishing review-response language into next year if she hadn't measured which fix actually earned the gap closing. The image did the work; the copy was along for the ride.

If you've made more than one change to a low-scoring pillar over time, you don't actually know which one worked until you isolate it. Run `run_trust_gap` now if you haven't checked lately, and when you retest later, use `compute_trust_gap_lift` to find out which specific fix earned the delta — before you spend another year improving the wrong one.

[Run the free diagnostic](https://ideabrandcoach.com/diagnostic)

— The IDEA Brand Coach team

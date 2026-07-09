---
subject: You missed the post-Prime-Day review window
preview: The review ask went out right on schedule. The schedule was wrong.
week: 37
send: a
theme: seasonal
funnel: review_request_flow
tools: get_sequence_performance, add_email_step
---

A loose-leaf-tea founder runs a review-request flow that's worked fine for a year: order confirmed, wait ten days, ask. Reliable, unremarkable, fine.

Except her Prime Day buyers aren't behaving like her normal buyers. They're three weeks past delivery now, and the review rate off that cohort is quietly worse than usual. Nothing broke. The flow fired exactly as built.

That's the trap with `review_request_flow`: it's tuned to one shape of buyer, and a surge event brings a different shape. A normal-week customer orders, gets it in three days, and is still curious when the ask lands on day ten. A Prime Day buyer got swept up in a deal, waited longer for shipping because everyone else was buying too, and by the time day ten rolls around the tea's just... tea. The emotional spike that made them buy has flattened into routine. You're asking someone to write about a moment that's already gone quiet in their head.

`get_sequence_performance` is what actually shows this — not a hunch, a number. Pull it and look at the ask campaign's own numbers for that window: opens usually hold steady while the conversion rate on the ask itself drops for that cohort specifically. The ask is landing on schedule and missing the moment.

The fix isn't a new sequence. It's `add_email_step` — one earlier touch inserted ahead of the existing ask, timed to when a Prime Day buyer actually opens the box, not when a normal-week buyer does. For a surge cohort that usually means pulling the ask forward by several days, sometimes replacing "leave a review" with something warmer first — a use-it-tonight nudge — before the ask itself arrives.

This week: pull `get_sequence_performance` on your own review flow and look specifically at anything shipped in the two weeks after Prime Day. If conversion dipped while opens held, you've got the same timing gap. `add_email_step` fixes it without touching anything else in the sequence.

The window for this cohort is closing. The one after Q4's rush won't be.

[Run the free diagnostic](https://ideabrandcoach.com/diagnostic)

— The IDEA Brand Coach team

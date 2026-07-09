---
subject: The checkout page nobody audits
preview: Every ad got torn down. The confirmation page never did.
week: 30
send: b
theme: teardown
funnel: cart_checkout_flow
tools: audit_asset, run_funnel_audit
---

Marcus, a resistance-band founder we'll call him, reviews every ad creative weekly. New hooks, new thumbnails, new angles — he's relentless about it. He had never once looked at his checkout confirmation copy.

Nobody does. It's the page you write once at launch and never open again, because nothing about it looks broken.

`audit_asset` scores one specific asset against your actual avatar, no full audit required. Pointed at just the cart_checkout_flow confirmation page, it came back weak — not broken, weak. The copy still spoke to the buyer Marcus had in mind two years ago: someone doing casual home workouts. Reassuring, friendly, low-stakes tone.

`run_funnel_audit` had already flagged who's actually buying now: someone training for a specific event, checking a box on a plan, not browsing casually. The confirmation page never mentioned the plan, the timeline, or what happens next toward that goal. It was still talking to a customer who'd moved on.

That mismatch is easy to miss because a confirmation page doesn't carry a CTR or a CVR to alert you. Nobody's watching a metric on the page you see after you've already paid.

The move: don't wait for a full funnel audit to catch this. Run `audit_asset` against whatever page in your funnel you haven't opened in over a year — checkout confirmation, shipping policy, order emails. Then cross-check it against whichever avatar `run_funnel_audit` says is actually converting right now.

The ad isn't always the leak. Sometimes it's the page right after the sale that's still talking to a customer you don't have anymore.

https://ideabrandcoach.com/diagnostic

— The IDEA Brand Coach team

---
subject: The abandonment spike before the drop
preview: It shows up every November, and it isn't browsing behavior. It's a date.
week: 42
send: b
theme: metric_deepdive
funnel: shipping_returns_policy
tools: ingest_funnel_analytics, get_funnel_piece_metrics
---

An insulated-bottle founder we'll call Priya watches cart abandonment climb every November like clockwork. Her read for two years running: "Q4 shoppers browse more, buy less. Everyone says so."

Maybe. Or maybe there's a specific day inside November doing all the damage, and "seasonal browsing" is just the label she reached for because the dashboard never showed her anything sharper.

This year she fed the season's data into `ingest_funnel_analytics` instead of eyeballing the monthly trend line. Then she ran `get_funnel_piece_metrics` on the touchpoints around checkout.

The spike wasn't a slow November drift. It was a cliff — one exact day, abandonment roughly doubling from the day before. That day lined up precisely with when her shipping cutoff messaging went from a clear date ("order by Dec 18 for Christmas delivery") to a vague one, because the copy had been written months earlier and nobody updated the countdown when the calendar moved.

Shoppers weren't browsing more. They were adding to cart, hitting a checkout page that could no longer tell them if their order would arrive in time, and leaving rather than risk a gift that shows up late.

"Seasonal behavior" was covering for a stale date field.

The lesson isn't specific to bottles or November. Any funnel position with a date, a countdown, or a cutoff needs to be checked against the actual calendar, not launched once and left. `get_funnel_piece_metrics` will show you the exact day it broke, if you feed it the data first.

Run the free diagnostic if you want the faster, first read on where your own funnel is likely leaking.

https://ideabrandcoach.com/diagnostic

— The IDEA Brand Coach team

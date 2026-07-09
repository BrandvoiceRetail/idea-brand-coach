---
subject: Your Prime Day buyers are going quiet
preview: A whole cohort is approaching the replenishment window with no sequence waiting.
week: 38
send: b
theme: seasonal
funnel: winback_replenishment
tools: create_email_sequence, get_sequence_performance
---

A bike-light founder has a normal `winback_replenishment` cadence built for a normal buying pattern — steady trickle of orders, steady trickle of replenishment reminders timed to when a light's battery is due to fade.

Prime Day didn't send a trickle. It sent a spike, all landing in the same few days. That spike is now about a month out from typical replenishment silence, and there's no sequence built for a spike — only for the trickle.

This is easy to miss because nothing's broken yet. The existing sequence is running fine on everyone it was designed for. It just wasn't designed for a cohort this size hitting the same window at once, which means when they go quiet, they'll go quiet together, and a founder watching the dashboard will see it as one cliff instead of the batch effect it actually is.

`create_email_sequence` stands up a cohort-specific version now, before the window opens — same winback logic, timed to when this specific batch of buyers is actually due, not whenever the generic sequence happens to fire next. Building it a month early instead of finding out the hard way is the entire point.

Then the proof comes later: `get_sequence_performance` won't have anything meaningful to say today, but by roughly week 44 it will show whether the timing actually caught this cohort before they went cold, or whether the gap was somewhere else — price, product fit, something the sequence can't fix by itself.

The action: if you had a Prime Day spike, don't wait for the dashboard to tell you replenishment quieted down. Build the sequence for that batch now with `create_email_sequence`, and put a reminder on your own calendar to check `get_sequence_performance` in a few weeks.

Silence you saw coming is a lot cheaper than silence you didn't.

[Run the free diagnostic](https://ideabrandcoach.com/diagnostic)

— The IDEA Brand Coach team

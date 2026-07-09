---
subject: How to Read a CTR Split Test Without Fooling Yourself
preview: Two days and a leaderboard aren't a result yet
week: 12
send: b
theme: metric_deepdive
funnel: amazon_main_image
tools: get_funnel_piece_metrics
---

An electrolyte-supplement founder ran a main-image split test and called it after two days. One variant was ahead on the leaderboard, so she picked it, killed the other, and moved on.

Two days of search traffic is noise dressed up as a result. CTR on a single image variant can swing wildly hour to hour depending on time of day, day of week, and who happened to search that particular term in that particular window. "Ahead right now" and "actually better" are different claims, and only one of them survives a bigger sample.

The mini-lesson: CTR lives at the amazon_main_image position specifically, which means it needs its own read, separate from CVR and separate from vibes. `get_funnel_piece_metrics` splits your funnel numbers out by position, so instead of one blended "conversion" figure, you see the actual click-through data for that image slot — and enough of it to know whether a gap is real or just this week's weather.

The concrete action: before you call any main-image test, pull the metrics for that specific piece and check the sample size behind the number you're staring at, not just which bar is taller. If the gap is small and the sample is thin, that's not a losing variant yet — it's an unfinished test.

The same discipline applies whenever you're tempted to end a test early because one version is "clearly winning." Clearly winning on day two and clearly winning on day ten are not the same claim, and only the second one is safe to act on.

Run the free diagnostic if you want the fuller picture of where else in your funnel a number might be lying to you.

— The IDEA Brand Coach team

https://ideabrandcoach.com/diagnostic

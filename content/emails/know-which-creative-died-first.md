---
subject: Know which creative died first
preview: A blended ROAS number hides exactly the thing you need to see
week: 36
send: b
theme: tool_spotlight
funnel: paid_social_creative
tools: ingest_content_performance, get_funnel_piece_metrics
---

A packing-cube founder ran four ad variants for Prime Day. When the dust settled, she knew one number: blended ROAS across all four, combined.

That number told her the campaign, overall, did fine. It told her nothing about which of the four creatives was carrying it and which one was quietly dragging it down. Blended numbers are good at hiding exactly the thing you need to see next.

`ingest_content_performance` feeds the per-asset numbers in — each variant's own CTR, its own engagement, its own decay curve, not folded into an average with the other three. `get_funnel_piece_metrics` then shows those numbers at the paid_social_creative position specifically, side by side, so you can see which single creative's CTR cratered first instead of guessing from a combined trend line.

For her, it wasn't the ad that "felt" weakest. It was the one with the best opening week — it peaked fast and fell off a cliff by week three, while a slower, steadier variant was still holding CTR at week five. The blended ROAS never showed that shape. It just averaged a spike and a slow burn into one unremarkable line.

This matters most right after a seasonal push, when you're deciding where the refresh budget goes. Refresh the wrong creative — the one that just happens to feel most associated with the campaign — and you spend money fixing something that was never broken while the actual dead asset keeps running.

The action: next time a multi-variant push wraps, run `ingest_content_performance` on all of them, then pull `get_funnel_piece_metrics` for paid_social_creative before you decide what gets refreshed. Fix the asset the data killed, not the one memory blames.

Run the free diagnostic for a broader read on where else a blended number might be hiding a real gap.

— The IDEA Brand Coach team

https://ideabrandcoach.com/diagnostic

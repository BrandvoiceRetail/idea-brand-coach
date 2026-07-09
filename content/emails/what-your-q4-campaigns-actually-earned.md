---
subject: What your Q4 campaigns actually earned
preview: Seller Central gives you one number. You ran six campaigns.
week: 45
send: a
theme: metric_deepdive
funnel: paid_social_creative
tools: ingest_campaign_analytics, get_campaign_metrics
---

A glass-meal-prep-container founder ran six different Q4 campaigns across paid_social_creative this quarter — a founder-story angle, a meal-prep-Sunday UGC set, a comparison-to-plastic ad, three retargeting variants. Seller Central hands her back one blended attributed-sales number for the whole period.

That number is real. It's also useless for deciding what to do in January.

A blended number can't tell you the founder-story angle carried half the quarter while the comparison ad quietly lost money the whole time, hidden inside an average that looked fine. Averages are good at reassurance and bad at decisions — they tell you the quarter was okay, not which specific campaign earned that.

`ingest_campaign_analytics` pulls the real per-campaign spend and results out of wherever they're actually sitting, not the rolled-up Seller Central view. `get_campaign_metrics` then splits that back out by campaign, so instead of one number for the quarter you get six, each attached to the actual creative that earned or lost it.

This matters most right now because January budgets get set off Q4 performance, and most founders set them off the feeling of the quarter rather than the campaign-level truth. "Q4 was decent" becomes "keep doing roughly what we did" — which means the comparison ad that lost money quietly gets funded again, and the founder-story angle that actually worked doesn't get the extra budget it earned.

The action: before you set January's ad plan, run `ingest_campaign_analytics` on all six Q4 campaigns and pull `get_campaign_metrics` for each. Rank them. Keep what earned it, kill what didn't, and give the winner the budget the loser was taking.

The blended number told you the quarter was fine. The per-campaign read tells you why — and what to do differently in January.

[Run the free diagnostic](https://ideabrandcoach.com/diagnostic)

— The IDEA Brand Coach team

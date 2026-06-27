-- Widen campaign_metrics.metric_name to cover the NON-DERIVABLE metrics the approved set +
-- the funnel-by-job mockup show but the original 13-value vocab was missing. Windsor returns
-- these directly; they need real storage slots (they cannot be computed from other metrics):
--   new_to_brand  — NTB fraction 0–1
--   repeat_rate   — repeat-purchase fraction 0–1
--   return_rate   — returns fraction 0–1
--   units_sold    — count
--   subscribe_save— Subscribe & Save count
--
-- DERIVABLE metrics (acos = spend/revenue, roas = revenue/spend, cpc = spend/clicks) are NOT
-- stored — they are computed at read-time in getFunnelPieceMetrics (like cvr/aov). TACoS is
-- skipped: it needs total revenue incl. organic, which we don't have per piece.
--
-- Additive + reversible: DROP the existing CHECK and re-ADD it with the original 13 values
-- PLUS the 5 new ones. No data migration; existing rows already satisfy the wider constraint.
--
-- DO NOT apply to prod from this worktree.

alter table public.campaign_metrics
  drop constraint if exists campaign_metrics_metric_name_check;
alter table public.campaign_metrics
  add constraint campaign_metrics_metric_name_check
    check (metric_name in (
      'impressions','sessions','clicks','opens','ctr','cvr','aov','spend',
      'orders','revenue','engagement','calls_booked','views',
      -- new non-derivable metrics (Windsor-sourced; rate metrics are fractions 0–1)
      'new_to_brand','repeat_rate','return_rate','units_sold','subscribe_save'));

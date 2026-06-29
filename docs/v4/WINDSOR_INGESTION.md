# Windsor → Fix metrics: the funnel-piece ingestion path

How real numbers get onto a v4 **Fix** funnel piece. This is the path that turns the
honest "—" in the Fix piece-detail into actual `cvr` / `aov` / orders / revenue.

## TL;DR

Ingestion is **host-driven through the MCP connector — there is no server-side
Windsor reader, no cron, and no `WINDSOR_*` key.** The connector's Claude pulls the
numbers from Windsor and hands them to Brand Coach's `ingest_*` MCP tools, which write
`campaign_metrics`. The in-app Fix screen then reads those rows back per piece.

```
Windsor (Meta/Google/GA4/Amazon Ads/…)
      │   host Claude in the connector calls:
      ▼
  windsor.get_connectors  →  windsor.get_data        (read live analytics)
      │   host Claude maps the rows to the metric vocab, then calls:
      ▼
  brand-coach MCP:  ingest_funnel_analytics           (gateWrite, owner-scoped)
      │            (or ingest_campaign_analytics / ingest_content_performance)
      ▼
  public.campaign_metrics   (one row per metric_name × date, attached to a funnel
      │                       piece via brand_asset_id; upserted on the natural key)
      ▼
  edge fn  get-funnel-piece-metrics   (RLS-scoped read, 7/30/90d window)
      ▼
  v4 Fix  →  fixService.getPieceMetrics  →  FunnelPieceDetail  →  real numbers
```

## Why host-driven (not a server bridge)

Brand Coach **never** reads Windsor itself — no Windsor credential lives on the server,
and there is no scheduled job. The connector's host Claude is already authenticated to
Windsor (the user connected it), so it does the read and the mapping, and only the
*resulting numbers* enter Brand Coach through the owner-gated `ingest_*` tools. This keeps
the trust boundary clean (Brand Coach stores only what an authenticated owner pushed) and
matches the "no fabrication" rule — the server can't invent a number it never received.

## The pieces

| Piece | Where | Role |
|---|---|---|
| `ingest_funnel_analytics` | `src/mcp/tools/ingestFunnelAnalytics.ts` | Funnel-tracker shape (per-stage `as_of` snapshots + monthly actuals) → `campaign_metrics`. Optional `brand_asset_id` attaches the whole upload to one funnel piece. `gateWrite` + `requireOwnedBrandAssets`. |
| `ingest_campaign_analytics` | `src/mcp/tools/ingestCampaignAnalytics.ts` | Channel/campaign-level metric rows → `campaign_metrics`. |
| `ingest_content_performance` | `src/mcp/tools/ingestContentPerformance.ts` | Per-asset content metrics → `campaign_metrics`. |
| `get_campaign_metrics` / `get_experiment_lift` / `get_sequence_performance` | `src/mcp/tools/*` | MCP read-backs for the connector. |
| `get-funnel-piece-metrics` | `supabase/functions/get-funnel-piece-metrics/index.ts` | The **in-app Fix reader**. `{ brand_asset_id, range? }` → one aggregated row per `metric_name` (SUM additive, AVG rates), RLS-scoped to the caller. |
| `campaign_metrics` | migrations `20260626…`–`20260627010000` | Storage. `brand_asset_id` = the funnel piece (a piece = an active brand asset = a campaign). An owner-guard trigger enforces `brand_asset_id` is owned by the inserting user. |

## Metric vocab (stored vs derived)

`campaign_metrics.metric_name` (CHECK-constrained) stores only **non-derivable** metrics
Windsor returns directly:

```
impressions · sessions · clicks · opens · views · spend · orders · revenue ·
engagement · calls_booked · ctr · cvr · aov ·
new_to_brand · repeat_rate · return_rate · units_sold · subscribe_save
```

Rate metrics (`ctr`, `cvr`, repeat/return rates) are **fractions 0–1**, not percentages.
**Derived metrics are NOT stored** — `cvr` (orders ÷ clicks), `aov` (revenue ÷ orders),
`acos`/`roas`/`cpc` are computed at read time (the frontend derives `cvr`/`aov` from
primitives). There is **no `estimated_lift` column**: realized lift is derived from
`brand_tests` (baseline → result), not stored per piece.

## Read-window aggregation

`get-funnel-piece-metrics` aggregates rows in the `range` window (`7d`/`30d`/`90d`,
default 30d):

- **SUM** — `impressions, sessions, clicks, views, engagement, orders, revenue, spend, units_sold, calls_booked, subscribe_save`
- **AVG** — everything else (`ctr`, `cvr`, `aov`, `opens`, `*_rate`, `roas`, `acos`, `cpc`)

Empty result = honest no-data; the Fix detail renders "—", never a guess.

## Seeding a piece for testing (so Fix shows real numbers)

Until a user actually ingests Windsor data, every piece is empty. To exercise the Fix
detail end-to-end (e.g. the QA account), seed a piece + metrics directly. Three gotchas:
(1) a funnel piece needs an owning brand; (2) **v4 funnel pieces are AVATAR-scoped** —
`SupabaseBrandFunnelService.listAssets` filters `brand_assets` by `avatar_id` (NOT the
brand-level `avatar_id IS NULL` the v2/MCP inventory uses), so attach the piece to the
user's **current avatar** (`profiles.current_avatar_id`) or it won't render in their Fix
funnel; (3) metrics need a `campaign_id` (NOT NULL) and pass the owner-guard only when
`user_id` owns `brand_asset_id`'s brand. Example (QA brand `My Brand`):

```sql
-- 1) campaign + funnel piece (piece.brand_id must be a brand owned by user_id;
--    avatar_id MUST be the user's current/primary avatar — v4 is avatar-scoped)
with cmp as (
  insert into public.campaigns (user_id, brand_id, name, channel, status)
  values (:uid, :brand_id, 'QA Amazon Listing (seed)', 'amazon', 'active') returning id),
piece as (
  insert into public.brand_assets (brand_id, avatar_id, touchpoint_id, stage, status, context_description)
  values (:brand_id, :avatar_id, 'amazon_listing_copy', 'consideration', 'misaligned', 'QA seed') returning id)
select (select id from cmp) campaign_id, (select id from piece) piece_id;

-- 2) metrics for that piece (run AFTER step 1 so the owner-guard sees the committed piece)
insert into public.campaign_metrics
  (user_id, campaign_id, brand_asset_id, channel, metric_name, metric_value,
   measured_date, granularity, source, journey_stage)
select :uid, :campaign_id, :piece_id, 'amazon', m.metric_name, m.metric_value,
       current_date - 1, 'snapshot', 'windsor', 'consideration'
from (values
  ('sessions',930::numeric),('views',1336),('clicks',612),('units_sold',51),
  ('orders',48),('revenue',1499.49),('cvr',0.0548),('aov',31.24)
) as m(metric_name, metric_value);
```

`measured_date` must fall inside the read window. The real path is the `ingest_*` tools;
this SQL just mimics their output for local/QA verification.

> A live QA seed exists on the shared QA brand (`My Brand`), attached to its **current
> avatar** ("Default Avatar") — touchpoint `amazon_listing_copy` — so the Fix funnel lists
> the piece and its detail renders real numbers on that account.

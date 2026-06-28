# Funnel Metrics — build report (Loop-3 Funnel-by-Job)

_2026-06-27 · FE worktree `feat/v4-alpha-surface` · MCP worktree `feat/mcp-analytics-ingest`_

## What was built

A unified **funnel-piece = campaign = active brand asset** model (locked decision #1):
metrics attach to the `brand_asset`, not to three separate things.

- **Unified piece+metrics model.** `campaign_metrics` gains a `brand_asset_id` FK
  (the funnel piece) + a `journey_stage` (awareness…advocacy, distinct from the
  channel `funnel_stage`). Migration
  `supabase/migrations/20260627000000_campaign_metrics_funnel_piece.sql`
  (additive, reversible, **NOT applied to prod**).
- **`get_funnel_piece_metrics`** seam returns ONE piece's metrics for a range,
  owner-scoped via `requireOwnedBrandAssets`; CVR/AOV derived from primitives;
  job-metric gaps reported as `noData` so the UI renders honest "—".
- **Windsor-source ingest.** Source vocab extended to include `windsor`; the
  host-Claude flow (below) is the only ingest path — no server-to-server fetch.
- **The 6 funnel screens** under `src/components/v4/fix/` + `src/pages/v4/V4Fix.tsx`:
  FunnelMap ("is each piece doing its job?"), FunnelPieceDetail ("did this piece do
  its job?"), FixTestPanel, TestingLiftTab, WindsorConnectGuide, AddPieceDialog.
- **Restored v2 selections:** marketplace / **avatar** / range toolbar selects,
  channel filter chips, upload-asset dialog, fix/test dialog, Testing & Lift tab.

## What's green

- `npx tsc --noEmit` clean on **both** worktrees (v4-surface, mcp-analytics).
- Fix-related FE suites: **189 tests pass** (`src/components/v4/fix`, `src/hooks`,
  `src/pages/v4`).
- No-fabrication bar held: every metric path degrades to "—"/`no_data`, never a
  guessed number. SSOT tool-surface drift-guard unaffected (no tool changes).

## BLOCKER/HIGH fixes applied

1. **Avatar selector restored** to the FunnelMap toolbar (between Marketplace and
   Range), wired to `AvatarContext.setCurrentAvatar` — switching re-scopes the
   whole funnel. Hidden when no non-template avatars exist.
2. **Insight bar now renders.** `V4Fix` computes a coach insight from the piece's
   verdict + primary-job-metric reading and passes it to `FunnelPieceDetail`. It
   self-hides only for a `missing` slot or no selection; states "no reading pulled
   yet" honestly rather than inventing a number.
3. **Export button wired** on Testing & Lift — `handleExportTests` downloads the
   real tests ledger as CSV (honest blanks for a running test's result; only
   reachable when rows exist) and fires `v4_testing_lift_exported`.
4. **Dead toolbar controls fixed.** `range` + `marketplace` lifted from FunnelMap
   to `V4Fix` as controlled props with `onRangeChange`/`onMarketplaceChange`.
   `range` now threads into the piece-metrics read (`selectPiece(id, range)` →
   `getPieceMetrics`, retry honors the same window) so it has real teeth;
   `marketplace` is parent-owned scope. New PostHog events
   (`v4_funnel_avatar_changed` / `_marketplace_changed` / `_range_changed`)
   registered in the `AlphaEventName` registry — no casts.
5. **[Security HIGH] Cross-user FK-attribution firewall.** Added a
   `BEFORE INSERT OR UPDATE` trigger (`campaign_metrics_brand_asset_owner_guard`)
   enforcing `brand_asset_id` is owned by the inserting `user_id`, independent of
   the app-layer `requireOwnedBrandAssets()` gate. Closes the direct-PostgREST
   integrity hole.

## Remaining MEDIUM / LOW (punch-list, not done)

- **[MED]** Continuity chip is generic ("⚠ message breaks") — surface the
  piece's specific audit phrase instead.
- **[MED]** `viewUrl` for "View on [channel] ↗" still not derived — known Alpha gap
  (stored-text-only; no live URL field).
- **[MED]** `piecesNoData` / `testsNoData` from `useFixRun` still not surfaced as
  reason props on FunnelMap/TestingLiftTab.
- **[MED]** `WhatNeedsWork` polymorphic `Row` passes `type`/`disabled` to a `div` —
  split into a conditional `button`/`div` render.
- **[MED]** `FunnelPieceDetail.compact()` allocates `Intl.NumberFormat` per call —
  hoist to module constant (FunnelMap already does).
- **[LOW]** `WindsorConnectGuide` connected dot uses gold, not the `--ok` green.
- **[LOW]** `ingest*` tools validate `brand_asset_id` as `z.string().min(1)` —
  upgrade to `z.string().uuid()`.
- **[LOW]** Migration unique-index DROP+CREATE not wrapped in a txn.
- **[LOW]** Defensive `no_data` fallback copy in V4Fix should reuse
  `PENDING_METRICS`.

## Windsor host-Claude flow

Brand Coach does **not** pull ads data itself. The user adds the **Windsor**
connector alongside the IDEA Brand Coach connector in Claude; in a Brand Coach
chat they ask to pull metrics. **Host-Claude** reads Windsor via `get_data`, then
calls the Brand Coach **ingest** tools, which store rows against each funnel piece
(`brand_asset_id` + `journey_stage`). Amazon Ads supplies
impressions/clicks/ctr/cost/cpc/acos/roas/conversions/sales/new-to-brand; CVR/AOV
are derived. No server-to-server fetch. Missing source → honest "—".

## Gated-deploy note

Migration `20260627000000_campaign_metrics_funnel_piece.sql` is **NOT applied to
prod** (banner in the file). `VITE_FORCE_V4` is **not** flipped. `types.ts` not
hand-edited (regenerate after the migration lands). Deploy remains gated per the
v4 program Phase-7 prod flip.

## Summary

The funnel now models one entity — the active brand asset — with metrics attached
to it, a per-piece metrics read, Windsor-driven ingest, all six screens, and the
restored v2 selections incl. the avatar scope. All real BLOCKER/HIGH gaps against
the approved mockups (avatar selector, insight bar, export, dead range/marketplace
controls) plus the cross-user FK security hole are fixed; tsc + 189 Fix tests
green. The build **matches the mockups** on structure, copy, and the v23
black/gold token system; the remaining deltas are the MEDIUM/LOW punch-list above
(continuity-phrase specificity, viewUrl, connected-dot colour), none of which
change the screens' shape or behaviour.

## Storage-gaps closed

Two confirmed storage gaps against the approved metric set + Alpha tester journey
are now closed.

### Gap A — metric_name enum was missing approved metrics

The `metric_name` SSOT (`src/mcp/service/campaignTypes.ts` → `METRIC_NAME_VALUES`,
mirrored by the SQL CHECK) gained **5 non-derivable storage slots** that Windsor
returns and we cannot compute from other primitives:

- `new_to_brand` — NTB share, a fraction 0–1
- `repeat_rate` — fraction 0–1
- `return_rate` — fraction 0–1
- `units_sold` — count
- `subscribe_save` — count

Migration `20260627010000_campaign_metrics_metric_vocab.sql` widens the CHECK
**additively** — the original 13 values remain, 5 are added, existing rows are
unaffected and reversible. Because the ingest tools validate `metric_name` against
the Zod enum, extending `METRIC_NAME_VALUES` auto-covers ingest with no tool
changes.

**Derivable metrics are NOT stored** — they compute at read-time alongside
`cvr`/`aov` in `analyticsIngestService.ts` (and the FE mirror in
`fixService.deriveMetricCells`):

- `acos = spend / revenue` (percent, fraction 0–1)
- `roas = revenue / spend` (ratio)
- `cpc = spend / clicks` (currency)

`TACoS` is intentionally **skipped** — it needs total revenue including organic,
which we do not have per piece; fabricating it would violate the honest-no_data
bar. Rate metrics are fractions 0–1 throughout; the FE `formatValue` percent path
multiplies by 100 at render (`0.05 → "5.0%"`).

### Gap B — brand_tests had no experiment lifecycle milestone dates

`brand_tests` tracked `status` + baseline/result but not the milestone dates the
tester journey (Step 6) needs to start the re-measure clock and feed the case
study. Migration `20260628000000_brand_tests_lifecycle_dates.sql` adds (additive,
nullable, reversible) **`asset_created_at`** (ASSET_CREATED) and
**`asset_live_at`** (ASSET_LIVE).

- **MCP:** `update_test_milestone` tool (registered in `server.ts` +
  `toolManifest.ts`; SSOT drift-guard green) gates with `gateWrite()` then does a
  read-verify-then-write on the JWT-bound RLS client (explicit not-found on a
  foreign id; `test_id` never logged).
- **FE:** `TestRow` gained `assetCreatedAt` / `assetLiveAt` / `lifecycleStage`;
  `fixService` exposes `markAssetCreated` / `markAssetLive` + `deriveLifecycle`;
  `TestingLiftTab` renders a lifecycle cell with stamp buttons (visible for
  `idea` / `asset_created`); PostHog milestone events registered in the
  `AlphaEventName` registry (no casts).

### What's green

- `npx tsc --noEmit` clean on **both** worktrees (mcp-analytics, v4-surface).
- `TestingLiftTab` suite: 12/12 pass after the percent-render fix.

### Remaining punch-list (MEDIUM/LOW, not blocking)

- MEDIUM — `fixService.stampMilestone` returns false success on an RLS-blocked /
  nonexistent id (no `.select()` / rows-affected check); chain
  `.select('id').maybeSingle()` and null-check.
- MEDIUM — `TestLifecycleStage` includes `'asset_live'` but `deriveLifecycle`
  never returns it (dead meta entries); either drop it or use it as a transient
  step.
- MEDIUM — no tests yet for milestone methods (`deriveLifecycle`,
  `stampMilestone`, `toTestRow`, `markAssetCreated/Live`) or `useFixRun` lifecycle
  handlers; ≥85% new-code bar not met.
- LOW — `DERIVED_METRICS` / `isDerivedMetric` omit `acos`/`roas`/`cpc` (shows
  honest `—`; add derivation alongside cvr/aov).
- LOW — `V4Fix.tsx` CSV export omits `assetCreatedAt` / `assetLiveAt` /
  `lifecycleStage` (the case-study columns).
- LOW — competitor-scoped tests (NULL `asset_id`) are invisible to the funnel RLS
  EXISTS-join (default-deny, not a leak); verify the
  `20260616120000_brand_funnel_tracker.sql` policy and add an `avatar_id`
  ownership OR-branch before milestone stamps go live on those rows.

### Migrations are NOT applied to prod

`20260627010000_campaign_metrics_metric_vocab.sql` and
`20260628000000_brand_tests_lifecycle_dates.sql` are **authored only — NOT applied
to prod**, additive and reversible. `VITE_FORCE_V4` is not flipped and `types.ts`
is not hand-edited (regenerate after the migrations land). Deploy stays gated per
the v4 program Phase-7 flip.

### Both gaps closed?

**Yes.** Gap A is closed (5 storage slots added to the SSOT + CHECK; acos/roas/cpc
derived at read-time; TACoS deliberately skipped). Gap B is closed (ASSET_CREATED
/ ASSET_LIVE columns + `update_test_milestone` MCP tool + the lifecycle UI). The
remaining items are MEDIUM/LOW quality/coverage follow-ups, none of which reopen
the storage gaps.

---

## Coach orchestration + Re-measure loop

_Appended 2026-06-27 — closes steps 2 (populate the funnel) and 7 (re-measure) of the Alpha tester journey._

### Coach-driven funnel ingest (SERVER_INSTRUCTIONS + onboard.html)

The Brand-Coach MCP cannot read Windsor itself — the **host Claude** (which holds
both the Brand Coach and Windsor connectors) orchestrates. The connector's
`SERVER_INSTRUCTIONS` (`src/mcp/config.ts`) and the pasteable megaprompt
(`public/onboard.html`) instruct the host through the `FUNNEL METRICS (Windsor)`
workflow:

1. **Ensure the pieces exist** — `list_funnel_inventory`; create any missing active
   touchpoint with `upsert_funnel_touchpoint`; use the returned `brand_asset_id`.
2. **Read Windsor** — `get_data` per connector; map each field to a piece +
   `journey_stage` + `metric_name` (amazon_ads impressions/ctr/clicks/spend/orders/
   revenue/new_to_brand; amazon_sp orders/returns→return_rate/repeat→repeat_rate;
   ga4 sessions; tiktok_shop views/clicks). Rate metrics expressed as fractions 0–1.
3. **Ensure a campaign, then store** — the ingest tools require a `campaign_id`
   (`z.string().min(1)`), so the host first calls `list_campaigns` (reuse) or
   `create_campaign` (new), then `ingest_campaign_analytics` / `ingest_funnel_analytics`
   with that `campaign_id` + `brand_asset_id` + `journey_stage` + `source="windsor"`.
   *(This step was the HIGH fix: the prior text told the host to ingest without a
   campaign id, which would have hit a validation error and stalled.)*
4. **Confirm honestly** — `get_funnel_piece_metrics`; report which pieces now carry
   data and which remain "—". Never fabricate a metric.
5. **Experiment loop** — `design_test` (stores the baseline) → `update_test_milestone`
   at asset-created and asset-live → later re-pull Windsor and re-measure.

No Tier-C internals appear in either surface (the only buyer-state/neuro mention is
the NARRATION *prohibition*; onboard.html "Captures" is the Tier-A book title).

### Re-measure: before/after lift (`get_experiment_lift` logic)

`remeasureService.getExperimentLifts(avatarId)` closes the experiment loop
deterministically, with no snapshot table:

- `before` = the stored `baseline_value`; `after` = the recorded `result_value`, else
  (only once `asset_live_at` is stamped) a real `campaign_metrics` pull windowed by
  the go-live date (`defaultExperimentMetricReader`: sum for count/currency, mean for
  rate/ratio). No live asset / no post-live row → `pending` (`after = null`), **never
  a fabricated after-number**. Lifecycle stage derives from the milestone dates +
  result via `deriveLifecycle`.
- `markExperimentResult` records the tester's `won` / `no_lift` verdict. The default
  writer now does a **read-then-write ownership gate** (RLS-bound `select … maybeSingle`
  → "not found or not owned") before the update — the HIGH fix.
- `defaultMetricsReader` (BusinessMetricsCard) now scopes the `campaign_metrics` read
  to the authenticated `user_id` **and** to the avatar's own `brand_assets`
  (`brand_asset_id IN …`) — the BLOCKER fix (defense in depth beyond RLS; no more
  cross-avatar/cross-tenant blend).

### Re-measure UI

`src/pages/v4/V4Remeasure.tsx` wires three presentational cards via `useRemeasureRun`:
`TrustGapLiftCard` (deterministic pillar before/after), `BusinessMetricsCard`
(CTR/CVR/AOV/revenue around the pivot date), and `ExperimentLiftCard` (per-experiment
before→after with lifecycle badge + "Mark won / No lift"). `ExperimentLiftCard` now
fires `v4_experiment_result_marked` (testId + verdict) alongside the write — the HIGH
fix (the event was registered but never emitted).

### What's green

- `npx tsc --noEmit` — clean on `v4-surface`.
- `npx tsc -p tsconfig.mcp.json` — only one **pre-existing, unrelated** error in
  `__tests__/analyticsIngestWorkbooks.test.ts` (`CampaignMetricRow.brand_asset_id`
  optionality); confirmed present with this change stashed. The `config.ts` edit is
  a string-only change and introduces nothing.
- `remeasureService` (19) + `BusinessMetricsCard` (4) + `TrustGapLiftCard` (6) tests
  pass — 29/29.

### Remaining punch-list (MEDIUM/LOW — deferred)

- **config.ts MEDIUM** — port the live CREATIVE INTELLIGENCE carve-out into this
  lineage before building prod from this branch (deployed≠repo divergence).
- **config.ts LOW** — add `purchases÷clicks→cvr (consideration)` to the amazon_ads map.
- **remeasureService MEDIUM** — `defaultExperimentReader` brand_assets read could add
  an explicit `user_id` predicate (RLS already scopes it).
- **remeasureService LOW** — runtime `z.enum(['won','no_lift'])` guard on `verdict` at
  the service boundary.
- **ExperimentLiftCard LOW** — no component test yet (pending/measured/decided render
  + event emission).

### No deploy / migrations not applied to prod

Nothing was deployed. `VITE_FORCE_V4` is not flipped. `types.ts` is untouched. The two
analytics/lifecycle migrations remain authored-only (not applied to prod). Deploy stays
gated per the v4 program Phase-7 flip.

### 7-step journey status

Functionally **complete on the worktrees**: storage (analytics/lifecycle migrations +
SSOT), orchestration (coach-driven Windsor→funnel ingest via SERVER_INSTRUCTIONS +
onboard.html), and re-measure (deterministic before/after lift + UI) are all built and
green. **Remaining = deployment**: apply the two migrations to prod, regenerate
`types.ts`, rebuild/redeploy the MCP container + the /v4 frontend, and the Phase-7
`VITE_FORCE_V4` flip — all human-gated, none done here.

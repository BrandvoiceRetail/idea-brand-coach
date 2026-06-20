# Competitor-Agents — Long-Term Scaffolding (P8)

_v1 2026-06-17. Worktree `feat/competitor-agents`. Companion to `COMPETITOR_AGENTS_PLAN.md` (§4 Track D)
and `_BUILD_MANIFEST.md`. This is the **P8 deliverable: specs + tracked TODO markers, NOT full code.**
Each long-term (LT) item names the **exact extension point** in the P1–P7 code and carries a concise
`// TODO(competitor-agents:LT-x)` marker placed at that point. No prod actions; no new runtime code paths._

## What P1–P7 already built (the substrate these LTs extend)

| Layer | Artifact | LTs that extend it |
|---|---|---|
| Edge analyzer | `supabase/functions/competitor-analysis-asset/{index,lib}.ts` (Sonnet 4.6, grounded, `routeModality` switch, VoC mine) | LT-1, LT-2 |
| Lift loop | `supabase/functions/funnel-rewrite/`, migration `20260618000100_brand_tests.sql` (`competitor_insight_applied`) | LT-5 |
| Insights store | migration `…_brand_asset_competitive_insights.sql` (+ `voc_signals` jsonb) | LT-2, LT-3, LT-5 |
| Brand Defense | `supabase/functions/brand-defense-monitor/{index,lib}.ts` (`IAlertSource`, STUB Titan, `INotificationChannel`) | LT-2 |
| Service / hook | `src/services/SupabaseCompetitorInsightsService.ts`, `src/hooks/useCompetitorInsights.ts` | LT-2 |
| UI | `src/components/v2/funnel/{TouchpointCompetitorAgentPanel,CompetitorGapsAggregate,TestingLiftTab,BrandDefenseAlertsPanel}.tsx` | LT-1, LT-5 |
| Workbooks | `src/mcp/service/workbook/{assembleWorkbookA,assembleWorkbookB}.ts` | LT-3 |
| MCP gateway | `src/mcp/tools/writeAuth.ts` (`gateWrite`/`actorTag`, D5 seam) | LT-4 |
| Flag | `src/config/features.ts` (`isCompetitorAgentsEnabled`) | LT-6 |

Grounding gate (applies to ALL LTs): never fabricate competitors, prices, IDEA scores, or quotes —
every claim anchors to a fetched/uploaded evidence item (`source_ref` / `evidence_refs`) or is flagged
`grounding:'inference'`. The substring/clamp/`needs_input` guards in `lib.ts` are the enforcement points
and must be reused verbatim by every new modality and tool.

---

## LT-1 — Full 26-touchpoint modality coverage

**Now:** 3 of 7 modalities are wired — `marketplace-listing` (DataForSEO), `web/store-copy`
(Firecrawl URL-fetch), `reviews/social-proof` (DataForSEO reviews + Firecrawl + Haiku VoC mine).
The other 4 (`visual/creative`, `email/lifecycle`, `social/content`, `program/community`) return
`'stub'` from `routeModality` → the analyzer emits a modality-specific `needs_input` (no fabrication).

**Spec:**
- **visual/creative** — Claude **vision** over competitor screenshots: DataForSEO Amazon image URLs
  (hero/A+/lifecycle) or user-uploaded creative from the `competitor_assets` library. Add image blocks
  to the analyzer's user message (the IDEA scoring stays text-out); each scored claim anchors to a
  screenshot `source_ref`. New `ModalitySource` value `'vision'`; new `gatherVisualEvidence` in
  `index.ts` (DataForSEO image fetch + base64/url image content).
- **email/lifecycle** — user-upload library only (no public source): welcome, abandoned-cart,
  post-purchase, win-back, promo/newsletter, SMS. `ModalitySource` `'upload'` reading `competitor_assets`.
- **social/content** — Firecrawl URL-fetch / upload (organic posts, short-form video copy, blog/SEO,
  brand-store editorial). Reuses the P5 `gatherWebStoreCopyEvidence` Firecrawl path.
- **program/community** — upload / URL-fetch (Subscribe & Save, loyalty, referral, membership,
  warranty/guarantee).
- Reconcile every touchpoint id against `src/config/touchpointTaxonomy.ts` once that file lands
  (`TODO(competitor-agents:taxonomy-reconcile)` from the manifest); the 7-profile map covers all 26.

**Extension point:** `routeModality` switch + the `ModalitySource` union in
`supabase/functions/competitor-analysis-asset/lib.ts` (each `'stub'` case → a wired source) and the
matching `gatherEvidence` switch in `index.ts`. Marker: `// TODO(competitor-agents:LT-1)` at the stub
cases in `routeModality`.

---

## LT-2 — Competitor monitoring at scale

**Now:** `SupabaseCompetitorInsightsService.analyzeCompetitors` is **on-demand only** (user clicks
"Analyze competitors" in `TouchpointCompetitorAgentPanel`). One run = one fresh insight row.

**Spec:** port the Drive **"Competitor Monitoring Automation System"** Make.com scenario to a native
scheduled job:
- A **cron-driven edge job** (Supabase scheduled function / `pg_cron`) re-runs the existing
  `competitor-analysis-asset` analyzer per tracked touchpoint on a cadence (e.g. weekly), writing each
  run as a new `brand_asset_competitive_insights` snapshot (the table is already append-style with
  `analyzed_at`).
- **Change-detection:** diff the newest snapshot against the prior one per (avatar, touchpoint,
  competitor) — score deltas, new/dropped competitors, price/copy changes — and on a material change
  emit an alert through the **existing brand-defense seam**: a new `IAlertSource`
  (`competitor-drift`) feeding `brand-defense-monitor`'s `INotificationChannel` (in-app first; email/push
  is what makes it retentive — Trevor's open Q on channel).
- Grounding holds: monitoring re-fetches real evidence each cycle; no synthetic "trend" without two
  real snapshots.

**Extension point:** `SupabaseCompetitorInsightsService` class top (the scheduled variant wraps the same
`analyzeCompetitors` invoke path; diff + alert reuse `brand-defense-monitor`'s `IAlertSource` /
`INotificationChannel`). Marker: `// TODO(competitor-agents:LT-2)` above `analyzeCompetitors`.

---

## LT-3 — Brand-level rollup into the two gold workbooks

**Now:** insights are per-touchpoint; the gold workbooks (`assembleWorkbookA`/`assembleWorkbookB`) render
the IDEA artifact chain + marketing-audit matrix, with no competitor surface.

**Spec:**
- **Workbook A → "Competitor Positioning Map" sheet.** Aggregate `brand_asset_competitive_insights`
  to a brand-level competitor×dimension matrix: our IDEA score vs each competitor across
  insight/distinctive/empathetic/authentic, with the `primaryGap` per touchpoint. Add a
  `competitor_positioning?` artifact to `WorkbookAArtifacts`, a `SHEET_NAMES` entry, an `appendSection`
  call, and a `projectWorkbookAArtifacts` branch. **Keep the assembler PURE** — the insights read happens
  in `exportWorkbook.ts` (the tool), never in the assembler (the workbook AGENTS.md critical rule).
- **Workbook B → "competitor-informed move" column.** `assembleWorkbookB`'s Investment Matrix gains a
  column flagging moves sourced from a competitor insight, joined via
  `brand_tests.competitor_insight_applied` (ties Workbook B to the LT-5 lift evidence).

**Extension point:** `WorkbookAArtifacts` interface in
`src/mcp/service/workbook/assembleWorkbookA.ts` (and the Investment Matrix columns in
`assembleWorkbookB.ts`). Marker: `// TODO(competitor-agents:LT-3)` above `WorkbookAArtifacts`.

---

## LT-4 — MCP exposure (post-D5 cross-server write-auth)

**Now:** the competitor surface is in-app only (service + hook + funnel UI). The MCP gateway exposes
ledger reads + identity-gated writes via `gateWrite()`/`actorTag()`; the D5 cross-server write-auth
decision is the documented blocker for binding new write tools.

**Spec:** after D5 lands, expose four MCP tools (three-layer pattern: pure `service/*` → `register*Tool`
with zod input → `server.ts`; **Calculation Parity** — byte-identical to the in-app
`SupabaseCompetitorInsightsService`):
- `list_touchpoints` — read; the taxonomy + which touchpoints have insights for an avatar.
- `analyze_touchpoint_competitors` — **WRITE** (persists an insight) → MUST run through `gateWrite()` and
  attribute via `actorTag()`.
- `get_competitor_gap` — read; the IDEA gap (our vs competitor) for one touchpoint.
- `compare_competitors` — read; brand-level competitor×dimension rollup (shares LT-3's aggregation).

**Extension point:** `src/mcp/tools/writeAuth.ts` — `gateWrite()` is the write seam the one write tool
goes through; the three reads bypass it. Marker: `// TODO(competitor-agents:LT-4)` above `gateWrite`.

---

## LT-5 — Warehouse lift attribution

**Now:** `brand_tests` carries `competitor_insight_applied BOOLEAN`, `baseline`/`result`, and an
`(avatar_id, competitor_insight_applied)` index; `TestingLiftTab` shows per-test lift and counts
competitor-informed tests. No cross-cohort attribution exists yet.

**Spec:** prove competitor-informed assets outperform — export `brand_tests` to the warehouse and run the
analysis on the existing substrate:
- Cohort by `competitor_insight_applied`; compute mean lift (`result - baseline`) per cohort.
- Significance-test the delta (sample-size gated; surface "insufficient data" rather than a false
  positive — the grounding discipline applied to metrics).
- Surface the result in the Workbook B rollup (§LT-3) and as a `funnel_competitor_*` aggregate metric.

**Extension point:** the correlation index + baseline/result columns in
`supabase/migrations/20260618000100_brand_tests.sql` (the attribution substrate; analysis layers on top).
Marker: `// TODO(competitor-agents:LT-5)` at the `idx_brand_tests_competitor_insight_applied` index.

---

## LT-6 — Productization / pricing (recurring vs one-time £97)

**Now:** the whole surface is one boolean (`isCompetitorAgentsEnabled`), OFF by default.

**Spec:** scheduled monitoring (LT-2) + alerts carry a **recurring** per-tracked-touchpoint cost
(DataForSEO + Firecrawl + Sonnet/Haiku calls every cycle) that the **one-time £97** diagnostic does not
cover. Split the product:
- **One-time** (£97 tier): on-demand per-touchpoint analysis (today's `analyzeCompetitors`).
- **Recurring "Brand Defense" tier:** unlocks LT-2 scheduled monitoring + drift alerts. The boolean gate
  becomes a **tier/entitlement** check (read the user's subscription entitlement instead of a build-time
  env flag). Open Qs carried from Trevor's brief: notification channel (in-app vs email/push), and whether
  trademark/IP monitoring is in the recurring tier or phase 2.

**Extension point:** `isCompetitorAgentsEnabled()` in `src/config/features.ts` (the single gate that
becomes a tier check). Marker: `// TODO(competitor-agents:LT-6)` above `isCompetitorAgentsEnabled`.

---

## TODO marker index

| Marker | File | Anchor |
|---|---|---|
| `LT-1` | `supabase/functions/competitor-analysis-asset/lib.ts` | `routeModality` stub cases |
| `LT-2` | `src/services/SupabaseCompetitorInsightsService.ts` | above `analyzeCompetitors` |
| `LT-3` | `src/mcp/service/workbook/assembleWorkbookA.ts` | above `WorkbookAArtifacts` |
| `LT-4` | `src/mcp/tools/writeAuth.ts` | above `gateWrite` |
| `LT-5` | `supabase/migrations/20260618000100_brand_tests.sql` | `idx_brand_tests_competitor_insight_applied` |
| `LT-6` | `src/config/features.ts` | above `isCompetitorAgentsEnabled` |

All six are specs + markers only — no runtime behavior changes. None gate prod; all are HALT-fenced behind
their named blockers (D5 for LT-4, the funnel taxonomy for LT-1, a recurring billing tier for LT-6).

# Competitor-Analysis Agents for the Brand Funnel — Plan v2 (Trevor-aligned)

_v2 2026-06-17. Supersedes v1. Folds in Trevor Bradford's "Brand Defense Monitoring" brief + the DataForSEO competitive-listing SOP. Build branch: `feat/competitor-agents` (off `worktree-customer-journey-tracking`). Autonomy bound for the implementation run: **code + local verify (lint/tsc/test)**; prod migrate/deploy is a human-gated HALT._

## 0. Thesis (v2)
For **every piece of the funnel, an agent tailored to that touchpoint** that shows how competitors handle it and where this brand can win — **scored on the IDEA Trust Gap™ lens (Insight / Distinctive / Empathetic / Authentic)**, grounded in the brand's avatar + Positioning Statement, surfaced **in each funnel-piece view**, and measured by lift. The differentiator is NOT structural listing audit (Helium-10 commodity) — it is the **IDEA-scored** read, which only works on top of Avatar 2.0 + Decision Trigger™. Competitive intelligence is also a **retention/push mechanic**: longitudinal drift + alerts, not a one-shot diagnostic.

> Source of truth for the IDEA scoring rubric = the existing **`audit-asset`** edge fn (already emits `{scores:{i,d,e,a}, rationale, fix}` for the brand's own asset). A competitor agent is **`audit-asset` pointed at a competitor's asset** + a gap read vs our avatar/Positioning Statement.

## 1. Two key external inputs folded in
- **DataForSEO SOP (Notion):** structured Amazon data by ASIN (title/bullets/images/pricing/reviews) + top-N competitor discovery by keyword/category. We adopt **DataForSEO as the Amazon data source via server-side API** (Basic auth, `DATAFORSEO_USERNAME`/`DATAFORSEO_PASSWORD` as Supabase secrets) — **NOT** the desktop-MCP delivery the SOP describes (wrong product shape). Replaces the Google-CSE + Firecrawl path for the marketplace-listing modality (those remain a fallback).
- **Trevor's Brand Defense brief:** (a) IDEA-scored competitor lens = the moat; (b) DTC/Shopify via **URL-fetch** (Claude fetches the live page), DTC = **phase 2**; (c) Trust Gap should be **longitudinal** (3 feeds: avatar-accuracy drift, Decision-Trigger health from the asset ledger, competitive pressure); (d) **retention = PUSH (alerts)**; (e) **Brand Defense Monitoring** loop (detect → IDEA-scored interpretation → drafted response via `generate_concepts`/`draft_asset`/`publish_filter_check` → log to asset ledger), leaning on the **Titan `get_alerts`** integration (coverage UNVERIFIED) + asset ledger.

## 2. Current state (audited 2026-06-17)
- **Funnel tracker BUILT/live** on this base branch: taxonomy in `src/config/touchpointTaxonomy.ts` (5 stages × 26 touchpoints + `audit_against` avatar bindings); tables `brand_assets`/`brand_tests` + `performance_metrics` extension; edge fns `audit-asset` (Claude Sonnet 4.6 vision IDEA audit) + `funnel-rewrite`; service `IBrandFunnelService`/`SupabaseBrandFunnelService`; hook `useFunnelTracker`; UI `FunnelTracker` (4 tabs) at `/v2/funnel`.
- **Reusable competitor plumbing (deployed):** `competitor-discovery` (Google CSE), `review-scraper`(+`-deep`) (Firecrawl), `competitor_reviews` table.
- **Deprecated:** the brand-level `competitive-analysis-orchestrator` monolith (broken contract, gpt-4o, hidden P2) — harvest discovery/scraper, do not extend the orchestrator/PDF/UI path.

## 3. Target architecture (v2)
- **One parameterized analyzer**, not 26 agents: `(modality framework) × (touchpoint bindings from taxonomy) × (avatar + Positioning Statement)`, **output = IDEA Trust-Gap score per competitor**. ~7 modality profiles cover all 26 touchpoints (marketplace-listing, web/store-copy, visual/creative, email/lifecycle, social/content, reviews/social-proof, program/community).
- **Per-funnel-piece-view agent (the headline UX):** each touchpoint/asset view renders a `TouchpointCompetitorAgentPanel` tailored to that touchpoint — "Analyze competitors for [touchpoint]" → IDEA-scored competitor cards + strategic angle + "draft a countermeasure". Aggregate roll-up stays in FunnelTracker Tab 2.
- **Data sources by modality:** Amazon = **DataForSEO** (ASIN + category top-N); web/DTC = **URL-fetch** (Firecrawl, phase 2 for discovery); reviews = `review-scraper`; visual = Claude vision on competitor screenshots (DataForSEO image URLs or upload); email/packaging = user-upload library.
- **Seam:** post-`auditAsset` → `competitor-analysis-asset` edge fn (Claude Sonnet 4.6, reuses the `audit-asset` IDEA rubric) → persist to `brand_asset_competitive_insights` → per-touchpoint panel → `funnel-rewrite`/`designTest` → `brand_tests` (`competitor_insight_applied` flag) for lift.
- **Grounding gate (mandatory):** every competitor claim/score anchored to fetched evidence or flagged `inference`. No fabricated competitors/prices/quotes.
- **Models:** Claude Sonnet 4.6 for scoring (+ Haiku for extraction/normalization). Retire gpt-4o. Canonical IDEA enum (`insight|distinctive|empathetic|authentic`) in one shared constant.

## 4. Implementation phases (this build — in order)

**Track A — per-touchpoint competitor agents**
- **P0 Baseline & manifest** — green baseline (tsc/lint/test) on the worktree; read taxonomy + `audit-asset` + service/UI; emit concrete file manifest + the IDEA-scoring contract + touchpoint→modality map. Record monolith-deprecation decision. *(no prod actions)*
- **P1 Data model** — migration `*_brand_asset_competitive_insights.sql` (+ `competitor_assets` upload library); RLS via avatar→user join; **feature-local TS types + casts** at the supabase boundary (do NOT hand-edit generated `types.ts`; note regen as a post-migration HALT).
- **P2 Analyzer engine + DataForSEO** — `_shared/dataforseo.ts` (server-side API: product-by-ASIN, top-N by keyword/category, reviews); `competitor-analysis-asset` edge fn producing **IDEA Trust-Gap scores per competitor** (reuse `audit-asset` rubric), grounded; persist insights. Marketplace-listing modality first.
- **P3 Service + hook + per-funnel-piece-view UI** — `IBrandFunnelService.analyzeCompetitors`/`getCompetitiveInsights`; `useFunnelTracker` wiring; **`TouchpointCompetitorAgentPanel` in each funnel-piece view** + Tab 2 aggregate; PostHog `funnel_competitor_*`.
- **P4 Lift loop** — strategic_angle → `funnel-rewrite` brief → `designTest` → `brand_tests` w/ `competitor_insight_applied`.
- **P5 Modalities 2 & 3** — web/store-copy (URL-fetch) + reviews (also feed avatar S1 vocab / S4 objections).

**Track B — Brand Defense & retention (in scope; Titan stubbed)**
- **P6a Longitudinal Trust-Gap drift** — `trust_gap_snapshots` table + snapshot fn across 3 feeds (avatar-accuracy drift, Decision-Trigger health from asset ledger, competitive pressure from Track A).
- **P6b Brand Defense loop** — `brand-defense-monitor` edge fn: `IAlertSource` interface with a **STUB Titan `get_alerts` adapter** (coverage unverified); on alert → IDEA-scored interpretation (which dimension is threatened) → drafted response via `generate_concepts`/`draft_asset`/`publish_filter_check` → `log_asset`/`update_asset_status`. Categories: listing-integrity, Buy-Box/ownership, compliance, reputation (trademark = phase 2).
- **P6c Push-alert scaffolding** — `INotificationChannel` (in-app first), alert table, unread surface in funnel UI.

**Track C — harden & ship**
- **P7 Harden** — canonical IDEA enum; `COMPETITOR_AGENTS` feature flag; per-user rate limits (mirror `audit-asset`); grounding-gate + service + edge-fn vitest coverage; full lint/tsc/test green.

**Track D — long-term scaffolding (specs + tracked TODOs, not full code)**
- **P8 LT scaffolding** — full 26-touchpoint modality coverage; competitor monitoring at scale (port the Drive "Competitor Monitoring Automation System" Make.com scenario to a scheduled job); brand-level rollup into gold workbooks A/B; MCP exposure (post-**D5** cross-server write-auth); warehouse lift attribution; productization/pricing (recurring vs £97). Emit as `docs/brand-funnel-builder/COMPETITOR_AGENTS_LONGTERM.md` + `// TODO(competitor-agents:LT-x)` markers.

**Final — verify & stage**
- **P9 Verify + runbook** — full `lint` + `tsc --noEmit` + `test` + `build` on the worktree; status report (green/stubbed/failed); **prod deploy runbook** as a HALT (migrations to apply; edge fns to deploy: `competitor-analysis-asset`, `brand-defense-monitor`; secrets to set: `DATAFORSEO_USERNAME`/`DATAFORSEO_PASSWORD`, confirm `GOOGLE_SEARCH_ENGINE_ID`; regen `types.ts`; flip `COMPETITOR_AGENTS`). Leave work uncommitted on the branch unless asked to commit.

## 5. HALTs (human-gated; do NOT do autonomously)
Apply migrations to prod • deploy edge fns to prod • set Supabase secrets • regen `types.ts` against prod • flip the prod feature flag • verify Titan `get_alerts` coverage (Trevor's open Q) • the real-ASIN integration run on the QA account. P9 prepares all of these as a runbook.

## 6. Open questions carried from Trevor's brief
- Titan `get_alerts` actual coverage (Buy-Box / unauthorized-seller?) — verify before treating P6 categories as fixed.
- Notification channel for v1 (in-app vs email/push — push is what makes it retentive).
- Trademark/IP monitoring in v1 or phase 2 (no confirmed data source).
- Pricing/tier: ongoing monitoring carries recurring cost a one-time £97 doesn't cover.

## 7. Definition of done (this build)
Per-funnel-piece competitor agent (IDEA-scored, DataForSEO-backed for Amazon) live in each funnel-piece view behind `COMPETITOR_AGENTS`, grounded, with one closed lift test; Brand Defense loop + drift + alert scaffolding present (Titan stubbed); lint/tsc/test/build green; LT scaffolded; prod deploy runbook staged for the human gate.

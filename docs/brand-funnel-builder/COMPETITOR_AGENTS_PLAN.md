# Competitor-Analysis Agents for the Brand Funnel — Short- & Long-Term Plan

_Authored 2026-06-17. Grounded in a live code + deployment audit (see §1)._

## 0. Thesis
For **every piece of the funnel, an agent that shows how competitors handle that touchpoint and where this brand can win** — grounded in the brand's avatar + Signature, and measured by lift. Competitor intelligence becomes an always-on **layer of the Brand Funnel tracker**, not a standalone report. The existing Amazon-listing competitor agent (`competitor_agent.py`) is the reference pattern for one modality; the work is to generalize it across the taxonomy and wire it to the funnel's audit + lift loop.

---

## 1. Current state (audited, not assumed)

**Brand Funnel tracker — BUILT, largely live** (worktree `customer-journey-tracking`, migrations + edge fns already deployed to prod `ecdrxtbclxfpkknasmrw`):
- Taxonomy: `docs/brand-funnel-builder/touchpoint-taxonomy.v0.json` — 5 stages × **26 touchpoints**, applicability flags (amazon/shopify/dtc/email/social/packaging/founder/support/loyalty), and `audit_against` bindings to avatar fields (`psychographics.*`, `buying_behavior.*`, `demographics.*`, `voice_of_customer`, `signature`).
- Data model (live): `brand_assets` (per-touchpoint asset: `touchpoint_id`, `stage`, `status`, `overall_score`, `audit_result` JSONB `{scores:{i,d,e,a}, rationale, fix}`, `signature_version`), `brand_tests` (lift: baseline/result, messaging version before/after), `performance_metrics` extended with `funnel_stage`/`touchpoint_id`/`asset_id`. Storage bucket `brand-assets` (owner-prefixed RLS).
- Engine (live edge fns): **`audit-asset`** (Claude Sonnet 4.6 vision → IDEA scores + rationale + fix vs avatar+Signature), **`funnel-rewrite`** (on-brand rewrite + publish-filter).
- Service/UI: `IBrandFunnelService` / `SupabaseBrandFunnelService` (`createAsset`, `auditAsset`, `getCoverage`, `recordTest`, `getAssetRoi`), `useFunnelTracker`, `FunnelTracker` (4 tabs) at route `/v2/funnel`.
- Gaps: Fix-with-coach flow ~80%, test create/close UI partial, MCP surface deferred behind the **D5 cross-server write-auth** decision.
- "Brand Funnel Expert" agent = currently emergent from `audit-asset` + service + UI; **no separate agent object exists.**

**Existing competitor plumbing — deployed, partly reusable, partly broken:**
- ✅ Reusable as shared services: **`competitor-discovery`** (Google Custom Search), **`review-scraper`** + **`review-scraper-deep`** (Firecrawl), table `competitor_reviews`.
- ⚠️ Broken + hidden: **`competitive-analysis-orchestrator`** (brand-level, market-category flow) — service→orchestrator contract mismatch (sends `{analysis_id, market_category}`, expects `{brandName, industry}`), IDEA-pillar naming drift, placeholder `GOOGLE_SEARCH_ENGINE_ID`, PDF passes `brandId` not `analysisId`, no route, no result display, **uses OpenAI gpt-4o** (rest of app uses Claude), zero tests. Behind P2 flag (Q3 2026).

**Reference pattern (the "close to what we want"):** `ecommerce-brand-business-os/.../content-engine/src/agents/competitor_agent.py` — 4 modality frameworks in Claude:
`analyze_competitor_listing` (7-part: positioning/keywords/messaging/differentiation/pricing/conversion/recs), `analyze_competitor_reviews` (voice-of-customer + gaps), `compare_multiple_competitors` (positioning map + SWOT), `identify_content_gaps` (content calendar).

**Strategic intent:** competitor data feeds the forensic avatar pipeline (S1 vocabulary / S4 objections) and the two gold workbooks (A: positioning map, B: investment matrix); all expert capability is meant to live in the **MCP layer** (unified-capability-layer ADR), grounded ("never fabricate"), identity-gated.

---

## 2. Target architecture — one parameterized engine, not 26 agents

> **Key insight:** Don't build 26 bespoke agents. Build **one Competitor Analyzer engine parameterized by `(modality framework) × (touchpoint bindings) × (avatar + Signature context)`.** ~7 modality profiles cover all 26 touchpoints. A touchpoint may invoke more than one modality (e.g., Amazon main image = visual; listing copy = marketplace-copy).

**Modality → touchpoint map (covers all 26):**

| Modality analyzer | Touchpoints it serves | Competitor evidence source | Reuses |
|---|---|---|---|
| **Marketplace-listing** | Amazon listing copy, Amazon brand story | scrape (`competitor-discovery` + `review-scraper` `/dp/`) | `competitor_agent.analyze_competitor_listing` |
| **Web/store-copy** | Shopify PDP, brand store/about, cart/checkout, shipping policy, trust badges, urgency | scrape (Firecrawl PDP/about) | listing framework, copy variant |
| **Visual/creative** | Amazon main image, paid-social creative, packaging, insert cards, UGC | scrape (public) + **user-uploaded competitor screenshots**; Claude vision | `audit-asset` vision pattern |
| **Email/lifecycle** | order confirm, shipping email, welcome series, win-back/replenishment, review request | **user-upload** first; later competitor-list-signup monitoring | new |
| **Social/content** | paid-social copy, organic profile, founder social/content, SEO, influencer | scrape/search public | `competitor_agent.identify_content_gaps` |
| **Reviews/social-proof** | reviews, trust badges | scrape (`review-scraper`/`-deep`) | `competitor_agent.analyze_competitor_reviews` |
| **Program/community** | referral, loyalty/community, support voice | manual/research | new |

**Evidence-acquisition tiers** (drives phasing): scrapeable now = marketplace-listing, web-copy, reviews, public social. Upload-based = email, packaging, insert cards. Monitored (long-term) = price/listing/review change detection.

**The seam (where it plugs into the funnel):**
1. After `SupabaseBrandFunnelService.auditAsset(assetId)` returns (we already have the brand's own asset, its IDEA scores, and the `fix`).
2. New edge fn **`competitor-analysis-asset`** `{assetId, touchpointId, auditResult, avatarContext, signature}` → selects the modality analyzer → gathers competitor evidence for that touchpoint → Claude Sonnet 4.6 → `{competitors:[{name,url,approach,gap_to_our_avatar}], strategic_angle, evidence_refs}`.
3. Persist to new table **`brand_asset_competitive_insights`** (FK `brand_assets`).
4. Surface in `FunnelTracker` **Tab 2 (What Needs Work)** under the IDEA bars: "N competitors analyzed → view gaps".
5. Feed `strategic_angle` into **`funnel-rewrite`** brief → **`designTest`** → `brand_tests` before/after, tagged `competitor_insight_applied` → lift proven via `getAssetRoi`.

**Grounding gate (mandatory):** every competitor claim is anchored to scraped/uploaded evidence or explicitly flagged `inference`. No fabricated competitors, prices, or quotes. (Same gate the coach uses.)

**Model:** standardize on **Claude Sonnet 4.6** for analysis (+ Haiku for extraction/normalization); **retire the gpt-4o** path. Canonicalize the IDEA pillar enum (`insight | distinctive | empathetic | authentic`) in one shared constant to kill the existing drift.

---

## 3. Short-term plan — MVP (≈4–6 weeks, phased, flag-gated)

**Goal:** one working per-touchpoint competitor agent across the **3 scrapeable, highest-value touchpoints** (Amazon listing, reviews, Shopify PDP), wired into the funnel tracker with measurable lift — behind a `COMPETITOR_AGENTS` flag. Stop wasting effort on the broken monolith.

| Phase | Work | Verify (done-when) |
|---|---|---|
| **ST-0 Decide monolith + harvest plumbing** (1–2d) | Quarantine the broken brand-level orchestrator + PDF UI path; keep `competitor-discovery`/`review-scraper(-deep)` + `competitor_reviews` as **shared services**. Branch from `customer-journey-tracking` (funnel code isn't on main yet). | Decision doc'd; the three shared fns invoked standalone from a scratch script returning real data. |
| **ST-1 Data model** (2–3d) | Migration `*_brand_asset_competitive_insights.sql` (+ `competitor_assets` library for uploads), RLS via avatar→user join; regen `types.ts`. | Migration applied on a branch DB; RLS test (other user can't read); types compile. |
| **ST-2 Engine v1 — marketplace-listing** (1wk) | `competitor-analysis-asset` edge fn implementing the `analyze_competitor_listing` framework, parameterized by touchpoint `audit_against` bindings + avatar + Signature; gather competitors via `competitor-discovery` + `review-scraper`. Claude Sonnet 4.6, grounded. | Run against a real ASIN on the QA test account; structured insight persisted with evidence_refs; no fabricated fields. |
| **ST-3 Service + hook + UI seam** (1wk) | `IBrandFunnelService.analyzeCompetitors(assetId)`; `useFunnelTracker` wiring; `FunnelTracker` Tab 2 "Competitor gaps" panel + modal (cards + strategic angle). PostHog `funnel_competitor_analysis_*`. | End-to-end in `/v2/funnel` on test account; screenshot of competitor gaps for a listing asset. |
| **ST-4 Lift loop** (3–4d) | Wire `strategic_angle` → `funnel-rewrite` brief → `designTest` → `brand_tests` w/ `competitor_insight_applied` flag. | A `brand_test` recorded with baseline + result tied to a competitor-informed rewrite. |
| **ST-5 Modalities 2 & 3** (1wk) | Web/store-copy (Firecrawl PDP/about) + Reviews (`analyze_competitor_reviews`) → also feed avatar **S1 vocab / S4 objections**. | Competitor gaps shown on ≥3 touchpoints across ≥2 stages. |
| **ST-6 Harden + ship behind flag** (3–4d) | Rate limits (per-user, mirror `audit-asset`), grounding-gate tests, vitest coverage for service+edge fn, `COMPETITOR_AGENTS` flag at P1, canonical IDEA enum + gpt-4o removal. | `npm run lint` + `tsc --noEmit` + `npm test` green; flag toggles feature on/off cleanly. |

**Short-term deliverable:** "Competitor gaps" on 3 scrapeable touchpoints, live behind a flag, with at least one lift test proving the loop closes.

---

## 4. Long-term plan — the full fleet + the moat

- **LT-1 Full modality coverage (all 26 touchpoints).** Add visual/creative (Claude vision on competitor screenshots — reuse `audit-asset`), email/lifecycle, social/content (`identify_content_gaps`), program/community. Add **competitor-asset upload UI** for non-scrapeable touchpoints (`competitor_assets` library).
- **LT-2 Competitor evidence acquisition at scale.** Port the Drive **"Competitor Monitoring Automation System" + Make.com scenario** into a scheduled edge cron; per-brand competitor library; **change detection** (price/listing/review deltas → alerts) — mirrors the InfinityVault `competitive-intelligence-implementation.md` spec.
- **LT-3 Brand-level rollup (revive the monolith, repurposed).** Aggregate per-touchpoint gaps into a **funnel-wide competitive positioning map** + the two **gold workbooks** (A positioning, B investment); fix/repoint the old orchestrator as this rollup; feed avatar S1/S4 automatically.
- **LT-4 MCP exposure (post-D5).** Expose `list_touchpoints`, `analyze_touchpoint_competitors`, `get_competitor_gap`, `compare_competitors` so external agents (Claude Desktop) and the in-house coach call the **same** capability — per the unified-capability-layer ADR.
- **LT-5 Lift-attribution maturity.** Warehouse auto-pull for `brand_tests.result_value`; correlate `competitor_insight_applied` tests vs not → **prove the feature drives lift** (the product's own proof metric).
- **LT-6 Productization.** Tier into £97+ plan; cost controls (Haiku extraction, cache competitor evidence, rate limits); per-modality quality bar; recurring "Competitor Watch" value (monitoring + alerts).

---

## 5. Cross-cutting decisions & open questions
- **Monolith:** recommend **deprecate the UI/orchestrator path, harvest the discovery+scraper services.** (Don't spend MVP effort fixing its 4 bugs; revisit only for LT-3 rollup.)
- **Non-scrapeable evidence (email/packaging):** **user-upload first**, monitoring later.
- **Model:** standardize on Claude Sonnet 4.6 + Haiku; retire gpt-4o. Fix IDEA-pillar drift with one shared enum.
- **MCP timing:** gated on the **D5** cross-server write-auth decision.
- **Sequencing dependency:** funnel system lives on worktree `customer-journey-tracking`, **not main** — build competitor work on that branch (or after it merges).
- **Cost:** per-analysis token cost; cache competitor evidence per (touchpoint, competitor); rate-limit.

## 6. Risks
- **Scraping limits** — Amazon `/product-reviews/` is login-walled; `/dp/` yields ~8 reviews (known truth). Mitigate via deep-scraper + user-upload fallback.
- **Fabrication** — mitigated by the mandatory grounding gate.
- **Scope (26 touchpoints)** — mitigated by modality generalization (~7 analyzers).
- **Unmerged base** — funnel system not yet on main; coordinate merge.

## 7. Definition of done
- **Short-term:** per-touchpoint competitor gaps on Amazon-listing + reviews + Shopify-PDP touchpoints, in `/v2/funnel` behind `COMPETITOR_AGENTS`, grounded, with one closed lift test; tests + lint + tsc green.
- **Long-term:** all 26 touchpoints covered by the parameterized engine; competitor monitoring + change alerts; brand-level rollup into both gold workbooks; MCP-exposed; lift attribution proving competitor-informed assets outperform.

---

### Immediate next concrete step
Branch from `customer-journey-tracking`, run **ST-0/ST-1** (decision + `brand_asset_competitive_insights` migration), then build **ST-2** (the marketplace-listing analyzer) against a real ASIN on the QA test account.

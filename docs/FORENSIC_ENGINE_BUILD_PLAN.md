# Forensic "Long-Running Free Analysis" — Build Plan

**Status:** SCOPED (not built) · 2026-06-21 · produced by a 5-agent recon+design workflow against current main.
**Spec:** `_bmad-output/mockups/idea-brandcoach-DEMO-v2-trevor-spec.html` Screen 4 (6-tool run).

## The encouraging headline
~80% of the pipeline **already exists** as separately-callable edge fns / MCP tools — the missing piece is the **connective tissue** (an orchestrator + long-running job infra + an in-app report surface), not the analysis itself.

## What exists (reusable spine)
- **ASIN → listing+reviews:** `import-product-data` (+`parse-amazon.ts`) — proven /dp/ scrape → `user_products`/`user_product_reviews` → `buildTrustGapEvidence()` emits the `{listings[],topReviews[]}` contract. **Cap: ~8 reviews/listing** (the spec's "47" is unreachable; `review-scraper-deep` is doc-only vapor).
- **Avatar 2.0 forensic chain:** `avatar-vocabulary/jobmap/triggers/objections` chained by `src/mcp/service/avatarPipeline.ts` (evidence-grounded, verbatim-enforced). = `analyse_reviews()` + the profile.
- **Evidence interpretation:** `diagnostic-interpretation-evidence` (cite-or-omit). GAP: consumes caller scores, doesn't derive IDEA scores from corpus.
- **Decision trigger (`match_fix_to_customer`):** `identify-decision-trigger` (evidence-gated, 422 without corpus). **LIVE BUG: old anchors (Lego/Apple/Nike/Gymshark/Netflix) vs spec's Dove set — ships wrong triggers today.**
- **Design brief:** `generate_brief`→`export-brief` with `scanBrief` claim-gate (blocks unconfirmed warranty claims). GAP: needs a full Brand Canvas (too heavy for free forensic).
- **Vision skeleton:** `audit-asset` does download→5MB-guard→base64→Sonnet 4.6→structured verdict — the exact shape `read_listing(screenshot)` needs. GAP: scores generic funnel assets, not listing structure.

## Missing connective tissue
(1) an orchestrator chaining the 6 steps as one tracked run; (2) evidence→IDEA-score derivation; (3) an in-app surface rendering forensic artifacts; (4) async/long-running job infra (NONE exists today); (5) credits wired to spend; (6) lead→user attach.

## Phased plan (minimal-first)
- **F1 — ASIN-only forensic, synchronous (M):** orchestrator chains import → evidence → new score-derivation → interpretation-evidence → decision-trigger. **Fix the anchor regression here regardless.** "Slow spinner" defers job infra. → real corpus-grounded trust-gap + correct trigger w/ verbatim evidence. *Past anything the free self-report does.*
- **F2 — Screenshot vision ingestion (M):** `read-listing-vision` edge fn (fork `audit-asset` skeleton + listing-structure prompt). Screenshot path = no reviews → thin-corpus mode, label confidence honestly. (Skill 12 contract is `detailed_doc_pending` — prompt is draft until Trevor's doc.)
- **F3 — Full Avatar 2.0 + brief, in-app report (L):** extend orchestrator with avatarPipeline + forensic-lite brief; new report route rendering the 4-field avatar / Component 0+trust-gap / DecisionTriggerPanel / A–D brief. Terminology Policy + voice. Nothing in src/ renders forensic artifacts today.
- **F4 — Long-running job UX + credits + email (L, highest risk):** `forensic_jobs` table + dispatcher (step-per-invocation + status polling) converting F1's sync run to async w/ the 6-tool progress animation; merge `_shared/meter.ts` + wallet UI + signup credit grant; emailable report (Resend already live); lead→user attach.

## Decisions needed (operator)
1. **Free vs paid gate** — spec says £97, task says free, skills say Phase 2/paid (contract identical, only gate differs). Rec: free-via-credits for launch, paywall-ready at F4.
2. **Vision model/cost** — default Sonnet 4.6 (matches audit-asset); confirm or cheaper pass.
3. **Screenshot-first vs ASIN-first** — rec ASIN-first (real reviews), screenshot as F2 fallback.
4. **Long-running approach** — rec jobs-table + polling (not chained-SSE / pg_cron).
5. **Report location** — rec new `/v2/forensic/:jobId` (coach is a chat shell).
6. **Anchor fix scope** — rec fix the FULL set (Harvard/Dove/Apple/Patagonia/Amazon's-Choice/FOMO) in one edit + redeploy.
7. **Lead→user attach** — rec signed-in-only (attach = auth.uid()).
8. **Review-count honesty** — rec ship thin-corpus labelled (don't claim 47).

## Top risks
- Live **anchor regression** ships wrong triggers now (one-file fix, do in F1).
- **Long-running vs edge-fn timeout** = highest technical risk (1 scrape + 5–7 Sonnet calls can't fit one HTTP request; no async pattern exists to copy).
- **Cost/run** ~7–9 Anthropic calls (one w/ vision) — size the free grant before flipping `PAYWALL_ENFORCED`.
- **~8-review thin corpus** — output must say it's thin or it over-claims.
- **Branch reconciliation** — load-bearing pieces scattered across feat/coach-evals-ideation (meter.ts), feat/diagnostic-lead-magnet (DecisionTriggerPanel), skill-architecture (skill contracts); live DB schema is ahead of all. Pull from the right branch; trust live schema over repo files.

## Fastest real value
F1+F2 deliver genuine forensic value behind a "slow spinner" and can ship **before** the F4 job infra — recommended if timeline is tight.

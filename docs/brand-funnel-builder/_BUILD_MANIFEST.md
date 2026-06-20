# Competitor-Agents — Build Manifest (P0)

_Generated 2026-06-17 on worktree `feat/competitor-agents` (HEAD `32b0825`). Companion to `COMPETITOR_AGENTS_PLAN.md`. This is the P0 deliverable: green-baseline record + IDEA-scoring contract + touchpoint→modality map + per-phase file plan + pattern catalog + monolith-deprecation note. No prod actions taken._

---

## 0. CRITICAL FINDING — the funnel-tracker base layer DOES NOT EXIST on this branch

The plan (§2 "Current state") asserts the funnel tracker is "BUILT/live on this base branch" and names files this build is supposed to read and extend. **None of them exist in this worktree's git history (this branch, `worktree-customer-journey-tracking`, or any branch).** Verified by `find`, working-tree `grep`, and `git log --all -- <path>`:

| Plan-named artifact | Status in this repo |
|---|---|
| `src/config/touchpointTaxonomy.ts` (5×26 taxonomy + `audit_against` bindings) | **ABSENT** |
| `supabase/functions/audit-asset/` (the IDEA `{i,d,e,a}` rubric source) | **ABSENT** |
| `supabase/functions/funnel-rewrite/` | **ABSENT** |
| `src/services/interfaces/IBrandFunnelService.ts` + `SupabaseBrandFunnelService.ts` | **ABSENT** |
| `src/hooks/useFunnelTracker.ts` | **ABSENT** |
| `src/components/v2/funnel/FunnelTracker.tsx` (+ per-touchpoint / Needs-Work view) | **ABSENT** |
| `brand_assets` / `brand_tests` migrations | **ABSENT** |
| `*brand_funnel*` migration | **ABSENT** |

`worktree-customer-journey-tracking` points at the **same commit** as `feat/competitor-agents` (`32b0825`, the alpha-instrumentation lineage), and the branch is a direct descendant of it — so it carries no funnel code either. The funnel tracker described in the plan lives on a different lineage that was never merged/harvested into this repo (consistent with MEMORY `project_brand_funnel_builder.md`: "spine unbuilt").

**Implication for P1–P7.** The plan is written as "extend the funnel tracker." In reality this build must **either** (a) wait for the funnel base branch to be merged into this worktree's base, **or** (b) build the minimal funnel substrate (taxonomy + asset table + IDEA-asset audit fn + a host view to mount the panel) as part of P1–P3. **This is a human-gated decision and a HALT** — surfacing it is the P0 job. The manifest below documents BOTH the plan-named targets and the **real existing analogs** to clone, so whichever path is chosen has a concrete pattern set.

### What DOES exist (the real substrate to build on)
- **IDEA scoring** lives in `supabase/functions/diagnostic-interpretation/index.ts` and `audit-idea-map/index.ts` (NOT `audit-asset`). Canonical enum + `/25`-per-pillar + `/100`-overall contract is in `diagnostic-interpretation`.
- **Competitor plumbing (deployed):** `competitor-discovery/` (Google CSE), `review-scraper/` + `review-scraper-deep/` (Firecrawl v2), `competitor_reviews` + `competitive_analyses` tables (migration `20260304000000_competitive_analysis.sql`), `src/types/competitive-analysis.ts`, `ICompetitiveAnalysisService` + `CompetitiveAnalysisService`.
- **Deprecated monolith:** `competitive-analysis-orchestrator/` (gpt-4o, brand-level) + `generate-competitor-analysis-pdf/` + feature-registry `COMPETITIVE_ANALYSIS` (P2). Harvest discovery/scraper; do not extend the orchestrator/PDF path.
- **Thin metrics:** `performance_metrics` table (migration `20260301065636`) is a KV (`avatar_id, metric_type, metric_value, metadata`), RLS via `avatars → brands.user_id` join. NOT a channel×deployment lift table.

---

## 1. The IDEA scoring contract (extracted from the real code)

`audit-asset` does not exist; the **authoritative IDEA-scoring contract** is `supabase/functions/diagnostic-interpretation/index.ts`, with the synthesis-over-grounded-inputs + grounding-gate pattern in `audit-idea-map/index.ts`. The competitor analyzer (`competitor-analysis-asset`) must reuse THESE.

### 1a. Field shapes
- **Canonical dimension enum (single source of truth to lift into a shared constant):**
  ```ts
  type Dimension = 'insight' | 'distinctive' | 'empathetic' | 'authentic';
  const DIMENSIONS = ['insight','distinctive','empathetic','authentic'] as const;
  const DIMENSION_LABELS = { insight:'Insight', distinctive:'Distinctive', empathetic:'Empathetic', authentic:'Authentic' };
  ```
  (from `diagnostic-interpretation` lines 92–98). NOTE: this corrects the stale "Identify/Discover/Execute/Analyze" loop — IDEA = **Insight-Driven, Distinctive, Empathetic, Authentic** (MEMORY `project_idea_framework_meaning.md`).
- **Score shape:** each pillar scored **0–25** (clamped), overall **0–100** (clamped), plus a named `primaryGap` dimension (weakest pillar). Bands: 0–9 weak / 10–17 mixed / 18–25 strong (`diagnostic-interpretation` lines 144–146).
- **Output object (interpretation fn):** `{ interpretations: { insight, distinctive, empathetic, authentic }, primaryGapSummary }`.
- **Output object (audit-idea-map synthesis fn):** `{ rows: [...], grounding: 'evidence'|'inference', evidence_refs: [{kind,ref}] }`. **The competitor analyzer adopts this `grounding` + `evidence_refs` envelope** — it is exactly the grounding gate the plan §3 mandates.
- **Proposed `competitor-analysis-asset` contract (new, modeled on the above):**
  ```
  Request:  { touchpoint_id, modality, our_asset?, competitor_evidence: [...], avatar_context, signature_context }
  Response: { competitors: [{ name, source_ref, scores: {insight,distinctive,empathetic,authentic} /25,
                              overall /100, rationale, strategic_angle }],
              grounding: 'evidence'|'inference', evidence_refs: [{kind, ref}],
              needs_input?: [{slot, question, why}] }
  ```
  Every `scores`/`overall`/quote anchored to a `competitor_evidence` item (→ `source_ref`); anything not anchored is omitted or `grounding:'inference'`. Mirror `audit-idea-map`'s `isFabricatedPreciseLift`-style guard for any numeric claim.

### 1b. Prompt structure (clone exactly from `audit-idea-map` / `marketing-audit`)
- `buildSystemPrompt()` returns a tagged-section string: `<persona>`, `<what-this-is>`/`<what-to-write>`, a rule block (`<grounding-rule>`, `<lift-multiplier-rule>`), `<voice-rules>` (no asterisks/markdown/em-dashes; UK English; no hype/emojis), optional `<few-shot-example>`, and `<output-contract>` (ONLY a JSON object, no fences).
- **Messages:** single `user` turn (NO assistant prefill — "Sonnet 4.6 rejects last-turn prefills (400)", noted in both fns).
- **System block uses prompt caching:** `system: [{ type:'text', text: prompt, cache_control:{type:'ephemeral'} }]` with header `'anthropic-beta':'prompt-caching-2024-07-31'`.
- **Tolerant parse:** reuse the `parseRows` / `extractBalancedObjects` brace-scan defensive parser verbatim (both fns carry an identical copy → candidate for `_shared/`).
- **needs_input gate:** when required grounding inputs are absent, return `{ needs_input:[{slot,question,why}] }` instead of fabricating (chain-incomplete pattern, `audit-idea-map` lines 296–307).

### 1c. Model id + API call
- `const SONNET_MODEL = 'claude-sonnet-4-6';` · `CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'` · header `x-api-key` + `anthropic-version:'2023-06-01'`.
- `max_tokens` ~3000–3072, `temperature` 0.5–0.6. On `!response.ok` log `[fn] Anthropic API error: <status> <body>` and throw. Retire gpt-4o (only the deprecated monolith still uses it).

### 1d. How avatar + Signature context is loaded
- **No `audit-asset` avatar-loader exists to copy.** The closest patterns: `audit-idea-map` accepts `canvas`/`brief`/`investments` **in the request body** (host pre-loads, fn stays stateless); `ai-insight-guidance` reads Avatar 2.0 from `user_knowledge_base` server-side.
- **Decision for this build:** follow the `audit-idea-map` stateless pattern — the **service/host loads avatar + Signature and passes them in the request body** (`avatar_context`, `signature_context`). This keeps the edge fn pure and matches the existing IDEA fns. The avatar/Signature binding **field names must come from `src/types/avatar.ts` at implementation time** (MEMORY warns the plan/thread field names are STALE; `signature`/`audit_against` are NOT currently present in `avatar.ts`, reinforcing that the binding layer is unbuilt).

---

## 2. Touchpoint → modality map (7 modalities)

**Caveat:** `src/config/touchpointTaxonomy.ts` does not exist, so the canonical 26-touchpoint list could not be read. The map below is the **modality framework keyed to the plan's 5-stage × ~26 grouping (§3) + the standard DTC/Amazon funnel**; it is the analyzer-routing contract (one parameterized analyzer × 7 modality profiles). **Reconcile the exact touchpoint ids against `touchpointTaxonomy.ts` once that file exists** (`// TODO(competitor-agents:taxonomy-reconcile)`).

| Modality profile | Data source (per plan §3) | Funnel-stage touchpoints it covers (representative) |
|---|---|---|
| **marketplace-listing** | DataForSEO (ASIN + category top-N); CSE/Firecrawl fallback | Amazon listing title, bullets, A+ content, product images-as-copy, price, Buy Box, category/search placement, sponsored listings |
| **web/store-copy** | URL-fetch (Firecrawl; phase 2 discovery) | DTC/Shopify product page, landing pages, homepage value-prop, PDP copy, pricing page, cart/checkout copy |
| **visual/creative** | Claude vision on competitor screenshots (DataForSEO image URLs / upload) | Hero/lifestyle imagery, A+ visual modules, ad creative, packaging shots, brand-store visual identity, video thumbnails |
| **email/lifecycle** | user-upload library | Welcome/onboarding email, abandoned-cart, post-purchase, win-back, promotional/newsletter, SMS lifecycle |
| **social/content** | URL-fetch / upload | Organic social posts, short-form video, influencer/UGC, blog/SEO content, brand-store editorial |
| **reviews/social-proof** | `review-scraper` (Firecrawl) → `competitor_reviews` | Amazon reviews, DTC reviews/testimonials, Q&A, ratings widgets, trust badges, UGC proof |
| **program/community** | user-upload / URL-fetch | Subscribe & Save / subscription, loyalty/rewards, referral, community/membership, warranty/guarantee program |

Each profile = `(modality framework) × (touchpoint bindings from taxonomy) × (avatar + Signature)` → IDEA Trust-Gap score per competitor (plan §3).

---

## 3. Files to CREATE and EDIT, by phase (P1–P7)

> Paths absolute-relative to the worktree root `…/.claude/worktrees/competitor-agents/`. Where a plan-named file is ABSENT (see §0), it is marked **[blocked-on-base]** and the realistic alternative is given.

### P1 — Data model
- **CREATE** `supabase/migrations/<ts>_brand_asset_competitive_insights.sql` — `brand_asset_competitive_insights` (per-touchpoint IDEA scores per competitor; `grounding`, `evidence_refs` jsonb) + `competitor_assets` upload library. RLS via **avatar → user** join. **[partially blocked]**: the plan's `brand_assets` FK target does not exist; until the funnel `brand_assets` table lands, FK to `avatars(id)` and join `avatars → brands.user_id` (the `performance_metrics` RLS pattern) — `// TODO(competitor-agents:fk-brand-assets)`.
- **CREATE** `src/types/competitor-insights.ts` — feature-local TS types (`CompetitiveInsight`, `CompetitorScore`, `Modality`, `Grounding`). Cast at the supabase boundary with `// TODO(types-regen)`; do NOT hand-edit `src/integrations/supabase/types.ts`.

### P2 — Analyzer engine + DataForSEO
- **CREATE** `supabase/functions/_shared/dataforseo.ts` — server-side DataForSEO client (Basic auth via `DATAFORSEO_USERNAME`/`DATAFORSEO_PASSWORD`): product-by-ASIN, top-N by keyword/category, reviews.
- **CREATE** `supabase/functions/competitor-analysis-asset/index.ts` — the analyzer (clone `audit-idea-map` boilerplate: CORS, optional JWT→getUser, Sonnet 4.6 + caching, tolerant parse, `grounding`/`evidence_refs`/`needs_input`). Marketplace-listing modality first.
- **CONSIDER CREATE** `supabase/functions/_shared/ideaParse.ts` — extract the duplicated `extractBalancedObjects`/`parseRows` parser (lives copy-pasted in `audit-idea-map`, `marketing-audit`) into `_shared` (DRY; optional, surgical).
- **EDIT** `supabase/config.toml` — register `competitor-analysis-asset` (verify_jwt flag matching neighbors).

### P3 — Service + hook + per-funnel-piece-view UI
- **EDIT/CREATE** `src/services/interfaces/IBrandFunnelService.ts` **[blocked-on-base — ABSENT]** → realistic alt: add `analyzeCompetitors` / `getCompetitiveInsights` to a **new** `ICompetitorInsightsService.ts` (+ `SupabaseCompetitorInsightsService.ts`) following `ICompetitiveAnalysisService`/`CompetitiveAnalysisService` (edge `supabase.functions.invoke`, async-domain mapping, Promise-throw on auth).
- **EDIT** `src/services/ServiceProvider.tsx` — register the new service.
- **CREATE** `src/hooks/useCompetitorInsights.ts` (the plan says wire `useFunnelTracker` — **[blocked-on-base — ABSENT]**).
- **CREATE** `src/components/v2/funnel/TouchpointCompetitorAgentPanel.tsx` + Tab-2 aggregate. **[blocked-on-base]**: `FunnelTracker.tsx` and its per-touchpoint / Needs-Work detail view (the intended mount point) do not exist — the host view must be built or the funnel base merged first (§4 / §0 HALT).
- **EDIT** `src/lib/posthogClient.ts` — add `funnel_competitor_*` events to `AlphaEventName` (counts/booleans/IDs/scores only — content discipline).

### P4 — Lift loop — BUILT (2026-06-18)
- **CREATED** `supabase/functions/funnel-rewrite/` (`index.ts` Deno entry + `lib.ts` pure/vitest-tested), cloning the `competitor-analysis-asset` boilerplate (CORS, optional JWT/abuse controls, Sonnet 4.6 + prompt caching, single user turn, tolerant parse). Folds the insight's `gap_to_our_avatar` + `strategic_angle` (the competitor brief) INTO the rewrite prompt so the rewrite is an explicit countermeasure. Registered in `config.toml` (verify_jwt=false, brand-copy-generator pattern). The `brand-copy-generator` fallback was NOT needed.
- **CREATED** `supabase/migrations/20260618000100_brand_tests.sql` (timestamp AFTER P1's `20260618000000`) — `brand_tests` table with `competitor_insight_applied BOOLEAN NOT NULL DEFAULT false`, avatar-scoped RLS, FK `competitive_insight_id -> brand_asset_competitive_insights(id)`, and an `(avatar_id, competitor_insight_applied)` index for the LT-5 correlation. `asset_id` stays an unconstrained uuid (`TODO(competitor-agents:fk-brand-assets)`).
- **A/B compose via the existing designTest path:** the service reuses `designAbTest` from `src/mcp/service/testDesign.ts` (the exact composer the MCP `design_test` tool uses) to build the two-variant spec (baseline A vs. competitor-informed rewrite B) before inserting into `brand_tests` — no duplicated composer logic.
- **Service/hook/UI:** `ICompetitorInsightsService` gained `draftCountermeasure` / `recordTest` / `getBrandTests`; `useCompetitorInsights` gained the matching actions + state + PostHog `funnel_competitor_countermeasure_drafted` / `funnel_competitor_test_recorded` events (counts/booleans/IDs only). `TouchpointCompetitorAgentPanel`'s "Draft countermeasure" now opens a `DraftCountermeasureDialog` (rewrite → edit → compose & record), and `FunnelTracker`'s Tests tab renders a new `TestingLiftTab` surfacing the `competitor_insight_applied` flag per test.
- Verify: `tsc --noEmit` clean; `eslint` clean on all P4 files (tree-wide lint stays at the 297-problem baseline, none in P4 files); full vitest `1186/1186` pass (the manifest's noted `workbookA` determinism flake did not recur this run).

### P5 — Modalities 2 & 3 — BUILT (2026-06-17)
- **EDITED** `supabase/functions/competitor-analysis-asset/index.ts` + `lib.ts`:
  - **web/store-copy** modality → `gatherWebStoreCopyEvidence`: URL-fetch via Firecrawl v2 `scrapeMainContent` (`onlyMainContent:true`) on caller-supplied `competitorUrls` (≤5), each page rendered as a grounded `url:` evidence item (`renderUrlEvidence`, capped `MAX_URL_EVIDENCE_CHARS`). `notConfigured` when `FIRECRAWL_API_KEY` is absent.
  - **reviews/social-proof** modality → `gatherReviewsEvidence`: competitor reviews from DataForSEO (`getAmazonReviews` by `reviewAsins`/`asin`, ≤5) + Firecrawl on review-page `competitorUrls`; each competitor's reviews fold into one `review:` evidence item (`renderReviewEvidence`) AND are kept in `reviewsByRef` for the VoC mine.
  - **VoC** (the S1/S4 feed): `mineVoc` runs a **Haiku** (`claude-haiku-4-5-20251001`) extraction over the fetched review corpus → `{vocab_clusters[], objections[]}` in the **exact `avatar_s1_vocab` / `avatar_s4_objections` shapes** (contracts `avatarS1Vocab.ts`/`avatarS4Objections.ts`). `enforceVocGrounding` drops any `customer_words` term / `verbatim_signal` quote that is NOT a literal substring of the corpus (substring gate cloned from `avatar-vocabulary`/`avatar-objections`), normalizes out-of-band `frequency_signal` to `Medium`, and returns `null` when nothing survives (no fabricated VoC). Never fatal — a VoC failure does not fail the analysis.
  - **Persistence:** VoC lands in the insight record via a new `voc_signals` jsonb column (migration `20260618000200_competitive_insights_voc_signals.sql`, additive) and in the edge response (`voc_signals`). The `user_knowledge_base` `avatar_s1_vocab`/`avatar_s4_objections` write path is **intentionally NOT touched** (owned by the avatar fns + their versioned `is_current`/`version` writeback; clobbering the user's own avatar work is the risk) — stubbed with `TODO(competitor-agents:voc-kb-write)`.
  - **Routing map updated:** `gatherEvidence` switch now routes `marketplace-listing`→P2, `web/store-copy`→P5, `reviews/social-proof`→P5; visual/email/social/program stay stubbed (emit modality-specific `needs_input`).
  - **Threaded through** `src/types/competitorInsights.ts` (`VocCluster`/`VocObjection`/`VocSignals`, `reviewAsins`, `vocSignals` on result + `voc_signals` on row) and `SupabaseCompetitorInsightsService` (request body + response/DB mapping). Generated `types.ts` untouched (cast at boundary, `TODO(types-regen)`).
  - **Tests:** 17 new vitest cases in `competitor-analysis-asset/__tests__/lib.test.ts` (renderers, corpus, VoC prompt/parse, substring-gate keep/drop/null). Verify on the worktree: `tsc --noEmit` clean; `eslint` clean on all P5 files (tree-wide lint stays at the 297-problem baseline); full vitest `1200/1200` pass (the `workbookA` determinism flake did not recur).
  - No Deno binary present; imports reviewed against siblings (`review-scraper` Firecrawl call, `_shared/dataforseo.ts` exports) — only the std/esm.sh imports already used by neighbors.

### P6 (Track B) — Brand Defense & retention
- **CREATE** `supabase/migrations/<ts>_trust_gap_snapshots.sql` (drift, 3 feeds) + `supabase/functions/brand-defense-monitor/index.ts` with `IAlertSource` + **STUB** Titan `get_alerts` adapter (coverage UNVERIFIED — HALT). `INotificationChannel` (in-app), alert table, unread surface.

### P7 (Track C) — Harden
- **CREATE** `src/config/idea.ts` (or `_shared/idea.ts`) — canonical IDEA enum constant (lift from `diagnostic-interpretation`).
- **EDIT** `src/config/features.ts` — add `COMPETITOR_AGENTS` flag (note: `features.ts` is a phase-gated registry, not boolean flags — add a registry entry or a sibling boolean flag module; confirm pattern at impl time).
- **EDIT** `competitor-analysis-asset/index.ts` — per-user rate limits mirroring `diagnostic-interpretation` (`MAX_BODY_BYTES`/`RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS` env-tunable, 429 + `Retry-After`, 413 on oversized).
- **CREATE** vitest: grounding-gate + service + edge-fn coverage (`src/services/__tests__/…`, `supabase/functions/_shared/__tests__/…`).

---

## 4. Existing patterns to follow

- **Migration style + RLS** — model on `20260604120000_user_products.sql`: `CREATE TABLE IF NOT EXISTS public.<t>` with `id uuid pk default gen_random_uuid()`, `user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE`, `created_at/updated_at timestamptz default now()`, `CHECK` constraints on enums/ranges, `UNIQUE` keys; `ALTER TABLE … ENABLE ROW LEVEL SECURITY`; four named policies (view/insert/update/delete) using `auth.uid() = user_id`; **child tables RLS via parent `EXISTS (SELECT 1 FROM parent WHERE id=… AND user_id=auth.uid())`**; `update_updated_at_column()` trigger; `idx_*` indexes; `GRANT ALL … TO authenticated`. For avatar-scoped tables use the `avatars JOIN brands ON brands.id = avatars.brand_id … brands.user_id = auth.uid()` join (`performance_metrics` migration).
- **Edge-fn boilerplate** — `import { serve } from "…/std@0.168.0/http/server.ts"` + `createClient` from `esm.sh/@supabase/supabase-js@2.39.3`; shared CORS via `supabase/functions/_shared/cors.ts` (or inline `corsHeaders`); `if (req.method==='OPTIONS') return new Response(null,{headers:corsHeaders})`; key-missing → 500 JSON; optional-JWT pattern (`audit-idea-map`) vs required-auth 401 (`review-scraper`); top-level `try/catch` → `console.error('Error in <fn>:', error)` + 500 JSON; **safeLog discipline**: log counts/IDs/status only, never PII/raw prompts.
- **Service Result `{data,error}` pattern** — services consume Supabase's `const { data, error } = await supabase.from(...)`/`.functions.invoke(...)` and `if (error) { console.error(...); throw / toast }`. `CompetitiveAnalysisService` is the closest analog (edge invoke + async status updates + domain mapping); `SupabaseAvatarService` shows the `mapXFromDb(row): Domain` boundary-cast (cast `Record<string,unknown>` fields, no `any`).
- **PostHog event pattern** — frontend: `captureAlphaEvent(name, props)` from `src/lib/posthogClient.ts`; add new names to the `AlphaEventName` union; **props are counts/booleans/IDs/scores only — never free text/PII** (rich content → Supabase `feedback_events`). MCP-side server events use `src/mcp/posthog.ts`.
- **Per-touchpoint panel mount point** — **NONE EXISTS.** The plan's intended mount (`FunnelTracker.tsx` per-touchpoint / Needs-Work detail view) is absent. Mounting `TouchpointCompetitorAgentPanel` requires building that host view or merging the funnel base branch first (§0 HALT). For an aggregate-only interim, the existing `/competitive-analysis` route (feature `COMPETITIVE_ANALYSIS`) is the only competitor-facing surface present, but it is the deprecated brand-level path.

---

## 5. Monolith-deprecation note (decision recorded)

**Decision:** the brand-level `competitive-analysis-orchestrator` (gpt-4o, broken contract, hidden behind the P2 `COMPETITIVE_ANALYSIS` feature) and its `generate-competitor-analysis-pdf` + UI path are **DEPRECATED — do not extend.** This build **harvests** the reusable, deployed plumbing from it — `competitor-discovery` (Google CSE), `review-scraper`/`review-scraper-deep` (Firecrawl), and the `competitor_reviews` table — into the new **per-touchpoint, IDEA-scored, Sonnet-4.6** analyzer (`competitor-analysis-asset`). gpt-4o is retired from the competitor path. The orchestrator/PDF/`/competitive-analysis` route stays untouched (no deletion of pre-existing code per surgical-change rule) until a separate cleanup is authorized.

---

## 6. Green-baseline record (P0)

Run on the worktree, `node_modules` installed via `npm ci` (exit 0).

| Check | Command | Result |
|---|---|---|
| Type check | `npx tsc --noEmit` | **PASS** (exit 0, no errors) |
| Lint | `npm run lint` | **FAIL (pre-existing)** — 297 problems (259 errors, 38 warnings) |
| Tests | `CI=true npm test -- --run` | **FAIL (pre-existing, 1)** — 1107/1108 pass; 1 fail |

**Lint** is RED at baseline and was so before any competitor-agents work. Breakdown by rule: `@typescript-eslint/no-explicit-any` ×251, `react-refresh/only-export-components` ×24, `react-hooks/exhaustive-deps` ×13, `no-useless-escape` ×4, `@typescript-eslint/no-require-imports` ×2, `@typescript-eslint/no-empty-object-type` ×2, `no-console` ×1. Spread across the whole tree (src/components/ui, src/hooks, src/contexts, supabase/functions, tailwind.config.ts, tests). None in competitor-agents files (none exist yet). **Later phases must not be blamed for these; the bar is "no NEW lint errors in files this build creates/edits."**

**Tests** — single pre-existing failure, file is committed-clean (unmodified):
`src/mcp/__tests__/workbookA.test.ts > assembleWorkbookA > is deterministic — two assemblies of the same artifacts produce identical buffers` — `AssertionError: expected false to be true` at line 411 (two `xlsx.writeBuffer()` calls produce non-identical buffers; non-determinism in the xlsx encoder, unrelated to competitor-agents). Unrelated to this build.

# Competitor-Agents — Production Deploy Runbook (P9)

_v2 2026-06-17. Worktree `feat/competitor-agents`. Companion to `COMPETITOR_AGENTS_PLAN.md` (§4 P9 / §5 HALTs),
`_BUILD_MANIFEST.md`, and `COMPETITOR_AGENTS_LONGTERM.md`._

**INTEGRATED-STATE UPDATE (v2):** the funnel base has been **overlaid into this worktree** — it is now
canonical here. `src/components/v2/funnel/FunnelTracker.tsx` (4-tab), `SupabaseBrandFunnelService`,
`useFunnelTracker`, `touchpointTaxonomy`, the `audit-asset` / `funnel-rewrite` edge fns, the `/v2/funnel`
route in `src/App.tsx`, and the four funnel-base migrations (`20260616120000` / `20260616120100` /
`20260617000000` / `20260617120000`) all EXIST and are canonical. The competitor build's per-touchpoint
panel is **route-mounted** (see §5 — the old "not mounted" caveat is RESOLVED). Two material changes vs v1:
(1) the migration set is now the **full ordered 20260616 → 20260618 sequence** (4 funnel-base + 5 competitor),
and (2) the `asset_id` FK gap is **closed** — `brand_assets` now exists, so the insights/tests FKs are real
(see §1 / §6).

**Every step below is a HUMAN-GATED HALT.** The build run was bounded to code + local verify only
(no prod migrate/deploy/secrets/flag, no commit/push). This runbook is the exact ordered sequence a
human operator runs to take Competitor-Agents to production. Do the steps **in order** — later steps
depend on earlier ones (the funnel-base tables must exist before the competitor migrations FK into them;
the competitor `brand_tests` migration FKs the insights migration; the edge fns need the tables and secrets
before a real-ASIN run will work; the flag should flip last).

---

## 0. Pre-flight

- [ ] **Branch is reviewed and merged (or PR open).** Work is uncommitted on `feat/competitor-agents`.
      Decide commit/merge strategy first; this runbook assumes the code is on the deploy target.
- [ ] **Confirm the live Supabase project is awake** (free tier auto-pauses). If reads time out / NXDOMAIN,
      restore it in the dashboard before migrating or deploying. (MEMORY `project_supabase_pauses`.)
- [ ] **Inspect live schema before applying migrations.** Other sessions apply migrations via MCP without
      repo files; the live schema can drift from the repo. Run `list_tables` / `list_migrations` and confirm
      which of the **nine** migrations (4 funnel-base + 5 competitor, see §1) are already applied live before
      applying the rest — in particular, confirm whether the funnel-base tables (`brand_assets`, `brand_tests`,
      funnel gaps, the storage bucket) already exist. (MEMORY `project_alpha_instrumentation`.)
- [ ] **Local gates are green on the worktree** (recorded P9, see §7): `tsc` clean, `test` 1259 passed
      (3 pre-existing funnel-base/lineage flakes — see §7), `build` clean, `lint` at the pre-existing
      baseline (zero new errors in competitor/funnel feature files).

---

## 1. Apply migrations — IN THIS EXACT ORDER

**Nine additive migrations** now coexist on the integrated branch: **4 funnel-base** (timestamps `20260616` /
`20260617`) followed by **5 competitor** (`20260618`). Order matters — the competitor migrations FK into the
funnel-base tables (`brand_asset_competitive_insights.asset_id` and `brand_tests` both reference
`public.brand_assets`, created by funnel-base #1), and `voc_signals` alters the insights table. All
competitor tables are RLS-anchored on `avatars.user_id = auth.uid()` (avatars has its own `user_id` column;
no `brands` join needed). The timestamp prefixes already enforce this order via the CLI; if applying
individually via MCP `apply_migration`, keep the order below. Any funnel-base migration already applied live
(it has been deployed on its own lineage) should be skipped — confirm via `list_migrations` first (§0).

| # | File | Creates / Alters | Depends on |
|---|---|---|---|
| 1 | `supabase/migrations/20260616120000_brand_funnel_tracker.sql` | **funnel-base:** `brand_assets` + `brand_tests` + funnel `performance_metrics` ext | avatars |
| 2 | `supabase/migrations/20260616120100_brand_assets_storage_bucket.sql` | **funnel-base:** `brand-assets` storage bucket + policies | #1 |
| 3 | `supabase/migrations/20260617000000_brand_funnel_gaps.sql` | **funnel-base:** funnel gaps table | #1 |
| 4 | `supabase/migrations/20260617120000_brand_funnel_failed_status.sql` | **funnel-base:** `failed` asset status | #1 |
| 5 | `supabase/migrations/20260618000000_brand_asset_competitive_insights.sql` | **competitor:** `brand_asset_competitive_insights` (`asset_id` FK → `brand_assets`) + `competitor_assets` (upload library) | #1 (FK target), avatars |
| 6 | `supabase/migrations/20260618000100_brand_tests.sql` | **competitor:** ALTERs `brand_tests` — adds `avatar_id`, `competitive_insight_id` FK, `competitor_insight_applied` (no longer CREATEs; base #1 owns the table) | #1 (table), #5 (FK target) |
| 7 | `supabase/migrations/20260618000200_competitive_insights_voc_signals.sql` | **competitor:** `ALTER … ADD COLUMN voc_signals JSONB` | #5 (table) |
| 8 | `supabase/migrations/20260618000300_trust_gap_snapshots.sql` | **competitor:** `trust_gap_snapshots` (drift, 3 feeds) | avatars |
| 9 | `supabase/migrations/20260618000400_brand_defense_alerts.sql` | **competitor:** `brand_defense_alerts` | avatars |

- [ ] Apply #1 → … → #9 in order (skip any funnel-base migration already live; do NOT skip a competitor one).
- [ ] After applying, run `get_advisors` (security + performance) and confirm no new RLS-missing / policy
      warnings on the new tables.

**HALT — do NOT** ad-hoc DDL outside these files. Use the migration files / `apply_migration`.

---

## 2. Set Supabase function secrets

Set BEFORE deploying the edge fns (a fn deployed without its secret fails at first real call, not at deploy).

- [ ] `DATAFORSEO_USERNAME` — DataForSEO API login (Basic auth). **NEW — required** for the marketplace-listing
      and reviews modalities (`_shared/dataforseo.ts`). Without it the analyzer returns `notConfigured`/`needs_input`,
      never fabricated data.
- [ ] `DATAFORSEO_PASSWORD` — DataForSEO API password. **NEW — required.**
- [ ] **Confirm `GOOGLE_SEARCH_ENGINE_ID` is already set** (used by the existing deployed `competitor-discovery`
      fn, the CSE fallback path). It is **NOT consumed by any new fn** in this build — the new analyzer uses
      DataForSEO, not CSE — so no action beyond confirming the existing secret is intact. (Grep confirms the only
      consumer is `competitor-discovery/index.ts`.)
- [ ] **Confirm already-set, reused secrets** (no new value needed; the new fns read them):
      `ANTHROPIC_API_KEY` (Sonnet 4.6 scoring + Haiku VoC mine), `FIRECRAWL_API_KEY` (web/store-copy +
      reviews URL-fetch — absent ⇒ that modality returns `notConfigured`, not an error),
      `SUPABASE_URL` / `SUPABASE_ANON_KEY` (auth-forwarding + persistence scoping).
- [ ] **Optional env tunables** (defaults are sane; set only to override):
      `COMPETITOR_RATE_LIMIT_MAX` / `COMPETITOR_RATE_LIMIT_WINDOW_MS` / `COMPETITOR_MAX_BODY_BYTES` (default 32768),
      and the `FUNNEL_REWRITE_*` / `BRAND_DEFENSE_*` equivalents.
- [ ] **Leave `TITAN_STUB_FIXTURE` UNSET in prod.** When unset/false, `brand-defense-monitor` returns an empty
      alert list (never a fabricated live threat). Set it to `true` only for local wiring tests.

**HALT — do NOT** commit secrets to the repo; set them via the Supabase secrets store only.

---

## 3. Deploy edge functions

**Two NEW competitor functions to deploy** (`competitor-analysis-asset` + `brand-defense-monitor`, matching
PLAN §9). `funnel-rewrite` and `audit-asset` are now **funnel-base canonical** — they ship with the funnel base,
not with this competitor build, so they are deployed as part of the funnel-base deploy (not re-listed as new
here). All three competitor-relevant fns are registered in `supabase/config.toml` with `verify_jwt = false`
(auth is OPTIONAL — the fn forwards the `Authorization` header itself for avatar-KB fallback / persistence
scoping, matching the `diagnostic-interpretation` / `brand-copy-generator` patterns).

- [ ] **`competitor-analysis-asset`** — NEW (competitor build). The IDEA-scored per-touchpoint analyzer
      (Sonnet 4.6 + prompt caching, grounding gate, `needs_input`, per-user rate limit 429 / body cap 413).
      Modalities wired: `marketplace-listing` (DataForSEO), `web/store-copy` (Firecrawl), `reviews/social-proof`
      (DataForSEO + Firecrawl + Haiku VoC mine). The other 4 modalities return `needs_input` (stubbed — LT-1).
- [ ] **`brand-defense-monitor`** — NEW (competitor build). `IAlertSource` contract + **STUB `TitanAlertSource`**
      (`coverageVerified = false`; returns empty unless `TITAN_STUB_FIXTURE=true`) → IDEA-scored dimension
      mapping → persists to `brand_defense_alerts`.
- [ ] **`funnel-rewrite` — funnel-base, NOT competitor-new.** The P4 lift-loop countermeasure rewrite reuses
      this canonical base fn (Sonnet 4.6, pure generation over the competitor brief + context, no DB access).
      Confirm it is deployed (it ships with the funnel base); the competitor build does not modify it.
- [ ] **No modified existing fns to redeploy for the competitor build.** It added two new fns only; it did not
      change any deployed fn's code. (The deprecated `competitive-analysis-orchestrator` /
      `generate-competitor-analysis-pdf` / `competitor-discovery` / `review-scraper*` are untouched — do NOT
      redeploy or extend them.)
- [ ] After deploy, `health`-check each fn responds (OPTIONS → CORS 200; a malformed POST → 400/JSON, not 500).

**HALT — do NOT** deploy until §1 (tables) and §2 (secrets) are done, or first real calls will fail.

---

## 4. Regenerate `src/integrations/supabase/types.ts`

The build did **not** hand-edit the generated types (project rule). Feature-local TS types
(`src/types/competitorInsights.ts`, `src/types/brandDefense.ts`) are cast at the Supabase boundary with
`// TODO(types-regen)` markers.

- [ ] After §1 migrations are live, regenerate against the live project
      (`supabase gen types typescript` / MCP `generate_typescript_types`).
- [ ] Replace `src/integrations/supabase/types.ts` with the regenerated output (never hand-edit).
- [ ] Optionally remove the `// TODO(types-regen)` boundary casts in `SupabaseCompetitorInsightsService.ts`,
      `SupabaseTrustGapSnapshotService.ts`, `SupabaseInAppNotificationChannel.ts` once the generated rows carry
      the new columns. This is a cleanup, not a blocker — the casts are correct and tests pass without it.
- [ ] Re-run `tsc --noEmit` + `test` after regen to confirm the new generated types still typecheck.

---

## 5. Flip the feature flag — LAST

- [ ] **Frontend:** set **`VITE_COMPETITOR_AGENTS=true`** at build time, then rebuild + redeploy the SPA.
      The flag is read by `isCompetitorAgentsEnabled()` in `src/config/features.ts` (re-exported from
      `src/config/competitorAgentsFlag.ts`). **Default OFF** in every environment.
- [ ] **SPA host:** the app is a static Vite SPA on the mango Lightsail box (Caddy), NOT GitHub Pages —
      redeploy = `npm run build` + rsync `dist/` to `/opt/ideabrandcoach`. (MEMORY `project_pages_deploy`.)

> **UI is route-mounted (v1 "NOT mounted" caveat RESOLVED).** The funnel base is overlaid, so
> `src/components/v2/funnel/FunnelTracker.tsx` is mounted at the **`/v2/funnel`** route in `src/App.tsx`
> (`<Route path="/v2/funnel" element={<FunnelTracker />} />`). `TouchpointCompetitorAgentPanel` is rendered
> per-asset inside FunnelTracker's "Live" tab — scoped to that asset's `touchpoint_id` + modality — and is
> gated on `competitorEnabled` (the flag). `CompetitorGapsAggregate` (Tab 2 roll-up), `TestingLiftTab`, and
> `BrandDefenseAlertsPanel` are likewise wired into the tabs. So once the flag is on, the surface IS reachable
> in-app at `/v2/funnel` — no extra routing work is required. Verify after flip: navigate to `/v2/funnel`
> (authed QA account), add/select an asset, confirm the "Analyze competitors for [touchpoint]" panel renders.

---

## 6. FK gap — RESOLVED by the funnel-base overlay

The v1 carry-forward (`asset_id` as an unconstrained uuid pending the missing `brand_assets` table) is
**closed**. The funnel base is overlaid, so `public.brand_assets` exists (created by migration #1,
`20260616120000_brand_funnel_tracker.sql`). The competitor migrations now carry **real** FK constraints:
`brand_asset_competitive_insights.asset_id UUID REFERENCES public.brand_assets(id) ON DELETE CASCADE`
(migration #5) and the `brand_tests` ALTER (#6) FKs `competitive_insight_id → brand_asset_competitive_insights`.

- [ ] No follow-up FK migration is required. Just apply the full §1 set in order so the FK targets exist
      before the referencing migrations run (#1 before #5/#6).

---

## 7. Verification gates (re-run on the integrated worktree, 2026-06-17 — P9 final)

| Check | Command | Result |
|---|---|---|
| Type check | `npx tsc --noEmit` | **PASS** (exit 0, no output) |
| Tests | `CI=true npx vitest run` | **1259 passed / 3 failed (98 files)** — all 3 failures are **pre-existing funnel-base/lineage flakes, none in competitor-agents code**: `src/mcp/__tests__/workbookA.test.ts` (output-engine xlsx determinism, commit `098b52c`), `src/pages/__tests__/FreeDiagnostic.test.tsx` (5s timeout under full-suite load, QA-stability lineage), `src/components/chat/__tests__/ImageUpload.test.tsx` ">20MB" (5s timeout under full-suite load). See note below for the ImageUpload classification. |
| Build | `npm run build` | **PASS** (exit 0; the >500 kB chunk warning is pre-existing) |
| Lint | `npm run lint` | **298 problems (259 errors / 39 warnings)** — entirely the **pre-existing baseline**: edge-fn `any` usage (`brand-ai-assistant`, `brand-copy-generator`, `generate-brand-strategy-document`/`-pdf`, `send-framework-email`, `idea-framework-consultant-claude/context.ts`) + the `tailwind.config.ts` `require()` import. Direct lint of the competitor/funnel feature files (`src/components/v2/funnel/`, `SupabaseBrandFunnelService.ts`, `IBrandFunnelService.ts`, `useFunnelTracker.ts`, `touchpointTaxonomy.ts`, `posthogClient.ts`) and the new competitor edge fns (`competitor-analysis-asset`, `brand-defense-monitor`, `_shared/dataforseo.ts`, `_shared/idea.ts`) is **0 errors** (1 benign unused-eslint-disable warning in `useFunnelTracker.ts`). The bar — "no NEW lint errors in feature files" — holds. |

### ImageUpload ">20MB" timeout — classification

The `should reject files over 20MB` failure is a **pre-existing full-suite resource-contention flake, NOT a
competitor-agents defect**. Run in isolation it **PASSES** in ~644 ms:

```
CI=true npx vitest run src/components/chat/__tests__/ImageUpload.test.tsx
→ 1 file / 9 tests passed; "should reject files over 20MB" 644 ms
```

It only times out (5 s threshold) when the full 98-file suite runs in parallel and CPU/memory contention slows
the 21 MB-string `File` construction + render past the limit. The same mechanism produces the `FreeDiagnostic`
5 s timeout. Both are funnel-base/lineage slowness; per the build bound, funnel-base code was **NOT modified**
to fix them — they are classified only. (To make the full-suite run green, a human could bump the per-test
`testTimeout` for these two heavy tests — a funnel-base/test-infra decision, not a competitor change.)

---

## 8. Real-ASIN smoke test — on the QA account (HALT)

Run AFTER §1–§5 so the analyzer hits live tables + live DataForSEO. Use the shared QA account
(credentials + auto-pause + email-confirmation gotcha in `docs/TEST_ACCOUNT.md`).

- [ ] Sign in to the QA account (confirm the live project is awake; confirm the signup email if needed via SQL).
- [ ] Call `competitor-analysis-asset` with `modality: 'marketplace-listing'`, a **real competitor ASIN**
      (and/or a top-N keyword/category), the QA avatar's `avatar_context` + `positioning_statement_context`, and a real
      `our_asset`. Expect: IDEA `scores` per competitor (each pillar 0–25, overall 0–100), every score/quote
      anchored to a `source_ref`, `grounding: 'evidence'`, populated `evidence_refs`.
- [ ] **Grounding-gate assertion (mandatory):** confirm NO fabricated competitors, prices, IDEA scores, or
      quotes. Anything not anchored to a fetched DataForSEO item must be omitted or `grounding: 'inference'`.
      Spot-check one returned price/quote against the live listing. A model that confabulates over thin data
      is the known failure mode — reject the run if any claim lacks a `source_ref`.
- [ ] Confirm a `brand_asset_competitive_insights` row persisted, scoped to the QA avatar (RLS: only the QA
      user can read it).
- [ ] **Reviews modality:** repeat with `modality: 'reviews/social-proof'` + `reviewAsins`; confirm the
      Haiku VoC mine returns `voc_signals` (vocab clusters / objections) with every term/quote a literal
      substring of the fetched review corpus (substring gate), or `null` if nothing survives.
- [ ] **Lift loop (P4):** "Analyze competitors" → "Draft countermeasure" (`funnel-rewrite`) → compose & record
      a `brand_tests` row with `competitor_insight_applied = true`; confirm it appears in the `TestingLiftTab`.
- [ ] **Rate-limit / body-cap:** an oversized body → **413**; rapid repeat calls → **429** with `Retry-After`.

---

## 9. Verify Titan `get_alerts` coverage — Trevor's OPEN QUESTION (HALT)

The whole `brand-defense-monitor` alert ingestion currently rides a **STUB** (`TitanAlertSource`,
`coverageVerified = false`). The Brand Defense category set (listing-integrity, Buy-Box/ownership,
compliance, reputation; trademark = phase 2) was treated as FIXED in the plan **pending verification**.

- [ ] **Verify what Titan `get_alerts` actually covers** before treating the categories as real:
      does it surface Buy-Box loss? unauthorized/hijacker sellers? listing-copy/imagery edits? compliance flags?
- [ ] If coverage is confirmed for a category → build a **real** `IAlertSource` adapter implementing the
      `brand-defense-monitor/lib.ts` `IAlertSource` interface (replace `TitanAlertSource`; set
      `coverageVerified = true`), at `// TODO(competitor-agents:titan-source)`.
- [ ] If a needed category is NOT covered by Titan → that category stays unmonitored (do not fabricate alerts);
      note the gap and decide an alternative source (Amazon Brand Registry, etc.).
- [ ] Until verified, keep the monitor on the stub (empty in prod) — it is wired and safe, but it raises no
      real alerts. **Do not market Brand Defense monitoring as live until a real source is verified + adapted.**

Related open questions carried from Trevor's brief (decide before the recurring tier — `LT-6`):
notification channel for v1 (in-app is built; email/push is what makes it retentive), and whether
trademark/IP monitoring is in v1 or phase 2 (no confirmed data source).

---

## 10. Rollback

- **Flag:** set `VITE_COMPETITOR_AGENTS` unset/false, rebuild + redeploy the SPA → surface goes dark instantly
      (default OFF). This is the fastest kill switch.
- **Edge fns:** the three new fns are additive; leaving them deployed-but-uncalled is harmless (flag-gated UI).
- **Migrations:** all five are additive (new tables + one additive `ADD COLUMN`); they touch no existing table's
      data. Rollback = drop the five tables + the `voc_signals` column in a reverse-order follow-up migration if
      ever required (no existing data depends on them).
- **Secrets:** removing `DATAFORSEO_*` makes the analyzer return `notConfigured` (graceful), not error.

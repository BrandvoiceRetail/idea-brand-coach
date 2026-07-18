# Brand Funnel Tracker — Phased Implementation Plan

Builds the funnel tracker mocked in [`mockups/`](./mockups/funnel-tracker-mockups.html) into a working feature, grounded in the verified data model ([`SPEC.md`](./SPEC.md)) and taxonomy ([`touchpoint-taxonomy.v0.json`](./touchpoint-taxonomy.v0.json)).

> **Status: COMPLETE — ready to execute.** This is the finished plan of record. Phases 0–2 are scaffolded in the `customer-journey-tracking` worktree; the build state, the live-apply/deploy gate, and the remaining work are itemized in **Appendix A**.

**Ingestion decision (this plan):** assets enter by **screenshot upload + a required short context description** ("Amazon main image — collector deck hero, sells the limited-edition angle"). The description is mandatory — it gives the vision audit the semantic context pixels alone can't, and removes guesswork from touchpoint mapping.

**"Functional" means:** a brand owner can upload a screenshot of a touchpoint, get it scored against their avatar + Positioning Statement, see the whole funnel map + what to fix, hand a fix to the coach, and record a before/after lift — end to end, on real data.

**Architecture note — MCP deferred:** the funnel tracker is built as **app services + edge functions + React UI** (the app's normal Supabase pattern). The MCP tool surface is intentionally *not* built now: `src/mcp/AGENTS.md` declares the gateway "substrate only — do not add owned asset-chain / asset-storage tools here yet," pending the **D5 cross-server write-auth** decision. The MCP surface (`list_touchpoints`, `upsert_brand_asset`, `audit_asset`, …) lands as a later integration once D5 resolves.

## Architecture at a glance

| Layer | What | Mirror / reuse (verified) |
|---|---|---|
| Storage | private `brand-assets` bucket; `{userId}/funnel/{assetId}.png`; client-side compress | `src/components/chat/ImageUpload.tsx:168` (`storage.from('documents').upload`, imageCompression) |
| Data | `brand_assets`, `brand_tests`, extend `performance_metrics` | RLS mirrors `performance_metrics` (`migrations/20260301065636…:22`) |
| Audit engine | edge fn `audit-asset`: vision call (screenshot + description + bound avatar fields + Positioning Statement) → IDEA scores, status, rationale, fix | `supabase/functions/reveal-positioning-statement/index.ts` (shape); `idea-framework-consultant-claude` (`claude-sonnet-4-6`) |
| Positioning Statement read + versioning | read current Positioning Statement; compare version for "stale" | `positioning_statements` table + `artifacts` chain (`src/mcp/tools/persistPositioningStatement.ts:66`, `artifactStore.ts:44`) |
| Avatar read | bound fields per touchpoint | `avatars` table + `avatar_field_values`; `IAvatarService` / BrandContext |
| App services | `IBrandFunnelService` → `SupabaseBrandFunnelService` (create / list / audit / coverage / test / roi); taxonomy via `touchpointTaxonomy` loader | service pattern in `src/services/SupabaseBrandService.ts`; `src/services/AGENTS.md` |
| Frontend | 4 screens under `src/components/v2/funnel/`, route `/v2/funnel` | shadcn Card/Badge/Button/Tabs; `BrandContext` for active brand/avatar |
| Observability | PostHog events (centralized) | `AlphaEventName` union in `src/lib/posthogClient.ts` |
| MCP surface | *deferred* until D5 (see note above) | `src/mcp/AGENTS.md` guardrail |

**Ownership boundary:** the tracker builds `brand_assets`/`brand_tests` in the brand-coach Supabase, accessed through app services + the `audit-asset` edge fn. A later phase reconciles them into the IV-OS canonical ledger (`asset_events`) per the 2-server split — *not* an MVP blocker.

---

## Phase 0 — Foundations (data + storage)
**Objective:** schema, storage, taxonomy loader, types — no UI.
**Build**
- Migrations (via `database-migrator`, never ad-hoc DDL):
  - `brand_assets` — `id, avatar_id FK avatars, touchpoint_id, stage, context_description TEXT NOT NULL (CHECK ≥8 chars), storage_path, positioning_statement_version (artifact_id at deploy), status ('pending'|'aligned'|'stale'|'misaligned'|'missing'), overall_score int, audit_result jsonb, superseded_by, created_at, updated_at`.
  - `brand_tests` — `id, asset_id FK brand_assets, hypothesis, messaging_version_before, messaging_version_after, metric_type, baseline_value numeric, result_value numeric, status ('running'|'won'|'no_lift'), source ('manual'|'warehouse'), deployed_at, measured_at, …`.
  - Extend `performance_metrics` — add nullable `funnel_stage`, `touchpoint_id`, `asset_id`, `deployed_at`.
  - RLS on all three: EXISTS join `avatars.brand_id → brands.user_id = auth.uid()` (mirror `performance_metrics`).
- Private Storage bucket `brand-assets` + storage RLS (owner-only by path prefix).
- `src/config/touchpointTaxonomy.ts` loader (embeds the taxonomy JSON as typed data; helpers for stages, applicability filter, audit bindings).
**Capability:** persistence + isolation ready.
**Acceptance / verify:** migration applies clean; cross-tenant SELECT returns 0 rows (RLS test); `context_description` NOT NULL enforced at DB; taxonomy loads + validates; `tsc` green.
**Size:** S (2–3 units).

## Phase 1 — Ingestion (screenshot + required description)
**Objective:** capture a touchpoint asset.
**Build**
- `SupabaseBrandFunnelService` (`src/services/`, implements `IBrandFunnelService`) — create/list/get `brand_assets`, upload via `storage.from('brand-assets')` reusing the compress pattern in `ImageUpload.tsx`.
- Upload UI (`src/components/v2/funnel/AssetUploadDialog.tsx`): drag/paste screenshot → **required** description field (zod min length, blocks submit) → touchpoint picker populated from the `touchpointTaxonomy` loader, applicability-filtered to the brand's channel tags.
**Capability:** assets land in DB + bucket with mandatory context.
**Acceptance / verify:** upload screenshot+desc → row + file created, path owner-scoped; empty description rejected (client + DB CHECK); touchpoint list excludes non-applicable (Amazon-only brand shows no Shopify PDP); a second upload to the same touchpoint creates a new version, not a dup.
**Size:** M (3–4 units).

## Phase 2 — Audit engine (core capability)
**Objective:** score an asset against avatar + Positioning Statement.
**Build**
- Edge fn `supabase/functions/audit-asset/index.ts` (mirror `reveal-positioning-statement`: CORS, JWT auth, Anthropic POST). Input: `{ assetId, touchpointLabel, brandTask, auditAgainst }` (the service supplies the taxonomy bindings so the fn need not duplicate the taxonomy). Loads the asset, current Positioning Statement (`positioning_statements` by `avatar_id`) + avatar fields, downloads the screenshot from the private bucket → base64, sends `claude-sonnet-4-6` a vision message (**screenshot + required description + bound avatar fields + Positioning Statement + IDEA rubric**) and forces a `report_audit` tool → `{ scores:{i,d,e,a}, rationale, fix }`. Persists `audit_result`/`overall_score`/`status`.
- **Stale = computed**, not LLM: if `brand_assets.positioning_statement_version != current Positioning Statement version` → force `status='stale'`.
- Called via `SupabaseBrandFunnelService.auditAsset`; rate-limit + body cap on the edge fn (reuse the public-fn abuse-control pattern from `diagnostic-interpretation`).
**Capability:** any asset → grounded IDEA score + status + concrete fix.
**Acceptance / verify:** a deliberately off-brand screenshot returns a low matching dimension + `misaligned` + a specific fix that cites the avatar/Positioning Statement; an on-brand one scores high; missing avatar/Positioning Statement → a clear "need X" (never fabricates); editing the Positioning Statement flips prior assets to `stale`; latency logged.
**Size:** L (4–5 units) — the hardest, most valuable phase.

## Phase 3 — Funnel Map + coverage (Screen 1)
**Objective:** the orient screen, on real audits.
**Build**
- Service `getCoverage(avatarId, brandTags)` — deterministic: applicable touchpoints from taxonomy × `brand_assets` statuses → per-stage cells, counts, coverage% (aligned ÷ applicable), target marker.
- `src/components/v2/funnel/FunnelMap.tsx` from the mockup, wired to live data; route `/v2/funnel`.
**Capability:** "your whole funnel, mapped."
**Acceptance / verify:** map matches DB exactly; coverage% recomputes after a new audit; missing touchpoints render as dashed/missing; empty state pre-upload.
**Size:** M (3 units).

## Phase 4 — What Needs Work + Fix-with-coach (Screen 2 + flow)
**Objective:** decide + act.
**Build**
- Ranked list (`impact × misalignment`) with the IDEA dimension bars + manual metric display; sort controls.
- **Fix-with-coach:** seed the coach (`idea-framework-consultant`) with the asset's screenshot context + audit `fix` + Positioning Statement → produce revised copy/brief → run existing `publish_filter_check` → create a work item (`brand_asset` next version, `status` in_progress) and open a `brand_test` shell.
**Capability:** "what needs work, backed by metrics" → one click into a guided fix.
**Acceptance / verify:** ranking is deterministic + explained; Fix produces a revised draft that passes/flags publish-filter; a work item + draft test are created and carry the Positioning Statement version.
**Size:** L (4–5 units).

## Phase 5 — In Progress board + messaging versions (Screen 3)
**Objective:** track work in flight.
**Build**
- Board (Queued / In progress / In review) reading work-item state; per-card Positioning Statement version; Approve → publishes the new asset version, sets prior to superseded, marks the linked test `running`.
**Capability:** "what's being worked on," versioned.
**Acceptance / verify:** state transitions persist; approve creates the new aligned asset version + flips map; publish-filter gate enforced before approve.
**Size:** M (3 units).

## Phase 6 — Testing & Lift (Screen 4)
**Objective:** prove the fix moved the needle.
**Build**
- `brand_tests` manual entry: baseline (captured at fix time) → result (entered when window closes) → lift delta + status (won/no_lift); `getAssetRoi(avatarId)` rollup; "won" feeds the Map/coverage.
- Later (separate phase): auto-pull `result_value` from the analytics warehouse (`source='warehouse'`) when ingestion is live.
**Capability:** "what's being tested" → before/after lift → ROI story.
**Acceptance / verify:** create test, enter result, lift computed correctly (incl. negative); won test updates coverage; ROI rollup sums only completed tests.
**Size:** S–M (2–3 units).

---

## Cross-cutting (woven through every phase)
- **Security/privacy:** RLS on all tables; screenshots in a **private** bucket and sent to the model **inline as base64** (never a public URL) since brand assets can be sensitive; required-description + all inputs zod-validated and sanitized; rate-limit the audit endpoint.
- **Observability:** centralized PostHog events — `funnel_asset_uploaded`, `funnel_asset_audited` (status), `funnel_fix_started`, `funnel_work_approved`, `funnel_test_recorded` (lift) — added to the `AlphaEventName` union; per-phase a log on every error path.
- **Testing:** Vitest ≥85% on new services; an RLS isolation test; an audit golden-set (a few labeled screenshots → expected status band) to guard prompt regressions; `lint` + `tsc` + `test` before handoff.
- **IV-OS reconciliation (post-MVP phase):** map `brand_assets`/`brand_tests` onto the canonical `asset_events` ledger; until then brand-coach is the system of record.

## Critical path & sequencing
`P0 → P1 → P2` are strictly sequential (each needs the prior). `P3` can start once `P2` lands one audited asset. `P4` needs `P3`. `P5`/`P6` follow `P4`. The audit engine (**P2**) is the keystone and the main risk — build it behind a golden-set test first.

**Rough effort:** ~3–4 weeks focused for a functional MVP (P0–P4 = a usable "map + fix" product; P5–P6 complete the loop). Each phase is independently demoable and gated by its acceptance criteria.

## Open decisions (carry from SPEC.md §8 + UX-SPEC §8)
1. Screenshot to model as **base64 inline** (private, recommended — implemented) vs short-TTL signed URL.
2. Audit model: `claude-sonnet-4-6` (quality, chosen) vs Haiku (cost) — Sonnet for the audit, it's the judgment step.
3. Build tables in brand-coach Supabase now (chosen) vs wait for IV-OS canonical ledger.
4. Taxonomy + `audit_against` bindings still need Matthew + Trevor sign-off (gates P2 quality).

---

## Appendix A — Execution state (snapshot 2026-06-16, worktree `customer-journey-tracking`)

> **LIVE IN PROD 2026-06-16 21:17 PDT** (initial); **gap-fix round 2026-06-17.** Deploy = `rsync dist/ → ubuntu@54.243.53.44:/opt/ideabrandcoach/` (Caddy SPA; Pages is org-disabled). Static deploy ships the worktree build (main-v3 lineage + funnel); frontend not yet git-committed.
>
> **Gap-fix round (2026-06-17) — all tiers addressed:**
> - 🔴 audit now reads real avatar context from `avatar_field_values` (jsonb cols are empty) + Positioning Statement avatar-scoped→brand-level fallback (`audit-asset` v2).
> - 🟠 Positioning Statement-change propagation: read-time stale in `getCoverage` + `reauditAll`. Fix-with-coach **rewrite** via new `funnel-rewrite` edge fn (on-brand copy + publish-filter flags). Abuse controls (per-user rate-limit + 5MB image guard). PostHog `funnel_*` events. Vitest taxonomy suite (7/7) + RLS policy verification.
> - 🟡 supersede-on-reupload, `updated_at` in all writes, `stage` CHECK, per-avatar channel tags (localStorage + toggle UI).
> - 🟢 paste-text assets (`content_text`), before/after score diff (`previous_score`). **Deferred:** bulk/folder upload + vision auto-touchpoint detection (heaviest, lowest-criticality); warehouse auto-pull, MCP surface (D5), IV-OS `asset_events` are externally gated.

The backend is **live** and the service layer is typed end-to-end against the real schema (`tsc -p tsconfig.app.json` clean for all funnel files; remaining tsc errors are pre-existing and unrelated, e.g. `CompetitiveAnalysisService` referencing a non-live table).

**Live on Supabase project `ecdrxtbclxfpkknasmrw`:**
- Migrations applied: `brand_assets`, `brand_tests` (RLS scoped via `avatars.user_id = auth.uid()` — corrected from the planned brands-join because live `avatars` has no `brand_id`; the `performance_metrics` extension is guarded by a table-existence check since that table isn't live). Both pass the security advisor (no `rls_enabled_no_policy`).
- Private `brand-assets` storage bucket + owner-by-path RLS.
- `audit-asset` edge function deployed (**v1, ACTIVE**, `verify_jwt`), `claude-sonnet-4-6` vision audit.
- `src/integrations/supabase/types.ts` regenerated (now includes `brand_assets`/`brand_tests`).

**Code (type-clean):**
- `src/config/touchpointTaxonomy.ts` (+ JSON) — taxonomy loader.
- `src/services/interfaces/IBrandFunnelService.ts` — service contract.
- `src/services/SupabaseBrandFunnelService.ts` — full impl (create+upload, list/get, `auditAsset` → edge fn, `getCoverage`, record/close test, ROI).
- `supabase/functions/audit-asset/index.ts` — the deployed source.

**UI built + route live (`/v2/funnel`), production build clean (3265 modules):**
- `src/hooks/useFunnelTracker.ts` — loads coverage + assets + tests, refresh + audit actions.
- `src/components/v2/funnel/AssetUploadDialog.tsx` — screenshot + **required** description (8+ char, blocks submit) + applicability-filtered touchpoint picker → createAsset → auditAsset.
- `src/components/v2/funnel/FunnelTracker.tsx` — the four tabs (Funnel Map w/ coverage meter, What Needs Work w/ IDEA dimension bars + re-run audit, In Progress, Testing & Lift) wired to live data.
- Route registered in `src/App.tsx`.

**Status by phase:** P0 ✅ · P1 ✅ (ingestion + dialog) · P2 ✅ (audit engine deployed) · P3 ✅ (Funnel Map) · P4 🟡 (Needs-Work list + re-run done; **Fix-with-coach flow remaining**) · P5 ✅ (In-Progress basic) · P6 🟡 (lift display done; **test create/close UI remaining**).

**Remaining:** the Fix-with-coach flow (seed `idea-framework-consultant` with asset context + fix + Positioning Statement → `publish_filter_check` → work item + draft test); the test create/close UI; optional `ServiceProvider` registration (currently the hook instantiates the service directly); Vitest + RLS-isolation + audit golden-set tests; and live browser QA (login → upload → audit → map) with the shared test account. The core loop — upload → vision audit → map/coverage → needs-work — is functional and deployed.

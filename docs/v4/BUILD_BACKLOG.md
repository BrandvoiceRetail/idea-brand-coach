# /v4 Build Backlog — Loops 2 & 3 (S-07..S-21)

Dependency-ordered story list to finish the /v4 surface after Loop 1 (onboarding,
S-03..S-06) and this scaffolding pass. Loop 1 (megaprompt → read-it-back theatre
→ confirm/edit → Context Card) is built; the spine/shell (sidebar, sticky spine
stepper, bottom-nav), `V4ContextStore`, and the Loop-2/Loop-3 screen scaffolds
(each a "coming in build phase N" placeholder) are wired today.

**Routes already mounted** (`src/App.tsx`, under `V4Layout`):
`/v4` (onboarding) · `/v4/diagnose` (V4Stage → deep-links `/v3/diagnostic`) ·
`/v4/analyse` (V4Analyse = Loop 2) · `/v4/fix` (V4Fix = Loop 3) ·
`/v4/remeasure` + `/v4/defend` (V4Stage placeholder) · `/v4/tools`.

**Backend legend.** ✅ = live MCP tool (`src/mcp/`). 🟡 = exists but needs
extension. 🔴 = net-new, must be built (see "Backend backlog" at the end).

---

## Phase 2 — Loop 2: Analyse (Avatar → Decision Trigger → Move → Brief)

Page: `src/pages/v4/V4Analyse.tsx`. Screens: `src/components/v4/analyse/*`.

### S-07 — Analyse run (build-theatre)
- **Files:** `src/components/v4/analyse/AnalyseRun.tsx`; reuse
  `src/components/v4/onboarding/OnboardingReflectionRun.tsx` timeline +
  `src/hooks/useForensicAvatarBuild.ts`; types in `src/types/onboardingReflection.ts`.
- **Backend:** `run_trust_gap` ✅, `run_diagnostic_evidence` ✅,
  `build_avatar_stage` ✅, `get_context_status` ✅.
- **AC:** live per-step timeline; one grounded finding per `done` step, null
  otherwise (no fabrication); pulls inputs only from confirmed context, asks when
  missing; 0 overflow at 375px.
- **Effort:** M (2–3d) — mostly reuse of the Loop-1 run engine.

### S-08 — Avatar 2.0 portrait
- **Files:** `src/components/v4/analyse/AvatarProfile.tsx`; reuse
  `src/components/v4/onboarding/AvatarPortraitCard.tsx`; types `src/types/avatar.ts`.
- **Backend:** `create_avatar` ✅, `build_avatar_stage` ✅, `get_avatar` ✅,
  `list_avatars` ✅, `set_primary_avatar` ✅.
- **AC:** four fields (who/problem/desire/channel) from the user's own words;
  editable + persisted; restated, never invented; sets the active avatar the rest
  of the loop reasons over.
- **Effort:** M (2–3d).

### S-09 — Gap + Decision Trigger panel
- **Files:** `src/components/v4/analyse/GapDecisionTriggerPanel.tsx`.
- **Backend:** `run_trust_gap` ✅, `identify_decision_trigger` ✅,
  `compute_trust_gap_lift` ✅.
- **AC:** shows Trust Gap score + the named Decision Trigger + the evidence behind
  it; Tier-C terms never leak; honest "not enough evidence yet" state.
- **Effort:** S (1–2d).

### S-10 — Decision Board (NET-NEW)
- **Files:** `src/components/v4/analyse/DecisionBoard.tsx`.
- **Backend:** `generate_positioning_moves` 🔴 (new), criteria scoring via existing
  eval criteria (`src/mcp/evals/criteria`); `generate_concepts` 🟡 as a fallback.
- **AC:** 2–3 candidate positioning moves, each scored against live coach criteria
  with the score rationale; user selects one (`onChooseMove`) → feeds S-11.
- **Effort:** L (4–5d incl. the new tool).

### S-11 — Move → 7-slot brief + claim gate
- **Files:** `src/components/v4/analyse/MoveBriefClaimGate.tsx`.
- **Backend:** `generate_brief` ✅ (7-slot), `publish_filter_check` ✅,
  `provide_context` ✅.
- **AC:** chosen move expands to a 7-slot brief; every product claim runs the
  fabrication gate; unconfirmed claims flagged, not shipped as fact.
- **Effort:** M (2–3d).

---

## Phase 3 — Loop 3: Fix / Funnel (Map → Work → Asset → Drift)

Page: `src/pages/v4/V4Fix.tsx`. Screens: `src/components/v4/fix/*`.

### S-12 — Funnel Map
- **Files:** `src/components/v4/fix/FunnelMap.tsx`; reuse `FunnelTracker`
  (`/v2/funnel`) data shape.
- **Backend:** `list_funnel_inventory` ✅, `get_funnel_coverage` ✅,
  `get_funnel_assets` ✅, `ingest_funnel_analytics` 🔴 (new).
- **AC:** five stages (Visibility→Clicks→Orders→Revenue→Profitability), per-
  touchpoint status colours (v23 tokens); no-data is explicit, never faked.
- **Effort:** L (4d).

### S-13 — What needs work (impact-ranked)
- **Files:** `src/components/v4/fix/WhatNeedsWork.tsx`.
- **Backend:** `run_funnel_audit` ✅, `get_funnel_audit` ✅, `run_marketing_audit`
  ✅, `get_campaign_metrics` 🔴 (new, for lift ranking).
- **AC:** touchpoints ranked by potential lift on the numbers; each row opens its
  Asset detail (`onSelectAsset`).
- **Effort:** M (3d).

### S-14 — Asset detail tabs
- **Files:** `src/components/v4/fix/AssetDetailTabs.tsx` (shadcn Tabs shell already
  wired: image-prompt / design-brief / check-asset).
- **Backend:** `generate_brief` ✅, `generate_canvas` ✅, `publish_filter_check` ✅,
  `audit_asset` ✅, `record_assessment` ✅, `get_asset` ✅, `get_asset_history` ✅.
- **AC:** three working tabs; check-asset audits against avatar + Signature and
  records the verdict; copy is claim-gated.
- **Effort:** L (4–5d).

### S-15 — Signature drift
- **Files:** `src/components/v4/fix/DriftBanner.tsx`.
- **Backend:** `persist_signature` ✅, `audit_asset` ✅, `list_assets` ✅.
- **AC:** on Signature change, flags assets built against the old Signature with a
  re-check link; self-hides at 0 drift.
- **Effort:** S (1–2d).

---

## Phase 3b — Re-measure & Defend (S-16..S-18, currently V4Stage placeholders)

### S-16 — Re-measure (lift on the numbers)
- **Files:** new `src/pages/v4/V4Remeasure.tsx` + `src/components/v4/remeasure/*`;
  route swap `remeasure` → `V4Remeasure` in `src/App.tsx`.
- **Backend:** `compute_trust_gap_lift` ✅, `get_campaign_metrics` 🔴,
  `ingest_campaign_analytics` 🔴, `get_sequence_performance` 🔴.
- **AC:** before/after on CTR/CVR/AOV/revenue tied to the brand change; honest
  no-data; deterministic delta (no snapshot-table dependency).
- **Effort:** L (4d).

### S-17 — Defend (hold the gains)
- **Files:** new `src/pages/v4/V4Defend.tsx` + `src/components/v4/defend/*`; route
  swap `defend` → `V4Defend`.
- **Backend:** `run_marketing_audit` ✅, `list_assets` ✅, competitor reads
  (deferred per Alpha); `export_workbook` ✅.
- **AC:** monitors drift + competitive pressure; surfaces a defend checklist;
  workbook export of the full loop.
- **Effort:** M (3d).

### S-18 — VersionGate force-flag + nav polish
- **Files:** `src/config/v4.ts` (`isV4Forced`), `src/pages/VersionGate.tsx`,
  `src/components/v4/V4Sidebar.tsx` + `V4BottomNav.tsx`.
- **Backend:** none.
- **AC:** `VITE_FORCE_V4` routes all users into /v4 without removing legacy routes;
  active-stage highlighting consistent across stepper/sidebar/bottom-nav.
- **Effort:** S (1d).

---

## Phase 4 — Cross-cutting (S-19..S-21)

### S-19 — Coach transparency (server narration + two-surface check)
- **Files:** `src/mcp/server.ts` (SERVER_INSTRUCTIONS), `src/mcp/` conformance
  test; in-app build-theatre already covered by S-07.
- **Backend:** prompt change + drift guard.
- **AC:** coach announces each tool it runs and why; two-surface conformance test
  green; no Tier-C leakage.
- **Effort:** M (2–3d).

### S-20 — Campaign/analytics backend (enables S-10/S-13/S-16)
- **Files:** `supabase/migrations/<new>.sql` (campaigns, campaign_metrics,
  email_sequences, email_steps; RLS owner-scoped — DO NOT apply to prod);
  `src/mcp/tools/*` + register in `server.ts` + `toolManifest.ts` + drift-guard
  test; services `CampaignService`, `AnalyticsIngestService`, `EmailSequenceService`.
- **Backend (NET-NEW 🔴):** `create_campaign`, `get_campaign`, `list_campaigns`,
  `update_campaign_status`, `ingest_campaign_analytics`, `ingest_funnel_analytics`,
  `ingest_content_performance`, `get_campaign_metrics`, `create_email_sequence`,
  `add_email_step`, `get_sequence_template`, `list_sequences`,
  `get_sequence_performance`, `generate_positioning_moves`.
- **AC:** ingestion accepts the real file shapes (funnel tracker / Amazon
  conversion-path / content_tracker_v2); coach reasons over the numbers; honest
  `no_data` (never fabricated); unit-tested with a mocked Supabase client.
- **Effort:** XL (1–2wk) — this is the backend gate for several Phase-2/3 stories.

### S-21 — E2E + mobile QA across /v4
- **Files:** `src/pages/__tests__/`, Playwright specs, folder `AGENTS.md` per
  feature area (`analyse/`, `fix/`).
- **Backend:** none.
- **AC:** 0 horizontal overflow at 375px on every /v4 screen; gap reachable in ≤2
  scrolls; ≥85% coverage on new code; terminology-leak lint green.
- **Effort:** M (3d).

---

## Backend backlog summary (🔴 net-new, build before the screens that need them)

| Tool | Unblocks | Story |
|------|----------|-------|
| `generate_positioning_moves` | Decision Board | S-10 |
| `ingest_campaign_analytics` / `get_campaign_metrics` | What-needs-work, Re-measure | S-13, S-16 |
| `ingest_funnel_analytics` | Funnel Map | S-12 |
| `ingest_content_performance` | content_tracker ingestion | S-20 |
| campaign CRUD + email-sequence tools | campaign/email surface | S-20 |

Build order: **S-20 (backend) → S-07/S-08/S-09 (Analyse core) → S-10/S-11
(move+brief) → S-12..S-15 (funnel) → S-16/S-17 (remeasure/defend) → S-18/S-19/S-21
(polish + transparency + QA).**

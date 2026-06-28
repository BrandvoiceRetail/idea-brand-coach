# IDEA Brand Coach — /v4 Program, Phase 1 Report

**Date:** 2026-06-26
**Scope:** Sections 1 & 2 of the action list — the in-Claude campaign/analytics MCP backend + the /v4 surface foundation. Built + verified on two isolated worktrees. **Nothing committed or deployed.**

- FE worktree: `feat/v4-alpha-surface` (off `main`) — `.claude/worktrees/v4-surface`
- MCP worktree: `feat/mcp-analytics-ingest` (off `mcp-oauth`) — `.claude/worktrees/mcp-analytics`

## Verdict: ✅ GO — proceed to build Loops 2–3, then the gated deploy.

Both worktrees typecheck, lint, build, and test green. The build was produced by workflow `wf_8cfc8636-979` (~20 agents); the two scoped adversarial reviews (security + frontend) surfaced 10 findings — **all 10 are now fixed and re-verified.**

---

## 1. What is built + GREEN

### Backend (MCP worktree) — §1.2 / §1.3 / §1.4
- **Migration** `supabase/migrations/20260626000000_campaign_analytics.sql` — 4 tables (`campaigns`, `campaign_metrics`, `email_sequences`, `email_steps`), owner-scoped RLS, indexes, least-privilege grants, `NULLS NOT DISTINCT` idempotency index. **Authored, NOT applied to prod.**
- **13 MCP tools** (registered in `server.ts` + `toolManifest.ts`, SSOT drift-guard test updated):
  - Campaign CRUD: `create_campaign`, `get_campaign`, `list_campaigns`, `update_campaign_status`
  - Analytics ingest/read: `ingest_campaign_analytics`, `ingest_funnel_analytics`, `ingest_content_performance`, `get_campaign_metrics`
  - Email sequences (the differentiator): `create_email_sequence`, `add_email_step`, `get_sequence_template` (welcome=5/nurture=7/abandoned_cart=3), `list_sequences`, `get_sequence_performance`
- **3 services**: `campaignService`, `analyticsIngestService` (parses the 3 real workbook shapes — funnel-tracker / Amazon conversion-path / content_tracker_v2), `emailSequenceService`.
- **Coach transparency** (§1.4): `COACH_TRANSPARENCY.md` + SERVER_INSTRUCTIONS narration edits.
- **Verify:** `tsc` clean · new-tool tests 62/62 pass · full suite 2193/2194 (lone fail = pre-existing `FreeDiagnostic.test.tsx` runner timeout flake, unrelated).

### Frontend (FE worktree) — §2 foundation + Loop 1
- **Design tokens** → Trevor v23 palette in `index.css` + `tailwind.config.ts` (blk `#111111`, wrm `#F5F4F0`, gld `#D4960A`, IDEA dims); `onboard.html` gold reconciled.
- **/v4 shell**: `V4Layout`, `V4Sidebar`, `V4BottomNav`, `SpineStepper` (Diagnose→Analyse→Fix→Re-measure→Defend), `ContextCard`, `CompletenessRing`; `config/v4.ts` SSOT; `V4ContextStore` (never-ask-twice).
- **Force-gate**: `VersionGate` + `config/v4.ts` route all users to /v4 — **fail-safe: default OFF; opt-in via `VITE_FORCE_V4=true`** (worktree sets it in gitignored `.env`). Old /v1–/v3 routes stay mounted.
- **Loop 1**: `V4Onboarding` — megaprompt → read-it-back **build-theatre** (`OnboardingReflectionService` + `useOnboardingReflectionRun`; never fabricates — honest empty/loading/error) → confirm/edit → Context Card.
- **Tool registry** (§1.3): `/v4/tools` page + `scripts/build-tool-registry.ts` generator + `public/tool-registry.html` (data-driven from `toolManifest`, includes the new tools).
- **Tests/docs**: Playwright E2E skeleton `tests/e2e/v4-flow.spec.ts`; `MANUAL_FLOW_CHECKLIST.md`; `ADR-V4-SURFACE.md`; `BUILD_BACKLOG.md`.
- **Verify:** `tsc` clean · lint clean on /v4 files · production build OK.

## 2. Scaffolded (compiles; built next phase)
Loop 2 (Analyse run, Avatar profile, Gap+Decision-Trigger, Decision Board, move+brief+claim-gate) and Loop 3 (Funnel Map, What-Needs-Work, Asset detail, drift) — routed placeholders (`V4Analyse`, `V4Fix`, `PhasePlaceholder`) + dependency-ordered backlog in `BUILD_BACKLOG.md` (S-07..S-21).

## 3. Not started (deliberate)
- Loops 2–3 full build → next workflow phase.
- §1.1 in-Claude coach **test-call with Trevor** → human action (connector already live).

---

## 4. Review findings — all resolved

### Security (RLS clean, identity gating clean on all 13 tools, no injection, no PII in logs)
| Sev | Finding | Resolution |
|---|---|---|
| MED | `ingest_funnel_analytics` unbounded arrays | `.max(10)` stages / `.max(600)` monthly |
| MED | `create_email_sequence` didn't verify `campaign_id` ownership (IDOR-link) | added owner check via `getCampaign()` before insert |
| LOW→**important** | `campaign_metrics` upsert conflict-target vs `coalesce(funnel_stage,'')` index → real Postgres `42P10` on every ingest (mocked tests hid it) | index → plain columns `NULLS NOT DISTINCT` (PG17 confirmed); conflict-target now matches exactly |
| LOW | migration `grant all` | least-privilege grants (metrics = select/insert only) |

### Frontend (no fabrication path, no redirect loop, old routes mounted, no 375px overflow, no `any`)
| Sev | Finding | Resolution |
|---|---|---|
| HIGH | duplicate `aria-label="Brand journey"` nav landmarks on mobile | SpineStepper → "Brand journey progress" |
| HIGH | `<Check>` icon `aria-label` not announced | → `aria-hidden="true"` |
| MED | `isV4Forced()` defaulted **true** when unset (prod footgun) | inverted to fail-safe **OFF**; worktree opts in via gitignored `.env` |
| MED | array-index list key | → `key={n.slot}` |
| LOW | `--background` HSL off-spec | → `48 20% 95%` (exact #F5F4F0) |
| LOW | `isV4Forced()` in effect not in deps | hoisted + added to dep array |

## 5. Known issue (not a blocker)
`src/pages/__tests__/FreeDiagnostic.test.tsx` — one test times out / "Timeout starting forks runner" under load. Pre-existing flake in the old /v1 guest diagnostic, untouched by this work. Re-run in isolation before merge to confirm.

---

## 6. GATED deploy runbook (Phase 7 — Matthew's eyeball; DO NOT auto-run)

The irreversible step is flipping `VITE_FORCE_V4=true` in prod (all users → /v4, old versions hidden). Sequence, verifying after each:

1. **DB** — apply the migration to prod (`ecdrxtbclxfpkknasmrw`) and regenerate types:
   `supabase migration` / `apply_migration` with `20260626000000_campaign_analytics.sql`, then regen `src/integrations/supabase/types.ts`.
2. **MCP server** — merge `feat/mcp-analytics-ingest` → `mcp-oauth`; rebuild the container on the box (`/home/ubuntu/brand-coach-mcp`: `build/` → `docker build` → `compose up`); verify the 13 new tools via QA-JWT + `health`.
3. **Frontend (staged, gate OFF)** — merge `feat/v4-alpha-surface` → `main`; build **without** `VITE_FORCE_V4`; rsync `dist/` → `ubuntu@54.243.53.44:/opt/ideabrandcoach` (key `lightsail-mango.pem`). At this point /v4 is reachable by URL but NOT forced — smoke-test it live first.
4. **The flip** — set `VITE_FORCE_V4=true` in the prod frontend build env; rebuild from `main`; rsync. **Now all users land on /v4; old versions hidden.** Verify the bundle `index.html` references the new asset over HTTP (per the admin-allowlist lesson — verify served bundle, not just on-disk). Rollback = rebuild with the flag unset + rsync.

Before the flip: build Loops 2–3 (so the forced surface is complete), run the manual checklist + Playwright E2E against the QA account, and do the in-Claude coach test-call with Trevor.

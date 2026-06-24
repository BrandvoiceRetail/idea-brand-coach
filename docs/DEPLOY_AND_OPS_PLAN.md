# Deploy & Operations Plan — ideabrandcoach.icodemybusiness.com

> Status: **FINALIZED** (2026-06-14). All sections locked from research across deploy, testing, and observability.

## Context
The IDEA Brand Coach app is **live** as a static React/Vite SPA at
`https://ideabrandcoach.icodemybusiness.com`, served by Caddy `file_server` from
`/opt/ideabrandcoach` on the **mango AWS Lightsail box** (`54.243.53.44`), built from
`main` (`npm run build` → `dist/`) and rsync'd to the box (DNS A-record; Caddy auto-TLS).
A separate agent is concurrently standing up the **MCP gateway** at
`https://ideabrandcoach.icodemybusiness.com/mcp` (Caddy `/mcp` path route → Dockerized
gateway) — that work is tracked separately (`docs/MCP_CONNECT_GAPS.md`).

This plan finalizes three things and how they **evolve over time**:
1. **Deploy all the latest changes** to the live site.
2. **Testing access** — how testers reach the app and give feedback.
3. **An internal ops dashboard** — starts as a link to PostHog, grows into a custom
   CloudWatch dashboard with role-gated CloudTrail logs, a support-ticket system, and
   environment controls (rollback / deploy-next / run-regression).

## Phasing at a glance
| Phase | Deliverable | Effort | Hard dependency |
|---|---|---|---|
| **P1 — now** | Reconcile latest → `main`, build+deploy SPA, redeploy edge fns, tester-access package, ops dashboard **v0 (PostHog link)** behind an admin gate | days | admin-role gate; merge reconciliation |
| **P2 — next** | Support-ticket intake + admin view (Supabase table, extends `feedback_events`); "escalate feedback → ticket" | ~1 sprint | P1 admin gate |
| **P3 — when IAM ready** | Custom **CloudWatch dashboard** + **CloudTrail** log viewer, **role-gated** via a new `IdeaBrandCoachOpsRole` (STS assume-role) | ~1 sprint | new AWS IAM role |
| **P4 — env controls** | Dashboard buttons: **rollback**, **deploy next changes**, **run regression tests with latest** | ~1 sprint | CI trigger + versioned deploys |

---

## P1 — Deploy latest changes + testing access + ops dashboard v0

### 1a. Deploy all the latest changes (locked)
**Mechanics (proven this session):**
- **SPA:** in a clean worktree off `origin/main` → `npm ci && npm run build` → `cp dist/index.html dist/404.html` (SPA fallback) → `rsync -az --delete dist/ ubuntu@54.243.53.44:/opt/ideabrandcoach/` (key `~/.ssh/lightsail-mango.pem`). Content-only — **no Caddy restart**. SSH port 22 is IP-firewalled (use home WiFi or Lightsail browser SSH; cellular is blocked).
- **Edge functions** do NOT ride the SPA rsync — each changed one needs `supabase functions deploy <name>` (Ask-First per AGENTS.md). The IDEA-framework fix touches `diagnostic-interpretation`, `generate-brand-strategy-section`/`-document`, `reveal-signature`, `idea-framework-consultant-claude`; Alpha adds `avatar-*` + `save-feedback-event`. **Supabase free tier auto-pauses** — if NXDOMAIN/INACTIVE, restore the project (dashboard) and wait 1–3 min before deploying. (`competitive-analysis-orchestrator` still has wrong structural keys — separate refactor.)
- **Rollback:** before each rsync, snapshot the current `dist/` to `/opt/ideabrandcoach-releases/<ts>/` so rollback = rsync the prior snapshot back. (Enables the P4 rollback button.)

**Reconciliation order (locked).** `origin/main` already carries this session's onboarding + IDEA-framework fixes (#5–#11, incl. `dd3ec71`); local `main` is 1 behind → `git fetch && merge` first. Then merge the production-intended branches to `main` in this order — **`product-data` MUST precede `alpha-instrumentation`** (alpha's code expects the product-data schema) — each via test-merge → `lint`+`test` → PR:
1. `fix/diagnostic-interpretation-abuse-controls` — P1 security; low conflict.
2. `feat/product-data-hookup` — evidence root (ASIN/review ingestion, product+review tables, evidence prefill); **high conflict** (predates the IDEA fix).
3. `feat/alpha-instrumentation` — the Alpha lineage (diagnostic scorecard, Signature engine, coaching + Moment-1 feedback instrumentation); **largest/highest-conflict**. First push it to origin for backup and commit its ~54 untracked **output-engine** files to a `feat/output-engine` branch (per DIRECTIVE_2026-06-07) before merging.
4. `feat/feature-status-tracker` — journey bridge (scorecard → Signature, F-059); medium conflict.
5. `feature/intelligent-memory` — tool-only-turn coaching fix; low conflict.

**Parked:** `feat/brand-coach-mcp-host` (Beta); `feat/onboard-skeleton` (MCP — owned by the other agent). **Prune cruft:** `auto-claude/*`, `worktree-agent-*`, `phase-*-mvp-beta`, `backup/*`, `production-readiness`, `best-practices-audit`. **Conflict rules:** IDEA-framework text → take newest; edge-fn model id → `claude-sonnet-4-6`; migrations → accept all (numbered); `package.json` → merge then `npm install`.

**Guardrail:** run the regression suite (1b) on merged `main` before build+deploy. The Alpha **output-quality gate is a human (Matthew) review** (DIRECTIVE_2026-06-07), not automated — QA the full flow (sign in → diagnostic → Signature → coaching → export) before shipping.

### 1b. Testing access + regression (locked)
**Tester access:**
- **Authed app:** testers sign in at `/auth` → `/v2/coach` + all authed routes. Use the **shared QA account** in `docs/TEST_ACCOUNT.md` (`signatureqa20260526@gmail.com`). Self-signups work but the **live project requires email confirmation** — confirm new testers via SQL (steps in TEST_ACCOUNT.md). Supabase free tier auto-pauses → restore before a session.
- **Claude front door:** `/onboard.html` (copy-paste prompt now; the MCP connector once the other agent ships it).
- **Feedback capture:** the auto `BetaFeedbackWidget` (logged-in users, when `VITE_ENABLE_BETA_FEEDBACK=true`/`P0`) + the full form at `/beta-feedback` → `save-beta-feedback` edge fn. `feedback_events` carries the `posthog_distinct_id` join key, so feedback ties to the PostHog funnel.
- **Deliverable:** a one-page **tester guide** — live URL, QA creds, the critical flow to exercise (sign in → diagnostic → Trust Gap → coaching → export), and how to file feedback.

**Regression — "run tests with the latest changes":**
- **Current state:** 72 Vitest files (some **flaky** — `BetaFeedbackWidget`/`InteractiveIdeaFramework` hook-mock issues; edge-fn 410/500 when Supabase is paused); **no CI** (`.github/workflows/` has none for tests); Playwright is MCP-driven only (no `playwright.config.ts`/`test:e2e` script); `npm run lint` has ~13 errors (mostly `no-explicit-any` in tests); no `typecheck` script (run `npx tsc --noEmit`).
- **Make it a one-command gate:** add `"typecheck": "tsc --noEmit"`, a `playwright.config.ts` + ~5 critical-flow specs with `"test:e2e": "playwright test"`, and `"regression": "npm run lint && npm run typecheck && npm test && npm run test:e2e"` (plus `"regression:fast": "npm run lint && npm run typecheck"`). Critical E2E flows: auth → `/v2/coach` → diagnostic → Trust Gap → export; + feedback submit.
- **Use it:** run `npm run regression` on merged `main` **before** build+deploy (P4 wires this to a dashboard button that records PASS/FAIL). Near-term hardening: fix the flaky mocks in `src/test/setup.ts`; always restore Supabase before a run.

### 1c. Ops dashboard v0 — PostHog link (locked; agent-confirmed)
PostHog is **fully wired** (client `src/lib/posthogClient.ts` + server `src/mcp/posthog.ts`,
EU region, project **195536**) with a dashboard of 6 insights (signature funnel, MCP tool
activity, error monitoring, avatar pipeline, etc.) and the `feedback_events` join key.

Build:
1. **Add an admin role** (the app has no role model today): migration
   `ALTER TABLE profiles ADD COLUMN is_admin boolean DEFAULT false;` + set
   `is_admin=true` for `matthew@arisegroup.ai`. **Tighten `feature_flags` RLS** so only
   admins can write (today any authenticated user can — not production-safe).
2. **Add `/admin/ops` route** (reuse the existing authenticated `Layout` gate used by
   `/admin/feature-flags`, plus an `is_admin` check), containing links to:
   - **PostHog dashboard** → `https://eu.posthog.com/project/195536/`
   - **Feature flags** → `/admin/feature-flags` (existing `FeatureFlagAdmin`)
   - **Feedback events** → simple admin table view
3. Ships with the P1 SPA deploy. **Effort ~½ day.**

---

## P2 — Support-ticket intake & management
Extend the `feedback_events` pattern (immutable, RLS-locked, edge-fn writes) into a
`support_tickets` table: `id, user_id, posthog_distinct_id, category, title, description,
status (open/in_progress/resolved/closed), severity, screenshot_urls[], created_at,
updated_at, resolved_at`. Add `/admin/support-tickets` (list/filter/inline-status, admin-gated
write RLS), each row linking to the user's PostHog funnel via `posthog_distinct_id`. Add an
"escalate to support" action on the feedback modal. Backend = one table + one edge fn + one page.

---

## P3 — CloudWatch dashboard + role-gated CloudTrail (needs new AWS IAM)
**Reality:** the local `BrandWebsiteAccess` IAM user (acct `836071698725`) **can** write
custom CloudWatch metrics (`PutMetricData`, namespace `InfinityVault/Commerce`) and read
CloudWatch, but is **denied CloudTrail, Lightsail, and CloudWatch dashboard creation**.
So this phase is **gated on new IAM**, not app code:
1. **Create `IdeaBrandCoachOpsRole`** (Terraform, least-privilege): `cloudwatch:*`
   (dashboards/alarms/metric queries), `cloudtrail:DescribeTrails`+`LookupEvents`,
   `lightsail:Get*`. The ops dashboard assumes it via **STS assume-role** (the role-gating).
2. **Emit app/box metrics** to CloudWatch (the SPA box + gateway: health, error rate,
   request counts; Bedrock/LLM cost where available) and build a CloudWatch dashboard
   (JSON template).
3. **CloudTrail viewer**: an admin page that, behind the assumed role, queries CloudTrail
   `LookupEvents` by date/actor/action — **role-gated** so only ops admins see it.
The `/admin/ops` PostHog link from P1 stays as the product-analytics pane; CloudWatch/CloudTrail
become the infra/audit panes.

---

## P4 — Environment controls (rollback / deploy-next / run-regression)
Surface in `/admin/ops`, each an admin-gated action → a Supabase edge fn that calls the
right pipeline:
- **Rollback:** re-point the box to the previous `dist/` snapshot (from 1a) — also,
  feature-flag toggles (`feature_flags.enabled=false`, percentage→0) give **instant**
  client-side rollback of gated features with no redeploy.
- **Deploy next set of changes:** trigger the build+deploy pipeline (edge fn → CI, e.g.
  GitHub Actions `workflow_dispatch`, or a deploy webhook to the box) for the next approved
  `main`.
- **Run regression tests with the latest changes:** edge fn → CI API to run the regression
  suite (1b) against latest; store run-id + PASS/FAIL in `feature_flags.metadata` (or a
  `deploy_runs` table) and show status in the dashboard; **gate** "deploy next" / flag-enable
  on a green run.
Requires: a CI entry point (GitHub Actions PAT or webhook), versioned deploys on the box,
and an audit log (who triggered what, when, with what test status).

---

## Cross-cutting risks & dependencies
- **Branch sprawl:** reconciling many divergent branches to `main` risks conflicts/lost work — do it via PRs + regression gate. ⏳
- **AWS IAM is the real gate** for P3/P4 infra controls — needs a new role; the current user is intentionally limited.
- **Admin model** must land in P1 (it's the gate for everything in the dashboard); today feature-flag writes are open to any authenticated user.
- **Edge-fn deploys + the MCP gateway** are separate from the SPA rsync and are Ask-First / owned by the other agent respectively.
- **Box access:** SSH (port 22) is IP-firewalled — deploys need home WiFi or Lightsail browser SSH.

## Verification (per phase)
- **P1:** `curl -s -o /dev/null -w '%{http_code}' https://ideabrandcoach.icodemybusiness.com/` = 200; spot-check updated copy in the live bundle; `/admin/ops` reachable only when `is_admin`; PostHog link opens project 195536; regression suite green on merged `main` before deploy.
- **P2:** create a test ticket end-to-end; admin view filters; PostHog link resolves.
- **P3:** assume `IdeaBrandCoachOpsRole`; CloudWatch dashboard renders; CloudTrail query returns events; non-ops users are denied.
- **P4:** trigger a regression run from the dashboard → status recorded; rollback restores the prior release; deploy-next ships the next `main`.

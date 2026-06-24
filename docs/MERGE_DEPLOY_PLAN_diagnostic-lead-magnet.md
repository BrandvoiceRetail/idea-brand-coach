# Merge-and-Deploy Plan — `feat/diagnostic-lead-magnet` → prod (parallel `/v2/diagnostic`)

> Status: DRAFT for execution. Authored 2026-06-23. Pipeline facts sourced from
> `docs/DEPLOY_AND_OPS_PLAN.md` (FINALIZED 2026-06-14) and a git audit of the branch.

## Why this exists
The Jun-21 reframed "Fix the Trust Gap Costing You Sales" lead-magnet diagnostic was
**announced live but never merged or deployed** — it lives only on `feat/diagnostic-lead-magnet`
(commit `0be0da5`), not on `main`, and not in the deployed build. The live `/diagnostic` still
renders the older "Free Brand Diagnostic" page, and `/opt/ideabrandcoach/assets` has **4 stale
`index-*.js` bundles** piled up. This plan ships the reframed work safely to a **new parallel
path** so nothing live breaks and Trevor can compare/approve before it becomes the canonical entry.

## What ships (branch `feat/diagnostic-lead-magnet`, 13 ahead of `main`, 0 behind, ZERO conflicts)
- `0be0da5` reframed lead-magnet diagnostic — anon capture + report email + evidence-based Qs
  (`src/pages/FreeDiagnostic.tsx`, `src/components/diagnostic/DiagnosticLeadCapture.tsx`,
  `supabase/functions/submit-diagnostic-lead`, migration `…_diagnostic_leads.sql`)
- `8756b47` post-capture next-steps nudge (free account + free credits)
- `6c1dc26` Dove brand-anchor fix (Trevor's Skill 09)
- `eab2add` **F1 — run-forensic-analysis engine + in-app forensic panel** (signed-in value)
- `f4ebca3` email the forensic report (Resend)
- + multi-avatar merge (`#28`)

## Pipeline (per `docs/DEPLOY_AND_OPS_PLAN.md`)
- **SPA:** built **from `main`** in a clean worktree → `npm ci && npm run build` →
  `cp dist/index.html dist/404.html` → `rsync -az --delete dist/ ubuntu@54.243.53.44:/opt/ideabrandcoach/`
  (key `~/.ssh/lightsail-mango.pem`). Content-only, **no Caddy restart**. `--delete` prunes stale bundles.
- **Edge functions** deploy separately — `supabase functions deploy <name>` (Supabase free tier
  auto-pauses; restore the project first if INACTIVE).
- SSH port 22 is **IP-firewalled** (home WiFi or Lightsail browser SSH; cellular blocked).

## ⚠️ Ask-First gates (repo AGENTS.md — do NOT do autonomously)
1. **Merge to `main`** 2. **`supabase functions deploy`** 3. **Prod SPA rsync**
Each requires Matthew's explicit go-ahead in chat. Open the PR + run regression, then HALT for review.

---

## Phases

### Phase 0 — Pre-flight
- Confirm the **branch-reconciliation order**: `main` is also behind `feat/alpha-instrumentation`
  (the build currently live) and `feat/product-data-hookup`. Reconcile alpha-instrumentation → `main`
  **first** so deploying `main` doesn't drop live instrumentation; then this branch on top. Re-run the
  conflict check after each step (`git merge-tree`).
- Trevor's revised entry-experience brief is **NOT** a blocker here — `/v2/diagnostic` is parallel; the
  brief gates *promotion* (Phase 6), not shipping the candidate.

### Phase 1 — Add `/v2/diagnostic` (on the branch)
- Register `/v2/diagnostic` → the reframed `FreeDiagnostic` + `DiagnosticLeadCapture` component.
- **Leave `/diagnostic` and `/v1/diagnostic` untouched** (both offered, side-by-side).

### Phase 2 — Merge + verify locally
- Merge `feat/diagnostic-lead-magnet` → `main` (clean). **[Ask-First gate #1]**
- `npm ci && npm run build`, `npm run test`, `npm run lint`, **`npm run regression`** → all green.
- Matthew QA the flow locally: `/v2/diagnostic` → lead capture → email; signed-in → forensic panel.

### Phase 3 — Backend first (Supabase) **[Ask-First gate #2]**
- Restore the Supabase project if auto-paused → wait 1–3 min.
- Apply migration `diagnostic_leads` (`supabase db push`).
- `supabase functions deploy submit-diagnostic-lead` + forensic fns (`run-forensic-analysis`, Resend email fn).
- Backend before frontend so the new UI's calls resolve.

### Phase 4 — Frontend build + deploy **[Ask-First gate #3]**
- Snapshot prod first: `cp -r /opt/ideabrandcoach /opt/ideabrandcoach-releases/<ts>/` (rollback point).
- Clean worktree off `main`: `npm ci && npm run build` → `cp dist/index.html dist/404.html` →
  `rsync -az --delete dist/ ubuntu@54.243.53.44:/opt/ideabrandcoach/`.
- `--delete` auto-prunes the 4 stale bundles; no Caddy restart.

### Phase 5 — Post-deploy smoke test (the step that was missing last time)
- `/v2/diagnostic` renders the reframed flow; `/diagnostic` + `/v1/diagnostic` still load.
- Submit a test lead → row in `diagnostic_leads` + email sends.
- Signed-in forensic engine works.
- Only **one** `index-*.js` in `/opt/ideabrandcoach/assets`; `curl -s -o /dev/null -w '%{http_code}' /` = 200.
- **Co-host check: ideabrandcoach AND mango both 200.**

### Phase 6 — Entry-experience reconciliation → promote (gated on Trevor)
- Send Trevor the `/v2/diagnostic` link for the recognition → diagnosis → product review.
- Iterate copy/sequence **on `/v2`** per his revised brief.
- On sign-off: promote `/v2` → canonical (point `/diagnostic` or `/` to it; redirect/retire `/v1`).

## Rollback
`rsync` the prior `/opt/ideabrandcoach-releases/<ts>/` back; revert the merge commit; redeploy prior functions.

## Definition of done
`/v2/diagnostic` live and smoke-passed; both old diagnostics still live; lead-capture + forensic verified;
single bundle in `/assets`; both co-hosted sites 200; all three Ask-First gates passed with Matthew's approval.

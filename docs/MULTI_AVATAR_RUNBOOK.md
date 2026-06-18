# Multi-Avatar — Deploy & Ops Runbook

**Feature:** "Build a customer-avatar profile, then switch the whole app to it" — brand → many avatars, two-tier (brand-shared vs avatar-scoped) knowledge, funnel stays brand-level, agent + UI avatar lifecycle, forensic avatar builder, per-avatar diagnostic overlay.

**Design:** `docs/v2/architecture/MULTI_AVATAR_DESIGN.md` · **P1 SQL detail:** `docs/v2/architecture/MULTI_AVATAR_P1.md`
**Branch:** `feat/brand-avatar-scope` (off `origin/main`). **Status:** code-complete (P1–P4), **NOT merged**, edge-fn/frontend/MCP **NOT deployed**. Only the **P1 schema is live**.

---

## 1. What shipped (commits on `feat/brand-avatar-scope`)

| Phase | Commit | What | Live? |
|---|---|---|---|
| P1 schema + types | `c43114d` | brand spine (`brand_id` on avatars, one brand/user), two-tier KB (`scope`/`brand_id`/`avatar_id`), diagnostic overlay cols, `brand_assets` → brand-level + `brand_asset_audits`, `avatar_build_state`, RPCs (`set_current_avatar`, `set_primary_avatar`, `save_asset_audit_atomic`, additive 7-arg `save_artifact_atomic`, scoped 7-arg `match_document_chunks`), auto-migrate backfill | **✅ migrations applied to live** (ledger `brand_avatar_scope_*`) |
| P2 MCP tools | `bc0c727` | 10 tools (`create/list/get/set_current/set_primary avatar`, `record_avatar_build`, 4 funnel) + `requireOwnedAvatar` retrofit on all avatar-accepting tools + server-side `brand_id` stamping | ❌ needs MCP redeploy |
| P3 edge-fn | `90f2ef6` | consultant `context.ts` retrieval is scope-authoritative (brand ∪ this-avatar; excludes other avatars) + scoped RAG; `index.ts` parses+validates `avatar_id` (falls back to `profiles.current_avatar_id`) | ❌ needs edge-fn deploy |
| P4a SPA core | `1f576a6` | one canonical switch path (`AvatarContext.setCurrentAvatar`), session-follows-avatar, bleed-firewall query-key namespace | ❌ needs frontend deploy |
| P4b SPA UX | `03de0eb` | avatar CRUD/UX (kebab, set-primary, context banner), V1 store collapsed into AvatarContext, `MultiAvatarInterface` deleted, diagnostic baseline/overlay compare-mode, forensic-builder UI | ❌ needs frontend deploy |

Verified pre-deploy: `tsc` + `tsc:mcp` clean; full SPA suite 1627 pass; mcp suite 284 pass; consultant 51 pass (incl. 9 bleed/scope); P1 backfill asserts + `get_advisors` clean.

---

## 2. Deploy sequence

> DEPLOY MODE banner active through 2026-06-21 — shipping pre-authorized; no testers yet. **Verify after each step.** Migrations already applied; the 3 remaining deploys are independent (P1 is their shared, satisfied prereq) — recommended order below.

### Step 0 — Land the branch (human; never auto-merged)
```bash
# from a normal checkout
git checkout main && git pull
git merge --no-ff feat/brand-avatar-scope     # or open a PR and merge
# tag a rollback point first:
git tag pre-multiavatar-$(date +%Y%m%d)
```
(Deploys below can also run straight from the `feat/brand-avatar-scope` worktree if you prefer to validate before merging.)

### Step 1 — Migrations — ALREADY DONE ✅
P1's 4 files are applied to live (ledger `brand_avatar_scope_schema/_rls/_rpcs/_backfill`). For a fresh environment only: apply `supabase/migrations/20260617000000…0300_brand_avatar_scope_*.sql` in order (windows: schema+rls together, then rpcs, then backfill). Then `supabase gen types typescript` → `src/integrations/supabase/types.ts`.

### Step 2 — Edge function (P3 two-tier KB)  ·  Supabase CLI
```bash
# from the repo root (linked project ecdrxtbclxfpkknasmrw)
supabase functions deploy idea-framework-consultant-claude
```
- This redeploys the consultant. ⚠️ It also ships the **merged coach unification** (loop + mcpClient + skill grounding) for the first time — but it stays **inert**: gated by env `CONSULTANT_TOOL_LOOP_ENABLED` (default off) **and** the PostHog flag `coach-mcp-tool-loop`. Only P3's two-tier retrieval is active.
- Don't deploy the 10-file function via the MCP `deploy_edge_function` (inline-files = error-prone for a multi-file Deno fn). Use the CLI.
- **Verify:** send an authed chat (QA account, `docs/TEST_ACCOUNT.md`); capture the SSE stream (per `feedback_sse_stream_capture` — HTTP 200 can wrap a body error). Confirm a normal coach reply + no regression.

### Step 3 — Frontend (P4 SPA)  ·  Lightsail rsync (needs home WiFi — port-22 firewalled)
```bash
# in a clean checkout of the merged code
npm ci && npm run build
cp dist/index.html dist/404.html
rsync -az --delete dist/ ubuntu@54.243.53.44:/opt/ideabrandcoach/   # key ~/.ssh/lightsail-mango.pem
# content-only; no Caddy restart
```
The multi-avatar UI is **not feature-flagged** — it goes live on this deploy. (No testers yet, so acceptable; flag later if needed before tester onboarding.)

### Step 4 — MCP host (P2 avatar/funnel tools)  ·  Lightsail (needs home WiFi)
```bash
# rebuild the Dockerized MCP image (linux/amd64) and redeploy to the box's /mcp service
#   per deploy/mcp/{Dockerfile,docker-compose.yml,README.md}
# then verify the new tool set is advertised:
curl -s -X POST https://ideabrandcoach.icodemybusiness.com/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | python3 -c "import sys,json;print(len(json.load(sys.stdin)['result']['tools']),'tools')"
# expect 38 (was 14): includes create_avatar, set_current_avatar, run_funnel_audit, etc.
```

---

## 3. Post-deploy verification (QA account, `docs/TEST_ACCOUNT.md`)

1. **Switch re-scopes everything (the headline):** create/select avatar A, give the coach avatar-specific context; switch to B; confirm the coach no longer recalls A's avatar-tier context, the conversation/thread changed, but **brand-level knowledge + the funnel are unchanged**.
2. **CRUD:** create / rename / duplicate / delete avatar from the header dropdown; set-primary star; delete-current falls back to primary.
3. **Diagnostic BOTH:** brand baseline persists; re-take under an avatar → compare-mode delta renders.
4. **Forensic builder:** evidence intake → run S1–S4 → review → approve; artifacts persist per avatar; re-run supersedes.
5. **Agent (if MCP deployed):** via Claude Desktop, `create_avatar` / `set_current_avatar` / `run_funnel_audit` succeed and are ownership-gated.
6. `get_advisors` (security + performance) → no new errors.

---

## 4. Rollback

- **Frontend:** `rsync` the previous `dist/` back (keep a tagged build).
- **Edge fn:** `supabase functions deploy` the prior `idea-framework-consultant-claude` revision (or `git checkout pre-multiavatar-<date> -- supabase/functions/idea-framework-consultant-claude && supabase functions deploy …`).
- **MCP:** redeploy the prior image.
- **Schema:** P1 is **additive + idempotent**; the only irreversible step is `avatars.brand_id SET NOT NULL`. Leaving the columns/tables in place is harmless if the app layer is rolled back (the old app ignores them). Do **not** attempt to drop columns to roll back — additive columns are safe to keep.

---

## 5. Known follow-ups (deferred, not blocking)

- **Orphan cleanup:** the legacy `src/pages/AvatarBuilder.tsx` subtree + `AvatarStorageAdapter.ts` are now unreachable (V1 store collapsed into `AvatarContext`, `/avatar`→`/v2/coach`). Safe to delete in a follow-up.
- **MCP-box SSH:** port-22 is IP-firewalled — the MCP + frontend deploys need home WiFi or Lightsail browser SSH (`project_pages_deploy`).
- **Coach unification activation:** separate from this feature — flip `CONSULTANT_TOOL_LOOP_ENABLED` + the PostHog flag when ready (`project_coach_capability_unification`).
- **Feature-flagging multi-avatar:** unflagged today; add a gate before tester onboarding if a staged rollout is wanted.

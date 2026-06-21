# Multi-Avatar RLS + RAG De-Risk — Goal Prompt & Loop Prompt

Two ready-to-run prompts that **isolate and harden the data-isolation surface** of the
multi-avatar effort (`feat/brand-avatar-scope`) — the two things that, if wrong, leak one
customer-avatar's data into another's context or let one user touch another's rows.

Scope = **only** the RLS (row-level security) and RAG (avatar-aware retrieval / cross-avatar
bleed) slices of the design. It deliberately does **not** build the SPA switch UX, CRUD, or
funnel — those ride on top once isolation is proven. Source of truth:
[`MULTI_AVATAR_DESIGN.md`](./MULTI_AVATAR_DESIGN.md) (§2.3 two-tier KB, §3.2 RLS, §3.3 RPCs, §6 tests).

> **Why these two first.** Every other phase assumes isolation holds. If RLS or the two-tier
> retrieval is wrong, the bug is *silent* (no error — just A's avatar memory showing up in B's
> coaching) and *high-blast-radius* (cross-tenant data exposure). Prove isolation, then build UX.

---

## The risks being mitigated (verbatim findings from the design review)

**RLS**
- **F2 (load-bearing):** all four live `brand_assets` policies are `EXISTS avatars WHERE avatars.id = brand_assets.avatar_id`. Making `avatar_id` nullable (for brand-level inventory) makes those rows **un-readable AND un-insertable**. The `DROP NOT NULL` relax + policy swap **must land in one apply window**, ordered relax-then-swap, with a brand-level smoke-insert as the migration's final assertion.
- **C2:** `avatar_field_values` has two contradictory live policies (`20260306` brands-join vs `20260317` user_id). Reconcile: `DROP POLICY IF EXISTS` both, create one canonical `auth.uid() = user_id` set.
- **INSERT/UPDATE `WITH CHECK` tightening** on `avatars` / `user_knowledge_base` / `user_knowledge_chunks` so a caller can only attach `brand_id`/`avatar_id` they own (`EXISTS brands/avatars … user_id = auth.uid()`).
- **F3 / C-1 (the hole RLS can't close):** the coach pointer must move only via a `SECURITY INVOKER` `set_current_avatar(p_avatar_id)` RPC that ownership-checks the avatar — **no direct PostgREST `UPDATE profiles`** from SPA or MCP.
- **L-1 GRANT discipline:** every new/replaced RPC gets `REVOKE ALL … FROM PUBLIC; GRANT EXECUTE … TO authenticated;` in the **same** migration as its `CREATE`.
- `diagnostic_submissions` gains UPDATE + DELETE (today SELECT/INSERT only) so overlays can be re-run.
- New tables `brand_asset_audits`, `avatar_build_state`: owner-only RLS; document cascade-only delete intent.
- **H-3:** `performance_metrics` (if present on the branch) needs `OR avatars.user_id = auth.uid()` so a NULL `brand_id` doesn't lock owners out (guard with `IF EXISTS` — no-op on live).

**RAG / cross-avatar bleed**
- **H1:** two-tier retrieval must be **scope-authoritative** — two typed queries (`scope='brand'` and `scope='avatar' AND avatar_id=$av`) merged in code, **never** `.or()` string interpolation (eliminates PostgREST filter injection). `avatarId` **UUID-validated** before it touches any query builder.
- **H2:** independent row budgets per tier so brand recency can't starve avatar context on the `minimal` path.
- **C2 (edge):** when `userId` is null, **no avatar-scoped retrieval runs at all**; a body-supplied `avatar_id` is never used without an authenticated session.
- `retrieveSemanticContext` / `match_document_chunks` gains `match_brand_id` / `match_avatar_id` (DEFAULT NULL, UUID-validated): `WHERE (match_brand_id IS NULL OR brand_id = match_brand_id) AND (scope = 'brand' OR avatar_id = match_avatar_id)`.
- **Single audited constant** in `context.ts` *and* `src/mcp/service/contextResolver.ts`: `const AVATAR_SCOPED_CATEGORIES = new Set(['avatar','insights'])`. Everything else is brand-shared.
- **MCP bleed:** `contextResolver.readUserKnowledgeBase/Chunks` must **use** the `_scope` param (drop the underscore); `readAvatarFieldValues` **skips** avatar reads when `scope.avatarId == null`.
- **Bleed firewall = query-key namespace:** every avatar-scoped react-query key starts `['avatar', avatarId, …]` via `avatarScopedKey()`; a **Vitest invariant test (written FIRST, "XC-1")** asserts it, plus a guard that fails if `brandCoach_currentAvatarId` or `'avatarChanged'` appears in `src/` outside the compat shim.

---

## GOAL PROMPT  — paste after `/goal`

```
/goal Harden the multi-avatar data-isolation surface — RLS + avatar-aware RAG — on
feat/brand-avatar-scope so NO cross-avatar bleed and NO cross-user access is possible.
DONE WHEN every probe in the companion loop checklist is green, get_advisors is clean, and
tsc+lint+test+build pass with ≥85% coverage on the new isolation code.

SCOPE. Data-isolation slice ONLY: RLS policies + ownership write-path RPCs + two-tier KB/RAG
retrieval + the bleed-firewall test. Do NOT build the switch UX, CRUD, or funnel here. Read
MULTI_AVATAR_DESIGN.md §2.3/§3.2/§3.3/§6 first.

TOOLING. Supabase MCP (list_tables, execute_sql, apply_migration, get_advisors).
INSPECT LIVE SCHEMA FIRST (list_tables + pg_policies + RPC sigs):
other sessions apply migrations via MCP without repo files, so live ≠ repo — the
brand_avatar_scope migrations are likely ALREADY LIVE. Author/test as a DELTA FROM THE LIVE
SNAPSHOT, never repo-replay.

GAP (confirm each against live; some may already be done). Schema may be live, but verify the
CODE: consultant edge fn parsing avatar_id + context.ts two-tier merge; contextResolver using
_scope; the bleed-firewall test; reconciled avatar_field_values policies; brand_assets RLS
surviving a nullable avatar_id; ownership RPCs present with correct GRANTs.

PLANNED WORK (each step: change -> verify).
1. Schema+RLS migration (idempotent, ONE window, only if not already live): two-tier scope on
   user_knowledge_base/_chunks + CHECK; brand_assets DROP NOT NULL avatar_id + brand-OR-avatar
   policies (relax-then-swap, ending in a brand-level smoke-insert); reconcile
   avatar_field_values to one auth.uid()=user_id set; tighten INSERT/UPDATE WITH CHECK;
   owner-only RLS on new tables. -> verify: get_advisors clean; smoke-insert (avatar_id NULL)
   ok; idempotent re-run = zero deltas.
2. Ownership RPCs (GRANTs in the SAME migration): set_current_avatar (SECURITY INVOKER, RAISE
   avatar_not_owned), set_primary_avatar, save_asset_audit_atomic; REVOKE FROM PUBLIC; GRANT
   authenticated. -> verify: rejects another user's avatar UUID; anon denied.
3. Avatar-aware retrieval (consultant edge fn): parse + UUID-validate avatar_id; gate on auth
   (userId null -> no avatar query); TWO typed queries (brand / avatar) merged by recency with
   independent budgets — NO .or() interpolation; AVATAR_SCOPED_CATEGORIES={avatar,insights};
   thread match_brand_id/match_avatar_id into match_document_chunks. -> verify: write avatar-KB
   to A, retrieve as B -> A's avatar/insights EXCLUDED, brand KB INCLUDED; injection string
   rejected; minimal path returns both budgets; unauth runs no avatar query.
4. contextResolver: use _scope; skip readAvatarFieldValues when scope.avatarId is null.
5. Bleed-firewall Vitest (write FIRST): every avatar-scoped hook uses avatarScopedKey; guard
   rejects brandCoach_currentAvatarId/'avatarChanged' outside the shim.
6. Regenerate types.ts (generate_typescript_types — never hand-edit).

FILE OWNERSHIP. supabase/migrations/<stamp>_brand_avatar_scope_{schema,rls,rpcs}.sql;
idea-framework-consultant-claude/{index,context}.ts (+context.test.ts);
src/mcp/service/contextResolver.ts; src/lib/queryKeys.ts; the firewall test; types.ts (regen
only). Do NOT touch the switch/CRUD/funnel components, forensic pipeline, or the 6-arg
save_artifact_atomic.

GUARDRAILS. Feature branch only (no merge to main without the operator). Migrations idempotent;
schema+RLS one window; 6-arg RPC stays until MCP redeploy. No .or() interpolation; no types.ts
hand-edits; no any. Inspect live before every apply; treat each apply/deploy/regen as a verify HALT.

DONE GATE. get_advisors clean; cross-user SQL probe returns 0 on every avatar-scoped table;
set_current_avatar rejects unowned UUIDs; bleed integration test green; injection rejected;
unauth runs no avatar query; firewall + contextResolver tests green; tsc+lint+test+build clean;
≥85% coverage on new isolation code. Report what needs a human browser-walk (QA account).
```

---

## LOOP PROMPT  — paste after `/loop` (self-paced; omit an interval)

```
/loop Drive the multi-avatar RLS+RAG isolation checklist to all-green, one item per iteration.

Each iteration: (1) pick the FIRST unchecked item below; (2) inspect LIVE state first
(list_tables / pg_policies / execute_sql with a second user's JWT / read the edge fn) to see if
it already holds; (3) if not, make the smallest change that satisfies it; (4) VERIFY with the
named probe and capture the evidence; (5) check it off with the evidence; (6) continue. If a
step needs a migration apply, edge-fn deploy, or type regen, do it, then re-verify against live.
STOP and surface to the operator if: a cross-user probe ever returns >0 rows, get_advisors shows
a new ERROR, a destructive change is the only path, or two consecutive iterations can't make an
item green. Never weaken a policy to make a probe pass. Keep going until all items are checked or
a STOP fires.

ISOLATION CHECKLIST (RLS)
[ ] R1  brand_assets: avatar_id nullable + brand-OR-avatar policies live; brand-level
        smoke-insert (avatar_id NULL) SUCCEEDS, and still readable by owner only. (F2)
[ ] R2  avatar_field_values: exactly ONE canonical auth.uid()=user_id policy set (old
        20260306/20260317 dropped). Probe: user B cannot select user A's rows.
[ ] R3  avatars / user_knowledge_base / user_knowledge_chunks: INSERT/UPDATE WITH CHECK
        rejects a brand_id/avatar_id the caller does not own.
[ ] R4  set_current_avatar RPC exists (SECURITY INVOKER) and RAISES avatar_not_owned for
        another user's avatar UUID; direct PostgREST UPDATE profiles is NOT used anywhere.
[ ] R5  every new/replaced RPC has REVOKE…FROM PUBLIC + GRANT…TO authenticated in the same
        migration; anon JWT is denied EXECUTE.
[ ] R6  diagnostic_submissions has UPDATE+DELETE policies (owner-only); overlay re-run works.
[ ] R7  brand_asset_audits + avatar_build_state: owner-only RLS; cross-user select = 0 rows.
[ ] R8  performance_metrics (IF EXISTS): owner not locked out by NULL brand_id (user_id fallback).
[ ] R9  get_advisors: zero new security/RLS warnings after all migrations.

ISOLATION CHECKLIST (RAG / bleed)
[ ] G1  retrieveUserContext: TWO typed queries (brand scope=NULL avatar / avatar scope+avatar_id)
        merged by recency — grep proves NO .or( ) string interpolation remains.
[ ] G2  avatarId is UUID-validated before any query builder; an injection string (e.g.
        "x') or true--") is rejected and runs no query.
[ ] G3  minimal path returns BOTH brand and avatar budgets (avatar context not starved). (H2)
[ ] G4  unauthenticated request (userId null): ZERO avatar-scoped queries execute; a
        body-supplied avatar_id is ignored. (C2)
[ ] G5  match_document_chunks honors match_brand_id/match_avatar_id; semantic results never
        cross avatars.
[ ] G6  AVATAR_SCOPED_CATEGORIES={avatar,insights} is the single constant in BOTH context.ts
        and contextResolver.ts; canvas/copy/diagnostic/visual_identity stay brand-shared.
[ ] G7  contextResolver uses _scope; readAvatarFieldValues skips when scope.avatarId == null.
[ ] G8  END-TO-END BLEED PROBE: write an avatar KB row (category 'avatar') to avatar A,
        retrieve context as avatar B — A's avatar/insights rows are EXCLUDED, brand KB INCLUDED.
[ ] G9  XC-1 Vitest green: every avatar-scoped hook uses avatarScopedKey; guard rejects
        brandCoach_currentAvatarId/'avatarChanged' outside the compat shim.

EXIT: all items checked + tsc/lint/test/build green. Then hand off with the live browser-walk
steps (QA account, docs/TEST_ACCOUNT.md): switch avatar A->B, confirm thread/fields/memory
re-scope and the funnel does NOT move.
```

---

### How to run

1. `git switch feat/brand-avatar-scope` (or `focus-worktree brand-avatar-scope`).
2. Confirm the **live Supabase project is awake** (it auto-pauses on free tier) before any probe.
3. Paste the **GOAL PROMPT** to set the success gate, then the **LOOP PROMPT** to grind the
   checklist. The loop is the executor; the goal is the gate it must satisfy.
4. The loop self-HALTs on any cross-user leak — that is the whole point. Don't relax a policy to
   get past it.

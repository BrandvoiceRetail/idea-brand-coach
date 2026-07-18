`authenticated` has table-level SELECT on `brand_assets` (Supabase default grants all to anon/authenticated/service_role; RLS is the real fence). So the §8b authenticated-role probe will work. The probe is valid.

Note this also surfaces an out-of-scope observation worth flagging in the runbook: `anon` holds table-level DML grants on `brand_assets` (Supabase default), but RLS `TO authenticated` policies mean anon gets no rows — defense rests entirely on RLS, which is the standard Supabase posture.

All four files are finalized and verified against live. Here is the complete deliverable.

---

# Multi-Avatar Phase 1 — FINAL DELIVERABLE

## (a) How every review finding was resolved

| ID | Sev | Resolution |
|----|-----|-----------|
| **data C-1** (orphan brand_id clobber) | CRIT | **FIXED 3 ways.** (1) FILE 1 §9 trigger rewritten to use a local var + `FOUND AND v_brand IS NOT NULL` guard — never null-clobbers. (2) FILE 1 §0 pre-cleans orphan `avatar_id`→NULL (5 artifacts/1 sig/3 evidence) before the trigger exists. (3) FILE 4 §9 assert extended to ALL 10 brand_id tables, so any brand-NULL row aborts loudly. |
| **sec C-1** (brand_assets lockout + smoke doesn't test SELECT) | CRIT | **FIXED.** FILE 2 §8 reordered to INSERT→SELECT(assert visible)→DELETE. Added §8b authenticated-role RLS probe (impersonate owner, assert owner SELECTs the row). Did NOT add a `user_id` column to brand_assets (out of scope; brand-OR-avatar ownership + mandatory brand arm on write covers it). |
| **sec C-2** (set_primary_avatar NULL-brand ambiguity) | CRIT | **FIXED.** FILE 3 separates `NOT EXISTS(owned)`→`avatar_not_owned` from `brand_id IS NULL`→`avatar_has_no_brand`. |
| **sec H-1** (concurrent supersede race) | HIGH | **FIXED.** FILE 3 `save_artifact_atomic`(7-arg) takes `FOR UPDATE` on current rows before superseding; `save_asset_audit_atomic` got the same `FOR UPDATE` guard. Serializes concurrent writers through the RPC instead of relying on the unique index to throw. |
| **sec H-2** (match_document_chunks no caller gate) | HIGH | **FIXED + re-grounded.** Added `auth.uid() IS DISTINCT FROM match_user_id`→`not authorized` to the 7-arg overload. **Live re-check:** the existing 5-arg already has this gate (hardened by `20260531000000`), so the ground-truth's "5-arg has the flaw" was stale; my overload now matches the established secure pattern. Callers run under the user JWT, so the gate doesn't break RAG. |
| **sec H-3** (`TO public` on policies) | HIGH | **FIXED** for every policy this migration touches (brand_assets, KB×2, avatars I/U, brands I/U, diagnostics, new tables) → `TO authenticated`. Untouched SELECT/DELETE policies on avatars/brands stay `TO public` (out of scope; see what-changed note). |
| **sec H-4** (cross-brand avatar/asset pairing) | HIGH | **FIXED.** brand_assets INSERT/UPDATE WITH CHECK now requires the brand owned AND (avatar NULL OR avatar in same brand). brand_asset_audits INSERT/UPDATE require `avatar.brand_id = brand_id`. |
| **data HIGH** (avatar-less KB demotion) | HIGH | **FIXED via product-intent option.** FILE 4 §2b auto-creates a default `'My Avatar'` primary for every brand lacking a non-template avatar (fires for the 2 real avatar-less-with-knowledge users). Their avatar/insights KB stays avatar-scoped; §4b demotion is now genuinely defensive (0 rows live). Comment corrected to state the true live impact. |
| **data MED / coach** (5 coach threads stay avatar-NULL) | MED | **FIXED by §2b** — those threads now bind to the default avatar in §6. |
| **data MED** (uq touchpoint NULL-distinct) / **sec L-1** | MED/LOW | **FIXED.** FILE 1 §7b attaches the sync trigger to `brand_assets` (INSERT OR UPDATE) so avatar-bound rows always get brand_id; FILE 2 makes the brand arm mandatory on write. Index documented as inventory-only, non-NULL-brand-only. |
| **sec M-1** (audit NULL-brand ambiguity) | MED | **FIXED** — same existence-then-brand separation as C-2. |
| **sec M-2** (build_state SELECT no avatar cross-check) | MED | **FIXED** — SELECT USING now also `EXISTS(avatar owned)`. |
| **sec M-3** (trigger clobbers caller brand_id) | MED | **FIXED** by the same non-destructive trigger as data-C-1. |
| **sec M-4** (REVOKE misses 5/6-arg) | MED | **FIXED + re-grounded.** Added guarded REVOKE/GRANT for the live 5-arg/6-arg. **Live re-check:** they already have no PUBLIC grant (EXECUTE = authenticated/service_role/postgres), so this is an idempotent no-op confirmation. New overloads granted to `authenticated, service_role` to match existing shape. |
| **sec M-5** (brands primary_avatar_id ownership) | MED | **FIXED.** FILE 2 §3b recreates brands INSERT/UPDATE with WITH CHECK validating `primary_avatar_id` ownership. |
| **sec L-2** (smoke runs as migration role) | LOW | **FIXED** — §8b authenticated-role probe added. |
| **sec L-3** (diagnostic UPDATE foreign brand) | LOW | **FIXED** — diagnostic UPDATE WITH CHECK validates brand_id/avatar_id ownership. |
| **sec L-4** (audit UPDATE no FK re-verify) | LOW | **FIXED** — audit UPDATE WITH CHECK re-verifies avatar+brand+same-brand. |
| **data L** (set_primary_avatar two-UPDATE) | LOW | **Confirmed safe; no change.** Comment added noting statement-atomicity. |
| **data L** (7-arg supersede-key collapse) | LOW | **Confirmed correct; no change.** brand_id deliberately not in supersede key (latent only under true multi-brand, out of Phase-1 scope). |
| **data L** (idempotency) | LOW | **Resolved by the C-1 fix** (no more re-clobber). Files remain zero-delta on re-run. |
| **data L** (drift not clobbered) | LOW | **Confirmed; no change.** |

---

## (b) APPLY RUNBOOK

**Apply remains a human HALT. Nothing was applied. Apply via `mcp__supabase__apply_migration` (one file per call, in order) or `supabase db push`.**

### Pre-flight
1. Confirm the live project is **not paused** (project memory: NXDOMAIN/timeout ⇒ restore in dashboard first).
2. Snapshot/backup (PITR or manual). FILE 4's `avatars.brand_id SET NOT NULL` is the only irreversible step.
3. Confirm no other session is mid-migration (`mcp__supabase__list_migrations`).

### Order & windows
```
WINDOW 1 (back-to-back, do NOT pause between):
  1. 20260617000000_brand_avatar_scope_schema.sql
  2. 20260617000100_brand_avatar_scope_rls.sql      <-- closes the brand_assets relax gap
        ↳ Checkpoint A: FILE 2 §8  NOTICE "brand_assets inventory smoke insert + SELECT ... OK"
        ↳ Checkpoint B: FILE 2 §8b NOTICE "authenticated-role RLS probe OK"
        (If either RAISEs, the window is incoherent — STOP, investigate, the tx aborted.)

WINDOW 2 (after WINDOW 1 verified):
  3. 20260617000200_brand_avatar_scope_rpcs.sql
  4. 20260617000300_brand_avatar_scope_backfill.sql
        ↳ Checkpoint C: FILE 4 §9 assert passes (no "backfill incomplete" exception)
        ↳ then the irreversible ALTER ... SET NOT NULL runs.
```
FILES 1+2 are the **one-window group** (FILE 1 drops `brand_assets.avatar_id NOT NULL`; until FILE 2 swaps the policies, avatar_id-NULL inventory rows are unreadable/uninsertable).

### Post-apply verification queries
```sql
-- 1. Advisors (run the MCP tool, expect no NEW security/perf errors beyond pre-existing)
--    mcp__supabase__get_advisors(type='security') and (type='performance')

-- 2. Backfill assertions (all must return 0)
SELECT count(*) FROM avatars WHERE brand_id IS NULL;                          -- 0
SELECT count(*) FROM user_knowledge_base WHERE brand_id IS NULL;              -- 0
SELECT count(*) FROM user_knowledge_base WHERE scope='avatar' AND avatar_id IS NULL;  -- 0
SELECT count(*) FROM brands b WHERE NOT EXISTS                                -- 0
  (SELECT 1 FROM avatars a WHERE a.brand_id=b.id AND a.is_primary)
  AND EXISTS (SELECT 1 FROM avatars a WHERE a.brand_id=b.id AND a.is_template=false);
-- per-table brand_id NULL sweep (all 0):
SELECT 'artifacts' t, count(*) FROM artifacts WHERE brand_id IS NULL
UNION ALL SELECT 'positioning_statements', count(*) FROM positioning statements WHERE brand_id IS NULL
UNION ALL SELECT 'evidence_snapshots', count(*) FROM evidence_snapshots WHERE brand_id IS NULL
UNION ALL SELECT 'decision_triggers', count(*) FROM decision_triggers WHERE brand_id IS NULL
UNION ALL SELECT 'uploaded_documents', count(*) FROM uploaded_documents WHERE brand_id IS NULL
UNION ALL SELECT 'chat_sessions', count(*) FROM chat_sessions WHERE brand_id IS NULL
UNION ALL SELECT 'diagnostic_submissions', count(*) FROM diagnostic_submissions WHERE brand_id IS NULL
UNION ALL SELECT 'user_diagnostic_results', count(*) FROM user_diagnostic_results WHERE brand_id IS NULL;

-- 3. Expected backfill side-effects on live
--    brands: was 7 -> still 7 (1/user). avatars: was 13 -> 15 (+2 auto-created 'My Avatar').
SELECT (SELECT count(*) FROM brands) brands, (SELECT count(*) FROM avatars) avatars;
SELECT count(*) FROM avatars WHERE name='My Avatar' AND is_primary;  -- 2 (the avatar-less cohort)
--    coach threads now bound:
SELECT count(*) FROM chat_sessions WHERE chatbot_type='idea-framework-consultant' AND avatar_id IS NULL;  -- expect 0

-- 4. RPC positioning statements present (overloads added, originals intact)
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc WHERE proname IN
  ('save_artifact_atomic','match_document_chunks','set_current_avatar',
   'set_primary_avatar','save_asset_audit_atomic')
ORDER BY proname;
-- expect: save_artifact_atomic x2 (6-arg + 7-arg), match_document_chunks x2 (5-arg + 7-arg).

-- 5. Regenerate types
--    mcp__supabase__generate_typescript_types  -> commit src/integrations/supabase/types.ts
```

### Idempotency re-run
Re-apply all four files (same order). Expected: **zero deltas, all NOTICEs, all asserts pass.** Specifically — §2b inserts 0 (NOT EXISTS guards), §3 pins 0, all backfill UPDATEs match 0 (`brand_id IS NULL` already satisfied), `SET NOT NULL` is a no-op. The previously-flagged re-clobber loop (data-L) cannot occur: orphans were pre-cleaned + the trigger is non-destructive.

### Rollback notes
- **WINDOW 1 only applied:** safe to roll back by `DROP`-ing added columns/indexes/policies and re-adding `brand_assets.avatar_id NOT NULL` (no rows live). RLS policies: recreate the original avatars-join `TO public` set (originals captured in this file's DROP list).
- **After FILE 4 `SET NOT NULL`:** irreversible without first `ALTER TABLE avatars ALTER COLUMN brand_id DROP NOT NULL`. The auto-created `'My Avatar'` rows and seeded `'My Brand'` rows are real data — deleting them cascades to KB/artifacts brand_id (ON DELETE CASCADE). Prefer PITR restore over manual unwind if FILE 4 must be reverted.
- All RPCs are `CREATE OR REPLACE` overloads; rollback = `DROP FUNCTION` the new positioning statements (6-arg/5-arg originals untouched).

---

## (c) What changed vs the design because of live state

1. **Agentic loop + `user_memories` already exist on origin/main** (design's "Phase-6 build a loop" / "defer memory namespacing" premises are obsolete). No edge-function code is in this DB-only Phase-1 deliverable; the consultant work is plumbing into the existing `loop.ts`, scoped to a later phase.
2. **`match_document_chunks` was already `auth.uid()`-gated on live** (hardened by `20260531000000`). The H-2 "5-arg is unguarded" claim was stale; the 7-arg overload now matches the live secure pattern. Live arg type is bare `vector`, not `vector(1536)` — overload positioning statement matches exactly.
3. **Existing RPCs already have no PUBLIC grant** (EXECUTE = authenticated/service_role/postgres). M-4's REVOKE block is a confirming no-op on live; new overloads granted to `authenticated, service_role` (not just authenticated) to match the existing functions' shape and not break service-role edge calls.
4. **Two schema items were already live** — `chat_sessions.avatar_id` and `avatars` UNIQUE(user_id,name) — so they are not recreated.
5. **`avatar_field_values` has ONE avatars-join policy and no `user_id`** — the design's "reconcile two contested policies, root on user_id" is impossible/unnecessary; File 2 only confirms the single policy (semantic no-op; role normalized to authenticated).
6. **`performance_metrics` does not exist live** — File 2 §7 is a guarded no-op.
7. **Default-avatar auto-creation (§2b) is a live-driven product decision**, not in the original design: 2 real users carry avatar-tier knowledge with no avatar; without it their knowledge silently demotes to brand scope (the exact bleed the two-tier split prevents) and coach threads strand. This raises live avatar count 13→15.
8. **Untouched-policy role mismatch (acknowledged, in-scope-limited):** avatars/brands SELECT+DELETE policies remain `TO public` (this migration only rewrites INSERT/UPDATE for the FK-ownership fixes). Harmless (anon's `auth.uid()` is NULL ⇒ no match). A follow-up cosmetic migration could flip them to `authenticated` for consistency.
9. **`anon` retains table-level DML grants on `brand_assets`** (Supabase default) — defense rests entirely on the `TO authenticated` RLS policies, the standard Supabase posture. Flagged, not changed.

Files (all authoring-only, not applied):
- `/Users/matthewkerns/workspace/ecommerce/ecommerce-tools/brand-systems/idea-brand-coach/supabase/migrations/20260617000000_brand_avatar_scope_schema.sql`
- `/Users/matthewkerns/workspace/ecommerce/ecommerce-tools/brand-systems/idea-brand-coach/supabase/migrations/20260617000100_brand_avatar_scope_rls.sql`
- `/Users/matthewkerns/workspace/ecommerce/ecommerce-tools/brand-systems/idea-brand-coach/supabase/migrations/20260617000200_brand_avatar_scope_rpcs.sql`
- `/Users/matthewkerns/workspace/ecommerce/ecommerce-tools/brand-systems/idea-brand-coach/supabase/migrations/20260617000300_brand_avatar_scope_backfill.sql`
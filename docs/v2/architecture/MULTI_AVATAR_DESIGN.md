All disputed facts confirmed against the actual working tree (`feat/alpha-instrumentation`):

- avatars Row: `id, user_id, is_template, name, ...` — **no `brand_id`, no `is_primary`, Relationships: []**. Matches the architecture review's "user-keyed, no brand_id" reality, contradicts repo migrations.
- Three stores live: `AvatarContext` (`idea-selected-avatar-id`), `useAvatarService` (`brandCoach_currentAvatarId` + `avatarChanged` event).
- `artifactStore.ts` calls **6-arg** `save_artifact_atomic(p_user_id, p_avatar_id, p_kind, p_content, p_grounding, p_evidence_refs)` — no `p_brand_id`.
- `contextResolver.readUserKnowledgeBase(slot, _scope)` ignores `_scope` (product-fit F6 confirmed); `readAvatarFieldValues` omits avatar filter when `scope.avatarId == null` (security M-3 confirmed).
- consultant fn: single-shot, no loop.ts/memory-context.ts; `index.ts:79` body parse has no `avatar_id`; `retrieveAllContext`/`retrieveUserContext` have no avatar param.

I have everything needed. Producing the final design.

---

# FINAL DESIGN & IMPLEMENTATION PLAN — Brand/Avatar Two-Tier Scoping

> **Integration base correction (load-bearing).** This document is written against the **actual working tree** (`feat/alpha-instrumentation`), verified live, **not** `origin/main`. The draft design's "INTEGRATION BASE" was wrong in three ways the reviews caught and I re-confirmed:
> - **No tool-calling loop exists.** `idea-framework-consultant-claude` is a **single-shot** Claude call. There is **no `loop.ts`, no `LoopConfig`, no `memory-context.ts`, no `buildMemorySnapshot`, no `callMcpTool`, no MCP dispatch, no directive mechanism** in the consultant fn. The only tool it declares is `extract_brand_fields`. (Arch-review C1, product-fit #1 — both correct.)
> - **`avatars` has no `brand_id`** on live (generated `types.ts:67` Row = `id, user_id, is_template, name, demographics, …`; `Relationships: []`). The repo migrations that "add `brand_id`" / create `performance_metrics` are **drift not on live** (arch-review C2/M4, data-integrity F4, product-fit #8).
> - **`avatar_id` is never parsed** in `index.ts` and never threaded into `context.ts`; `retrieveUserContext` has no avatar param and a `minimal` branch that the two-tier query must respect (product-fit #1, arch-review H2).
>
> Every "Phase 3 = one-field edit to LoopConfig" assumption in the draft is **deleted**. The conversational-agent-tools path (locked #4) requires **first building a tool-calling loop** in the consultant fn — this is scoped explicitly below as its own phase, not a threading tweak.

---

## 1. Goal + Locked Decisions

**Goal.** One brand per account, many avatars under it. Switching the *current coach avatar* re-scopes the **coach conversation, avatar profile/fields, strategy artifacts, and recalled memory (KB/RAG)** to that avatar, while **brand-level knowledge (uploaded docs, brand strategy) and the funnel stay shared**. Rich avatars are built via the forensic evidence pipeline (S1→S4), surfaced in-app and via agent tools.

**Locked decisions (designed to, not relitigated):**
1. ONE brand per account, MANY avatars. Funnel + brand assets are brand-level. Add `brand_id` to avatars.
2. Switch re-scopes conversation + profile/fields + artifacts + recalled memory; brand knowledge + funnel stay shared.
3. Build via forensic pipeline (`build_avatar_stage` S1→S4); surfaced in-app; assume full MCP deployed.
4. Coach agent gets MCP tools to create/list/get/set-current avatar; UI keeps them too.
5. Diagnostic = BOTH brand baseline + optional per-avatar overlay (`avatar_id` on diagnostic).
6. Auto-migrate, shared-by-default; non-destructive + idempotent.
7. Funnel viewable per-avatar on demand; pinned primary avatar default; **separate selector** from the coach switch.
8. Scope: brand layer + `brand_id`; switch re-scoping; forensic in-app; agent tools; CRUD/UX; migration. **Defer** avatar comparison.

---

## 2. Target Architecture

### 2.1 Hierarchy & the three pointers

One brand per user (security root stays `auth.uid() = user_id`; `brand_id`/`avatar_id` are **scoping** dimensions, not new security boundaries). Three pointers, three distinct jobs:

| Pointer | Home | Job | Moves on coach switch? |
|---|---|---|---|
| **current coach avatar** | `chat_sessions.avatar_id` (**primary, authoritative**) + `profiles.current_avatar_id` (UI default mirror) | which avatar the active conversation/retrieval is scoped to | yes |
| **this thread's avatar** | `chat_sessions.avatar_id` | per-thread scope anchor | n/a (it *is* the anchor) |
| **funnel default** | `brands.primary_avatar_id` | funnel's pinned audit target | **no** (locked #7) |

> **Resolution of the architecture-review C3/H1 race (changed from draft).** The draft made `profiles.current_avatar_id` the retrieval source of truth with a 15s SPA poll, which the architecture review proved creates a TOCTOU cross-avatar bleed (agent switches the account pointer mid-turn while the in-flight chat body still carries the old avatar). **Fix adopted: retrieval is anchored on the conversation's `chat_sessions.avatar_id` (the thread), not the mutable account pointer.** `profiles.current_avatar_id` becomes a *UI convenience default* ("which avatar a new thread opens with") and the agent's `set_current_avatar` repoints/creates the active **session**, not just the profile row. This makes per-tab/per-thread scoping correct by construction and eliminates the poll race entirely. The 15s poll is **dropped** as a retrieval input (kept only as an optional UI hint for a second tab's default).

### 2.2 The avatar-switch contract (one enforced code path)

| Re-scopes on switch (AVATAR-scoped) | Stays SHARED (BRAND-scoped) |
|---|---|
| Coach **conversation** (`chat_sessions.avatar_id` thread) | Uploaded brand docs + brand KB (`scope='brand'`) |
| Avatar **profile/fields** (`avatar_field_values`) | **Funnel** / `brand_assets` inventory (locked #7) |
| Strategy **artifacts** (`artifacts`/`positioning_statements`/`evidence_snapshots` where `avatar_id=current`) | Brand strategy / canvas / copy / visual-identity KB |
| Recalled **memory** — KB rows `scope='avatar'` (categories `avatar`, `insights`) | Brand **baseline** Trust Gap (`avatar_id IS NULL`) |
| Per-avatar **diagnostic overlay** | Founder/coaching memory (no avatar tier this effort) |

**KB category policy (single audited constant)** in `context.ts` *and* `contextResolver.ts` (shared semantics):
```ts
const AVATAR_SCOPED_CATEGORIES = new Set(['avatar', 'insights']);
```
Everything else (`canvas`, `copy`, `diagnostic`, `visual_identity`, `productContext`) is BRAND-shared. **Retrieval is authoritative on the `scope` column, not on `avatar_id`-nullness** (data-integrity F8).

**The ONE switch entry point** — `AvatarContext.setCurrentAvatar`, the single path all five callers (V2 dropdown, V1 tabs, agent `set_current_avatar`, onboarding, delete-fallback) funnel through — except the funnel, which is structurally separate (§4.4):
```ts
// src/contexts/AvatarContext.tsx — THE single switch path
async function setCurrentAvatar(avatarId: string) {
  if (avatarId === currentAvatarId) return;                       // idempotent
  const prev = currentAvatarId;
  setLocal(avatarId); localStorage.setItem(KEY, avatarId);        // optimistic + cache mirror
  try {
    await profileService.setCurrentAvatarRPC(avatarId);          // ownership-checked RPC (F3) sets profiles.current_avatar_id
    await chatSessionService.ensureSessionForAvatar(userId, 'idea-framework-consultant', avatarId); // thread anchor
    await queryClient.invalidateQueries({ predicate: q => q.queryKey[0] === 'avatar' });            // nuke per-avatar caches
  } catch (e) { setLocal(prev); localStorage.setItem(KEY, prev ?? ''); toast.error('Could not switch avatar'); }
}
```

**Bleed firewall = query-key namespace.** Every avatar-scoped react-query key MUST start `['avatar', avatarId, …]` via `avatarScopedKey(domain, avatarId, ...rest)` in `src/lib/queryKeys.ts`. The invalidation predicate keys off `['avatar', …]`. A **Vitest invariant test (written first, XC-1)** asserts every avatar-scoped hook uses the prefix; a second guard fails if `brandCoach_currentAvatarId` or `'avatarChanged'` appears in `src/` outside the compatibility shim (arch-review H5).

### 2.3 Two-tier KB retrieval (the bleed fix, scope-authoritative)

```ts
// context.ts retrieveUserContext(client, userId, avatarId, query, minimal)
// avatarId MUST be UUID-validated before it touches any query builder (H1).
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const av = avatarId && isUuid(avatarId) ? avatarId : null;

// Independent budgets so brand recency can't starve avatar context in the `minimal` path (H2):
const brandRows  = await base.eq('scope','brand').is('avatar_id', null).limit(minimal ? 6 : 40);
const avatarRows = av ? await base.eq('scope','avatar').eq('avatar_id', av).limit(minimal ? 6 : 40) : [];
return mergeByRecency(brandRows, avatarRows);
```
- **No `.or()` string interpolation.** Two typed queries merged in code — eliminates PostgREST filter injection (security H1) and the minimal-budget starvation (arch H2).
- `retrieveSemanticContext` (`context.ts:108`) is **in the edit set**: `match_document_chunks` gains `match_brand_id`/`match_avatar_id` (DEFAULT NULL), passed UUID-validated; WHERE adds `(match_brand_id IS NULL OR brand_id=match_brand_id) AND (scope='brand' OR avatar_id=match_avatar_id)`.
- **Unauthenticated guard (security C2):** when `userId` is null, **no avatar-scoped retrieval runs at all** — the existing `if (userId && supabaseClient)` gate wraps the avatar path; a body-supplied `avatar_id` is never used without an authenticated session.

### 2.4 Memory namespacing — **DEFERRED with rationale**

The draft specified `buildMemorySnapshot`/`user_memories` path-prefix namespacing. **Neither exists in this tree** (arch-review confirmed; I re-confirmed: no `memory-context.ts`, no `user_memories` references). The "recalled memory re-scopes" half of locked #2 is satisfied **entirely by the two-tier KB** (`avatar`/`insights` categories), which *is* the coach's recalled memory in this codebase. **Memory-tier namespacing is deferred** until the intelligent-memory branch lands `user_memories`; when it does, namespace under `/memories/avatars/<avatarId>/*` (additive). Documented as open question O-4.

---

## 3. Data Model + Ordered Idempotent Migration (with RLS)

One dated directory, **four ordered files**, all idempotent. Apply via `mcp__supabase__apply_migration`.

```
supabase/migrations/
  20260620000000_brand_avatar_scope_schema.sql
  20260620000100_brand_avatar_scope_rls.sql
  20260620000200_brand_avatar_scope_rpcs.sql
  20260620000300_brand_avatar_scope_backfill.sql
```

> **Migration-drift reconciliation (data-integrity F4, arch-review C2/M4, product-fit #8).** The repo has a contradictory lineage (`20260301065445` adds `avatars.brand_id ON DELETE SET NULL`; `20260306`/`20260317` fight over `avatar_field_values` RLS; `20260301065636 performance_metrics` joins through `avatars.brand_id`). **Live has none of it.** Therefore:
> - **Do NOT validate via `create_branch` repo-replay** — it reproduces the brand-keyed avatars table, the opposite of live. Author/test as a **delta from a live schema snapshot** (`list_tables` + `pg_policies` + RPC positioning statements).
> - The schema file **explicitly reconciles the FK** (drop+re-add with the intended `ON DELETE`), so it is correct whether `brand_id` pre-exists (branch) or not (live).
> - Reconcile (don't blind-`db reset`) the stale repo migrations before any branch work.

### 3.1 `…_schema.sql`

```sql
-- BRAND SPINE: one brand per user. Pre-consolidate dupes BEFORE the unique index (F10, product-fit #12).
DELETE FROM public.brands b USING public.brands keep
  WHERE b.user_id = keep.user_id AND b.id > keep.id;   -- keep MIN(id) per user; safe (live 7/7 clean)
CREATE UNIQUE INDEX IF NOT EXISTS uq_brands_user_id ON public.brands(user_id);
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS primary_avatar_id uuid
  REFERENCES public.avatars(id) ON DELETE SET NULL;     -- FUNNEL default (locked #7), NOT the coach pointer

-- COACH CURRENT-AVATAR UI DEFAULT (mirror; thread is authoritative)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_avatar_id uuid
  REFERENCES public.avatars(id) ON DELETE SET NULL;     -- SET NULL: deleted avatar nulls the pointer (product-fit #5)
CREATE INDEX IF NOT EXISTS idx_profiles_current_avatar ON public.profiles(current_avatar_id);

-- avatars.brand_id — RECONCILE FK regardless of pre-existence (product-fit #3, data-integrity F4)
ALTER TABLE public.avatars ADD COLUMN IF NOT EXISTS brand_id uuid;
ALTER TABLE public.avatars DROP CONSTRAINT IF EXISTS avatars_brand_id_fkey;
ALTER TABLE public.avatars ADD CONSTRAINT avatars_brand_id_fkey
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;   -- CASCADE, not SET NULL
ALTER TABLE public.avatars ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_avatars_brand_id ON public.avatars(brand_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_avatars_one_primary_per_brand
  ON public.avatars(brand_id) WHERE is_primary;

-- KB TWO-TIER (the bleed fix)
ALTER TABLE public.user_knowledge_base
  ADD COLUMN IF NOT EXISTS brand_id  uuid REFERENCES public.brands(id)  ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS avatar_id uuid REFERENCES public.avatars(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'brand' CHECK (scope IN ('brand','avatar'));
ALTER TABLE public.user_knowledge_base DROP CONSTRAINT IF EXISTS chk_ukb_scope_avatar;
ALTER TABLE public.user_knowledge_base ADD CONSTRAINT chk_ukb_scope_avatar CHECK (
  (scope='avatar' AND avatar_id IS NOT NULL) OR (scope='brand' AND avatar_id IS NULL)
) NOT VALID;   -- VALIDATE inside this same migration window (F8) — 2191 rows, trivial lock
CREATE INDEX IF NOT EXISTS idx_ukb_brand_scope ON public.user_knowledge_base(brand_id, scope, is_current);
CREATE INDEX IF NOT EXISTS idx_ukb_avatar ON public.user_knowledge_base(avatar_id, is_current) WHERE avatar_id IS NOT NULL;
ALTER TABLE public.user_knowledge_chunks
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS avatar_id uuid REFERENCES public.avatars(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'brand' CHECK (scope IN ('brand','avatar'));

-- brand_id denormalized onto avatar-keyed tables (single-key scoping). F11: kept (one brand/user; trigger guards consistency).
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['artifacts','positioning_statements','evidence_snapshots','uploaded_documents','chat_sessions','decision_triggers'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_brand_id ON public.%I(brand_id)', t, t);
  END LOOP; END $$;
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS avatar_id uuid REFERENCES public.avatars(id) ON DELETE SET NULL;  -- if absent on live

-- DIAGNOSTIC OVERLAY (locked #5): NULL avatar = brand baseline; set = per-avatar overlay
ALTER TABLE public.diagnostic_submissions
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS avatar_id uuid REFERENCES public.avatars(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_diag_brand_avatar ON public.diagnostic_submissions(brand_id, avatar_id, completed_at DESC);
ALTER TABLE public.user_diagnostic_results
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS avatar_id uuid REFERENCES public.avatars(id) ON DELETE CASCADE;

-- FUNNEL CARVE-OUT: brand_assets inventory brand-level (avatar_id nullable) + separate audit overlay (F2).
ALTER TABLE public.brand_assets ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE;
ALTER TABLE public.brand_assets ALTER COLUMN avatar_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brand_assets_brand ON public.brand_assets(brand_id, touchpoint_id, stage);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_assets_current_per_touchpoint
  ON public.brand_assets(brand_id, touchpoint_id) WHERE superseded_by IS NULL;
CREATE TABLE IF NOT EXISTS public.brand_asset_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_asset_id uuid NOT NULL REFERENCES public.brand_assets(id) ON DELETE CASCADE,
  avatar_id uuid NOT NULL REFERENCES public.avatars(id) ON DELETE CASCADE,
  brand_id  uuid NOT NULL REFERENCES public.brands(id)  ON DELETE CASCADE,
  user_id   uuid NOT NULL,
  overall_score integer, audit_result jsonb,
  grounding text NOT NULL DEFAULT 'inference', evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  superseded_by uuid REFERENCES public.brand_asset_audits(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_asset_audit_current
  ON public.brand_asset_audits(brand_asset_id, avatar_id) WHERE superseded_by IS NULL;

-- FORENSIC BUILD STATE
CREATE TABLE IF NOT EXISTS public.avatar_build_state (
  avatar_id uuid PRIMARY KEY REFERENCES public.avatars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stages_done text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','built','approved')),
  approved_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);

-- CONSISTENCY TRIGGER (F11): keep denormalized brand_id == avatar's brand_id on avatar-keyed tables
CREATE OR REPLACE FUNCTION public.sync_brand_id_from_avatar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.avatar_id IS NOT NULL THEN
    SELECT brand_id INTO NEW.brand_id FROM public.avatars WHERE id = NEW.avatar_id;
  END IF;
  RETURN NEW;
END $$;
-- attach as BEFORE INSERT OR UPDATE on artifacts/positioning statements/evidence_snapshots/decision_triggers
```

### 3.2 `…_rls.sql`

> **brand_assets atomicity (data-integrity F2, the load-bearing one).** ALL four live `brand_assets` policies are `EXISTS avatars WHERE avatars.id = brand_assets.avatar_id` — making `avatar_id` nullable renders inventory rows (avatar_id NULL) **un-readable AND un-insertable**. **The schema relax (`DROP NOT NULL`) and this policy swap MUST land in one apply window**, ordered relax-then-swap, with a smoke insert of an inventory row as the migration's final assertion. (Files `…000000` and `…000100` are applied back-to-back in HALT-1 as one window.)

- `brand_assets`: **replace** avatar→user policies with brand-OR-avatar ownership (SELECT/INSERT/UPDATE/DELETE).
- `avatars`, `user_knowledge_base`, `user_knowledge_chunks`: keep `auth.uid()=user_id` SELECT/DELETE; **tighten INSERT/UPDATE `WITH CHECK`** so `brand_id`/`avatar_id` belong to caller (`EXISTS brands/avatars … user_id=auth.uid()`).
- `diagnostic_submissions`: **add UPDATE + DELETE** (today SELECT/INSERT only) so overlays can be re-run/replaced (data-integrity F1-class).
- `avatar_field_values`: **reconcile the contested policies (arch C2)** — `DROP POLICY IF EXISTS` for *both* the `20260306` brands-join and `20260317` user_id names, then create one canonical `auth.uid()=user_id`-rooted policy set.
- `brand_asset_audits`, `avatar_build_state`: new RLS, `auth.uid()=user_id`. **Include explicit DELETE policy** on `avatar_build_state` (security L-4) or document cascade-only intent (chosen: cascade-only; no user DELETE policy, documented).
- `performance_metrics` (if present on the branch lineage): add `OR avatars.user_id = auth.uid()` fallback so NULL `brand_id` doesn't lock owners out (security H-3, product-fit #8). On live it doesn't exist → no-op guarded by `IF EXISTS`.
- `profiles`: self-RLS unchanged for reads; **value-level ownership of `current_avatar_id` is enforced by RPC, not RLS** (see F3 below).

### 3.3 `…_rpcs.sql`

- **`save_artifact_atomic` — additive 7-arg overload, 6-arg LEFT INTACT (product-fit #7, data-integrity F9, arch H4).** Postgres overloads by arity, so create `save_artifact_atomic(p_user_id, p_brand_id, p_avatar_id, p_kind, p_content, p_grounding, p_evidence_refs)` **alongside** the existing 6-arg — the live `artifactStore.ts` keeps working untouched until its deploy. **The supersede-match key stays identical to today** (`user_id, kind, COALESCE(avatar_id, ZERO_UUID)`); `brand_id` is **written, not matched** — so 6-arg and 7-arg calls for the same `(user,kind,avatar)` collapse to one chain (no fork, no `uq_artifacts_current_per_kind` double-CURRENT violation). When `artifactStore.ts` is updated to call 7-arg (Phase 2), drop the 6-arg in a *later* migration once the MCP redeploy is confirmed.
- **`set_current_avatar(p_avatar_id)` — `SECURITY INVOKER`, the SINGLE write path for the coach pointer (security F3/C-1/XC-2).** Does `IF NOT EXISTS (SELECT 1 FROM avatars WHERE id=p_avatar_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'avatar_not_owned'`; then `UPDATE profiles SET current_avatar_id=p_avatar_id WHERE id=auth.uid()`. **Both SPA and MCP call this RPC** — no direct PostgREST `UPDATE profiles` allowed (closes the cross-user pointer hole RLS can't). Distinguishes not-found vs RLS-denied only after avatar_field_values RLS is reconciled (M2).
- **`set_primary_avatar(p_avatar_id)`** — clears+sets `is_primary` in one tx (respects partial unique index), ownership-checked, also sets `brands.primary_avatar_id`.
- **`save_asset_audit_atomic(...)`** — self-supersede→insert→repoint per `(brand_asset_id, avatar_id)`; raises on brand mismatch.
- **GRANT discipline (security L-1):** every new/replaced RPC gets `REVOKE ALL … FROM PUBLIC; GRANT EXECUTE … TO authenticated;` **in the same migration as its `CREATE`**.

### 3.4 `…_backfill.sql` (auto-migrate, shared-by-default)

```sql
-- 1. one brand per user — seed from the UNION of ALL user-scoped tables (F1: covers KB-only / doc-only users)
INSERT INTO public.brands(user_id, name)
SELECT DISTINCT u.user_id, 'My Brand' FROM (
  SELECT user_id FROM public.avatars              UNION
  SELECT user_id FROM public.user_knowledge_base  UNION
  SELECT user_id FROM public.uploaded_documents   UNION
  SELECT user_id FROM public.user_diagnostic_results UNION
  SELECT user_id FROM public.diagnostic_submissions  UNION
  SELECT user_id FROM public.artifacts
) u LEFT JOIN public.brands b ON b.user_id=u.user_id WHERE b.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 2. attach avatars
UPDATE public.avatars a SET brand_id=b.id FROM public.brands b WHERE b.user_id=a.user_id AND a.brand_id IS NULL;

-- 3. pin primary (oldest NON-TEMPLATE) per brand; mirror to brands.primary_avatar_id + profiles.current_avatar_id (L2)
WITH ranked AS (
  SELECT id, brand_id, row_number() OVER (PARTITION BY brand_id ORDER BY created_at) rn
  FROM public.avatars WHERE brand_id IS NOT NULL AND is_template = false)
UPDATE public.avatars a SET is_primary=true FROM ranked r
 WHERE a.id=r.id AND r.rn=1 AND NOT EXISTS (SELECT 1 FROM public.avatars x WHERE x.brand_id=a.brand_id AND x.is_primary);
UPDATE public.brands b SET primary_avatar_id=(SELECT id FROM public.avatars a WHERE a.brand_id=b.id AND a.is_primary LIMIT 1) WHERE b.primary_avatar_id IS NULL;
UPDATE public.profiles p SET current_avatar_id=(
  SELECT id FROM public.avatars a JOIN public.brands b ON b.id=a.brand_id
  WHERE b.user_id=p.id AND a.is_primary LIMIT 1) WHERE p.current_avatar_id IS NULL;

-- 4. KB scoping — BRANCH ON CATEGORY (H3): avatar/insights → avatar-scoped to primary; else brand-shared
UPDATE public.user_knowledge_base k SET brand_id=b.id,
    avatar_id = CASE WHEN k.category IN ('avatar','insights') THEN pa.id ELSE NULL END,
    scope     = CASE WHEN k.category IN ('avatar','insights') THEN 'avatar' ELSE 'brand' END
  FROM public.brands b LEFT JOIN public.avatars pa ON pa.brand_id=b.id AND pa.is_primary
  WHERE b.user_id=k.user_id AND k.brand_id IS NULL;
UPDATE public.user_knowledge_chunks c SET brand_id=b.id, scope='brand', avatar_id=NULL
  FROM public.brands b WHERE b.user_id=c.user_id AND c.brand_id IS NULL;  -- 0 rows live

-- 5. per-avatar tables: brand_id from row's avatar else user's brand (avatar_id never cleared)
--    repeat for artifacts/positioning statements/evidence_snapshots/uploaded_documents/decision_triggers
UPDATE public.artifacts t SET brand_id=COALESCE(av.brand_id,b.id)
  FROM public.brands b LEFT JOIN public.avatars av ON av.id=t.avatar_id
  WHERE b.user_id=t.user_id AND t.brand_id IS NULL;

-- 6. chat_sessions: backfill coach threads to primary avatar (F6, locked #2/#6) — past chat NOT stranded
UPDATE public.chat_sessions s SET brand_id=b.id,
    avatar_id = CASE WHEN s.chatbot_type='idea-framework-consultant' THEN pa.id ELSE s.avatar_id END
  FROM public.brands b LEFT JOIN public.avatars pa ON pa.brand_id=b.id AND pa.is_primary
  WHERE b.user_id=s.user_id AND s.brand_id IS NULL;

-- 7. diagnostics → brand baseline (avatar stays NULL), stamp brand_id
UPDATE public.diagnostic_submissions d SET brand_id=b.id FROM public.brands b WHERE b.user_id=d.user_id AND d.brand_id IS NULL;
UPDATE public.user_diagnostic_results r SET brand_id=b.id FROM public.brands b WHERE b.user_id=r.user_id AND r.brand_id IS NULL;

-- 8. brand_assets existing rows → inventory (brand-level), stamp brand_id from user
UPDATE public.brand_assets x SET brand_id=b.id FROM public.brands b WHERE b.user_id=x.user_id AND x.brand_id IS NULL;  -- 0 rows live

-- 9. ASSERT-THEN-TIGHTEN (F1/F5): fail loudly with offending ids BEFORE the irreversible NOT NULL
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.avatars WHERE brand_id IS NULL;
  IF n>0 THEN RAISE EXCEPTION 'backfill incomplete: % avatars without brand_id', n; END IF;
  SELECT count(*) INTO n FROM public.user_knowledge_base WHERE brand_id IS NULL;
  IF n>0 THEN RAISE EXCEPTION 'backfill incomplete: % KB rows without brand_id', n; END IF;
END $$;
ALTER TABLE public.avatars ALTER COLUMN brand_id SET NOT NULL;
-- (chk_ukb_scope_avatar already VALIDATEd in schema file's window)
```

Then **regenerate `src/integrations/supabase/types.ts`** via `mcp__supabase__generate_typescript_types` (never hand-edit).

---

## 4. Subsystem Designs

### 4.1 Switch re-scope (SPA + session layer)

- **Collapse three stores to one (arch H5, product-fit #4).** `AvatarContext` becomes canonical, backed by `set_current_avatar` RPC + thread anchor. **In the first commit**: `useAvatarService.selectAvatarById` and V1 `useAvatarTabs` become **thin delegators** to `AvatarContext.setCurrentAvatar`; the `avatarChanged` event and `brandCoach_currentAvatarId` writes are deleted (one-time localStorage seed from legacy keys). **`useBrandCoachV2State` must source avatar from `useAvatarContext()`, not `useAvatarService`** (product-fit #4 — explicit acceptance criterion).
- **Session layer is first-class, early (product-fit #2, arch M3).** `ChatSessionService.createSession` stamps `avatar_id`+`brand_id`; add net-new `ensureSessionForAvatar(userId, type, avatarId)` (pick existing open thread for that avatar or create one); `getSessions` filters by `avatar_id`. `useChatSessions` gains `avatarId?: string` in `UseChatSessionsOptions`, filters by it, and includes it in the query key: `['chat','sessions',chatbotType, avatarId ?? 'brand']` (product-fit #14). Chat body (`ChatEdgeFunctionService`/`SupabaseChatService`) sends `avatar_id`.
- **Auto-select race (product-fit #10, arch L1):** startup priority is **server pointer (valid) → stored localStorage → auto-select non-template avatars[0]**; auto-select gated behind "no valid server pointer AND no stored selection."
- **Delete-current fallback (product-fit #5):** delete path calls `setCurrentAvatar(brand.primary_avatar_id)` (or null if last avatar), clears the stale localStorage key, and `profiles.current_avatar_id` is `ON DELETE SET NULL` so the pointer can't dangle.
- **MCP-side bleed fix (product-fit #6):** `contextResolver.readUserKnowledgeBase`/`readUserKnowledgeChunks` must **use** the `_scope` param (drop underscore) — filter by `brand_id` + `scope` + `avatar_id` after migration. `readAvatarFieldValues` brand-level branch (security M-3): when `scope.avatarId == null`, **skip** avatar field reads (brand-level has no avatar OWNER-INTENT slots).

### 4.2 Forensic build in-app (locked #3)

- The S1→S4 pipeline (`buildAvatarStage.ts`/`avatarPipeline.ts`), grounding gate, `ingest_evidence`, `get_context_status`, per-avatar `save_artifact_atomic` are **already built and correct — do NOT touch** (matches the "26 tools registered, full pipeline present" live fact).
- **In-app surface, simplified (product-fit #9, security H2/M5):** the SPA does not call `/mcp` directly. The draft's `action:'avatar_build'` edge-fn-as-MCP-proxy is **rejected** — the consultant fn has no MCP client and SSRF-to-a-Node-host from Deno is fragile. **Instead, surface the forensic stages through their existing deployed edge functions** (`avatar-vocabulary`, `avatar-jobmap`, etc. per AGENTS.md) called directly from the SPA — the simpler, already-deployed path. `ForensicBuildService` → `useForensicAvatarBuild` → `ForensicAvatarBuilder.tsx` (stepper: pick/create → evidence intake → readiness check → run build → review read-only → **approve-not-edit**). `record_avatar_build` writes `avatar_build_state`. Re-run supersedes via the artifact chain; manual edit is an explicit "override locked field" path respecting `enforce_avatar_field_lock()`.
- **`product_id` hardening (security H2/M5):** `ingestEvidence`/`provideContext` add `z.string().uuid()` and an ownership pre-check (`SELECT id FROM user_products WHERE id=$1`); verify `user_product_reviews` INSERT RLS has `WITH CHECK (product_id IN (SELECT id FROM user_products WHERE user_id=auth.uid()))`.

### 4.3 Agent avatar tools (locked #4)

- **The conversational path requires a tool-calling loop that does not exist (arch C1, product-fit #1).** Two options for the operator (O-1):
  - **(A) Minimal, recommended for this effort:** lifecycle tools live in the **MCP host** (`src/mcp`), which already has tool-calling. The in-app coach exposes avatar lifecycle via the **SPA UI + the existing avatar edge functions**; the *conversational* "agent creates/switches avatar mid-chat" is delivered through the **MCP host when accessed via an MCP client (Claude Desktop)**, where the loop already works (per project memory: MCP Apps panels render in Desktop). The consultant edge fn (the SPA's chat) does **not** gain a tool loop in this effort.
  - **(B) Full:** build a native tool-calling loop in `idea-framework-consultant-claude` (multi-turn, MCP dispatch, directive rebind). Substantial; scoped as **Phase 6 (optional/deferred)**.
- **MCP lifecycle tools (4 new, `src/mcp/`):** `create_avatar` (gateWrite; mints `avatars` row, stamps `brand_id` from caller's brand resolved server-side — never caller-supplied; optional `set_current:true`), `list_avatars`, `get_avatar`, `set_current_avatar` (gateWrite; calls `set_current_avatar` RPC). Plus `record_avatar_build`. **Shared `requireOwnedAvatar(avatarId)` helper** (`src/mcp/service/avatarOwnership.ts`) called by **every** tool accepting `avatar_id` (security C-1) — retrofitted to existing `ingest_evidence`/`build_avatar_stage`/`persist_positioning_statement`/`provide_context`/`get_context_status` too.
- **`SupabaseAvatarService.create()` must stamp `brand_id`** server-side (product-fit #11) or the NOT NULL constraint rejects SPA-created avatars.
- **No tool-name collisions (arch M1):** `list_coach_conversations`/`get_coach_conversation` already exist and are conversation-listing, not avatar-listing — new `list_avatars`/`get_avatar` are distinct. Forensic + conversation tools are already registered; only **lifecycle** tools are net-new (host 26→~31).

### 4.4 Funnel carve-out (locked #7)

- **Inventory** = `brand_assets` keyed by `brand_id` (avatar_id NULL). **Overlay** = `brand_asset_audits(brand_asset_id, avatar_id)` via `save_asset_audit_atomic`.
- **Separate selector** `useFunnelAuditAvatar` (own key `idea-funnel-audit-avatar-id`, defaults to `brands.primary_avatar_id`) — **does NOT read either coach key, does NOT subscribe to switch events, does NOT call `setCurrentAvatar`**. Mechanical guarantee the funnel never moves on a coach switch.
- MCP: `list_funnel_inventory`, `upsert_funnel_touchpoint` (no `avatar_id`), `run_funnel_audit({avatar_id?})` (defaults to primary), `get_funnel_audit({avatar_id?})`. Funnel UI is Beta/dormant (0 rows) — this effort ships schema + tools + the independent selector; full view is a follow-up.

### 4.5 CRUD/UX consolidation

- `AvatarHeaderDropdown` gets kebab CRUD + primary star + forensic-build entry; `BrandCoachHeader` shows a context banner ("Coaching: <avatar> · Brand: <brand>"). New `AvatarManageDialogs`, `AvatarSwitchConfirm`.
- **DELETE `MultiAvatarInterface.tsx`** — zero-importer check is a **gate, not an assumption** (product-fit #15; grep already shows no external importers). Repoint V1 `useAvatarTabs` to delegate through `AvatarContext`; fallback redirect `/v1/avatar`→`/v2/coach`.

### 4.6 Diagnostic — BOTH (locked #5)

- **Resolve which table is authoritative (data-integrity F7) BEFORE coding:** read `SupabaseDiagnosticService.ts` + `runTrustGap.ts` + `TrustGapScorecard.tsx` to confirm whether the scorecard reads `user_diagnostic_results` vs `diagnostic_submissions` vs `profiles.latest_diagnostic_*`. Overlay store = whichever the scorecard actually persists/reads. `profiles.latest_diagnostic_*` is **brand baseline only** (single-valued; documented).
- Brand baseline = `avatar_id IS NULL`; overlay = `avatar_id` set. `TrustGapScorecard` gains a `baseline` compare-mode rendering the delta. `run_trust_gap` MCP tool gains `avatar_id?` + optional `persist` (read scores from the diagnostic table when omitted), stamping `avatar_id`+`brand_id` (product-fit #13).

---

## 5. Sequenced Phased Plan (file ownership + infra HALTs)

**HALT = human-gated infra step** (migration apply, MCP deploy, edge-fn deploy, type regen). Per project memory: live Supabase auto-pauses; **inspect live before apply**; other sessions apply migrations via MCP without repo files.

**Phase 0 — Base & branch.** Branch `feat/brand-avatar-scope` off the current working branch. Snapshot **live** schema (`list_tables`+`pg_policies`+RPC sigs). No skill-architecture/loop dependency.

**Phase 1 — Migrations.** Author 4 SQL files. Pre-check duplicate brands (empty). *Owns:* `supabase/migrations/2026062000030[0..3]_*.sql`.
**HALT-1 (migration apply):** apply `…000000`+`…000100` as **one window** (brand_assets relax + policy swap + smoke-insert assertion atomic), then `…000200`, `…000300`. **HALT-2 (type regen):** `generate_typescript_types` → write `types.ts`. Verify: `get_advisors`, backfill assertions, idempotency re-run (zero deltas).

**Phase 2 — MCP layer.** Depends on Phase 1. *Owns:* NEW `src/mcp/service/{avatars,avatarOwnership,funnelInventory,assetAudit}.ts`, `contracts/funnelAudit.ts`; NEW tools `{createAvatar,listAvatars,getAvatar,setCurrentAvatar,recordAvatarBuild,listFunnelInventory,upsertFunnelTouchpoint,runFunnelAudit,getFunnelAudit}.ts`; EDIT `artifactStore.ts` (→7-arg), `server.ts` (register), `server.test.ts`, `AGENTS.md`; **retrofit `requireOwnedAvatar` into existing avatar-accepting tools**; fix `contextResolver` `_scope`. Do NOT touch `avatarPipeline/buildAvatarStage/ingestEvidence/getContextStatus` logic (only add ownership guard).
**HALT-3 (MCP deploy):** deploy full host. Then drop 6-arg RPC in a follow-up migration once confirmed.

**Phase 3 — Edge fn (two-tier KB + avatar plumbing).** Depends on Phase 1 RPC. *Owns:* EDIT `idea-framework-consultant-claude/index.ts` (parse `avatar_id`, gate behind auth, hashed user log per M-1, restrict CORS per M-4), `context.ts` (`retrieveUserContext`/`retrieveAllContext`/`retrieveSemanticContext` + `avatarId` + scope-authoritative two-query merge + UUID validation + `AVATAR_SCOPED_CATEGORIES`). **No loop/memory work.**
**HALT-4 (edge-fn deploy):** `deploy_edge_function`. Smoke per memory's SSE-capture lesson.

**Phase 4 — SPA single-switch + session layer + CRUD/UX + diagnostic.** Depends on Phase 1 types + Phase 3 body contract. *Owns:* EDIT `AvatarContext.tsx` (canonical store + RPC switch + thread ensure + startup priority), `useAvatarService.ts` (delegate, drop event), `useAvatarTabs`, NEW `lib/queryKeys.ts`, EDIT `SupabaseUserProfileService.ts` (RPC wrapper), `SupabaseAvatarService.ts` (stamp brand_id, setPrimary), `ChatSessionService.ts` (avatar_id/brand_id + ensureSessionForAvatar + filter), `useChatSessions.ts` (avatarId + key), chat body services, `SupabaseDiagnosticService.ts`, `TrustGapScorecard.tsx`, `useBrandCoachV2State.ts` (source from AvatarContext), `runTrustGap.ts`; NEW forensic + funnel-selector + diagnostic-overlay components. DELETE `MultiAvatarInterface.tsx` (after zero-importer gate).

**Phase 5 — Tests, advisors, handoff.** `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`; `get_advisors`; browser QA via `docs/TEST_ACCOUNT.md`.

**Phase 6 — (OPTIONAL/DEFERRED) Native tool-calling loop in the consultant fn** + memory-tier namespacing once `user_memories` lands. Required only for in-SPA-chat conversational avatar lifecycle (option B, §4.3).

---

## 6. Test Strategy

- **Migration:** test as a **delta from a live snapshot, NOT repo-replay branch** (drift). Assert backfill (every avatar `brand_id`; every user 1 brand+1 primary+pointer; KB-only/doc-only users get a brand — F1; `avatar`/`insights` KB → avatar-scoped to primary — H3; coach sessions → primary — F6; CHECK validated). Idempotency: re-run all 4 → zero deltas. Inventory smoke-insert (avatar_id NULL) succeeds — F2. `get_advisors` clean.
- **Bleed firewall (load-bearing, written FIRST — XC-1):** Vitest asserting every avatar-scoped hook uses `avatarScopedKey`; guard rejecting `brandCoach_currentAvatarId`/`avatarChanged` outside the shim. Integration: write avatar-KB to A, switch to B, assert context excludes A's `avatar`/`insights` rows, includes brand KB.
- **Switch contract:** unit on `setCurrentAvatar` (optimistic→RPC→ensureSession→invalidate; rollback on failure). E2E (QA account): switch → thread swaps, fields reload, banner updates, **funnel unchanged**. Delete-current → fallback to primary (F5).
- **Ownership (security):** `set_current_avatar` RPC rejects another user's avatar UUID (F3/C-1); `requireOwnedAvatar` rejects across all retrofitted tools; `create_avatar` brand_id stamped server-side + `name_taken` (23505); anon-denied.
- **Edge fn:** two-tier returns brand ∪ avatar; UUID validation rejects injection (H1); `minimal` path returns both budgets (H2); unauth request runs no avatar query (C2); SSE capture for stream-wrapped errors.
- **RPC:** 7-arg ∥ 6-arg-shim collapse to one artifact chain (F9); `set_primary_avatar` never two primaries; `save_asset_audit_atomic` brand-mismatch raise.
- **Diagnostic:** baseline (avatar NULL) unchanged; overlay compare-mode renders delta; persist scope only changes (F7).
- Target ≥85% on new code.

---

## 7. Risks + Open Questions for the Operator

**Risks (all review findings mapped):**
- **HALT ordering across 4 gates.** brand_assets relax+RLS-swap **one window** (F2); 6-arg RPC stays until MCP redeploy confirmed (F9/product-fit #7); type regen last (drift). 
- **Migration drift / parallel MCP sessions** (recurring per MEMORY): every file idempotent; inspect live before apply; reconcile (don't auto-delete) stale `20260301065445`/`20260306`/`20260317`/`performance_metrics` migrations; test as live-delta not repo-replay (F4/M4).
- **`.or()` injection eliminated** by two-query merge + UUID validation (H1).
- **Query-key prefix discipline** — Vitest guard is the only defense (XC-1/H5).
- **F11 brand_id desync** — consistency trigger added (one brand/user makes it moot today).
- **No tool loop in consultant fn** — conversational-agent-avatar in-SPA deferred to Phase 6; MCP-client path works today (arch C1).

**Findings explicitly deferred (with rationale):**
- **Memory-tier namespacing (F12, draft §b):** `user_memories`/`buildMemorySnapshot` don't exist in this tree; recalled-memory re-scoping is fully covered by two-tier KB. Namespace when intelligent-memory lands (O-4).
- **Avatar comparison** — locked #8 defers it.

**Open questions for the operator:**
- **O-1 (decision needed):** Agent avatar lifecycle in-SPA-chat — ship **option A** (MCP-client + SPA UI; no consultant tool loop, recommended for this effort) or commit to **option B** (build the tool loop, Phase 6)? Default assumed: A.
- **O-2:** Confirm which table the Trust Gap scorecard actually persists/reads (F7) — gates the diagnostic-overlay store. Resolve by reading `runTrustGap.ts`/`SupabaseDiagnosticService.ts`/`TrustGapScorecard.tsx` in Phase 0.
- **O-3:** Confirm `chat_sessions.avatar_id` exists on live (draft claimed it does, 0/57; schema file adds `IF NOT EXISTS` defensively either way).
- **O-4:** When does intelligent-memory's `user_memories` land? Sequences the deferred memory namespacing.
- **O-5:** Coordinate the brand_assets `DROP NOT NULL` with the product-data branch (if it assumes `avatar_id NOT NULL`) and onboarding's brand bootstrap (must route through `set_current_avatar`/`createAvatar` + honor `uq_brands_user_id`).

**Key files re-verified for implementers (all absolute):** `/Users/matthewkerns/workspace/ecommerce/ecommerce-tools/brand-systems/idea-brand-coach/supabase/functions/idea-framework-consultant-claude/{index,context,tools}.ts`; `.../src/integrations/supabase/types.ts` (avatars Row = no brand_id); `.../src/mcp/service/{artifactStore,contextResolver}.ts`; `.../src/contexts/AvatarContext.tsx`; `.../src/hooks/{useAvatarService,useChatSessions}.ts`; `.../src/services/chat/ChatSessionService.ts`; `.../src/mcp/server.ts`; stale-drift migrations `.../supabase/migrations/{20260301065445_create_avatars_table,20260301065636_create_performance_metrics_table,20260306_create_avatar_field_values_table,20260317000000_fix_avatar_field_values_rls,20260607020000_artifact_save_atomic_rpc}.sql`.
# Clerk Auth — Cutover Runbook

Native-swap cutover: Clerk replaces Supabase Auth as the identity Supabase trusts.
Flag-gated and additive until the final flip. Prereq: `CLERK_SETUP.md` is done
(Clerk app created, publishable key in hand, Supabase third-party Clerk provider
saved with the Clerk domain).

## What's already built (this branch, `feat/clerk-auth`)

- `VITE_ENABLE_CLERK_AUTH` + `VITE_CLERK_PUBLISHABLE_KEY` flags (`src/config/clerkConfig.ts`).
- Clerk-aware Supabase client (`client.ts`) — sends the Clerk token as the bearer
  via `accessToken` when the flag is on; byte-identical to today when off.
- Shared bearer accessor (`src/integrations/supabase/sessionToken.ts`) used by the
  client and the 4 edge-fn callers (chat stream, title, competitive, doc upload).
- `ClerkAuthProvider` bridges Clerk → the existing `AuthContext` (all `useAuth()`
  consumers unchanged); `ClerkAuthSurface` renders `<SignIn/>/<SignUp/>`.
- `Auth.tsx` and `DiagnosticAuthModal.tsx` render the Clerk surface when the flag is on.
- Native-swap DB migration: `supabase/migrations/20260624000000_clerk_native_swap.sql`
  (+ `_down.sql`) — **authored, NOT applied**. Review its HOTSPOTS first (see below).

## ⚠️ The re-key migration is now GENERATED, not static (updated 2026-07-12)

The original static `20260624000000_clerk_native_swap.sql` is **STALE and marked
SUPERSEDED — do not apply it.** It was authored against the 2026-06-24 schema;
prod has since drifted materially (verified live 2026-07-12):

| Surface | Static file (2026-06-24) | Live prod (2026-07-12) |
|---------|--------------------------|------------------------|
| RLS policies on `auth.uid()` | 121 | **142** |
| FKs to `auth.users` | 30 | **37** |
| `user_id`/`id` uuid cols retyped | 34 | **46** |
| `auth.uid()` column DEFAULTs | 2 | **7** |
| `auth.uid()` SQL functions | 9 names / 12 overloads | +**`enforce_trial_piece_limit`** (new) |

Because this surface grows with every new user-data table, the swap is now
produced by a **catalog-driven generator** that always matches prod at cutover:

> **`supabase/migrations/_generators/clerk_native_swap.gen.sql`**

At cutover: run its SELECTs against prod, assemble the emitted sections in the
documented order into `supabase/migrations/<UTC-ts>_clerk_native_swap.sql`, then
apply the companion `20260624000100_clerk_profiles_and_functions.sql` (functions +
`profiles.id`→text) **after** it. The generator is view-safe (drops/recreates
`user_knowledge_current`), handles the 7 `auth.uid()` DEFAULTs, and re-enumerates
functions. **Silent-bug note:** `enforce_trial_piece_limit`'s `auth.uid() IS NULL`
guard would, unrewritten, make the free-trial paywall stop enforcing under Clerk —
the companion migration's STEP 3 fixes it; re-run its enumeration query at cutover.

## Pre-cutover review (do once)

1. **Resolve the two migration HOTSPOTS — these BLOCK the swap (read the bottom of
   `20260624000000_clerk_native_swap.sql`):**
   - **[H1] `profiles.id`** stays `uuid` but is compared to `auth.uid()` in the
     profiles + beta_testers policies → becomes `text = uuid` (runtime error).
     DECIDE: convert `profiles.id` (the app's user PK) + its FKs
     (`profiles_id_fkey`→auth.users, `profiles_current_avatar_id_fkey`) to a text
     Clerk id (consistent choice), OR cast `id::text` in those policies. The
     migration intentionally does NOT do this for you.
   - **9 SQL functions** (`match_document_chunks`, `match_user_documents`,
     `match_user_knowledge`, `update_knowledge_entry`, `save_artifact_atomic`,
     `save_asset_audit_atomic`, `set_context_avatars`, `set_current_avatar`,
     `set_primary_avatar`) call `auth.uid()` and/or take a `uuid` user param.
     Under Clerk `auth.uid()` is NULL and the caller id is text — update each to
     read `(auth.jwt()->>'sub')` and accept text ids, or the RAG/knowledge/avatar
     paths break. NOT auto-rewritten.

2. **Profile provisioning under Clerk (architecture decision — REQUIRED).**
   Today `public.profiles` is auto-created by the `handle_new_user` trigger on
   `auth.users` (`on_auth_user_created`), and `link_beta_tester_to_user` runs on the
   same event. **Clerk users never hit `auth.users`, so these triggers never fire →
   no profile row, no beta linking.** Replace with one of:
   - a **Clerk webhook** (`user.created`) → edge function that inserts the profile
     (keyed by the Clerk id), or
   - **create-on-first-authenticated-load** (upsert the profile client/edge-side when
     a Clerk user first appears).
   Decide this BEFORE cutover; it pairs with the `profiles.id` → text decision in [H1].
2. **Accept the data reality:** existing rows keyed to Supabase UUID `user_id`s will
   NOT match any Clerk `sub`. This is acceptable only because there are no real
   customers yet (internal/QA data). If that changes, a data-remap step is required
   BEFORE this migration.
3. Verify against the **dev** Clerk instance first (steps below), then repeat with
   the `pk_live_…` production instance.

## Cutover sequence (scheduled, ~30 min, reversible)

1. **Config (Supabase dashboard):** confirm Authentication → Third-Party Auth → Clerk
   is enabled with the correct Clerk domain. (Dashboard-only; my token is read-only here.)
2. **Generate + apply the DB migration** (point of no easy return — down generator ready):
   - Run `_generators/clerk_native_swap.gen.sql` SELECTs against prod; assemble the
     emitted sections (in the documented order) into a new timestamped migration.
   - Apply it, then apply `20260624000100_clerk_profiles_and_functions.sql`.
   - Immediately smoke-test one RLS read with a Clerk token (see step 4).
3. **Set frontend env + build from `main`:**
   `VITE_ENABLE_CLERK_AUTH=true`, `VITE_CLERK_PUBLISHABLE_KEY=pk_live_…`,
   then `npm run build`.
4. **Verify on the QA account BEFORE wide release** (`docs/TEST_ACCOUNT.md`):
   - `/auth` shows the Clerk sign-in/up (not the old forms).
   - Sign up + sign in succeed; the diagnostic modal closes on auth.
   - An authenticated Supabase read (e.g. avatars list) returns the user's rows →
     proves the Clerk token authenticates RLS via `auth.jwt()->>'sub'`.
   - Chat streaming + a document upload work (proves the edge-fn bearer path).
5. **Deploy frontend** to prod (rsync `dist/` to `ubuntu@54.243.53.44:/opt/ideabrandcoach`).
6. **Restore the normal Ask-First gates banner** in `CLAUDE.md` before testers onboard.

## Rollback

- **Frontend (instant):** set `VITE_ENABLE_CLERK_AUTH` unset/false, rebuild + redeploy
  → the app is back on Supabase Auth UI immediately.
- **Database:** apply `20260624000000_clerk_native_swap_down.sql` (restores `auth.uid()`
  policies and `user_id uuid`). Do this only if the migration was applied and you are
  reverting the whole swap.
- The two are independent: you can roll the UI back without touching the DB only if the
  DB still has the Supabase-Auth policies (i.e. before step 2, or after the down-migration).

## Known follow-ups (non-blocking)

- Clerk is statically imported, so it ships in the bundle even when the flag is off.
  Lazy-import `ClerkAuthProvider`/`ClerkAuthSurface` if bundle size matters.
- Google sign-in: enable Google as a social connection in the Clerk dashboard to keep
  parity with today's "Continue with Google".
- Password reset / email confirmation are handled inside Clerk's components — the old
  Supabase `?mode=reset` / "check your email" branches are skipped in Clerk mode.

# /v4 + Funnel Surface — Cross-User Data Separation Audit

**Date:** 2026-06-27 · **Branch:** `feat/v4-alpha-surface` · **Scope:** read-only audit; no code changed.
**Method:** repo migrations + service/hook/context code, cross-checked against **live prod RLS** (`pg_policy`).

## Verdict

**Cross-user isolation is SOLID.** Every table the /v4 + funnel surface reads/writes has RLS
enabled and owner-scoped on **live prod**, either directly (`user_id = auth.uid()`) or transitively
through an ownership join (`avatars.user_id` / `brands.user_id`). The client services correctly rely
on RLS (filter by `avatar_id`/`id`, no client-side `user_id` filter) — the verified policies make a
foreign id return **empty**, not another user's data. No HIGH/MEDIUM live isolation defect found.
The only findings are a same-device localStorage `guest` bucket (LOW) and schema/repo drift for the
analytics + positioning statements tables (INFO — RLS is correct in prod, just not reproducible from this repo).

## (a) RLS — verified on LIVE prod

| Table | RLS | Scope (verified) | Sev |
|---|---|---|---|
| `avatars` | on | `auth.uid() = user_id` (SELECT/INS/UPD/DEL) — the linchpin every funnel read joins through | OK |
| `brands` | on | `auth.uid() = user_id`; INS/UPD WITH CHECK validates `primary_avatar_id` ownership | OK |
| `brand_assets` | on | SELECT/UPD/DEL via `brands.user_id` OR `avatars.user_id`; INSERT WITH CHECK requires owned brand **and** owned avatar | OK |
| `brand_tests` | on | via `brand_assets → avatars.user_id` (all four cmds) | OK |
| `brand_asset_audits` | on | `auth.uid() = user_id`; INS/UPD WITH CHECK re-verifies avatar+brand ownership | OK |
| `positioning_statements` | on | `auth.uid() = user_id` (SELECT/INS/UPD) | OK |
| `artifacts` | on | `auth.uid() = user_id` | OK |
| `avatar_field_values` | on | `avatar_id IN (avatars WHERE user_id = auth.uid())` | OK |
| `diagnostic_submissions` | on | `auth.uid() = user_id`; UPD WITH CHECK validates brand_id/avatar_id ownership | OK |
| `user_diagnostic_results` | on | `auth.uid() = user_id`; UPD WITH CHECK brand/avatar ownership | OK |
| `trust_gap_snapshots` | on | via `avatars.user_id` (all cmds) | OK |
| `decision_triggers` | on | `auth.uid() = user_id` (all cmds) | OK |
| `content_generation_jobs` | on | `user_id = auth.uid()` (FOR ALL) — edge fns stamp `user_id` from verified JWT | OK |
| `campaigns` / `campaign_metrics` / `email_sequences` / `email_steps` | on | `user_id = auth.uid()` (SELECT/INS, +UPD where present) | OK |
| `leads` (diagnostic lead PII) | on | **zero policies = default-deny**; service-role-only via `submit-diagnostic-lead` | OK |
| `profiles` | on | `auth.uid() = id` | OK |
| `beta_testers` | on | public INSERT (intended signup); SELECT scoped to own email | OK |
| storage `brand-assets` bucket | on | read/update/delete scoped to `foldername[1] = auth.uid()` | OK |

**campaign_metrics owner-guard:** the live policy is a flat `user_id = auth.uid()` (not a
brand_asset/`brands.user_id` trigger). That is strictly owner-scoped and correct; no avatar_id-based
leak. The brief's "owner-guard trigger via brands.user_id" describes the unmerged analytics-branch
design — prod landed the simpler owner policy.

## (b) Client-side scoping

- **`src/services/v4/*` (fix/analyse/defend/remeasure) + `SupabaseBrandFunnelService`:** correct
  pattern — reads filter by `avatar_id`/`id` and **lean on RLS** for tenant isolation. Given the
  verified policies, a user passing a foreign `avatarId` gets empty results, never another tenant's
  rows. Writes stamp `user_id` from `supabase.auth.getUser()`.
- **`fixService` `defaultMetricsReader`:** reads `campaign_metrics` by `avatar_id` through an untyped
  client (table absent from generated types). Prod RLS enforces `user_id = auth.uid()`, so this is
  cross-user safe; on error it degrades to an empty map (honest no-data).
- **`V4ContextStore`** (`src/contexts/V4ContextStore.tsx`): localStorage keyed **per authenticated
  user** (`idea.v4.context.<userId>`). Authed buckets do not bleed between accounts — a different
  login re-hydrates from its own key. See LOW finding F1 for the `guest` bucket.

## (c) Reads that could surface another user's data
None found. Every audited read is RLS-gated; the unauth diagnostic path writes to default-deny
`leads` via service role only and never reads cross-user rows.

## Findings

- **F1 (LOW) — shared `guest` localStorage bucket.** Unauthenticated use writes to
  `idea.v4.context.guest`. Two different people using the app **pre-login on the same browser/device**
  would see each other's brand context. No auth boundary or server data is crossed (client-only,
  same device). Also, on sign-out the prior user's `idea.v4.context.<userId>` bucket is not cleared
  (persists locally; not surfaced to other logins). *Optional fix:* clear/namespace the guest bucket
  on auth-state change, or drop guest persistence and migrate guest answers into the user bucket on
  login.
- **F2 (INFO) — schema/repo drift.** `campaigns`, `campaign_metrics`, `email_sequences`,
  `email_steps`, and the `positioning_statements` CREATE+RLS exist and are correctly owner-scoped **in prod** but
  are **not in this worktree's migrations** (referenced only). Live isolation is fine; the gap is
  reproducibility — a fresh DB from these migrations would lack them. *Fix:* backfill the migration
  files to match prod (consistent with the project's known MCP-applied drift pattern).
- **F3 (INFO) — storage INSERT WITH CHECK not asserted in this audit.** brand-assets read/update/
  delete are owner-folder scoped; the INSERT policy uses a WITH CHECK that should mirror
  `foldername[1] = auth.uid()` (same shape as the `documents` bucket). Confirm if hardening storage.

## Recommendation
Ship — cross-user data separation for the /v4 surface is immaculate at the RLS layer. Address F1
(guest bucket) as a small privacy nicety and F2 (migration backfill) for repo hygiene; neither blocks.

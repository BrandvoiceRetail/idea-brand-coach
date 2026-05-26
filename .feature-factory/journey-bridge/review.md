# Journey Bridge — Review Gate (review bucket)

Reviewer: `frontend-architect` agent (read-only) over the diff. Findings triaged
against scope (wiring only) and file ownership.

## Verdict
Routing logic clean, well-typed, fully tested; `parseGapParam` safely validates
untrusted URL input; `?gap=` survives the email/password auth round-trip. Fixed
all in-scope findings; one blocker flagged as a scoped follow-up (pre-existing
auth-infra, outside ownership).

## Findings & disposition

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| 1 | Blocker | Google OAuth (`SupabaseAuthService.signInWithOAuth`) hardcodes `redirectTo: origin/`, dropping `?redirect=` (and the gap) for guests who sign up with Google. | **FLAGGED — follow-up.** Pre-existing behaviour, not introduced here; in auth-service files outside this task's ownership; needs Supabase redirect-allowlist config. The documented QA/email signup path preserves the gap correctly, so the journey has a complete no-dead-end path. Tracked for a scoped auth task. |
| 2 | Should-fix | Gate redirect effect depended on `location.pathname/search` → could re-fire on in-page nav and bounce an authed user to `/auth`. | **FIXED.** Reverted `useLocation`; read `window.location` at fire time; deps now `[isLoadingAuth, user, navigate]`. Even more minimal. |
| 3 | Should-fix | Gap opener could call `handleSendMessage` before `currentSessionId` exists. | **FIXED.** `showGapOpener` now also requires `!!currentSessionId`. |
| 4 | Should-fix | `trustGap.ts` `route` field now dead/misleading. | **FLAGGED only** — `trustGap.ts` is frozen (DO NOT TOUCH). Noted in arch.md D6; clean up when freeze lifts. |
| 5 | Should-fix | Bridge "Back to my scorecard" hardcoded `/v1/diagnostic/results`. | **FIXED.** Uses `V1_ROUTES.DIAGNOSTIC_RESULTS`. |
| 6 | Nit | Redundant `&& gap` in JSX. | **KEPT** — required for TS narrowing through the boolean; harmless. |
| 7 | Nit | Opener banner missing landmark role. | **FIXED.** Added `role="region"` + `aria-label`. |
| 8 | Nit | `collectCurrentFields` dep in `useBrandCoachChat` (pre-existing). | **FLAGGED only** — pre-existing, not in scope/ownership. |
| 9 | Nit | `buildBridgePath` doesn't `encodeURIComponent` (gap is a constrained enum). | **KEPT** — values are 4 known URL-safe keys; not a bug. |

## Post-fix verification
- `tsc --noEmit`: 0 errors.
- eslint (touched files): 0 errors (1 pre-existing warning at `useBrandCoachV2State.ts:466`, the `useMemo`/`progress` dep — unrelated to this change).
- `journeyBridge.test.ts`: 9/9. `trustGap.test.ts`: 13/13.
- E2E (authed QA account) re-confirmed earlier: full chain renders + routes, 0 journey-step console errors.

## Known limitations carried forward
- Google-OAuth redirect (finding #1) — guest Google signup lands on `/`, not the
  coach. Email signup is unaffected.
- Pre-existing non-fatal `sync-diagnostic-to-embeddings` 500 at diagnostic save
  (logged + swallowed; out of scope).

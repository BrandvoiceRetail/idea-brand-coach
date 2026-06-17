# Review — Moment 1 Feedback Loop

> Bucket: Refactor & code review · Gate: security-auditor on the new write path + RLS.
> Checklist: guide `99-reference/CODE_REVIEW_CHECKLIST.md` (consumed).

## Security review (security-auditor lens, read-only)

**Verdict: no Critical/High findings.** The write path and RLS are sound and a security *upgrade* over
the existing `save-beta-feedback` pattern (which trusts a client-supplied `userId`). Confirmed strengths:
- `user_id` derived from the **verified JWT** (`auth.getUser`), not the request body — no user spoofing.
- RLS **deny-by-default to clients**: no INSERT policy (writes only via service-role edge fn); `SELECT`
  scoped `user_id = auth.uid()`; null-user rows unreadable by clients. `feedback_events` was NOT flagged by
  Supabase security advisors (unlike `beta_*` tables with permissive `WITH CHECK (true)` insert policies).
- Service-role key confined to the edge fn (`Deno.env`), never returned to the client; response is only `{id}`.
- No injection surface (parameterized supabase-js insert); no string-built SQL.

## Findings & resolutions

| Sev | Finding | Resolution |
|-----|---------|------------|
| Low (Act-Now, borderline) | Unchecked `auth.getUser()` lets an anon-key caller write `user_id=null` rows via the raw URL | **Conscious decision documented in code + here:** anonymous writes are intentionally allowed so feedback is never lost; the modal is only reachable on the authed `/v2/coach` route (so real submits capture `user_id`), and null-user rows are RLS-unreadable by clients. Abuse mitigation = rate limit (deferred, below). |
| Medium | Unbounded `payload` jsonb (storage abuse) | **Fixed:** server rejects `payload` > 10KB (`400 payload too large`) — verified live. |
| Low | `moment` unvalidated free text (index pollution) | **Fixed:** server rejects `moment` > 64 chars (`400 moment too long`) — verified live. |
| Low | No `free_text` length cap | **Fixed:** `maxLength={2000}` on the modal Textarea. |
| Info | `CORS *` | Acceptable for a JWT-verified, cookieless function (matches `save-beta-*`). No change. |
| Low | PII in logs | Confirmed: function logs only `error.message`, never the payload. No change. |

## Deferred (Plan Later — out of alpha scope, tracked)

- **Rate limiting** (per-user/IP) on the endpoint — the anon key is a valid JWT, so `verify_jwt` alone
  doesn't stop scripted spam. Acceptable for low-traffic alpha; revisit before broader release.

## Quality / regressions

- `npx tsc --noEmit`: clean. `npm run build`: ✓.
- Tests: hook (4) + modal (5) + trigger integration (1) = 10 new, all green. Full suite: only the
  **pre-existing** `DiagnosticResults.test.tsx` failures (6) remain — identical on the clean `9de686f`
  base; out of this feature's ownership (the score page). **Zero regressions introduced.**
- DRY/SOLID: reused the codebase write pattern + shared ui primitives + the existing pick-handler seam;
  no parallel feedback system (see arch.md).

## Real-write verification (DONE-WHEN)

Exercised the **deployed** function end-to-end:
- Submit → row with `payload {chosen_signature, scores:{score_felt_right, signature_felt_right}, free_text}`, `moment_1`.
- Dismiss → row with `payload {skipped:true, chosen_signature}`, `moment_1`.
- Rows read back via SQL (readable, correct shape); guards (400s) verified; verification rows then deleted.
- UI path: `tsc`/build green; unit tests cover modal render/submit/skip/payload; integration test proves
  Signature pick → modal opens. (`user_id` is null only for the anon-key probe; the authed UI captures it.)

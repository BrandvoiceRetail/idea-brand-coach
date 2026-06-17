# Error Handling — Moment 1 Feedback Loop

> Bucket: Error handling & retry · Orchestrator: `errors-orchestrator`
> Checklist: guide `99-reference/ERROR_HANDLING_CHECKLIST.md` (consumed, not restated).

## Principle: the feedback prompt must NEVER break the Signature flow

Moment 1 is low-stakes product signal. A failed write must not block, error-toast-spam, or trap the
user. So `useFeedbackEvent.recordEvent` **never throws** — it resolves `{ ok: false }` and sets a soft
`error`; the modal still shows the thank-you and closes. No write is on the critical path.

## Failure matrix

| # | Failure mode | Where | Handling | Retry? |
|---|--------------|-------|----------|--------|
| 1 | Network offline / fetch failure | `functions.invoke` rejects | catch → `{ok:false}`, soft `error` set, modal still thanks/closes | No — fire-and-forget; the event isn't worth blocking on |
| 2 | Auth expired / missing JWT (401) | edge fn `verify_jwt` | invoke error → `{ok:false}`; flow continues. `/v2/coach` is already auth-gated so this is rare | No |
| 3 | Bad request (missing `moment`) | edge fn 400 | Can't happen from the modal (always sends `moment:'moment_1'`); edge fn still validates & returns 400 | No |
| 4 | DB/insert error (5xx) | edge fn catch | server logs `console.error`; returns `{error}`; client → `{ok:false}` | No |
| 5 | RLS denial | n/a | Not applicable — service-role insert bypasses RLS by design | n/a |
| 6 | Double submit | modal | `settledRef` guard → exactly one write | n/a |
| 7 | Skip *after* a successful submit (dialog close) | modal | `settledRef` + `thanked` guards → no extra `skipped` write | n/a |
| 8 | Oversized free text | edge fn / jsonb | Accepted (jsonb tolerates); no length cap enforced for alpha. Documented risk, low. | n/a |
| 9 | user_id null (unauthenticated edge case) | edge fn | Insert proceeds with `user_id: null` (column is nullable); event still captured | n/a |

## Decisions

- **No retry / no queue.** A lost Moment-1 event is acceptable; retrying risks duplicate rows and adds
  complexity for negligible value. (If signal volume later proves lossy, revisit — out of alpha scope.)
- **Skip is fire-and-forget** (`void recordEvent(...)`) so dismissal is instant.
- **Single-write guard** (`settledRef`) prevents duplicate submit/skip rows.
- **Soft error only**, surfaced via the hook's `error` state; no blocking toast (the modal closes either way).
- **Server-side validation** of `moment` (400 if missing) — defensive even though the client always sends it.

# Functionality — Moment 1 Feedback Loop

> Bucket: Functionality · Orchestrator: `func-orchestrator` (TDD)
> Checklist: guide `99-reference/TDD_QUICK_REFERENCE.md`, `FUNCTION_DESIGN_CHECKLIST.md` (consumed).

## Stories

### T6 — `feedback_events` table + write path
- **Migration** `supabase/migrations/20260526000000_create_feedback_events.sql`:
  `feedback_events(id uuid pk, moment text not null, user_id uuid null → auth.users, session_id text null,
  created_at timestamptz, payload jsonb)`; indexes on moment/user_id/created_at; RLS enabled; deny-by-default
  to clients; self-`SELECT` policy for future read use.
- **Edge fn** `supabase/functions/save-feedback-event/index.ts`: `verify_jwt: true`; derives `user_id` from
  the verified JWT (`auth.getUser`); service-role insert; returns `{ id }`. Validates `moment`.
- **Client hook** `src/hooks/v2/useFeedbackEvent.ts`: `recordEvent({moment, payload, sessionId?})` →
  `invoke('save-feedback-event', { body:{ moment, session_id, payload } })`; non-blocking `{ok}` result.

**TDD (RED→GREEN):** `src/hooks/v2/__tests__/useFeedbackEvent.test.ts` — 4 tests: correct invoke body;
null session default; `{ok:false}` + error on failure without throwing; `isSubmitting` toggle. All green.

### T5 — `FeedbackMoment1` modal
- `src/components/v2/feedback/FeedbackMoment1.tsx`: self-contained `<Dialog>`. Three v3-framed prompts —
  "Did the score feel right?", "Did the Signature feel right?", "What's off?". Submit → `recordEvent`
  with payload `{chosen_signature, scores:{score_felt_right, signature_felt_right}, free_text}` tagged
  `moment_1`, then thank-you. Dismiss → `skipped` event. `settledRef` guards single-write.
- New folder → `src/components/v2/feedback/AGENTS.md` scaffolded (hierarchy convention).

**TDD (RED→GREEN):** `src/components/v2/feedback/__tests__/FeedbackMoment1.test.tsx` — 5 tests: closed renders
nothing; three prompts present (no "Draft Canvas"); submit writes exact payload + thanks; dismiss logs
`skipped`; no skip-after-submit. All green.

### Trigger
`src/components/v2/signature/SignatureReveal.tsx` — minimal: optional `sessionId?` prop; on the existing
option `onClick` (the pick handler) also `setPickedSignature(option); setFeedbackOpen(true)`; renders
`<FeedbackMoment1>` as a sibling. No restructure of the state machine.

## Verification status
- `npx tsc --noEmit`: clean. `npm run build`: ✓. Full suite: 730 passed; my 9 all pass.
- Pre-existing failures (NOT introduced here): `src/pages/__tests__/DiagnosticResults.test.tsx` (6) — the
  diagnostic **score** page, out of this feature's ownership; identical on the clean `9de686f` base.
- Live write verification (real `feedback_events` row) + security review: see `review.md` / DONE gate.

## DRY / reuse
Reused the codebase's universal write pattern (`functions.invoke` → service-role edge fn), the shared
`Dialog`/`Button`/`Textarea` ui primitives, and the Signature flow's existing option `onClick` seam.
No parallel feedback system: `beta_feedback` stays the beta-program sink; `feedback_events` is the new
moment-tagged product-signal sink (see arch.md).

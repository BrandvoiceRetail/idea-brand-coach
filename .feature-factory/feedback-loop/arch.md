# Architecture — Moment 1 Feedback Loop

> Bucket: Architecture · Feature: `feedback-loop` (v3 sprint T6 + T5)
> Base commit: `9de686f` (Signature engine). Scope: Gen 3 alpha, **Moment 1 only**.

## Goal

Write a `feedback_events` row when a user reacts after picking their Signature —
payload `{chosen_signature, scores, free_text}`, tagged `moment_1` — via a self-contained
modal, verified by a real write and a security review gate.

## Standards source

Generic standards are **not restated** here — pulled from the shared guide (the `mango-tools`
MCP serves these; in this worktree they're referenced directly from the guide repo):
`99-reference/TDD_QUICK_REFERENCE.md`, `ERROR_HANDLING_CHECKLIST.md`, `CODE_REVIEW_CHECKLIST.md`,
`FUNCTION_DESIGN_CHECKLIST.md`. Follow the AGENTS.md hierarchy; new folders get a scaffolded AGENTS.md.

## Existing system inspected

| Piece | Finding |
|-------|---------|
| `supabase/functions/save-beta-feedback` | Edge fn, service-role insert into `beta_feedback`; `userId` taken from request body (client-provided). Handles beta-program bug/idea/liked feedback + step comments. |
| `supabase/functions/save-beta-comment` | Edge fn, service-role insert into `beta_comments` (in-progress comments). |
| `supabase/functions/save-beta-tester` | Edge fn, service-role insert into `beta_testers`. |
| `reveal-signature` | Edge fn, `verify_jwt: true`, Claude Sonnet. The Signature source. |
| Client write pattern | Universal: `supabase.functions.invoke('<fn>', { body })`. Client never holds the service-role key; all writes go through edge fns; tables have RLS. |
| `feedback_events` table | Does **not** exist yet. Supabase confirmed **LIVE** (15 tables, RLS on all). |
| Current chat `session_id` | Page-managed (threaded into `useChat({ sessionId })` by BrandCoachV2). Not globally accessible. |

## Decision

**New `feedback_events` table + new thin edge function `save-feedback-event`** — reusing the
codebase's established write *pattern*, not building a parallel feedback *system*.

- **Why not extend `beta_feedback`?** It's shaped for the beta program
  (`issues`/`improvements`/`liked_most`/`step_comments`). Moment 1 is a generic, moment-tagged
  product-signal **event log** (`moment` + `payload jsonb`) meant to grow across moments. Force-fitting
  it into `beta_feedback` would conflate two purposes and break the goal's explicit `feedback_events` shape.
- **Why a new edge fn (not a direct client insert)?** Consistency with every other write in this
  codebase (service-role insert behind `functions.invoke`), and security: the edge fn derives `user_id`
  from the **verified JWT** (`auth.getUser()` on the caller's token) instead of trusting a client-supplied
  `userId` like `save-beta-feedback` does. This is the more defensible write path for the security gate.
- **It is NOT a parallel system:** same pattern, one new typed sink. `beta_feedback` stays the beta-program
  form/widget sink; `feedback_events` is the alpha product-signal sink.

## Components & ownership (this agent OWNS)

| Layer | Path | Notes |
|-------|------|-------|
| Migration | `supabase/migrations/<ts>_create_feedback_events.sql` | `feedback_events(id uuid pk, moment text, user_id uuid null, session_id text null, created_at timestamptz, payload jsonb)`. RLS enabled. |
| Write path | `supabase/functions/save-feedback-event/index.ts` | `verify_jwt: true`; derives `user_id` from JWT; service-role insert; returns `{ id }`. |
| Hook | `src/hooks/v2/useFeedbackEvent.ts` | `recordEvent({moment, payload, sessionId?})` + `recordSkip(...)`; wraps `functions.invoke('save-feedback-event')`. |
| Modal | `src/components/v2/feedback/FeedbackMoment1.tsx` (new folder → scaffold AGENTS.md) | Self-contained `<Dialog>`; 3 prompts; submit→write; dismiss→`skipped`; thank-you. |
| Trigger | `src/components/v2/signature/SignatureReveal.tsx` | Minimal: open the modal after `pickOption`. No restructure. Adds optional `sessionId?` prop (default undefined → keeps BrandCoachV2 untouched). |

**DO NOT TOUCH:** routing, BrandCoachV2 flow wiring, TrustGapScorecard, the bridge (other agent), `trustGap.ts`.

## Data shape

- Row: `{ id, moment: 'moment_1', user_id, session_id, created_at, payload }`
- `payload` (jsonb): `{ chosen_signature: string, scores: { score_felt_right, signature_felt_right }, free_text: string }`
- Skip row: `payload: { skipped: true, chosen_signature }`, same `moment_1` tag (goal: "log 'skipped'").

`session_id` is nullable and captured best-effort via the optional SignatureReveal prop; the DONE-WHEN
requires only chosen Signature + scores + free text, so a null session_id does not block Moment 1.

## RLS posture

Enable RLS on `feedback_events`. Writes happen only via the service-role edge fn (bypasses RLS).
No client INSERT/SELECT policy is needed for Moment 1 (the app never reads this table client-side),
so the table is **deny-by-default to clients** — the most locked-down stance. A self-`SELECT`
(`user_id = auth.uid()`) policy is added, commented, for future read use. Security gate reviews this.

## Out of scope (Decision 2 lock)

Moments 2 & 3, day-14 sends, Sentry, score recomputation, any TrustGapScorecard/trustGap change.

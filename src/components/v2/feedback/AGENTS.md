# AGENTS.md — `src/components/v2/feedback/`

Feature-local rules for the **Moment 1 feedback loop** (Gen 3 alpha). Scaffolded for this new
folder per the AGENTS.md-hierarchy convention; generic standards live in the shared guide
(`mango-tools` MCP / `99-reference/*`) — not restated here.

## What this is

The feedback prompt shown after a user picks their Signature. It captures product signal into
`public.feedback_events` (tagged `moment_1`) so the alpha produces data on whether the score and
Signature land.

## Pieces

| Layer | Path | Notes |
|-------|------|-------|
| Modal | `FeedbackMoment1.tsx` | Self-contained `<Dialog>`. 3 prompts → submit writes an event; dismiss logs `skipped`; thank-you on submit. |
| Write hook | `src/hooks/v2/useFeedbackEvent.ts` | `recordEvent({moment,payload,sessionId})`; non-blocking. |
| Edge fn | `supabase/functions/save-feedback-event/index.ts` | service-role insert; user_id from verified JWT. |
| Trigger | `src/components/v2/signature/SignatureReveal.tsx` | opens the modal after `pickOption` (minimal hook). |

## Rules

- **Self-contained.** The modal owns its own open/close; the trigger only flips `open`.
- **Non-blocking.** A failed write must never break the Signature flow — `recordEvent` resolves
  `{ok:false}`; the modal still thanks/closes. See `.feature-factory/feedback-loop/errors.md`.
- **v3 framing** for the three prompts: "Did the score feel right?", "Did the Signature feel right?",
  "What's off?" — NOT the older "Draft Canvas" wording.
- **Scope (Decision 2 lock):** Moment 1 only. No Moments 2/3, no day-14 sends, no Sentry.
- **Do not touch** TrustGapScorecard / `trustGap.ts` / BrandCoachV2 wiring (other agents own those).

# Signature Engine — Agent & Testing Context

Feature-local instructions for the **Signature reveal** (the "recognition moment").
For the shared test account and browser-QA setup, see `docs/TEST_ACCOUNT.md`
(pointed to from the top-level `CLAUDE.md`).

## What this feature is

The Signature names the deeper truth of what a customer is REALLY buying, in
Trevor's voice: "My customer isn't buying X. They're buying Y." It is the
retention / recognition moment.

**Acceptance bar (Trevor's):** a Signature works only if the user recognises it as
true AND had never said it themselves. It reuses the customer's emotional
VOCABULARY but synthesises a TRUTH they had not articulated.

## The pieces

| Layer | Path | Notes |
|-------|------|-------|
| UI (dialog, cards, gold result) | `src/components/v2/signature/SignatureReveal.tsx` | Self-contained `<Dialog>`. State machine: paste → loading → options → picked. |
| State / API call | `src/hooks/v2/useSignatureReveal.ts` | Calls `supabase.functions.invoke('reveal-signature', …)`. |
| Mount point | `src/pages/v2/BrandCoachV2.tsx` | `<SignatureReveal messages={displayMessages} fieldValues={fieldValues} sessionId={currentSessionId} />` in the chat header. |
| Edge function | `supabase/functions/reveal-signature/index.ts` | Claude **Sonnet** (`claude-sonnet-4-20250514`), `verify_jwt: true`, JSON-prefill output. Needs the `ANTHROPIC_API_KEY` secret. Returns `{ options, usedReviews, inference }`. |
| Moment-1 feedback (Alpha) | `src/components/v2/signature/SignatureFeedbackForm.tsx` | Renders inside the picked stage AFTER the surprise answer. Writes to `feedback_events` via the `save-feedback-event` edge fn. Every row carries `posthog_distinct_id` — THE JOIN KEY to the PostHog funnel. |
| Feedback edge fn | `supabase/functions/save-feedback-event/index.ts` | `verify_jwt: true` (anon key passes); `user_id` derived from the verified JWT, never the body. Service-role insert into `feedback_events`; rejects requests without `posthogDistinctId` (400). |
| Analytics | `src/lib/posthogClient.ts` | All funnel events (`signature_reveal_cta_shown`, `reviews_paste_shown/pasted`, `signature_reveal_requested/options_shown/picked`, `feedback_modal_opened/submitted`, `thank_you_viewed`, `llm_call_failed`). No-ops when `VITE_POSTHOG_KEY` is unset. Counts/booleans/IDs only — NEVER review text or conversation content in event props. |

## CRITICAL rule — do NOT parrot

If every claim in a Signature traces VERBATIM to the user's pasted/typed words, it
has FAILED (that is a summary, not an insight). The no-parroting rule lives in the
edge function's `buildSystemPrompt`. When changing the prompt, keep this rule and
the four InfinityVault few-shot examples intact.

- BAD: "collections getting too big to manage" → "a way to manage their growing collection".
- GOOD: → "the moment a chaotic, overflowing collection finally feels like a collection".

## How to test it (browser, end-to-end)

1. Log in with the test account (`docs/TEST_ACCOUNT.md`) and go to `/v2/coach`.
2. Send one chat message to set context, e.g.: "My brand is InfinityVault. We make
   premium trading card binders for serious collectors."
3. Click **Reveal Signature** (chat header). Paste InfinityVault reviews into the
   textarea (sample below). Click **Reveal Signature**.
4. Expect **3–4 DISTINCT, equal-weight** option cards (no pre-pick). Each in the
   "isn't buying X / they're buying Y" shape, UK English, no markdown, no em dashes.
5. Pick one → dominant **gold-accent** result + "Did this surprise you?".
6. Answer the surprise prompt → the **Moment-1 feedback form** appears (two
   yes/partially/no questions + optional free text). Submit requires both
   questions answered. On success a thank-you note replaces the form.
7. Verify the write: `SELECT moment, posthog_distinct_id, chosen_signature,
   q1_score_felt_right, q2_signature_felt_right, q3_whats_off FROM
   feedback_events ORDER BY created_at DESC LIMIT 1` (service role —
   clients cannot SELECT this table). `posthog_distinct_id` must be non-empty.
8. Confirm **no console errors**.

**Analytics check (when `VITE_POSTHOG_KEY` is set):** the journey above should
emit `signature_reveal_cta_shown → reviews_paste_shown → reviews_pasted →
signature_reveal_requested → signature_options_shown → signature_picked →
feedback_modal_opened → feedback_submitted → thank_you_viewed` in PostHog.
Without the env key all capture calls no-op (nothing to assert).

**No-reviews path:** leave the textarea empty → the dialog shows an inference
warning and the function returns `inference: true` (usually 3 options).

### Quick function-only check (no browser)

`POST` to `https://ecdrxtbclxfpkknasmrw.supabase.co/functions/v1/reveal-signature`
with `Authorization: Bearer <anon-key>` and body
`{ "conversation": [...], "fields": {...}, "reviews": "<text>" }`. The anon key is a
valid JWT so it passes `verify_jwt`.

### Sample InfinityVault reviews (paste target)

> This binder is built like a tank, feels premium and expensive, not like the cheap
> ones from the gaming aisle. My cards finally all fit in one place, I had three
> binders before and now it is just this one. No more dimples or rounded corners, the
> side loading pockets mean nothing slips out. I was terrified my Charizard would get
> scratched and now I do not worry. It makes me feel like a proper serious collector.
> Took it to a card show and everyone asked where I got it. It holds everything I have
> been hoarding for years and it actually feels organised now, like a real collection
> instead of a mess. After my last binder tore I will never trust a cheap one again.

## Scope guardrails (Gen 3, locked through alpha)

No scope add, no framework rewrite, no redesign. Out of scope: the /25 scorecard,
Avatar 2.0 form, Brand Canvas, exports, pay gate. T3 uses the Anthropic key only —
never route through gpt-4o or the OpenAI-embedding paths. Never bundle an API key
client-side (the key lives only in the edge function secret).

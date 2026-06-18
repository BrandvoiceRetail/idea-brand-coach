# User-Feedback Data Map — IDEA Brand Coach

_Audited 2026-06-17. Inventory of every user-feedback / user-behavior signal we record (and where to review it), plus the high-value signals we do **not** yet capture._

## TL;DR

- **Tiny real dataset today.** Prod has **2 user profiles**; the prod PostHog SDK only started reporting **2026-06-17** (project **203641**). So there's almost no historical prod behavior yet — the value is that instrumentation is *ready*, and the priority is closing gaps before real users arrive.
- **Two feedback systems, one alive, one dead.** The Gen-3 `feedback_events` path (Signature "moment_1" only) is live (4 test rows). The older **Beta feedback suite** (widget + survey page + `beta_feedback`/`beta_comments`/`beta_testers` tables + `save-beta-*` edge fns) is fully built but **0 rows** — dead/unsurfaced.
- **Happy-path funnel is well instrumented; the corrective signal is not.** ~19 client funnel events exist, but the richest feedback — **users correcting/rejecting AI output** (field review accept/reject/edit, signature backtrack/reroll) — is entirely local state, captured **nowhere**.
- **Review everything in PostHog project 203641** (EU): Funnels/Events, Session Replay, Logs. Deeper per-user data is in Supabase SQL.

---

## Where to review

| Surface | Where | Notes |
|---|---|---|
| Funnel + events | PostHog **203641** → Activity / Insights / Funnels | Canonical project (BrandVoice org). 195536 is a **stray** holding pre-2026-06-17 local/QA events — ignore/archive. |
| Session replay | PostHog 203641 → Replay | Live since 2026-06-17; recordings captured. |
| Server logs (OTel) | PostHog 203641 → Logs | Only once the MCP server is deployed with the new code (see below). |
| Per-user records | Supabase SQL (`feedback_events`, `signatures`, `diagnostic_submissions`, `chat_messages`, `avatar_field_values`, …) | RLS owner-scoped; query via service role. |

---

## 1. What we record today

### Client funnel events (PostHog 203641) — `src/lib/posthogClient.ts`
Landing → diagnostic → scorecard → auth → signature → feedback. Counts/enums/IDs only (no PII/free-text).

| Stage | Events (file:line) | Useful props |
|---|---|---|
| Landing | `beta_welcome_viewed` (BetaWelcome.tsx:69) | referrer |
| Diagnostic | `diagnostic_started` (FreeDiagnostic.tsx:116), `diagnostic_completed` (:203) | overall + 4 dimension scores |
| Scorecard | `scorecard_viewed`, `scorecard_interpretation_shown` (TrustGapScorecard.tsx:180/194) | primary_gap, scores, interpretation_source |
| Auth | `auth_started` (Auth.tsx:46), `auth_completed` (useAuth.tsx:61) | — |
| Coach | `conversation_message_sent` (useBrandCoachChat.ts:276) | message_index |
| Signature | `signature_reveal_cta_shown`, `signature_reveal_requested`, `reviews_paste_shown`, `reviews_pasted`, `signature_options_shown`, `signature_picked` (SignatureReveal.tsx / useSignatureReveal.ts) | char_count, review_count_estimate, option_count, used_reviews, inference, chosen_index |
| Moment-1 feedback | `feedback_modal_opened`, `feedback_submitted`, `thank_you_viewed` (SignatureFeedbackForm.tsx) | q1, q2 (yes/partial/no) |
| Errors | `llm_call_failed` ×7 (useChat.ts, useTrustGapInterpretation.ts, useSignatureReveal.ts) | which_call, error_type |

- **Dead event:** `conversation_started` is defined in the union but **never fired** (no call site).
- **Verified live (203641, 30d):** only `signature_reveal_cta_shown`, `auth_completed`, `conversation_message_sent`, `auth_started`, `$pageview/$pageleave/$autocapture/$exception` have actually landed — all from 2026-06-16/17 test traffic. The rest haven't fired yet.

### Session replay + error capture
- `capture_exceptions: true` (posthogClient.ts:60) → `$exception` autocapture. Session replay enabled at the **project** level (203641).
- `ErrorBoundary` (src/components/ErrorBoundary.tsx) **only `console.log`s** — it does **not** relay to PostHog/Supabase. React-tree errors only (not async/network).

### Explicit feedback UIs
| UI | File | Captures | Stores |
|---|---|---|---|
| **Moment-1 feedback** (Signature) | `SignatureFeedbackForm.tsx` / `FeedbackMoment1.tsx` + `useFeedbackEvent.ts` | Q1 score-felt-right, Q2 signature-felt-right, Q3 what's-off (free text), skip | PostHog (q1/q2 enums) + Supabase `feedback_events` (full, via `save-feedback-event`); **skip** is logged as `{skipped:true}` |
| **Beta feedback widget** (general/bug/idea + free text) | `BetaFeedbackWidget.tsx` | type + text + page URL | `save-beta-feedback` → `beta_feedback` — **DEAD (0 rows)**, gated by `VITE_ENABLE_BETA_FEEDBACK` |
| **Beta survey page** (5-star, liked/improve/issues, NPS, areas tested) | `pages/BetaFeedback.tsx` | full structured survey | `save-beta-feedback` → `beta_feedback` — **DEAD (0 rows)** |

### Supabase tables holding feedback / behavioral signal (live row counts)
| Table | Signal | Rows | Join key? |
|---|---|---|---|
| `feedback_events` | Moment-tagged product feedback (only `moment_1`); `chosen_signature`, `scores`, `q1/q2/q3`, free text | 4 | **Yes — `posthog_distinct_id`** |
| `signatures` | **`chosen_index`** (which option picked), `used_reviews`, `inference`, `all_options` | 9 | No |
| `diagnostic_submissions` | `answers` + computed `scores` (4 IDEA dims) | 5 | No |
| `avatar_field_values` | **`field_source`** (AI vs user), `is_locked`, `confidence_score` — implicit AI-accuracy signal | 46 | No |
| `chat_sessions` / `chat_messages` | conversation context + full message history (`role`, `content`, `metadata`) | 5 / 36 | No |
| `marketing_audits`, `user_memories`, `artifacts`, `business_facts`, `evidence_snapshots` | derived user context / outputs | 5 / 6 / 41 / 30 / 9 | No |
| `user_product_reviews` | scraped **customer** reviews (avatar evidence, not app feedback) | 34 | No |

### Server / MCP telemetry (behind deploy)
- **12 `mcp_*` events** (`src/mcp/posthog.ts` + tools): `mcp_diagnostic_evidence_completed`, `mcp_brief_generated`, `mcp_brief_claim_blocked`, `mcp_canvas_generated`, `mcp_signature_generated/persisted/persist_failed`, `mcp_context_provided`, `mcp_evidence_ingested`, `mcp_marketing_audit_completed`, `mcp_avatar_stage_completed`, `mcp_avatar_pipeline_completed`, `mcp_http_error`. Props are counts/grounding/stage only (MF-5 clean).
- **OTel → PostHog Logs** (`src/mcp/instrumentation.ts`, new 2026-06-17): startup + error logs to `/i/v1/logs`. **Not deployed yet** (MCP runs as a separate Docker service).

### Edge functions that persist feedback/behavior
`save-feedback-event` → `feedback_events` (the live path) · `save-beta-feedback`/`save-beta-comment`/`save-beta-tester` → beta tables (**dead**) · `diagnostic-interpretation(-evidence)` → `artifacts` · `reveal-signature` → `signatures` · plus the generate/avatar/audit/competitor fns writing `artifacts`/`marketing_audits`.

---

## 2. High-value gaps (not currently captured)

### P1 — the corrective signal (richest, cheapest, most actionable) — ✅ IMPLEMENTED 2026-06-17 (built + verified, deploy pending)
1. **Field review accept / reject / edit** — ✅ done. `useExtractionQueue.ts` now fires `field_review_accepted` (with `edited` flag), `field_review_rejected`, `field_review_accept_all`, `field_review_abandoned` — each carrying `field_id`, `chapter_id`, `source`, `confidence`.
2. **Signature dissatisfaction / churn** — ✅ done. `SignatureReveal.tsx` fires `signature_reconsidered` ("See other options") and `signature_rerolled` ("Start over"/"Reveal again", with `from` = options|picked).
3. **Regeneration** — client-side, the only genuine redo surface is the signature reveal-again/start-over (covered by `signature_rerolled` above) + field reject; the other "regenerate" hits are chat-title regen (low value). No separate artifact-regenerate UI exists to instrument.

_New events added to `src/lib/posthogClient.ts` union; `ErrorBoundary` now relays caught render errors as `app_error_caught` (P2 #8 ✅). All MF-5-safe (IDs/enums/numbers/booleans only). Needs a prod rebuild+deploy to go live._

### P2 — coverage & joins
4. **Other Supabase tables can't be joined to PostHog.** — ✅ DONE 2026-06-17 (deployed). Migration `20260617000000` added `posthog_distinct_id` to `signatures`, `diagnostic_submissions`, `chat_sessions`; the client write paths (`SupabaseSignatureService`, `SupabaseDiagnosticService`, `ChatSessionService`) now stamp `getPostHogDistinctId()`. Populates on the next write of each.
5. **Conversation quality** — ✅ DONE 2026-06-17 (deployed + live-verified). Thumbs up/down on persisted assistant messages in `ChatMessageList.tsx` → `coach_message_rated` event (`message_id` joins to `chat_messages`).
6. **Drop-off granularity** — only full diagnostic submissions; no per-question abandonment, no per-stage timing/checkpoints. _(not yet done)_
7. **A/B & messaging lift** — `brand_tests` table (hypothesis/baseline/result) is **built but empty (0 rows)**; no experiment cohorting. `version_preference` is set once, never versioned. _(not yet done)_
8. **ErrorBoundary → PostHog** — ✅ DONE 2026-06-17 (deployed). `ErrorBoundary` now relays caught render errors as `app_error_caught` AND is now actually **mounted at the app root** in `App.tsx` (it was previously defined but never mounted).

### P3 — decisions / cleanup
9. **Beta feedback path** — ✅ REVIVED 2026-06-17 (deployed + live-verified). Prod now builds with `VITE_ENABLE_BETA_FEEDBACK=true` so the floating widget shows for authenticated users; the widget's link now opens the full survey at `/beta-feedback` (was `/beta-journey`). `save-beta-feedback` → `beta_feedback` works (no `verify_jwt`). **Build note:** the prod build MUST pass `VITE_ENABLE_BETA_FEEDBACK=true` (it's inlined at build time, like the PostHog vars) or the widget disappears again.
10. **Empty new-feature tables:** `decision_triggers`, `brand_assets`, `brand_tests` — built, no data yet.
11. **`type_drift`:** `types.ts` references `competitive_analyses` / `competitor_reviews` / `performance_metrics`, **not present in the live DB** (unmerged funnel/competitor work). Regenerate types from live or merge+migrate.
12. **Diagnostic re-takes** don't refresh `profiles.latest_diagnostic_score` (only first submission); later takes live in `diagnostic_submissions` only.

---

## Plumbing notes
- **PostHog projects:** 203641 (BrandVoice) is canonical for the website + server. 195536 (iCodeMyBusiness) is a stray with pre-2026-06-17 local/QA events — archive.
- **Join key:** `feedback_events.posthog_distinct_id` (from `getPostHogDistinctId()`, localStorage fallback) is the one thread between Supabase feedback and the PostHog journey. Extend it to other tables for cross-source analysis.

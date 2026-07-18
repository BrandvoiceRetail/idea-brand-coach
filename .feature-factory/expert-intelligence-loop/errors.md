# errors.md — Expert Intelligence Loop failure modes

Failure-mode matrix for the 5-stage seam (see `arch.md`). Written during the disk-block so the build phase
(local or remote) codes the handling in from the start. Severity: 🔴 correctness/safety · 🟠 quality/noise · 🟡 ops.

## Stage 1 — capture (`capture_correction` tool + in-app harvest)

| # | Failure | Sev | Handling |
|---|---|---|---|
| 1 | Non-admin calls `capture_correction` (spoof / curiosity) | 🔴 | Verify `profiles.is_admin` from the JWT server-side; if false, return a **no-op success** (never write, never error the chat, never reveal the gate). Never trust an `expert_user_id` from input — derive it from the token. |
| 2 | Verbatim leaks into telemetry / logs (MF-5) | 🔴 | `safeLog` metadata only (counts, source, tool_context length). Never log `verbatim`/`correction`/`coach_claim` bodies. No PostHog event carries the text. |
| 3 | Coach never calls the tool on a real redirect (model non-compliance) | 🟠 | The `global.expert_capture` instruction + `SERVER_INSTRUCTIONS` line raise compliance but can't guarantee it — Feeder 2 (chat harvest) is the safety net for the in-app surface. Connector misses are irrecoverable (no transcript); accept as best-effort and monitor capture volume. |
| 4 | Duplicate captures (same correction fired twice in a turn) | 🟠 | Tolerate at write time; dedupe in the distill (Stage 2) by `(expert_user_id, tool_context, near-identical correction)` within a window. Don't hard-block on a unique index — a real second correction may look similar. |
| 5 | Service-role write fails (DB down, RLS misconfig) | 🟠 | Fail **soft**: catch, `safeLog` the failure, return success to the coach so the conversation never breaks (mirrors `submit_feedback`/`save-feedback-event`). A lost correction is acceptable; a broken coach turn is not. |
| 6 | Tool present in connector but NOT in the in-app tool-loop | 🟠 | Registration must cover both surfaces (`server.ts` + the `coach-mcp-tool-loop` path). Add a test asserting the tool is in both registries. Otherwise in-app live-capture silently no-ops (only the nightly harvest catches it). |

## Stage 1b — in-app harvest sweep over `chat_messages`

| # | Failure | Sev | Handling |
|---|---|---|---|
| 7 | Schema mismatch (`assistant`≠`coach`, `content`≠`text`) mis-maps turns | 🔴 | Central adapter with a unit test on the exact mapping; fail the sweep loudly (not silently) on an unknown `role`. |
| 8 | RLS-scoped client can't read a nominated expert's rows | 🔴 | Must use a **service-role** read (the `list/getCoachConversation` tools are caller-scoped). Scope strictly to `user_id IN (admin ids)` + `chatbot_type='idea-framework-consultant'`. |
| 9 | Re-ingesting already-captured turns each night | 🟠 | Track a high-water mark (max `chat_messages.created_at` processed per expert) or dedupe against existing `expert_corrections(session_id, ...)`. Idempotent sweep. |
| 10 | False-positive "redirect" detection (an expert question ≠ a correction) | 🟠 | Conservative classifier; when unsure, capture as `status='new'` for human triage rather than auto-drafting. Precision over recall — noise erodes trust in the loop. |

## Stage 2 — distill (`scripts/harvest-expert` + nightly drafting)

| # | Failure | Sev | Handling |
|---|---|---|---|
| 11 | Drafts a `coach_instructions` body that violates the terminology policy | 🔴 | Run every drafted body through the existing terminology guard / `publish_filter_check` before insert; reject/flag on Tier-B/C leaks. A poisoned instruction would degrade the live coach on publish. |
| 12 | Maps a correction to the WRONG `instruction_id` (clobbers unrelated guidance) | 🔴 | Never overwrite a published row. New drafts are `status='draft'` only; human publish archives the prior version. Record source `expert_corrections.id`s so the reviewer can judge the mapping. |
| 13 | Auto-publishes (violates HUMAN-only guardrail) | 🔴 | The nightly path inserts `status='draft'` exclusively; add a test asserting it never writes `status='published'`. Publish is Studio-only. |
| 14 | Over-drafting / PR spam (one PR per tiny correction) | 🟠 | Cluster first (`status='clustered'`); one draft/PR per cluster, not per correction. Cap PRs per run and `log()` anything deferred (no silent truncation). |
| 15 | Nightly run partially fails midway (some rows drafted, some not) | 🟡 | Status transitions are per-row and idempotent (`new→clustered→drafted`); a re-run picks up stragglers. No all-or-nothing batch. |

## Stage 3–4 — apply + review + digest

| # | Failure | Sev | Handling |
|---|---|---|---|
| 16 | `COACH_INSTRUCTIONS_ENABLED` is off in prod → published drafts never bind | 🔴 | Precondition check in arch; verify the flag at deploy. If off, enabling it is in scope. Surface the flag state in the Studio so the reviewer knows whether publish is live. |
| 17 | In-app consultant doesn't read `coach_instructions` (only an example wires it) | 🔴 | Known gap (arch.md). Wiring `coachInstructionsHelper` into `idea-framework-consultant-claude` is in scope, else "live coach reflects it" is connector-only. Edge-fn deploy = ASK-FIRST. |
| 18 | Digest reaches Trevor BEFORE Matthew reviews/publishes (ordering) | 🔴 | Digest reports only **APPLIED** (published/merged) changes, emitted on the **weekly** cadence after the human step — never nightly, never on drafts. Guard on `status='applied'`. |
| 19 | Digest send fails (`feedbackNotifier` / Slack token) | 🟡 | Non-blocking; retry next cycle; `log()` the failure. A missed digest is recoverable; don't let it wedge the pipeline. |
| 20 | Studio provenance query is heavy (joins corrections per draft) | 🟡 | Index `expert_corrections(proposed_instruction_id)`; lazy-load provenance per selected draft, not for the whole list. |

## Cross-cutting

| # | Failure | Sev | Handling |
|---|---|---|---|
| 21 | GDPR erasure misses `expert_corrections` | 🔴 | Register in `_shared/gdprData.ts` keyed on `expert_user_id`; redeploy `gdpr-export`/`gdpr-delete-account` in the same change (root AGENTS.md hard rule). |
| 22 | Migration timestamp collides / precedes an existing one | 🟡 | Confirm it sorts after the latest `supabase/migrations/*` on `main` before applying; bump if needed. |
| 23 | Loop trains on a BAD expert correction (Trevor was wrong that turn) | 🟠 | Human review IS the gate — no correction auto-applies. The reviewer can `status='dismissed'`. Provenance lets them re-judge before publish. |

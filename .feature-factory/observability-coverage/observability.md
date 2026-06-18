# Observability Plan: Merged Features (launch readiness)

_Audited 2026-06-18 (OBSV bucket). Scope: observability for features other agents merged to `main`, prioritizing what's **deployed to prod**. Goal: when real users arrive, we can answer "is it working?" and "if not, what went wrong?" from accessible dashboards + logs._

## The observability plane (architecture)

| Layer | Store | Access | Status |
|---|---|---|---|
| **Frontend** product events + funnels | PostHog **203641** | PostHog UI (Insights/Funnels/Dashboards) | ✅ live, flowing |
| **Frontend** errors | PostHog **Error Tracking** (`$exception`, `capture_exceptions:true`) + `app_error_caught` (ErrorBoundary) | PostHog → Error Tracking | ✅ working |
| **Session replay** | PostHog 203641 | PostHog → Replay | ✅ live |
| **Backend** (edge functions) logs | **Supabase logs** (`console.*`) | Supabase dashboard → Logs, or `get_logs` MCP | ✅ accessible (free, reliable) |
| **Backend** errors → one pane | **PostHog** (relay) | PostHog UI | ⛔ GAP — being added |
| **MCP server** logs | OTel → PostHog **Logs** (`/i/v1/logs`) | PostHog → Logs | ✅ wired (lives when MCP Docker redeploys) |

**Decision — logging backend:** keep **Supabase logs** as the backend log store (already on, accessible, zero-cost, reliable) and **mirror errors into PostHog** so frontend + backend errors are in one UI. **Not AWS CloudTrail** — that's AWS-API audit logging (who called which AWS API), not application logs; it would add cost + IAM complexity for no app-observability value. The VPS only serves the static SPA via Caddy (no app logic to log there).

> ⚠️ Project note: prod reports to PostHog **203641** (BrandVoice). The old dashboards on **195536** (iCodeMyBusiness, a stray) are orphaned — ignore them. All new dashboards go on 203641.

## Golden Signals coverage (current → target)

| Signal | Current | Target |
|---|---|---|
| **Traffic** | `$pageview`, funnel events flowing | Dashboard tile: pageviews + key-action counts |
| **Errors** | frontend `$exception`/`app_error_caught`/`llm_call_failed` ✅; **backend errors not in PostHog** ⛔ | edge-error relay → `edge_function_error` event + dashboard tile |
| **Latency** | only `generate-brand-strategy-document` logs elapsed; LLM calls mostly untimed | (roadmap) log duration_ms on LLM edge calls |
| **Saturation** | none (LLM token/cost, Firecrawl credits unlogged) | (roadmap) log token usage + provider rate-limit headers |

## What's instrumented vs dark (merged features)

| Feature | Deployed? | Success events | Failure events | Priority |
|---|---|---|---|---|
| Alpha funnel (diagnostic→signature→feedback) | ✅ | ✅ good | ✅ `llm_call_failed` | — (covered) |
| Feedback signals (field-review, thumbs, reroll) | ✅ | ✅ (PR #18) | ✅ | — (covered) |
| **Figma** (OAuth, import) | merged; edge fns likely **not deployed** (gated) | ❌ none | ❌ none (silent edge fns) | HIGH (when deployed) |
| **Product import** (`import-product-data`) | ✅ | ❌ none (client+edge) | ❌ none in PostHog | HIGH |
| **Coach tool-loop / avatar stages** (MCP) | MCP not deployed | ✅ success (`mcp_*`) | ⚠️ failures/retries dark | HIGH (when MCP live) |
| **Onboarding tour** | ✅ | ❌ no funnel events | ❌ | MED-HIGH |
| **Output engine / workbook** (MCP) | MCP not deployed | ❌ no PostHog | ❌ | MED |

## Structured logs — edge functions

All 38 edge fns log via `console.*` → Supabase logs. Findings:
- **No correlation IDs anywhere** (can't trace one request across `orchestrator → discovery → scraper`). _Roadmap: add a `requestId` UUID at entry, log it on every line._
- **Best-instrumented (reference):** `diagnostic-interpretation`, `reveal-signature`, `import-product-data`, `competitive-analysis-orchestrator`, `generate-brand-strategy-document` (retries + upstream status + stages).
- **Near-silent (fix):** `figma-status/disconnect/oauth-start`, `buyer-intent-analyzer`, `send-framework-email`, `generate-session-title`, `contextual-help`.
- **LLM failure modes under-logged:** rate-limit (429), token-budget/truncation, streaming errors (esp. `idea-framework-consultant-claude`), invalid-JSON. _Roadmap: standardize: log `response.status` + `stop_reason` + `retry-after` on every LLM call._
- **No cost/latency:** token usage + Firecrawl credits + per-step latency unlogged.

## Dashboards (203641)

**Building now — "Product Health (Alpha)" dashboard:**
- Funnel: `diagnostic_started → auth_completed → signature_reveal_requested → signature_picked → feedback_submitted`
- Errors trend: `llm_call_failed` + `app_error_caught` + `$exception` (+ `edge_function_error` once relay lands)
- Feedback quality: `coach_message_rated` (up/down), `field_review_rejected`, `signature_rerolled`, `feedback_submitted`
- Engagement: `signature_reveal_cta_shown`, `conversation_message_sent`, `$pageview`

Existing (keep): `My App Dashboard` (traffic/retention), `Analytics basics` (MCP tool usage).

## Implementing this session
1. **Edge-error → PostHog relay** — shared `reportError()` helper (Deno) emitting `edge_function_error` {function, stage, error_type, status_code}; wired into the top high-traffic functions. → backend errors in PostHog UI.
2. **Product-Health dashboard** on 203641.
3. This doc.

## Deployed-prod audit (via Supabase `get_logs`, 2026-06-18) — what's ACTUALLY live

Reading live edge-function logs surfaced real prod state that "merged to main" hides:
- 🔴 **`figma-oauth-start` returning 500 repeatedly** — almost certainly `FIGMA_CLIENT_ID` not set in prod (deployed but **not configured**). Figma "Connect" is broken in prod right now.
- 🔴 **Canva integration is DEPLOYED and erroring** (`canva-oauth-start/sync/list-designs/...` → 401/403/500) — contra the runbook's "not deployed".
- 🟡 **Competitor/funnel edge fns are deployed** (`competitor-analysis-asset`, `brand-defense-monitor`, `classify-touchpoint`) even though PRs #16/#17 aren't merged — **backend shipped ahead of the frontend merge**.
- 🟢 `idea-framework-consultant-claude` healthy (200s, 2.8–13s latency).

**None of these 500s are in PostHog today** — they live only in Supabase logs. That's the relay's whole point. Access them now: Supabase dashboard → Logs → Edge Functions, or `get_logs` MCP (`service: edge-function`, last 24h).

## Backend errors in PostHog — TWO paths (one already live)

1. **Client-side failure capture (LIVE, deployed).** Every client→edge call captures its failure as a PostHog event, so backend errors surface in PostHog **without an edge deploy**: `llm_call_failed` (coach/diagnostic/signature LLM edge fns), `figma_connect_failed`/`figma_import_failed` (figma edge fns — surfaces the live 500), `product_import_failed`. This covers all **user-facing** backend failures and is on the dashboard's "Feature & integration failures" tile.
2. **Server-side relay (built, deploy-gated).** For errors that DON'T surface to a client (background/cron, or the precise server error class), the `_shared/posthog.ts` relay emits `$exception` server-side. This needs the edge-function deploy (below) — but path #1 already covers the user-facing gap, so this is now an enhancement, not the critical path.

## Relay — built this session, ACTIVATION steps
- Sink: `supabase/functions/_shared/posthog.ts` (`captureServerException` / `captureServerEvent`) — POSTs to PostHog `/i/v0/e/` as `$exception` (→ Error Tracking) + custom events. No-op without `POSTHOG_API_KEY`.
- Wired into: `save-feedback-event`, `reveal-signature`, `figma-oauth-start` (incl. the live-500 not-configured path).
- **To activate (human/CLI step):** (1) set the `POSTHOG_API_KEY` secret for edge functions (`supabase secrets set POSTHOG_API_KEY=phc_uo6f… POSTHOG_HOST=https://eu.i.posthog.com`), (2) redeploy the 3 wired functions, (3) trigger a figma connect → confirm a `$exception` (`edge_function=figma-oauth-start`) appears in PostHog 203641 → Error Tracking. Then roll the same one-line catch-block call out to the rest (esp. `idea-framework-consultant-claude`, `buyer-intent-analyzer`, the `canva-*` fns).

## Roadmap (prioritized follow-ups, not done this session)
0. **Fix the live prod errors** the audit found: set `FIGMA_CLIENT_ID` (or hide the Figma UI), investigate the Canva 500s.
1. Correlation IDs across all edge functions (CRITICAL for tracing).
2. Standardized LLM error logging (status / stop_reason / retry-after) on all Claude/OpenAI calls.
3. Figma OAuth/import events (when the integration is deployed).
4. Product-import client+edge events (start/success/fail/partial).
5. Onboarding-tour funnel events (start/step/complete/abandon).
6. MCP tool-loop + avatar **failure** events + retry/latency (when MCP redeploys).
7. Token/cost + latency metrics on LLM calls (saturation signal).

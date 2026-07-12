# Telemetry & Observability

## PostHog project

| Setting | Value |
|---------|-------|
| Project ID | 203641 |
| Host | eu.posthog.com |
| Timezone | UTC |

## Live dashboards

| Name | Dashboard ID | Purpose |
|------|-------------|---------|
| Launch Readiness — v4 | 780663 | Auth→activation funnel, v4 stage engagement, connector adoption, value, gate-block friction, errors |
| MCP Tool Telemetry | 780607 | Per-tool latency, error rates, and bounce patterns from the MCP gateway |
| Brand Coach Engagement | 753486 | Generic web-analytics starter (pageviews / retention / traffic) |

## Event families

### Frontend — `captureAlphaEvent`

Source: `src/lib/posthogClient.ts`

Every event name is a member of the `AlphaEventName` union defined in that file.
Events are emitted via `captureAlphaEvent(name, properties)`.

**Content discipline (MF-5):** properties carry counts, booleans, IDs, and scores ONLY.
Review text, conversation content, and any PII must never be sent through PostHog.
Rich content goes to Supabase `feedback_events` or nowhere.

`getPostHogDistinctId()` provides the join key that links a user's PostHog funnel
journey to their Supabase `feedback_events` row.

### Server-side MCP — `mcp_tool_latency`

Source: `src/mcp/instrument.ts` (`instrumentToolLatency` wraps `registerTool` ONCE, so
every tool emits one event per call — never instrument tools individually).

| Field | Type | Notes |
|-------|------|-------|
| `tool` | string | Tool name |
| `duration_ms` | number | Wall-clock latency |
| `ok` | boolean | Whether the call succeeded |
| `error_name` | string \| null | Error class name if `ok=false` |
| `outcome` | string | `delivered` \| `needs_input` \| `error` \| `empty` — the bounce signal (a session whose terminal call is not `delivered` is a bounce candidate) |
| `session_id` | string \| null | Best-effort `Mcp-Session-Id`; also promoted to PostHog `$session_id` in `posthog.ts` so events sessionize for funnel/path analysis |
| `arg_keys` | string \| null | Sorted top-level input key NAMES only — schema, never values (MF-5) |
| `authenticated`, `country`, `region` | — | Request context |

Session anchors `mcp_session_authenticated` / `mcp_auth_challenge` carry `session_id` too.

### Edge function events

Source: `supabase/functions/_shared/posthog.ts` — `captureServerEvent(event, distinctId, props)`
and `captureServerException(fn, error, context)`. Same content discipline (counts/booleans/
ids/status-codes/error-names only). Safe no-op when `POSTHOG_API_KEY` is unset (falls back to
the publishable project key). The coach (`idea-framework-consultant-claude`) currently emits
structured console logs in the same vocabulary (`telemetry.ts`); migrating to the shared sink
is a swap of the sink call.

## Adding a new instrumented event

1. **Frontend:** add the event name to the `AlphaEventName` union in `src/lib/posthogClient.ts`,
   then `captureAlphaEvent('your_event_name', { /* counts/booleans/ids only */ })` at the
   relevant point in the component/hook. The union makes the compiler guard every emitted name.
2. **Server-side MCP:** do NOT instrument a tool by hand — extend the `instrument.ts` wrapper so
   the new signal lands on every tool uniformly.
3. **Edge function:** use `captureServerEvent` / `captureServerException` from `_shared/posthog.ts`.
4. Never include user content, PII, or message text in any property (MF-5).

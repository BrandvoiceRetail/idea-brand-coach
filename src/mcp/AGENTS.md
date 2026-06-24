# Brand-Coach MCP host — testing & guardrails (feature-local)

> Scaffold delivered from `brand-coach-mcp-planning/` (build target: "Brand-coach MCP
> host / gateway"). This folder is the **gateway substrate** only. The owned asset-chain
> tools (concept → publish-filter → draft → test-design) and the diagnostic wrappers
> (Trust Gap, Signature, avatar, KB) are **future initiatives — do not add them here yet.**

## What this is

A TypeScript **streamable-HTTP MCP gateway** for idea-brand-coach. Brand-coach is a
**consumer** of the IV-OS Marketing MCP: it OWNS the generative front and CONSUMES the
IV-OS asset/test ledger + knowledge reads. Today the host exposes:

- `health` — liveness + config probe (no secrets).
- `list_assets`, `get_asset` — the two **STABLE** IV-OS ledger reads, consumed via the
  IV-OS MCP client adapter (`ivos/client.ts`). These never throw: they return
  `available:false` when IV-OS is unconfigured/unreachable.
- `submit_feedback` — the easy user→team feedback path. Posts a short message to the
  team's #idea-brand-coach Slack channel via `chat.postMessage`, authenticated with the
  `SLACK_BOT_TOKEN` bot token (`chat:write`; the bot must be invited to the channel)
  (`slack/feedbackNotifier.ts`). NOT identity-gated (anon may submit so feedback is never
  lost); the feedback text is the only user content sent and is never logged (MF-5).
  Degrades gracefully to a clear error when the token is unconfigured/unreachable. NOTE:
  Slack returns HTTP 200 even on logical errors — the notifier checks the body `ok` field.

- `list_coach_conversations` / `get_coach_conversation` — **READ, per avatar.** Surface the
  authenticated caller's own Brand-Coach chat threads (`chat_sessions` + `chat_messages`,
  `chatbot_type = idea-framework-consultant`) over the JWT-bound RLS client
  (`service/coachConversations.ts`). `list_coach_conversations` indexes threads — each
  annotated with its avatar (`avatar_id` + resolved `avatar_name`; null = brand-level) and
  turn count — and takes an optional `avatar_id` filter; `get_coach_conversation` returns one
  thread's full transcript (chronological) by `session_id`. Identity-gated (anon refused; reads
  are private user data). MF-5: only counts/flags logged — never titles or message content.
  The avatar scope rides on `chat_sessions.avatar_id` (nullable FK → `avatars`, migration
  `20260301065818`); a NULL row is a brand-level thread.

The IV-OS **write** tools (`log_asset`/`record_test`/…) and **knowledge** reads
(canon/product/funnel) are referenced by capability only (`ivos/capabilities.ts`
→ `DEFERRED_IVOS_CAPABILITIES`) and are intentionally **not bound** — pending the
brand-coach-side **D5 cross-server write-auth** decision and IV-OS's own ADRs.

## Architecture (three-layer, mirrors Inventory Hero skills 040/041)

`service/*` (layer 1, pure logic) → `tools/*` (layer 2, `register*Tool` + zod input) →
`server.ts` (layer 3, assembles a fresh `McpServer` per request). `http.ts` runs each
request inside `runWithIdentity(...)` so caller identity (Supabase JWT → AsyncLocalStorage)
never bleeds across concurrent requests.

## Run it

```bash
npm run mcp:dev      # tsx watch, boots on MCP_PORT (default 8787), POST /mcp, GET /healthz
# env: MCP_PORT, IVOS_MCP_URL, IVOS_MCP_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY
#      SLACK_BOT_TOKEN (optional — enables submit_feedback delivery; unset = graceful no-op)
#      SLACK_FEEDBACK_CHANNEL_ID (optional — defaults to #idea-brand-coach)
```

## Acceptance bar (Done-when)

- `npm run typecheck:mcp` clean · `npm run lint` clean · `npm test` green.
- Boots streamable-HTTP with `health`; `GET /healthz` → 200.
- Per-request Supabase-JWT identity via AsyncLocalStorage, no cross-request bleed
  (`__tests__/identity.test.ts`).
- IV-OS adapter exposes `list_assets`/`get_asset`, degrades gracefully when the ledger
  is empty/unreachable (`__tests__/ivosClient.test.ts`, `server.test.ts`).
- **MF-5:** no PII / prompts / tokens / tool args in logs (`__tests__/redact.test.ts`).

## Tests

```bash
npm test -- src/mcp        # all host tests (vitest)
```

`__tests__/server.test.ts` connects a real MCP `Client` over `InMemoryTransport` and
asserts the advertised tool set + handler behavior end-to-end.

## Child Areas

| Area | Focus |
|------|-------|
| `contracts/` | Output-engine artifact contracts (single source of truth) — local AGENTS.md |
| `service/workbook/` | Workbook assemblers + gold-workbook export engine — local AGENTS.md |

## Guardrails

- **Consume, never duplicate.** No asset-storage / test-storage / brand-canon tools here
  — call IV-OS. Canonical IV-OS = `ecommerce/ecommerce-brand-business-os` (never the
  stale clone under `ecommerce-tools/brand-systems/`).
- **Calculation Parity (Gen-3 lock).** When the owned tools are added next, they must
  wrap the existing Supabase edge fns / TS services **verbatim** (byte-identical output).
- **Logs are redaction-gated.** Always log via `safeLog` from `logging/redact.ts`.
- Don't bind PROVISIONAL IV-OS tools until D5 lands.

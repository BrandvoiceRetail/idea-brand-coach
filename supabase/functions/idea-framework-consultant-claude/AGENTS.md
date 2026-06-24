# AGENTS.md — `idea-framework-consultant-claude` (Trevor, the coach fn)

Feature-local context for the consultant edge function. Root `AGENTS.md` applies.

## What this function is

The Layer-1 coach chat. Raw `fetch` to the Anthropic Messages API (`claude-sonnet-4-6`),
streaming SSE to the browser, two client-visible tools:

- `extract_brand_fields` (fire-and-forget → `extracted_fields` SSE event; never continues the turn)
- `memory_20250818` — Anthropic's client-side memory tool backed by the `user_memories`
  table (RLS, `_shared/memory.ts`). Memory tool_use runs through a **server-side agentic
  loop** (`loop.ts`): execute command → append `tool_result` → call Claude again, max 4
  iterations / 60s, while the browser SSE stream stays open.

## File map

| File | Owns |
|---|---|
| `index.ts` | auth, request parse, context assembly, cache layout, loop dispatch, flag + country resolution |
| `prompt.ts` | STATIC system block only (persona, framework-identity, memory + extraction policy); per-session pieces via `buildSessionContext` |
| `memory-context.ts` | `<memory-snapshot>` builder (deterministic memory injection) |
| `loop.ts` | agentic loop (streaming + non-streaming), tool_result rules, BP4 movement, per-call + handler latency |
| `registry.ts` | tool-dispatch registry (`continue`/`terminal` kinds); Phase-2 per-request MCP tool registry + `registerMcpTools`/`resolveToolEntry` |
| `mcpClient.ts` | Phase-2 hand-rolled MCP streamable-HTTP JSON-RPC client (handshake/session/SSE, never throws) |
| `telemetry.ts` | per-call (`consultant_llm_latency`) + handler (`consultant_handler_latency`) latency logs; `resolveCountry` |
| `stream.ts` | `translateOneStream` — ONE upstream stream per call, caller-owned controller; never emits `done`; `onFirstText` TTFT hook |
| `context.ts` | `user_knowledge_base` structured reads (NO embeddings — Anthropic-only) |
| `../_shared/memory.ts` | six memory commands, path/size/secret guards, Supabase store adapter |

## ADR Phase 1 — tool loop + registry + latency (flag-gated)

Implements Phase 1 of `docs/v2/architecture/adr/ADR-UNIFIED-COACH-CAPABILITY-LAYER.md`.
The agentic loop already existed (memory tool); Phase 1 added the generic seam.

- **Registry (`registry.ts`):** one table classifies tools as `continue` (tool_result
  fed back → loop calls the model again; today: `memory`) or `terminal` (acknowledged,
  no continuation; `extract_brand_fields`). The `<<< PHASE-2 EXTENSION POINT >>>` is
  where MCP-backed `continue` tools plug in later (their `execute` POSTs to `/mcp` with
  the caller's JWT). Phase 1 does NOT build the MCP client.
- **Flag `CONSULTANT_TOOL_LOOP_ENABLED` (default OFF):** ON routes `buildToolResults`
  through the registry; OFF keeps the original hardcoded memory+extraction branches —
  **byte-identical for the two built-in tools** (instant rollback). The flag governs
  only whether the generic extension seam is live; it does NOT disable the memory loop
  (use `MEMORY_TOOL_ENABLED=false` for that). Both paths share the identical tool_result
  content + loop policy, so the 15 agentic-loop tests pass under either flag value.
- **Latency telemetry (`telemetry.ts`):** every Anthropic call emits
  `consultant_llm_latency { duration_ms, ttft_ms, ok, iteration, model, country }`;
  each entry point emits one `consultant_handler_latency { duration_ms, ttft_ms, ok,
  iteration_count, tool_loop, model, country }`. Structured console logs (no server-side
  PostHog edge path exists yet — matches the MCP `mcp_tool_latency` field vocabulary so a
  future sink swap is trivial). `country` is best-effort from `x-client-country` /
  `cf-ipcountry` / CloudFront / Vercel headers, null when absent. **Content discipline:
  durations/booleans/counts/model/country ONLY — never prompt or message content.**

## ADR Phase 2 — live MCP capability layer (flag-gated)

Wires the chat to the live brand-coach MCP gateway so the coach can call the same
tools an external agent would (`list_assets`, `get_asset`, `log_asset`,
`record_assessment`, …). Builds on the Phase-1 registry seam.

- **Client (`mcpClient.ts`):** minimal hand-rolled streamable-HTTP JSON-RPC client
  (NO MCP SDK). `initialize` (sends `Accept: application/json, text/event-stream`,
  captures `Mcp-Session-Id`, fires `notifications/initialized`) → `listTools()` →
  `callTool(name, args)`. Parses BOTH `application/json` and SSE bodies. Forwards
  the caller's Supabase JWT as `Authorization: Bearer`. Per-method timeouts; NEVER
  throws past the loop — every method returns `{ ok, … }`.
- **Dynamic discovery (`index.ts`):** at request start, when MCP is eligible
  (`MCP_TOOLS_ENABLED` ON **and** `CONSULTANT_TOOL_LOOP_ENABLED` ON **and** an
  authenticated caller), `listTools()` runs, each gateway tool is converted to an
  Anthropic tool def + added to the model's `tools`, and registered as a `continue`
  entry in a **request-scoped** `McpToolRegistry` (never global — no cross-request
  bleed). Unreachable/empty gateway ⇒ DEGRADE: log + built-in tools only (chat
  never fails). Built-in names (`memory`, `extract_brand_fields`) are never shadowed.
- **Generic dispatch (`loop.ts`):** the registry path now dispatches EVERY
  `continue` tool by name via `resolveToolEntry(name, mcpRegistry)` (request-scoped
  MCP entries win, then built-ins). `stream.ts` routes non-built-in tool_use into
  `continueToolUses`; the non-streaming path parses them too. MCP tools continue the
  loop only under the flag (OFF path stays byte-identical to Phase 1).
- **Flags:** `MCP_TOOLS_ENABLED` (default OFF), `MCP_GATEWAY_URL`
  (default `https://ideabrandcoach.icodemybusiness.com/mcp`). OFF ⇒ no MCP calls,
  no extra tools, byte-identical to Phase 1.
- **Telemetry (`telemetry.ts`):** each proxied tools/call emits
  `mcp_proxy_latency { tool, duration_ms, ok }` (tool NAME only — no args/PII).
- **NOTE:** the deployed gateway exposes only a SMALL surface today (health, asset
  ledger reads/writes, assessment, coach-conversation reads, submit_feedback). The
  high-value tools (avatar pipeline, concept generation, publish-filter, draft/test
  design) appear automatically once the full 28-tool MCP build is redeployed —
  discovery is dynamic, nothing here is hardcoded to the small surface.

## Cache layout (do not break)

Four ephemeral breakpoints, order tools → system → messages:
**BP1** static system block (shared across users per mode/extraction/docs/memory variant —
also caches the tools rendered before it; never put per-user text in `generateSystemPrompt`).
**BP2** per-user `<founder-context>` block (KB + product + memory snapshot + session context).
**BP3** last history message. **BP4** last tool_result, moved each loop iteration.
Verify after changes: `[Usage] ... cache_read` > 0 on turn 2 in fn logs.

## Memory rules

- Taxonomy is app-standard, instantiated per user: `index.md` (concept map), `founder.md`,
  `coaching.md` (all three injected every request), `brand.md`, `sessions/*` (on-demand `view`).
- Selective storage policy lives in `prompt.ts` `<what-to-store>/<what-NOT-to-store>` —
  memory must never duplicate product data, KB fields, or diagnostic scores.
- Handler guards: paths under `/memories` only (traversal rejected, depth ≤2, `.md` only),
  ≤8KB/file, ≤30 files/user, secret-pattern screen. `create` upserts (deliberate divergence
  from the reference spec — Trevor rewrites stale notes).
- **Kill switch:** function secret `MEMORY_TOOL_ENABLED=false` disables tool + snapshot
  without redeploy (function reverts to pre-memory behavior byte-for-byte).
- Every tool_use id in an assistant turn MUST get a tool_result (incl. extraction acks)
  or the next upstream call 400s — `loop.ts` handles this; keep it that way.

## Testing

- Unit: `supabase/functions/_shared/__tests__/memory.test.ts` (30 tests — commands, traversal,
  caps, secrets), `__tests__/agentic-loop.test.ts` (15 tests — scripted SSE fixtures,
  iteration caps, mixed tools, handler failure, upstream 429),
  `__tests__/tool-registry.test.ts` (9 tests — registry kinds, flag ON/OFF parity, country
  resolution, TTFT recorder, per-call/handler latency emission),
  `__tests__/mcp-client.test.ts` (15 tests — handshake/session/SSE, tools/list→Anthropic
  conversion, callTool, graceful degrade), and `__tests__/mcp-dispatch.test.ts` (9 tests —
  registerMcpTools, generic by-name dispatch streaming+non-streaming, mcp_proxy_latency,
  flag-OFF = no MCP calls, degrade with no registry). Run with `--pool=threads`.
- Live smoke (QA account per `docs/TEST_ACCOUNT.md`): (1) authed streamed message stating a
  durable fact → expect `memory_activity` events + rows in `user_memories` + `index.md`
  updated; (2) NEW session, "what do you remember?" → recall with ZERO `memory_activity`
  events (snapshot injection, no view round-trip); (3) non-streaming request still returns
  `{response, extractedFields}`.
- Acceptance bar: cross-session recall feels like a returning-client greeting; memory writes
  happen on durable facts/decisions, not every message; chat never breaks when memory
  storage errors (error-string tool_results, snapshot returns '' on failure).

## History

- 2026-06-11: memory tool + agentic loop + 4-breakpoint cache layout shipped (v9,
  `feature/intelligent-memory`); OpenAI semantic search removed from this fn (Anthropic-only).
- 2026-06-11: framework-identity prompt fix (v8, Loop 04) — coach must never deny the
  IDEA framework/book in conversational mode.
- 2026-06-11: model swap to `claude-sonnet-4-6` (v7, Loop 04 P0).

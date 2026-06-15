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
| `index.ts` | auth, request parse, context assembly, cache layout, loop dispatch |
| `prompt.ts` | STATIC system block only (persona, framework-identity, memory + extraction policy); per-session pieces via `buildSessionContext` |
| `memory-context.ts` | `<memory-snapshot>` builder (deterministic memory injection) |
| `loop.ts` | agentic loop (streaming + non-streaming), tool_result rules, BP4 movement |
| `stream.ts` | `translateOneStream` — ONE upstream stream per call, caller-owned controller; never emits `done` |
| `context.ts` | `user_knowledge_base` structured reads (NO embeddings — Anthropic-only) |
| `../_shared/memory.ts` | six memory commands, path/size/secret guards, Supabase store adapter |

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
  caps, secrets) and `__tests__/agentic-loop.test.ts` (13 tests — scripted SSE fixtures,
  iteration caps, mixed tools, handler failure, upstream 429). Run with `--pool=threads`.
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

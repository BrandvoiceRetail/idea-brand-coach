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

- **Avatar lifecycle (Phase 2, §4.3).** `create_avatar` / `list_avatars` / `get_avatar` /
  `set_current_avatar` / `set_primary_avatar` / `record_avatar_build`. Creation stamps `brand_id`
  **server-side** via `service/avatarOwnership.resolveBrandId()` (one brand per user, P1
  `uq_brands_user_id`) — the caller NEVER supplies `brand_id`. `set_current_avatar` is the
  **stateless avatar-switch**: it only invokes the `set_current_avatar(uuid)` RPC (the sole write
  path for `profiles.current_avatar_id`, ownership-checked server-side), so the host holds **no
  session state** (matches `context/identity.ts`). `set_primary_avatar` is the only MCP write path
  for `brands.primary_avatar_id` (the funnel-audit default, locked #7) — it invokes the
  `set_primary_avatar(uuid)` RPC (ownership + brand-presence checked, surfacing
  `avatar_not_owned`/`avatar_has_no_brand` as clean denials) and is **distinct** from the coach
  current-avatar. `record_avatar_build` upserts `avatar_build_state` (S1→S4 progress +
  draft/built/approved). Writes are `gateWrite`-gated; reads are identity-gated.

- **Avatar-ownership gate (`service/avatarOwnership.ts`).** `requireOwnedAvatar(avatarId)` is the
  per-call authorization seam: an RLS-bound `avatars` read that returns the avatar's `brand_id` or a
  ready-to-return `CallToolResult` denial (gateWrite-shaped `{ denied, brandId }`). It is retrofitted
  into **every** write tool that accepts `avatar_id` (build_avatar_stage, provide_context,
  ingest_evidence, persist_signature, run_diagnostic_evidence, generate_canvas, generate_brief,
  generate_audit_idea_map, run_marketing_audit, export_workbook, record_avatar_build, run_funnel_audit,
  get_funnel_audit) — called right after `gateWrite()`, before any avatar-scoped work. RLS already
  scopes `avatars` to `auth.uid()`; this converts a foreign `avatar_id` from a silent brand-level write
  into an explicit refusal and surfaces `brand_id` for two-tier scoping. `get_context_status` (a READ
  that takes `avatar_id`) also gates with `requireOwnedAvatar` so a foreign avatar_id is refused rather
  than silently degrading to a brand-level fill-map — no `gateWrite` there since RLS already handles the
  anon case. The gate **never throws**: a DB error during the check returns a generic denial (no raw
  Postgres message), keeping the five non-try-wrapped retrofit sites MF-5-safe. `generate_signature`
  is left RLS-only by design (a non-gated read).

- **Funnel engine (Phase 2, §4.4).** `list_funnel_inventory` / `upsert_funnel_touchpoint` (BRAND-LEVEL,
  **no `avatar_id`** — inventory is `brand_assets` with `avatar_id` NULL) + `run_funnel_audit` /
  `get_funnel_audit` (per-avatar OVERLAY in `brand_asset_audits` via the `save_asset_audit_atomic` RPC).
  The audit tools default `avatar_id` to `brands.primary_avatar_id` (locked #7) when omitted — the funnel
  **never** reads/writes the coach current-avatar. `brand_id` is resolved server-side throughout
  (`service/funnelInventory.ts`).

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
| `evals/` | MCP evals suite — compares skill/tool configurations + scores coach value (`npm run evals`); feeds the `/admin/coach-evals` dashboard — see `evals/README.md` |
| `skills/` | Skill grounding: `skillLoader` (book corpus) + `appSkills` (App Skill Architecture, IDEA-APP-SKILLS-001) |

## Guardrails

- **Consume, never duplicate.** No asset-storage / test-storage / brand-canon tools here
  — call IV-OS. Canonical IV-OS = `ecommerce/ecommerce-brand-business-os` (never the
  stale clone under `ecommerce-tools/brand-systems/`).
- **Calculation Parity (Gen-3 lock).** When the owned tools are added next, they must
  wrap the existing Supabase edge fns / TS services **verbatim** (byte-identical output).
- **Coach Surface Parity.** `SERVER_INSTRUCTIONS` (`config.ts`) is the connector's steering;
  its posture/persona/framework text is governed by
  [`ADR-COACH-SURFACE-PARITY`](../../docs/v2/architecture/adr/ADR-COACH-SURFACE-PARITY.md).
  The source of truth for shared steering is the **Coach Charter** — edit that, not
  `SERVER_INSTRUCTIONS` directly, or this surface drifts from the in-app coach (`prompt.ts`).
  Adding a tool here without exposing it to the chat loop (`idea-framework-consultant-claude`)
  also breaks parity — the drift guard treats tool-set asymmetry as a failure.
- **Logs are redaction-gated.** Always log via `safeLog` from `logging/redact.ts`.
- Don't bind PROVISIONAL IV-OS tools until D5 lands.

# Brand-Coach MCP host — testing & guardrails (feature-local)

> **North Star:** IDEA Brand Coach is a **conversion-fix tool** — objective diagnostic (self-score vs SQP intent + review mining), mine Amazon directly, **the in-app UI is the priority surface**. Full direction: [root `AGENTS.md`](../../AGENTS.md).


> Scaffold delivered from `brand-coach-mcp-planning/` (build target: "Brand-coach MCP
> host / gateway"). This folder is the **gateway substrate** only. The owned asset-chain
> tools (concept → publish-filter → draft → test-design) and the diagnostic wrappers
> (Trust Gap, Positioning Statement, avatar, KB) are **future initiatives — do not add them here yet.**

## What this is

A TypeScript **streamable-HTTP MCP gateway** for idea-brand-coach. Brand-coach OWNS the
generative front AND its own asset/test ledger: the ledger is now INTERNAL, backed by the
brand-coach's own Supabase via `NativeLedgerClient` (`service/nativeLedger.ts`), wired in
`server.ts` (`const ivos = ledgerClient ?? new NativeLedgerClient()`). It is no longer a
consumer of an external IV-OS MCP. Today the host exposes:

- `health` — liveness + config probe (no secrets).
- `list_assets`, `get_asset` — the two **STABLE** ledger reads, served by `NativeLedgerClient`
  (the brand-coach's own Supabase). These never throw: they return `available:false` when the
  ledger is unconfigured/unreachable.

> The "What this is" list below is illustrative — `src/mcp/server.ts` (the `register*Tool`
> calls) plus `src/mcp/toolManifest.ts` are the AUTHORITATIVE tool surface (40+ tools).

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
  ingest_evidence, persist_positioning_statement, run_diagnostic_evidence, generate_canvas, generate_brief,
  generate_audit_idea_map, run_marketing_audit, export_workbook, record_avatar_build, run_funnel_audit,
  get_funnel_audit) — called right after `gateWrite()`, before any avatar-scoped work. RLS already
  scopes `avatars` to `auth.uid()`; this converts a foreign `avatar_id` from a silent brand-level write
  into an explicit refusal and surfaces `brand_id` for two-tier scoping. `get_context_status` (a READ
  that takes `avatar_id`) also gates with `requireOwnedAvatar` so a foreign avatar_id is refused rather
  than silently degrading to a brand-level fill-map — no `gateWrite` there since RLS already handles the
  anon case. The gate **never throws**: a DB error during the check returns a generic denial (no raw
  Postgres message), keeping the five non-try-wrapped retrofit sites MF-5-safe. `generate_positioning_statement`
  is left RLS-only by design (a non-gated read).

- **Funnel engine (Phase 2, §4.4).** `list_funnel_inventory` / `upsert_funnel_touchpoint` (BRAND-LEVEL,
  **no `avatar_id`** — inventory is `brand_assets` with `avatar_id` NULL) + `run_funnel_audit` /
  `get_funnel_audit` (per-avatar OVERLAY in `brand_asset_audits` via the `save_asset_audit_atomic` RPC).
  The audit tools default `avatar_id` to `brands.primary_avatar_id` (locked #7) when omitted — the funnel
  **never** reads/writes the coach current-avatar. `brand_id` is resolved server-side throughout
  (`service/funnelInventory.ts`).

- **Creative-plan directors (the Higgsfield ↔ brand-coach bridge).**
  `generate_video_storyboard` / `generate_aplus_content_plan` / `generate_main_image_title_plan` /
  `generate_storefront_messaging_plan` / `generate_ugc_ad_plan` (script-level UGC: avatar-cast
  persona, trigger-angled hook variants, AI-presenter honesty rails) + the update path
  `refine_creative_plan` (and the older `generate_listing_image_brief`). Pure Layer-1
  grounding-directors (no LLM/edge/DB calls): each returns a positioning-aligned plan —
  scene/beat/section architecture, claim gate, evidence discipline, prompt construction
  (`IMAGE_PROMPT:` / `VIDEO_PROMPT:` + exact negative prompts) — and the HOST executes on the
  Higgsfield connector (generate_image / generate_video / edit tools), then logs outputs back
  via `log_asset` (host-driven, like Windsor ingestion). The shared spine lives in
  `service/creativeAlignment.ts`: `POSITIONING_SPINE` (trigger / avatar core / positioning statement /
  trust-gap pillar / verified facts, each with a resolve-tool + honest degrade so new users are
  never blocked), `POSITIONING_PROPAGATION` (deterministic element-change → per-surface recompose
  map that `refine_creative_plan` filters; component changes stay surgical — one scene/panel, one
  job), and `HIGGSFIELD_HANDOFF` (reference-kit discipline, storyboard-image vs per-scene video
  modes, UGC/unboxing preset routing, edit-tools-before-regen, draft economy, save-back + the
  performance loop). Tests: `__tests__/creativePlans.test.ts` (propagation-map completeness, honest
  degrade, guardrail carriage); `__tests__/creativePlansEdge.test.ts` (input/format/trigger edges +
  refine scope detection + determinism); `__tests__/creativePlanContracts.test.ts` (**app-behavior
  regression lock** — calls each tool through a real MCP client and pins the `structuredContent`
  keys the connector/panels consume, the guardrail contract, and the zod input boundary). The
  eval catalog (`evals/cases/catalog.ts`) also carries `infinityvault-*` creative cases so the
  mcpjam/behavioural tiers catch a tool-SELECTION regression. **NB:** the guard-echoing
  `never_contain` list means these tools trip `terminology.leak` telemetry on every call — a known
  false positive (the denylist names the denied terms), shared with `generate_listing_image_brief`.

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
# env: MCP_PORT, SUPABASE_URL, SUPABASE_ANON_KEY, MCP_OAUTH_REQUIRE_AUTH (OAuth kill-switch)
# (IVOS_MCP_URL / IVOS_MCP_TOKEN are DEPRECATED — the ledger is internal now)
```

## Authentication

The gateway is an OAuth 2.1 resource server. `src/mcp/oauth.ts` serves the RFC 9728
protected-resource metadata and the 401 challenge that starts a client's OAuth flow;
the hand-rolled consent page is `src/pages/OAuthConsent.tsx` (`/oauth/consent`). The
`MCP_OAUTH_REQUIRE_AUTH` env var is the kill-switch (when off, requests are not forced
through OAuth). Supabase is the authorization server.

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
| `evals/image/` | **Output-quality tier** — scores the IMAGE deliverables an E2E session produces (our MCP + Higgsfield in one chat) against a rubric, grounded in the opted-in customer corpus (`evals:image:mcpjam` to drive + assert the pipeline; `evals:image` to vision-judge the produced images) — see `evals/image/README.md` |
| `skills/` | Skill grounding: `skillLoader` (book corpus) + `appSkills` (App Skill Architecture, IDEA-APP-SKILLS-001) |

## Guardrails

- **Ledger is internal.** The asset/test ledger is the brand-coach's own Supabase via
  `NativeLedgerClient` (`service/nativeLedger.ts`) — do NOT re-introduce an external IV-OS
  MCP dependency. (Historical: this gateway used to consume IV-OS; that boundary was reversed.)
- **Calculation Parity (Gen-3 lock).** When the owned tools are added next, they must
  wrap the existing Supabase edge fns / TS services **verbatim** (byte-identical output).
- **Logs are redaction-gated.** Always log via `safeLog` from `logging/redact.ts`.
- **Tool telemetry is uniform + MF-5-safe.** `instrument.ts` wraps `registerTool` ONCE
  (`instrumentToolLatency(server)` in `server.ts`, before any `register*Tool`), so EVERY tool
  emits one `mcp_tool_latency` event per call — no per-tool wiring. Properties: `tool`,
  `duration_ms`, `ok`, `error_name`, `outcome` (`delivered` | `needs_input` | `error` |
  `empty` — the bounce signal: a session whose terminal call is not `delivered` is a bounce
  candidate), `session_id` (best-effort `Mcp-Session-Id`; also promoted to PostHog
  `$session_id` in `posthog.ts` so events sessionize for funnel/path analysis), `arg_keys`
  (top-level input key NAMES only, sorted — schema, NOT values, so MF-5 holds), `authenticated`,
  `country`, `region`. Session anchors `mcp_session_authenticated` / `mcp_auth_challenge` carry
  `session_id` too. To add a signal, extend the wrapper — never instrument tools individually.
- **Cap any DB read that lands in a tool's `content`/`structuredContent` via a named constant in
  `service/contextBudgets.ts`** (create it the first time a tool here needs one — mirrors
  `supabase/functions/_shared/contextBudgets.ts` on the Deno side, same naming convention, a
  separate file because the two are separate bundle boundaries). Use `MCP_RESPONSE_*` naming —
  these bound what lands directly in a LIVE calling agent's context, a different failure mode
  from an internal edge-fn prompt (the end user feels it immediately: slower replies, faster
  context exhaustion). Caller-supplied values are fine but MUST clamp to a hard ceiling constant.
  A 2026-07-12 audit found several tools reading an unbounded collection with NO cap at all —
  `get_coach_conversation` (a full chat transcript, the most severe finding),
  `list_coach_conversations`, `get_asset_history`, and the review/product reads in
  `contextResolver.ts` — none fixed yet; if you touch one of these, add the dial rather than
  leaving it. If a dial genuinely isn't warranted, extend `instrument.ts`'s `emitToolLatency`
  (the wrapper above) with a response-size field instead of adding nothing — see
  [`../../docs/architecture/ADR-CONTEXT-BUDGET-LEVER.md`](../../docs/architecture/ADR-CONTEXT-BUDGET-LEVER.md).
- Don't bind PROVISIONAL IV-OS tools until D5 lands.

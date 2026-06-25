# ADR: Unified Capability Layer for the MCP Gateway and the In-House Coach Chat

- **Status:** Proposed
- **Date:** 2026-06-15
- **Deciders:** Matthew Kerns (eng)
- **Relates to:** `ADR-CLAUDE-AGENT-SDK-MIGRATION.md` (Proposed — partially implemented), `ADR-CONVERSATION-MEMORY.md` (Accepted), `ADR-EMBEDDINGS-STRATEGY.md` (Proposed), companion plan `docs/v2/architecture/CLAUDE-AGENT-SDK-MIGRATION.md`
- **Extended by:** `ADR-COACH-SURFACE-PARITY.md` — carries this *capability* parity forward to *full-surface* parity (posture, framework definition, persona/voice) across the two coach surfaces.

## Context

We have two coaching surfaces that should behave like the same product but currently do not:

1. **The brand-coach MCP gateway** (`src/mcp/`, Node/TS, streamable HTTP host) — a 28-tool agent surface across a clean 3-layer design (pure services → tool handlers with Zod schemas → per-request registration in `src/mcp/server.ts:71-156`). It exposes the full tailored flow: the **Avatar 2.0 forensic pipeline S1→S5** (`build_avatar_stage` → `src/mcp/service/avatarPipeline.ts`), the asset chain (`generate_concepts` → `publish_filter_check` → `draft_asset` → `design_test`), diagnostics (`run_trust_gap`, `run_diagnostic_evidence`), the IV-OS asset/test ledger (`list_assets`/`get_asset`/`log_asset`/`record_assessment`/…), context intake (`get_context_status`, `provide_context`, `ingest_evidence`), and the output/export engine (`generate_canvas`, `generate_brief`, `run_marketing_audit`, `export_workbook`). Writes are identity-gated (`gateWrite()` in `src/mcp/writeAuth.ts:21-39`), reads are RLS-scoped via `getUserSupabase()`, and PII is redacted in logs (`safeLog()`).

2. **The in-house coach chat** (`supabase/functions/idea-framework-consultant-claude/`, Deno edge function) — a single-turn RAG text consultant. It calls the Anthropic Messages API (`claude-sonnet-4-6`) directly with **one tool, `extract_brand_fields`** (`tools.ts:23-94`), and that tool's output is **never fed back to the model** — there is no `tool_result` round-trip and no agent loop (`index.ts:186-218`, `stream.ts:93-105`). All context is **pre-injected** up-front: `user_knowledge_base`, pgvector RAG over `user_knowledge_chunks`, and client-supplied snapshots (avatar field values, latest diagnostic). It cannot reach the asset/test ledger, brand canon, product truth, `business_facts`, the output-engine artifact store, the avatar S1–S4 pipeline, the publish filter, or the diagnostic/generation engines.

**The asymmetry is the problem.** A user talking to the in-house coach gets strictly less capability and less data access than an external agent talking to the MCP — even though we want the in-house chat to be the *primary* coaching experience. We want both surfaces to (a) drive the same tailored flows and (b) have the same available tools and access to internal data.

**Critical realization from the audit:** the two surfaces already share compute. The MCP's *owned generative* tools do not reimplement logic — they HTTP-proxy to the same Deno edge functions (`generate_concepts`→`idea-framework-consultant-claude`; `draft_asset`→`brand-copy-generator`; avatar stages→`avatar-*`; etc.) via a JWT-forwarding `EdgeFnClient` (`src/mcp/edgeFn/client.ts`). The in-house chat *is* one of those edge functions. So the chat doesn't lack engines — it lacks the **agentic tool loop** and the **context-resolution / artifact-persistence / guardrail wrapper** that the MCP layer adds around those engines.

**Correction (2026-06-16):** the "no tool loop" statement above is true for `main` and `feat/alpha-instrumentation`, but a **memory-tool agentic loop already exists** on the unmerged `feature/intelligent-memory` lineage (commits `fb85e52`/`0b2ff96`; `loop.ts` — present locally on `main-v3`). So the loop machinery is partly built but unlanded on main. This sharpens Phase 1: the missing pieces are a **generic tool-dispatch registry** (so MCP tools plug in) + flag + telemetry — implemented on that lineage (see Implementation status below) — plus eventually merging the loop lineage forward. It does not change the decision.

**The genuinely new decision** (not covered by any existing ADR): how a single tool/capability registry spans the **Node↔Deno runtime split**. Today there is *zero* shared code across that boundary — `src/mcp/` is hard Node (`node:http`, `node:async_hooks`, `exceljs`, `@modelcontextprotocol/sdk`, NodeNext `.js` import specifiers) and the edge functions are hard Deno (`deno.land/std`, `esm.sh`, `Deno.env`, URL/`.ts` specifiers). A shared `import`-level module is therefore blocked for any I/O-bound capability. But the project **already uses HTTP as its cross-runtime calling convention** (MCP→edge fns). So parity is an architecture/registry problem, not a runtime-portability problem — *provided the seam is HTTP, not `import`.*

## Decision Drivers

- **Parity:** the in-house chat must reach the same tools + internal data as the MCP agent surface.
- **Single source of truth:** one implementation, one guardrail model (`gateWrite()`/RLS/PII-redaction), one place to add capabilities — avoid a second divergent tool stack.
- **Reuse, not duplication:** the MCP's context-resolution, grounding gates ("never run ungrounded"), artifact chain, and identity/RLS plumbing are valuable and must not be re-forked into Deno.
- **Runtime reality:** the Node↔Deno boundary is real and cannot be wished away for I/O-bound code.
- **Incrementalism:** the MCP↔edge-fn HTTP contract is already in production; build on it.
- **Completes prior intent:** the Agent-SDK ADR already proposed a tool-calling chat; the inference half shipped, the agentic half did not. This ADR finishes it.

## Considered Options

### Option 1 — MCP as the canonical capability layer; chat becomes an MCP client (HTTP seam) — **chosen**
Promote the MCP server to the single canonical tool/capability registry. Give the in-house chat a **real Claude tool loop**; when the model calls a tool, the edge function invokes the corresponding MCP tool over `POST /mcp` (`src/mcp/http.ts`), **forwarding the user's Supabase JWT**. The MCP runs the tool under that identity, so RLS scoping, `gateWrite()` write-gating, grounding gates, and PII redaction are reused for free. One implementation per capability, each owned by the runtime that suits it (deterministic/ledger/persistence → MCP; LLM generation → edge fn, which the MCP already wraps).

- **Pros:** true parity (the chat reaches *exactly* the MCP tool set); one registry, one guardrail model; reuses the entire identity/RLS/artifact stack; lowest architectural risk (the inverse HTTP call already exists in prod); directly completes the Agent-SDK ADR.
- **Cons:** adds a network hop mid-stream (chat → MCP → possibly edge fn) → latency; requires the MCP host to be network-reachable from Supabase edge functions and to validate forwarded Supabase JWTs (infra/deploy work); a dependency cycle to manage (`generate_concepts` calls the consultant edge fn, which would now also be an MCP client — non-recursive in practice but must be guarded).

### Option 2 — Extract pure-TS capability modules importable by both runtimes
Lift the pure/deterministic services (Pattern A: `trustGap.ts`, `publishFilter.ts`, `testDesign.ts`, `auditCalibration.ts`, `claimGate.ts`, the `contracts/*` Zod schemas) into modules importable by both Node and Deno (dual build / import map). Precedent exists: the MCP already imports the app's `src/lib/trustGap.ts` in-process.

- **Pros:** no network hop for cheap deterministic ops; genuinely shared code.
- **Cons:** covers only ~30% of the surface — **nothing** touching Supabase, identity (`node:async_hooks`), or `exceljs`; needs a new dual-build/import-map step that doesn't exist today; leaves the high-value tools (ledger, artifacts, avatar pipeline, exports) unshared.

### Option 3 — MCP-as-registry, status quo extended
Keep the MCP as the registry but don't give the chat access. Collapses back to Option 1 the moment the chat needs any tool, since the only way for the chat to reach the registry is to call it (over HTTP). Not a distinct end-state.

### Option 0 — Do nothing / duplicate tools into the edge function
Re-implement the tool surface inside the Deno edge function.

- **Cons:** rejected — guarantees drift, a second guardrail model, and double maintenance; violates the project's "push complexity into deterministic shared code" operating model.

## Decision Outcome

**Adopt Option 1**, with Option 2 as a bounded optimization.

1. **The MCP server is the single canonical capability/tool layer** for all coaching surfaces. New capabilities are added there once.
2. **The in-house coach chat becomes an MCP client.** Replace the single-shot Messages call with a **real agentic tool loop**: model emits `tool_use` → edge fn calls the MCP tool over HTTP with the user's JWT → feeds the `tool_result` back → continues until the model returns a final answer. Streaming of assistant text is preserved.
3. **Identity is forwarded, never re-implemented.** The edge fn passes the caller's Supabase JWT to the MCP; the MCP's existing `runWithIdentity()` + RLS + `gateWrite()` enforce exactly the same boundaries for the chat as for any external agent.
4. **Optimization (Option 2):** the pure/deterministic Pattern-A capabilities (trust-gap math, publish-filter rules, claim gate, contract schemas) MAY be co-bundled into the edge function to avoid a network hop, **as long as** the MCP remains the source of truth and the shared module is the single definition (no re-fork). Defer until latency data justifies it.
5. **The "tailored flow" this unlocks in chat:** the coach can conversationally drive the full Avatar 2.0 pipeline — `get_context_status` (what's missing) → ask the user → `ingest_evidence`/`provide_context` (grounding) → `build_avatar_stage('pipeline')` → present S1–S4 results → gated S5 signature → `generate_canvas`/`generate_brief` → `export_workbook`. Same tools, same internal-data access, same grounding guarantees as the MCP agent.

This **supersedes-in-part** `ADR-CLAUDE-AGENT-SDK-MIGRATION.md`: that ADR's central proposal (agentic tool loop for the chat) is realized here via the MCP capability layer rather than the Agent SDK's in-Deno tool runner — consistent with the companion plan's "raw Messages API with manual tool loop" fallback.

## Consequences

**Positive**
- The in-house chat reaches full tool + internal-data parity with the MCP agent.
- One registry, one guardrail model, one place to add capabilities; no divergent second stack.
- The chat inherits grounding gates ("never run ungrounded"), artifact persistence, and PII redaction automatically.
- Completes the unrealized agentic half of the Agent-SDK migration.

**Negative / risks**
- **Latency:** mid-stream tool calls add round-trips (chat → MCP → edge fn). Mitigate with parallel tool calls, the Option-2 co-bundle for cheap deterministic ops, and surfacing tool progress in the stream.
- **Infra/reachability:** the MCP host is **already deployed and live** (verified 2026-06-17) at `https://ideabrandcoach.icodemybusiness.com/mcp` — Caddy `/mcp` route → Dockerized MCP on the mango Lightsail box (`54.243.53.44`, AWS us-east-1), TLS-terminated, MCP `initialize` returns 200 (`serverInfo: brand-coach-mcp v0.1.0`). So Phase 0 is effectively done for direct connectors. The remaining infra question is narrow: confirm it's reachable **from the Supabase edge-fn runtime** and validates a **forwarded** Supabase JWT (today it serves direct Claude-Desktop connectors). Note the live build predates this session's `mcp_tool_latency` instrumentation.
- **Dependency cycle:** `generate_concepts` (MCP) calls the consultant edge fn; the consultant now also calls the MCP. Non-recursive in practice (concept-generation mode ≠ conversational tool loop), but must be explicitly guarded against loops and depth.
- **Net-new work, not a refactor:** the chat has no tool registry to share *into* today — the agent loop is new code.

**Neutral / dependencies**
- **Conversation memory** is settled (`ADR-CONVERSATION-MEMORY`, Accepted, model-agnostic). Any "memory as a tool" builds on it; do not re-litigate.
- **Embeddings/RAG** must route through the eventual single `_shared/embeddings.ts` seam (`ADR-EMBEDDINGS-STRATEGY`); do not introduce a parallel embedding path when exposing `search_documents` as a tool.

## Implementation Sketch (phased — not yet executed)

1. **Phase 0 — MCP reachability:** deploy the MCP host behind TLS, reachable from edge functions; confirm it validates Supabase JWTs and that `runWithIdentity()` scopes correctly under a forwarded token. (Infra gate.)
2. **Phase 1 — Tool loop in the chat:** add a real `tool_use`→`tool_result` loop in `idea-framework-consultant-claude` (raw Messages API, manual loop per the companion plan). Keep streaming.
3. **Phase 2 — Wire the MCP client:** implement the inverse of `EdgeFnClient` — an MCP HTTP client in the edge fn that forwards the JWT and maps `tool_use` → `POST /mcp`. Start with read-only tools (`get_context_status`, `list_assets`, `run_trust_gap`).
4. **Phase 3 — Tailored flow tools:** expose `ingest_evidence`/`provide_context`/`build_avatar_stage` (and downstream canvas/brief/export) to the loop so the chat can drive the avatar pipeline end-to-end. Verify grounding + identity gating hold via the MCP.
5. **Phase 4 — Optimization (optional):** co-bundle Pattern-A deterministic capabilities to cut hops, sharing the single definition.

Each phase ships behind a flag with the existing single-shot path preserved for rollback, mirroring the Agent-SDK ADR's rollback posture.

**Implementation status (2026-06-16):** Phase 1's net-new pieces are built on the `feature/intelligent-memory` lineage (which already carries the memory tool loop), in worktree branch `worktree-agent-a075e98b98356dcdd`: a generic tool-dispatch `registry.ts` (the Phase-2 extension point), per-call latency telemetry (`consultant_llm_latency` / `consultant_handler_latency`, same field vocabulary as `mcp_tool_latency`, country-ready), and a `CONSULTANT_TOOL_LOOP_ENABLED` flag (gates the *registry seam*, not the memory loop — the loop is required by the shipped memory feature and is separately killable via `MEMORY_TOOL_ENABLED`). 60 edge-fn tests pass; not merged, not deployed. **Caveat:** built on the memory-loop lineage, which is unmerged to `main` — integration requires landing that lineage first (or retargeting), a branch-strategy call.

## Observability (latency over time, by country)

Ad-hoc laptop timing is not representative of prod, so the latency tradeoff is made **measurable in the deployed code** rather than estimated. Per-tool latency is instrumented at a single seam (`src/mcp/instrument.ts`, wired in `src/mcp/server.ts`): every tool emits an `mcp_tool_latency` PostHog event with `{ tool, duration_ms, ok, error_name, authenticated, country, region }`. The geo dimension comes from a per-request `RequestMeta` context (`src/mcp/context/requestMeta.ts`) resolved from `x-client-country` (forwarded by the chat edge fn) or CDN headers (`cf-ipcountry`/CloudFront/Vercel) — satisfying the "users in different countries" requirement. This gives PostHog trends of p50/p95 latency per tool, sliceable by country, which is the **empirical basis for both the hosting choice and the per-tool curated-surface decision**.

Client-side user-perceived latency is also captured: `useChat.sendMessageStreaming` emits a `chat_response_latency` event (`src/lib/posthogClient.ts`) with TTFT (time-to-first-token), total duration, `ok`, and `error_type` on every coach turn. The SPA's PostHog has auto-GeoIP, so this yields **real per-country user-perceived latency from production now** (the SPA is already deployed), independent of where the MCP host lands. Remaining companion slice (not yet built): per-call duration inside the chat edge function.

## Decisions Recorded

- **Tool surface to the chat:** **full 28-tool surface** (decided 2026-06-16). The conversational agent reaches every MCP tool. Implication: it can perform raw IV-OS ledger writes (`log_asset`, `update_asset_status`, `record_assessment`) — acceptable because those remain identity-gated (`gateWrite()`), RLS-scoped, and caller-attributed; revisit if conversational mis-triggers appear.

## Open Questions

- **Hosting:** the MCP is **already live** on the mango Lightsail box (AWS **us-east-1**) at `/mcp` via Caddy — so the practical question is no longer "VPS vs AWS from scratch," but: does us-east-1 co-locate with the Supabase **DB region** (confirm it), and is the existing box adequate vs a managed AWS service as load grows? Decide empirically from `mcp_tool_latency` once this session's instrumentation is deployed.
- Is the consumer-app "Zero to First Avatar" onboarding journey in the PRD (`_bmad-output/planning-artifacts/prd.md:168-245`) — a distinct, app-level narrative flow — in scope for this unification, or does it remain a separate UX track layered on top of these capabilities?

# ADR: Migrate Chat System from OpenAI to Claude Agent SDK

**Status:** Proposed  
**Date:** 2026-04-04  
**Decision Makers:** Matthew Kerns  
**Context:** The IDEA Brand Coach chat system (Trevor) currently runs on OpenAI GPT-4.1 via the Responses API. This ADR evaluates migrating to Anthropic Claude via the Agent SDK for agentic workflows.

---

## 1. Context & Motivation

### Why This Decision Is Being Made

Three forces are driving this evaluation:

1. **Agentic workflows**: The current edge function manually orchestrates what an agent framework provides natively — tool loops, multi-step reasoning, and context management. The main handler is 1,874 lines of hand-rolled orchestration.

2. **Provider resilience**: The system is 100% dependent on OpenAI. A single billing/quota issue (insufficient_quota, 2026-04-01) blocked ALL AI functionality with no fallback.

3. **Cost trajectory**: At $7.33/avg user/month, AI costs scale linearly. Claude's prompt caching (90% discount on cached tokens vs OpenAI's 50%) and Haiku pricing for lightweight tasks offer significant savings at scale.

### What Problem Does The Product Solve

IDEA Brand Coach is an AI-powered brand consulting platform using the IDEA Strategic Brand Framework. Users complete a diagnostic, then work with Trevor (AI brand coach) through 11 chapters covering 35 brand fields. Trevor extracts field values from conversation, builds a comprehensive brand profile, and generates strategy documents.

**AI is core, not supplementary** — Trevor IS the product. The chat system handles:
- Personalized brand coaching with RAG context
- Real-time field extraction via tool calling (35 fields, 11 chapters)
- Document analysis and field population
- Strategy document generation

---

## 2. Current State: OpenAI Implementation

### Architecture Overview

```
Client (React) → Supabase Edge Function (Deno) → OpenAI APIs
                                                    ├── Responses API (GPT-4.1) — main chat + streaming + tool calling
                                                    ├── Chat Completions (GPT-4o-mini) — 8 secondary functions
                                                    ├── Embeddings API (ada-002) — semantic search
                                                    └── Vector Store API — file_search for uploaded docs
```

### OpenAI API Touchpoints (Complete Inventory)

| Function | Model | API | Streaming | Tools | Monthly Cost % |
|----------|-------|-----|-----------|-------|---------------|
| idea-framework-consultant | GPT-4.1 | Responses | Yes (SSE) | extract_brand_fields | 60% |
| brand-copy-generator | GPT-4o-mini | Completions | No | No | 2.5% |
| buyer-intent-analyzer | GPT-4o-mini | Completions | No | No | < 1% |
| brand-ai-assistant | GPT-4.1 | Completions | No | No | < 1% |
| generate-brand-strategy-section | GPT-4o-mini | Completions | No | No | 5% |
| extract-fields-from-document | GPT-4o-mini | Completions | No | No | 7% |
| ai-insight-guidance | GPT-4o-mini | Completions | No | No | < 1% |
| generate-session-title | GPT-4o-mini | Completions | No | No | < 1% |
| Embeddings (multiple) | ada-002 | Embeddings | N/A | N/A | 5% |
| Vector store ops (5 functions) | N/A | Files/VS API | N/A | N/A | 5% |

### Strengths of Current Implementation

1. **Streaming SSE protocol is model-agnostic** — Client receives `text_delta`, `extracted_fields`, `done`, `error` events. The client-side `ChatStreamParser.ts` does not know or care about OpenAI. This is the single most migration-friendly design decision.

2. **Tool calling for field extraction works well** — 35-field extraction with confidence scoring, source tracking, and chapter-scoped tool descriptions (reduces token usage from ~1200 to ~200 tokens per turn).

3. **Tiered context retrieval is smart** — Simple greetings get minimal context; complex queries get full RAG. Saves tokens on 30-40% of messages.

4. **Conversation chaining via previous_response_id** — Reduces per-request token usage by letting OpenAI maintain history server-side.

5. **Parallel context retrieval** — Knowledge base, semantic search, and vector store queries run concurrently via `Promise.all`.

### Weaknesses of Current Implementation

1. **1,874-line monolith** — `index.ts` contains duplicated code from modular files (`rag.ts`, `fields.ts`). The modular files exist but the monolith has inline copies.

2. **Fragile conversation chaining** — Stale chain detection uses string matching on error bodies (`body.includes('pending')`). One retry, no circuit breaker.

3. **"Tool call only, no text" bug** — When the model produces only a tool call, a synthetic fallback message is injected. This masks model failures and creates inconsistent UX.

4. **No prompt caching** — OpenAI caches automatically (50% on prefix match), but there's no explicit optimization. The ~2,500-token system prompt is re-sent every turn.

5. **Vector store vendor lock-in** — 5 edge functions manage OpenAI vector stores. Documents are uploaded to OpenAI's proprietary format, creating hard dependency.

6. **JWT verification disabled on ALL edge functions** — Critical security gap (from production audit). Any unauthenticated user can call AI functions.

7. **No cost monitoring or rate limiting** — Single power user could incur $65+/month. No alerts, no dashboards.

8. **No error tracking** — Console logs only. Production errors invisible until user reports.

---

## 3. Proposed State: Claude Agent SDK

### Architecture Overview

```
Client (React) → Supabase Edge Function (Deno) → Anthropic Messages API
                                                    ├── Claude Sonnet 4 — main chat + streaming + tool calling
                                                    ├── Claude Haiku 4.5 — 8 secondary functions
                                                    ├── Voyage AI voyage-3 — embeddings
                                                    └── Supabase pgvector — document search (replaces OpenAI VS)
```

### Claude Agent SDK Capabilities

The Agent SDK provides the autonomous agent loop that powers Claude Code:

1. **Native tool loop**: Agent decides to call tools → SDK executes them → results feed back → agent continues. No manual orchestration needed.
2. **Streaming with tool use**: Text and tool calls stream incrementally via `content_block_delta` events.
3. **TypeScript SDK v0.2.71**: Full feature parity with Python. Deno v1.28.0+ compatible.
4. **Cost controls**: `maxTurns`, `maxBudgetUsd`, `effort` levels.
5. **Prompt caching**: 90% discount on cached tokens with `cache_control: { type: "ephemeral" }`.

### Key Architectural Difference: Agent Loop vs Manual Orchestration

**Current (OpenAI — manual):**
```
Build context → Single API call → Parse SSE events → Accumulate tool args
→ If tool call: parse fields, emit to client → Submit tool outputs (separate API call)
→ If no text: inject fallback message → Emit done
```
~400 lines of streaming/tool orchestration code.

**Proposed (Claude Agent SDK):**
```
Create agent with tools → Agent.run() → SDK handles tool loop automatically
→ Stream events mapped to existing client protocol → Agent guarantees text after tools
```
~100 lines. The SDK handles tool result injection, multi-step reasoning, and response generation.

### What The Agent SDK Eliminates

| Current Manual Code | Agent SDK Equivalent |
|---|---|
| `stream-builder.ts` (195 lines) — SSE proxy, tool call accumulation | SDK streaming with `content_block_delta` events |
| `submitToolOutputs()` — separate API call to chain tool results | Automatic — SDK injects tool results |
| Fallback message injection when model produces only tool calls | Agent naturally produces text after tool calls |
| `previous_response_id` chaining + stale chain retry logic | Client-managed history (already implemented as fallback) |
| Manual `functionCallArgs` string accumulation | SDK provides parsed tool input |

### What The Agent SDK Enables (New Capabilities)

1. **Agent-initiated RAG**: Define `search_documents` as a tool the agent calls when needed, instead of always pre-fetching. Eliminates wasted RAG calls on simple messages (~30-40% of turns).

2. **Multi-step field extraction**: Agent extracts fields, receives confirmation, then crafts a response referencing the extraction. Eliminates the "tool call only, no text" bug by design.

3. **Conversation memory as a tool**: `recall_conversation` tool for semantic search of past messages. Implements the planned memory ADR as an agent capability.

4. **Parallel tool calls**: Claude natively supports calling multiple tools simultaneously (e.g., extract fields AND search documents in one turn).

---

## 4. Tradeoff Analysis

### 4.1 Model Quality

| Dimension | OpenAI GPT-4.1 | Claude Sonnet 4 | Assessment |
|-----------|----------------|-----------------|------------|
| Conversational coaching | Excellent — prompt tuned over months | Untested with Trevor persona | **Risk**: Prompt tuning needed (2-3 days) |
| Tool calling reliability | Good — occasionally produces tool-only responses | Good — more conservative about tool calls | **Trade**: May need explicit encouragement to extract aggressively |
| Instruction following | Strong with CAPITALIZED instructions | Strong with XML-tagged instructions | **Neutral**: Different syntax, same capability |
| Context window | 1M tokens | 1M tokens | **Neutral** |
| Vision (image analysis) | Yes | Yes | **Neutral** |

**Verdict**: Comparable quality. Primary risk is prompt tuning for Trevor's persona and extraction behavior.

### 4.2 Cost

| Dimension | OpenAI | Claude | Winner |
|-----------|--------|--------|--------|
| Main chat (per 1K tokens) | $2 in / $8 out (GPT-4.1) | $3 in / $15 out (Sonnet 4) | **OpenAI** by ~2x on raw pricing |
| With prompt caching | 50% off cached input | 90% off cached input | **Claude** — system prompt (~2.5K tokens) cached at 90% vs 50% |
| Lightweight tasks | $0.15 in / $0.60 out (GPT-4o-mini) | $0.80 in / $4 out (Haiku 4.5) | **OpenAI** — GPT-4o-mini is cheaper than Haiku |
| Embeddings | $0.02/1M (ada-002) | Voyage AI ~$0.06/1M | **OpenAI** by 3x |
| Vector store hosting | $0.10/GB/day (OpenAI VS) | $0 (Supabase pgvector — already provisioned) | **Claude path** — eliminates VS cost entirely |
| Batch API (non-realtime) | 50% discount | 50% discount | **Neutral** |

**Cost projection at 1,000 users:**

| Scenario | OpenAI (current) | Claude (optimized) |
|----------|-----------------|-------------------|
| Main chat | $6,500/mo | $4,200/mo (with caching) |
| Secondary functions | $550/mo | $800/mo (Haiku more expensive) |
| Embeddings | $100/mo | $180/mo (Voyage AI) |
| Vector stores | $300/mo | $0 (pgvector) |
| **Total** | **$7,450/mo** | **$5,180/mo** |
| **Savings** | — | **30% reduction** |

**Verdict**: Claude is ~30% cheaper at scale primarily due to prompt caching and eliminating vector store costs. Raw per-token pricing favors OpenAI, but caching inverts this for the chat use case where the system prompt is 2,500+ tokens sent every turn.

### 4.3 Developer Experience

| Dimension | OpenAI | Claude Agent SDK | Winner |
|-----------|--------|-----------------|--------|
| Tool loop | Manual (400 lines) | Automatic (~100 lines) | **Claude** |
| Streaming + tools | Complex (accumulate args, submit outputs) | Native (SDK handles) | **Claude** |
| Deno compatibility | Works via fetch() | SDK supports Deno 1.28+ | **Neutral** |
| Debugging | Console logs only | Hooks for custom logging | **Claude** (slight edge) |
| Prompt caching | Implicit (no control) | Explicit markers (full control) | **Claude** |
| Error handling | Manual retry logic | Configurable (maxTurns, maxBudget) | **Claude** |

**Verdict**: Significant DX improvement. The agent loop eliminates the most complex and fragile parts of the codebase.

### 4.4 Operational Risk

| Dimension | OpenAI | Claude | Assessment |
|-----------|--------|--------|------------|
| Provider reliability | Single point of failure (proven: 2026-04-01 quota outage) | Single point of failure (different provider) | **Neutral** — swapping one SPOF for another |
| Vendor lock-in | High (vector stores, response IDs, file_search) | Low (pgvector is portable, no proprietary storage) | **Claude path** — reduces lock-in |
| Migration risk | N/A (status quo) | High during transition (prompt tuning, testing) | **OpenAI** — no migration risk |
| Rollback | N/A | Possible if old function preserved | **Mitigated** with parallel deploy |
| Maturity | Responses API is 6+ months old | Agent SDK is newer (v0.2.71) | **OpenAI** — more battle-tested |

**Verdict**: Migration carries short-term risk but reduces long-term vendor lock-in. The key mitigation is preserving the old edge function during transition.

### 4.5 Alignment with Project Objectives

| Objective | OpenAI (Current) | Claude Agent SDK | Winner |
|-----------|-----------------|-----------------|--------|
| **P0 Beta Launch** (chat, extraction, streaming) | Done, working | Requires rebuild | **OpenAI** — already shipping |
| **Response quality** (personalized coaching) | Tuned and validated | Untested | **OpenAI** — known quantity |
| **< 5s p95 latency** | Meeting target | Unknown until benchmarked | **OpenAI** — known |
| **65-75% margin at scale** | ~85% margin at Professional tier | ~90% margin with caching | **Claude** — better margins |
| **P1: Document upload RAG** | OpenAI vector stores (vendor-locked) | pgvector (portable, already exists) | **Claude path** — better architecture |
| **P1: Smart model routing** | Possible (GPT-4 vs 4o-mini) | Possible (Sonnet vs Haiku) | **Neutral** |
| **P2: Team collaboration** | No impact | No impact | **Neutral** |
| **Long-term: Agentic features** | Manual orchestration for each new tool | Native — add tools to agent definition | **Claude** — extensibility |
| **Long-term: Multi-provider resilience** | 100% OpenAI | 100% Claude (but less vendor lock-in) | **Slight Claude edge** |

---

## 5. Gaps and Mitigation

### 5.1 No Equivalent to OpenAI Vector Stores

**Gap**: OpenAI's `file_search` tool provides hosted vector store search. Claude has no equivalent.

**Mitigation**: Migrate to Supabase pgvector (already partially used). This is actually better architecture — eliminates vendor lock-in, reduces cost, and gives full control over retrieval.

**Effort**: Create `document_chunks` table, migration script, `match_document_chunks` RPC. 2-3 days.

### 5.2 No Anthropic Embedding Model

**Gap**: Anthropic doesn't offer embeddings. Currently using `text-embedding-ada-002`.

**Mitigation**: Use Voyage AI `voyage-3` (Anthropic partner, recommended in their docs). Or keep OpenAI for embeddings only — embeddings are provider-agnostic once generated.

**Effort**: Swap API call, re-embed existing content. 1 day.

### 5.3 Conversation Memory Without previous_response_id

**Gap**: OpenAI's Responses API maintains conversation history server-side. Claude has no equivalent.

**Mitigation**: Already implemented — the fallback path sends `chat_history` array from the database. Per ADR-CONVERSATION-MEMORY, the system has already moved away from server-side chaining (`store: false`). This is a non-issue.

### 5.4 Agent SDK in Supabase Edge Functions

**Gap**: Edge functions are stateless with 5-15 minute timeouts. The Agent SDK's multi-turn loop needs state.

**Mitigation**: For the chat use case, the agent loop completes in a single request-response cycle (1-3 turns: reason → extract fields → respond). This fits within edge function constraints. The SDK's `maxTurns: 3` prevents runaway loops. If future agentic features need longer loops, a backend service can be added later.

### 5.5 Prompt Tuning for Trevor Persona

**Gap**: The system prompt is tuned for GPT-4.1 over months. Claude may respond differently to the same instructions.

**Mitigation**: Budget 2-3 days for prompt tuning. Key changes: replace CAPITALIZED instructions with XML tags (Claude's preferred format), adjust extraction aggressiveness, test persona consistency. A/B test with real conversations.

---

## 6. Decision Options

### Option A: Stay on OpenAI (Status Quo)

**Pros**: No migration risk, prompt already tuned, known latency/quality  
**Cons**: Vendor lock-in, manual orchestration debt, no agentic capabilities, single provider risk  
**Cost**: $7,450/mo at 1K users  
**Effort**: 0 (but ongoing maintenance of 1,874-line monolith)

### Option B: Migrate to Claude Agent SDK (Full Replace)

**Pros**: Agentic workflows, reduced orchestration code, prompt caching, less vendor lock-in  
**Cons**: Migration risk, prompt tuning needed, untested at production scale  
**Cost**: ~$5,180/mo at 1K users (30% reduction)  
**Effort**: 14-22 days (see migration plan)

### Option C: Hybrid — Claude for Chat, OpenAI for Secondary

**Pros**: Targeted migration of highest-value function, keeps working secondary functions  
**Cons**: Two providers to manage, two sets of API keys, more operational complexity  
**Cost**: ~$5,800/mo at 1K users (22% reduction)  
**Effort**: 8-12 days (Phase 0 + Phase 1 only)

---

## 7. Recommendation

**Option B: Full migration to Claude Agent SDK**, executed in phases with the old edge function preserved for rollback.

### Rationale

1. **The agentic loop is the key win**. Eliminating 400+ lines of manual tool orchestration, stale chain handling, and fallback message injection justifies the migration alone. Every new tool added in the future benefits from this foundation.

2. **Cost savings compound**. 30% reduction at 1K users, growing as prompt caching covers more of the system prompt. The vector store cost elimination is immediate.

3. **Vendor lock-in reduction is strategic**. Moving from OpenAI vector stores to pgvector makes the RAG layer portable. If Claude underperforms, switching to another provider later is easier than switching from OpenAI vector stores.

4. **The streaming protocol is already model-agnostic**. The client-side code (`ChatStreamParser.ts`, `useChat.ts`) doesn't know about OpenAI. Only the edge function internals change.

5. **Conversation memory is already migrated**. Per ADR-CONVERSATION-MEMORY, `previous_response_id` is already deprecated. The fallback path (client-managed history) is the de facto standard.

### Pre-Conditions (Must Address Regardless of Migration)

These issues from the production audit apply to both OpenAI and Claude:

1. **Enable JWT verification on all edge functions** — Critical security gap
2. **Add rate limiting** — Prevent cost runaway from single users
3. **Add error tracking** — Sentry or equivalent for production visibility

---

## 8. Migration Phases (If Approved)

| Phase | Scope | Days | Risk |
|-------|-------|------|------|
| 0: Infrastructure | API keys, pgvector tables, RPC functions | 1-2 | Low |
| 1: Chat Migration | New edge function with Agent SDK, streaming, tool calling, prompt tuning | 5-8 | High |
| 2: RAG Migration | pgvector search replaces OpenAI vector stores | 3-4 | Medium |
| 3: Secondary Functions | 8 model swaps (GPT-4o-mini → Haiku) | 2-3 | Low |
| 4: Cleanup | Remove OpenAI dependencies, embeddings migration | 1-2 | Low |

**Total: 14-22 days. Phases 2 and 3 can run parallel with Phase 1.**

### Rollback Strategy

- Phase 1 creates a NEW edge function (`idea-framework-consultant-claude/`). The existing function is untouched.
- Client switches via a single constant in `ChatEdgeFunctionService.ts`.
- Rollback = change the constant back. Zero code changes to the old function.

---

## 9. Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Response quality | Equivalent to GPT-4.1 (blind A/B test) | 5 real conversations rated by stakeholder |
| Field extraction accuracy | >= 90% of current extraction rate | Compare extraction counts on same inputs |
| Streaming latency (TTFT) | < 2 seconds | Measure in dev environment |
| End-to-end latency (p95) | < 5 seconds | Measure across 50+ messages |
| Cost per message | < current ($0.065) | Track via API usage |
| Code reduction | >= 50% fewer lines in edge function | LOC comparison |
| Test suite | All existing tests pass | `npm test` |

---

## 10. References

- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Claude Agent Loop](https://platform.claude.com/docs/en/agent-sdk/agent-loop)
- [Claude Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [ADR-CONVERSATION-MEMORY.md](./ADR-CONVERSATION-MEMORY.md)
- [AI Cost Analysis](../cost-analysis/AI-COST-ANALYSIS.md)
- [Production Readiness Audit](../../production/PRODUCTION_READINESS_AUDIT_UPDATED.md)

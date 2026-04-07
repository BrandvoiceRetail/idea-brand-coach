# IDEA Brand Coach: OpenAI → Claude Agent SDK Migration Plan

> Created 2026-04-04. Migration from OpenAI GPT-4.1 (Responses API) to Anthropic Claude via Agent SDK.

## Motivation

- **Agentic workflows**: Agent SDK provides native tool loops, multi-step reasoning, and agent-initiated RAG — currently built manually with ~1500 lines of orchestration code
- **Cost**: Claude prompt caching (90% discount) vs OpenAI (50%); Haiku for lightweight tasks
- **Reliability**: Eliminate dependency on single provider (OpenAI quota issues have blocked all AI calls)

---

## 1. Current State Inventory

### 1.1 OpenAI API Touchpoints

#### Primary Chat (`idea-framework-consultant`)

| Touchpoint | API | Model | Purpose |
|-----------|-----|-------|---------|
| Main conversation | Responses API `/v1/responses` | gpt-4.1-2025-04-14 | Trevor coaching + `extract_brand_fields` tool |
| SSE streaming | Responses API `stream: true` | gpt-4.1-2025-04-14 | Real-time text deltas + function call streaming |
| Vector store search | Responses API + `file_search` tool | gpt-4o-mini | Search user-uploaded docs in OpenAI vector stores |
| Embeddings | `/v1/embeddings` | text-embedding-ada-002 | Semantic search against pgvector (currently dead code) |

#### Document Field Extraction (`extract-fields-from-document`)

| Touchpoint | API | Model | Purpose |
|-----------|-----|-------|---------|
| Per-field vector store query | Responses API + `file_search` | gpt-4o-mini | Extract 35 brand fields from uploaded docs (batched 5 at a time) |

#### Section Generation (`generate-brand-strategy-section`)

| Touchpoint | API | Model | Purpose |
|-----------|-----|-------|---------|
| Section content | Chat Completions | gpt-4o-mini | Generate strategy document sections |
| Skills search | Vector Store Search API | N/A | Retrieve IDEA framework methodology chunks |

#### Other Edge Functions (8 functions)

| Function | Model | Notes |
|----------|-------|-------|
| `generate-session-title` | gpt-4o-mini | Simple prompt, JSON output |
| `brand-copy-generator` | gpt-4-turbo-preview | Most expensive model in stack |
| `competitive-analysis-orchestrator` | gpt-4o | Market analysis |
| `buyer-intent-analyzer` | gpt-4o-mini | JSON response format |
| `ai-insight-guidance` | gpt-4o-mini | Diagnostic guidance |
| `brand-ai-assistant` | gpt-4o-mini | Field suggestions |
| `file-conversation-insights` | gpt-4o-mini | Conversation analysis |
| `sync-diagnostic-to-embeddings` | ada-002 | Chunk diagnostic data |

#### Infrastructure Functions (to deprecate)

`upload-document-to-vector-store`, `ensure-user-kb`, `create-user-kb`, `sync-to-openai-vector-store`, `list-vector-stores` — manage OpenAI vector stores

### 1.2 Streaming Protocol

Custom SSE protocol between edge function and client (already model-agnostic):
- `text_delta` — text content
- `extracted_fields` — parsed field extractions
- `done` — stream complete
- `error` — error message

Client-side `ChatStreamParser.ts` is a table-driven parser. **No client changes needed** if the edge function preserves this protocol.

### 1.3 Conversation Memory

Per ADR (`ADR-CONVERSATION-MEMORY.md`):
- OpenAI server-side chaining already removed (`store: false`)
- `previous_response_id` no longer used
- Client-managed chat history (last 5-10 messages)
- **No dependency on OpenAI conversation storage**

### 1.4 Tool Calling

One tool: `extract_brand_fields` with 35 brand fields. Chapter-scoped descriptions reduce token usage. Currently uses OpenAI function calling format.

---

## 2. Anthropic Equivalents

### 2.1 Model Mapping

| OpenAI Model | Anthropic Equivalent | Use Case |
|-------------|---------------------|----------|
| gpt-4.1-2025-04-14 | claude-sonnet-4-20250514 | Main conversation (Trevor) |
| gpt-4o-mini | claude-3-5-haiku-20241022 | Title gen, field extraction, section gen |
| gpt-4-turbo-preview | claude-sonnet-4-20250514 | Brand copy generation |
| gpt-4o | claude-sonnet-4-20250514 | Competitive analysis |
| text-embedding-ada-002 | Voyage AI voyage-3 | Embeddings (Anthropic partner) |

### 2.2 Feature Mapping

| OpenAI Feature | Anthropic Equivalent | Notes |
|---------------|---------------------|-------|
| Responses API | Messages API | System prompt in `system` param |
| SSE streaming | SSE streaming | Different events, same transport |
| Function calling | Tool use | `{ name, description, input_schema }` format |
| `file_search` tool | **No equivalent** | Migrate to Supabase pgvector |
| Automatic prompt caching | Explicit `cache_control` markers | 90% discount (vs OpenAI 50%) |
| Multi-modal (images) | Vision (image content blocks) | Direct mapping |

### 2.3 Gaps Requiring Mitigation

| Gap | Mitigation |
|-----|------------|
| **No hosted vector stores** | Migrate to Supabase pgvector (partially exists) |
| **No embedding model** | Use Voyage AI `voyage-3` (Anthropic partner) |
| **Agent SDK Deno compatibility** | Verify `@anthropic-ai/sdk` in Deno; fallback to raw Messages API with manual tool loop if needed |

---

## 3. Agentic Workflow Design

### 3.1 Current Architecture (Manual)

```
Client request
  → Edge function builds context (system prompt + RAG pre-fetch)
  → Single OpenAI API call with extract_brand_fields tool
  → Manual SSE event parsing + tool call accumulation
  → If tool call: parse fields, emit extracted_fields
  → If no text output: inject fallback message
  → Emit done
```

**Problems**: No multi-step reasoning, RAG always pre-fetched (wasteful), fallback message hack, ~1500 lines of orchestration.

### 3.2 Proposed Architecture (Agent SDK)

```
Client request
  → Edge function creates Agent with tools + context
  → Agent.run() enters agentic loop:
      Step 1: Read user message + context
      Step 2: Decide to call tools (extraction, RAG search, etc.)
      Step 3: Tool handlers execute, return results
      Step 4: Agent receives results, generates conversational response
      Step 5: May call additional tools if needed
  → Stream events mapped to existing client SSE protocol
  → Agent guarantees text output after tool calls
```

### 3.3 Agent Definition

```typescript
const trevorAgent = new Agent({
  name: "Trevor",
  model: "claude-sonnet-4-20250514",
  instructions: generateTrevorSystemPrompt(chapterContext, diagnosticContext),
  tools: [
    extractBrandFieldsTool,    // Existing field extraction
    searchDocumentsTool,        // NEW: Agent-initiated RAG
    searchKnowledgeBaseTool,    // NEW: Agent-initiated KB lookup
  ],
});
```

### 3.4 New Agentic Capabilities

**Agent-Initiated RAG**: Instead of always pre-fetching document context, define a `search_user_documents` tool the agent calls when needed. Eliminates wasted RAG calls on simple messages.

**Multi-Step Field Extraction**: Agent extracts fields, receives confirmation, then crafts a response referencing the extraction. Eliminates "tool call only, no text" bug.

**Conversation Memory as a Tool**: `recall_conversation` tool for searching past messages via pgvector. Implements semantic memory ADR as an agent capability.

### 3.5 Streaming Translation

| Agent SDK Event | Client Protocol |
|----------------|----------------|
| Text chunk from agent | `{ type: "text_delta", delta }` |
| `tool_use` with `extract_brand_fields` | `{ type: "extracted_fields", fields }` |
| Agent run complete | `{ type: "done" }` |
| Agent error | `{ type: "error", message }` |

---

## 4. Migration Phases

### Phase 0: Infrastructure Prep (1-2 days)

- [ ] Add `ANTHROPIC_API_KEY` to Supabase edge function secrets
- [ ] Add Voyage AI API key to secrets
- [ ] Create `document_chunks` table with pgvector column
- [ ] Create `skills_chunks` table for IDEA methodology content
- [ ] Write migration script: OpenAI vector stores → pgvector
- [ ] Create `match_document_chunks` and `match_skills_chunks` RPC functions

### Phase 1: Chat Conversation Migration (5-8 days)

- [ ] Create `idea-framework-consultant-claude/` as parallel edge function
- [ ] Implement Agent SDK agent with Trevor system prompt
- [ ] Register `extract_brand_fields` as Agent SDK tool
- [ ] Rewrite streaming: Claude SSE events → custom client protocol
- [ ] Add prompt caching (`cache_control` on system prompt + tools)
- [ ] Add `useClaudeApi` feature flag (default: false)
- [ ] Prompt tuning (2-3 days): Claude prefers XML-tagged instructions
- [ ] A/B test against GPT-4.1 path

### Phase 2: RAG Migration to pgvector (3-4 days)

- [ ] Replace `searchVectorStore()` with pgvector similarity search
- [ ] Replace `searchSkillsVectorStore()` with pgvector query
- [ ] Migrate `extract-fields-from-document` to Claude + pgvector
- [ ] Update `upload-document-to-vector-store` to store in pgvector
- [ ] Deprecate OpenAI vector store management functions

### Phase 3: Remaining Edge Functions (2-3 days)

8 simple model swaps — no streaming or tool calling complexity:
- [ ] `generate-session-title` → Haiku
- [ ] `generate-brand-strategy-section` → Haiku
- [ ] `brand-copy-generator` → Sonnet 4
- [ ] `competitive-analysis-orchestrator` → Sonnet 4
- [ ] `buyer-intent-analyzer` → Haiku
- [ ] `ai-insight-guidance` → Haiku
- [ ] `brand-ai-assistant` → Haiku
- [ ] `file-conversation-insights` → Haiku

### Phase 4: Embeddings + Cleanup (1-2 days)

- [ ] Switch embedding model to Voyage AI
- [ ] Re-embed all existing content
- [ ] Implement semantic memory (`match_chat_history` RPC)
- [ ] Remove `OPENAI_API_KEY` from secrets
- [ ] Delete deprecated vector store functions
- [ ] Clean up `ChatEdgeFunctionService.ts` (remove `openai_response_id` refs)

---

## 5. Risk Assessment

### High Risk

| Risk | Mitigation |
|------|------------|
| **Prompt quality regression** | A/B test Phase 1. Budget 2-3 days for prompt tuning. Claude prefers XML-tagged instructions vs GPT's CAPITALIZED SECTIONS. |
| **Tool calling behavior differences** | Claude is more conservative about tool calls. May need explicit encouragement in system prompt. Test extraction rates against real conversations. |
| **Streaming latency** | Benchmark before committing. Prompt caching should help. |

### Medium Risk

| Risk | Mitigation |
|------|------------|
| **Agent SDK in Deno** | Verify `@anthropic-ai/sdk` works in Deno edge functions. Fallback: raw Messages API with manual tool loop (still simpler than current). |
| **Vector store migration** | Run parallel retrieval during Phase 2, compare results before cutting over. |
| **Embedding model change** | Re-embed all content. Store embedding model version alongside vectors. |
| **Cost uncertainty** | Monitor during A/B test. Set max_tokens limits. Configure agent max_turns (e.g., 3). |

### Low Risk

| Risk | Mitigation |
|------|------------|
| **Client-side breakage** | Custom SSE protocol shields client. Verify with integration tests. |
| **Rollback** | Feature flag keeps OpenAI path active. Only remove after validation. |

---

## 6. Effort Estimate

| Phase | Size | Calendar Time | Dependencies |
|-------|------|--------------|-------------|
| Phase 0: Infrastructure | S | 1-2 days | None |
| Phase 1: Chat Migration | L | 5-8 days | Phase 0 |
| Phase 2: RAG Migration | M | 3-4 days | Phase 0 |
| Phase 3: Other Functions | S-M | 2-3 days | None (parallel with Phase 1) |
| Phase 4: Cleanup | S | 1-2 days | Phases 1-3 |
| Validation / Buffer | M | 2-3 days | All |
| **Total** | | **14-22 days** | |

### Recommended Sequencing

```
Week 1: Phase 0 + Phase 1 (start) + Phase 3 (parallel)
Week 2: Phase 1 (complete + prompt tuning) + Phase 2
Week 3: Phase 4 + Validation + A/B testing
```

### Key Decision Point

After Phase 1 A/B testing, evaluate:
1. Is Claude response quality on par with GPT-4.1 for Trevor coaching?
2. Is extraction accuracy comparable?
3. Are latency targets met?

Feature flag allows indefinite parallel operation if needed.

---

## Critical Files

| File | Role in Migration |
|------|-------------------|
| `supabase/functions/idea-framework-consultant/index.ts` | 1500-line monolith to rewrite with Agent SDK |
| `supabase/functions/idea-framework-consultant/stream-builder.ts` | SSE proxy to rewrite for Claude events |
| `supabase/functions/idea-framework-consultant/fields.ts` | Tool definition to convert to Claude format |
| `supabase/functions/idea-framework-consultant/rag.ts` | RAG module to migrate to pgvector |
| `src/services/chat/ChatStreamParser.ts` | Client parser — should NOT need changes |
| `src/hooks/useChat.ts` | Client hook — should NOT need changes |

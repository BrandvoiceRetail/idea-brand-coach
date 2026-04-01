# ADR: Conversation Memory — Semantic Retrieval over Sequential History

**Status**: Accepted
**Date**: 2026-03-27
**Authors**: Matthew Kerns, Claude (AI pair)
**Supersedes**: Implicit sequential history + OpenAI server-side chaining

---

## Context

The IDEA Brand Coach uses an AI consultant (Trevor) powered by OpenAI's Responses API. The current model is `gpt-4.1-2025-04-14`, with a planned migration to GPT-5 Mini for conversation and GPT-5 for document generation / field extraction (see [Beta Cost Projection](../cost-analysis/BETA-COST-PROJECTION.md)). Conversations require multi-turn context so Trevor can reference prior statements, build on earlier discussions, and guide users progressively through the 11-chapter IDEA framework.

### Problem

The original implementation used two mechanisms for conversation continuity:

1. **OpenAI server-side chaining** (`store: true` + `previous_response_id`) — OpenAI maintains full history server-side
2. **Sequential fallback** — Send last 5-10 messages as `chat_history` when chaining fails

Both approaches have significant drawbacks:

| Issue | Impact |
|-------|--------|
| `store: true` incurs storage fees ($0.50/1M stored tokens) | Cost scales with usage |
| Tool output submission required to maintain chain (2nd API call per message) | Doubles per-message cost for extraction turns |
| Stale chain errors when tool outputs aren't properly submitted | Causes retry logic, occasional failures |
| Sequential history loses early context in long sessions | Trevor "forgets" things said 10+ messages ago |
| Brand building is non-linear — users revisit topics | Recency-based window misses topically relevant history |

### Cost Incident (March 2026)

Total OpenAI spend jumped from ~$0.39 over the prior 2-3 months to $5+ in days. Root cause analysis identified:

- **Per-message cost**: ~$0.03-0.12 (main call + tool output submission + embedding + vector store search)
- **Dead code**: `retrieveSemanticContext()` generating embeddings against an empty `user_knowledge_chunks` table on every message
- **Unnecessary calls**: Vector store search running even when user has no uploaded documents
- **OpenAI quota exhausted**: `insufficient_quota` error surfaced as vague "I'm sorry" fallback due to missing error event handling in SSE parser

### Immediate Fixes Applied

1. Removed dead semantic search call (empty table)
2. Gated vector store search behind `hasUploadedDocuments` check
3. Switched to `store: false`, eliminating tool output submission call
4. Added proper handling for OpenAI `error` and `response.failed` SSE events
5. Removed `previous_response_id` chaining and stale chain retry logic

**Result**: Per-message cost reduced to ~$0.02-0.05 (40-50% reduction). But conversation context quality degraded — now limited to last 5 sequential messages.

---

## Decision

Adopt a **hybrid semantic memory** approach: retrieve conversation context using embedding similarity search combined with a small recency window.

### Architecture

```
User sends message
  1. Save message to chat_messages (existing)
  2. Generate embedding (text-embedding-3-small) and store alongside message
  3. Query: top-3 semantically similar prior messages from same session
  4. Build input: [semantic_top_3] + [last_2_messages] + [current_message]
  5. Deduplicate: if semantic result overlaps with recent messages, skip it
  6. Send to model with: system_prompt + hybrid_context + user_message
```

### Scope

- **Phase 1**: Session-scoped retrieval (search within current `chat_session` only)
- **Phase 2** (future): Cross-session retrieval ("Last time we talked about your brand values...")

### Hybrid Context Window

| Slot | Source | Purpose | Tokens (est.) |
|------|--------|---------|---------------|
| 1-3 | Semantic retrieval | Most relevant prior context | ~600 |
| 4-5 | Last 2 messages | Immediate conversational continuity | ~400 |
| 6 | Current message | User's new input | ~200 |
| **Total** | | | **~1,200** |

Compared to sending last 10 messages sequentially (~2,000 tokens), this uses fewer input tokens while providing dramatically better context quality.

---

## Alternatives Considered

### 1. Keep Sequential History (Last N Messages)

**Approach**: Send last 5-10 messages on every request.

| Pro | Con |
|-----|-----|
| Simple implementation | Loses early context in long sessions |
| No embedding cost | Brand building is non-linear — recency misses topic revisits |
| Predictable token usage | 10 messages = ~2,000 tokens regardless of relevance |

**Rejected because**: Context quality is poor for the brand coaching use case where users discuss values in message 3, competitors for 20 messages, then return to values.

### 2. OpenAI Server-Side Chaining (`store: true`)

**Approach**: Let OpenAI maintain full conversation history server-side via `previous_response_id`.

| Pro | Con |
|-----|-----|
| Full history without sending tokens | Storage fees ($0.50/1M stored tokens) |
| No embedding infrastructure needed | Requires tool output submission (2nd API call) |
| OpenAI manages context window | Stale chain errors cause retries and failures |
| | Vendor lock-in — history trapped in OpenAI |
| | Opaque — can't control what the model "remembers" |

**Rejected because**: Higher cost, added complexity (stale chain handling), and the history is trapped in OpenAI's system. If we switch to Claude/Anthropic later, we lose all stored conversations.

### 3. Conversation Summarization

**Approach**: Periodically summarize older messages into a condensed context block. Send summary + last N messages.

| Pro | Con |
|-----|-----|
| Very token-efficient | Requires an extra API call to generate summary |
| Captures key themes | Summary may lose nuance or specific details |
| Works across long sessions | Adds latency to message processing |

**Viable future enhancement**: Could be combined with semantic retrieval for extremely long sessions (50+ messages). Not needed for Phase 1.

### 4. Full Anthropic/Claude Migration

**Approach**: Switch from OpenAI to Claude API with explicit prompt caching.

| Pro | Con |
|-----|-----|
| Prompt caching (90% discount on cached system prompt) | Migration effort |
| Potentially cheaper per-message | No built-in vector stores (use Supabase pgvector) |
| No `store: true` equivalent needed | Different tool calling format |
| Explicit cache control | |

**Viable future option**: The semantic memory architecture is model-agnostic — it works identically with Claude. This ADR's design intentionally avoids OpenAI-specific features to keep migration paths open.

### 5. Use Existing `user_knowledge_chunks` + pgvector (This Decision)

**Approach**: Embed chat messages, store vectors in Supabase, retrieve via cosine similarity.

| Pro | Con |
|-----|-----|
| pgvector already enabled in Supabase | One embedding call per message ($0.00002 with text-embedding-3-small) |
| `match_user_documents` is the template | Requires new table/column + RPC function |
| Same cost as sequential but better context | Slightly more complex than raw truncation |
| Model-agnostic — works with any LLM | |
| Session-scoped today, cross-session later | |

**Selected** as the best balance of cost, quality, and architectural simplicity.

---

## Implementation Plan

### Database Changes

```sql
-- Option A: Add embedding column to existing chat_messages table
ALTER TABLE chat_messages ADD COLUMN embedding vector(1536);

-- Option B: Separate table (if chat_messages is already wide)
CREATE TABLE chat_message_embeddings (
  message_id UUID PRIMARY KEY REFERENCES chat_messages(id),
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Similarity search function (modeled on match_user_documents)
CREATE FUNCTION match_chat_history(
  query_embedding vector(1536),
  match_session_id UUID,
  match_count INT DEFAULT 3
) RETURNS TABLE (
  id UUID,
  role TEXT,
  content TEXT,
  similarity FLOAT
) AS $$
  SELECT id, role, content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM chat_messages
  WHERE session_id = match_session_id
    AND embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql;
```

### Edge Function Changes

1. After saving assistant message: generate embedding via `text-embedding-3-small` ($0.02/1M tokens — 5x cheaper than ada-002), store in `chat_messages.embedding`
2. Before building input: call `match_chat_history(current_embedding, session_id, 3)`
3. Build hybrid context: `[...semantic_results, ...last_2_messages, current_message]`
4. Deduplicate by message ID

### Client Changes

- Ensure `chat_history` always includes recent messages (already done)
- No UX changes required for Phase 1

---

## Cost Analysis

### Per-Message Comparison

*Updated March 2026 with current model pricing. Conversation model assumes GPT-5 Mini ($0.25/$2.00) per [Beta Cost Projection](../cost-analysis/BETA-COST-PROJECTION.md) Strategy C. Embeddings assume text-embedding-3-small ($0.02/1M).*

| Approach | Embedding | Vector Search | Main LLM Call | Tool Submit | Storage | **Total** |
|----------|-----------|--------------|---------------|-------------|---------|-----------|
| Original (store: true + GPT-4.1 chaining) | $0.0001 (wasted) | $0.001 | $0.03-0.08 | $0.01-0.03 | $0.50/1M tokens | **$0.04-0.12** |
| Current (store: false, GPT-4.1, last 5) | $0 | $0 | $0.02-0.05 | $0 | $0 | **$0.02-0.05** |
| **Semantic hybrid + GPT-5 Mini (planned)** | **$0.00002** | **$0** (pgvector) | **$0.002-0.006** | **$0** | **$0** | **$0.002-0.006** |

With the model swap to GPT-5 Mini, the semantic hybrid approach brings per-message cost down to $0.002-0.006 — a 10-20x reduction from the original architecture while providing dramatically better context quality.

### At Scale (1,000 messages/day)

| Approach | Daily Cost | Monthly Cost |
|----------|-----------|-------------|
| Original (GPT-4.1 + store: true) | $40-120 | $1,200-3,600 |
| Current (GPT-4.1 + truncated) | $20-50 | $600-1,500 |
| **Semantic hybrid + GPT-5 Mini** | **$2-6** | **$60-180** |

Same context quality as the semantic approach with GPT-4.1, but 10x cheaper due to model swap.

---

## Consequences

### Positive

- Trevor maintains relevant context across long sessions without cost increase
- Non-linear brand-building conversations work naturally (values discussed early remain accessible)
- Architecture is model-agnostic — works with OpenAI, Claude, or any LLM
- pgvector infrastructure is already provisioned in Supabase
- Opens path to cross-session memory in Phase 2
- Eliminates vendor lock-in to OpenAI's `store` feature

### Negative

- One additional database write per message (embedding storage)
- Slight latency increase (~50-100ms for embedding generation + pgvector query)
- Embedding quality depends on text-embedding-3-small's representation of conversational content (upgrade from ada-002 for 5x cost reduction with comparable quality)
- Session-scoped search won't find relevant context from prior sessions (Phase 1 limitation)

### Risks

- **Embedding drift**: If we switch embedding models later, existing vectors become incompatible. Mitigation: store model version alongside embeddings.
- **Relevance noise**: Semantic search may retrieve topically similar but contextually irrelevant messages. Mitigation: filter by recency (e.g., only last 50 messages) and use similarity threshold (> 0.75).

---

## References

- [Supabase pgvector docs](https://supabase.com/docs/guides/ai/vector-columns)
- [OpenAI Embeddings pricing](https://openai.com/pricing) — text-embedding-3-small: $0.02/1M tokens (recommended), ada-002: $0.10/1M tokens (current)
- [OpenAI API Pricing March 2026](https://pecollective.com/tools/openai-api-pricing/) — GPT-5 Mini: $0.25/$2.00, GPT-5: $1.25/$10.00
- [Beta Cost Projection](../cost-analysis/BETA-COST-PROJECTION.md) — Model swap strategy and 200-user cost analysis
- [AI Cost Analysis](../cost-analysis/AI-COST-ANALYSIS.md) — Complete API call inventory and optimization roadmap
- Existing `match_user_documents` RPC function in migration `20251108065320`
- Cost incident analysis: March 26-27, 2026

---

**Last Updated**: 2026-03-27 (updated with GPT-5 series pricing and text-embedding-3-small recommendation)

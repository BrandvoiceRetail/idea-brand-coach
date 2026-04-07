# ADR: Embeddings Strategy Post-Claude Migration

**Status:** Proposed  
**Date:** 2026-04-07  
**Decision Makers:** Matthew Kerns  
**Context:** After migrating LLM inference from OpenAI to Anthropic Claude, the embeddings layer still uses OpenAI ada-002. This ADR evaluates whether to migrate embeddings, and to what.

---

## 1. Context & Current State

### What Changed in the Claude Migration

The OpenAI-to-Claude migration (Phases 1-3) moved all **LLM inference** off OpenAI:
- Primary consultant: GPT-4.1 → Claude Sonnet 4 (SSE streaming)
- 8 secondary functions: GPT-4o-mini → Claude Haiku 4.5
- Vector storage: OpenAI Vector Stores → pgvector (Supabase-native)

**What was NOT changed:** Embeddings generation. All 7 edge functions that generate embeddings still call OpenAI's `text-embedding-ada-002` model via `OPENAI_API_KEY`.

### Where Embeddings Are Generated

| Function | What It Embeds |
|----------|---------------|
| `_shared/embeddings.ts` | Shared utility (ada-002) used by 4 functions below |
| `sync-diagnostic-to-embeddings` | Diagnostic submission scores → 6 context chunks |
| `sync-diagnostic-to-user-kb` | Diagnostic data → knowledge base chunks |
| `upload-document-to-vector-store` | Uploaded documents → batch-embedded chunks |
| `sync-to-openai-vector-store` | Knowledge base entries → pgvector sync |
| `idea-framework-consultant-claude/context.ts` | Query embeddings for RAG retrieval (duplicated code) |
| `brand-copy-generator` | Query embeddings for copy context (duplicated code) |
| `generate-brand-strategy-section/context.ts` | Query embeddings for strategy sections (duplicated code) |

### Where Embeddings Are Consumed

All consumption is via **pgvector RPC functions** (similarity search):
- `match_document_chunks` — primary RAG search (used by consultant, strategy generation)
- `match_user_knowledge` — knowledge base entry search
- `match_user_documents` — legacy document search (fallback)

One exception: `generate-brand-strategy-section/skills.ts` still uses **OpenAI's Vector Store search API** directly for IDEA framework skills retrieval.

### Is Anything Broken?

**No.** All embeddings paths are functional. The `OPENAI_API_KEY` remains set in Supabase and ada-002 calls work correctly. The AI consultant responds with relevant context, brand strategy documents generate with quality content, and uploaded documents are searchable.

### Why Does This Matter?

It matters for three reasons:
1. **Vendor dependency**: `OPENAI_API_KEY` is still required solely for embedding generation
2. **Quality**: ada-002 (2022) is outperformed by every modern embedding model
3. **Code duplication**: 4 edge functions have their own copy of `generateEmbedding()` instead of using the shared utility

---

## 2. Options Evaluated

### Option A: Keep OpenAI ada-002 (Do Nothing)

**Pros:**
- Zero risk, zero effort, already working
- Negligible cost (~$0.05-$5/month at current scale)
- No re-embedding required

**Cons:**
- Maintains OpenAI API key dependency
- Lowest quality among all options (MTEB ~61.0)
- Fixed 1536 dimensions (larger vectors, more storage)
- 8K token context limit per embedding

### Option B: Upgrade to OpenAI text-embedding-3-small

**Pros:**
- Drop-in replacement (same API, same key)
- Better quality (MTEB ~62.3) at 5x lower cost ($0.02/MTok)
- Supports Matryoshka dimensions (256-1536)
- No vendor change needed

**Cons:**
- Still requires OpenAI dependency
- Requires re-embedding if changing dimensions
- Modest quality improvement

### Option C: Migrate to Voyage AI voyage-3.5 (Anthropic Recommended)

**Pros:**
- Anthropic's officially recommended embeddings partner
- Significantly better quality (MTEB ~66 vs ~61)
- Lower cost ($0.06/MTok vs $0.10) + 200M free tokens
- 32K context window (vs 8K)
- Matryoshka dimensions (256-2048)
- Aligns with Claude-based LLM stack

**Cons:**
- Requires re-embedding all existing content (dimension change 1536→1024)
- New vendor relationship + API key (`VOYAGE_API_KEY`)
- MongoDB acquired Voyage AI (Feb 2025) — long-term availability uncertain
- pgvector column type must be altered

### Option D: Supabase Built-in gte-small

**Pros:**
- Zero external API calls (runs in Edge Runtime)
- No API key needed
- Free

**Cons:**
- 384 dimensions, 512 token max input, English only
- Lower quality than ada-002 (MTEB ~61.36)
- Not suitable for production RAG

### Option E: Google Gemini Embedding 001

**Pros:**
- Highest MTEB score (~68.3)
- Currently free (1500 RPM limit)
- 3072 dimensions with Matryoshka support

**Cons:**
- Free tier may change
- New vendor dependency (Google Cloud)
- Overkill for current scale

---

## 3. Comparison Matrix

| Criteria | ada-002 (current) | embed-3-small | Voyage 3.5 | gte-small | Gemini |
|----------|-------------------|---------------|------------|-----------|--------|
| Quality (MTEB) | ~61.0 | ~62.3 | ~66.0 | ~61.4 | ~68.3 |
| Cost/MTok | $0.10 | $0.02 | $0.06 | Free | Free* |
| Dimensions | 1536 (fixed) | 256-1536 | 256-2048 | 384 | 256-3072 |
| Context window | 8K | 8K | 32K | 512 | 8K |
| Re-embedding needed | No | Optional | Yes | Yes | Yes |
| Vendor alignment | OpenAI | OpenAI | Anthropic | Supabase | Google |
| Migration effort | None | Low | Medium | Medium | Medium |

---

## 4. What Features Depend on Embedding Quality?

| Feature | Impact of Poor Embeddings | Current Quality |
|---------|--------------------------|-----------------|
| AI Consultant RAG | Less relevant context → generic advice | Working well |
| Brand Strategy Docs | Weaker section-specific context retrieval | Working well |
| Document Search | Uploaded docs less discoverable | Working well |
| Copy Generator | Less context-aware copy output | Working well |
| Diagnostic Context | Personalized coaching less targeted | Working well |

**Key insight:** Users report quality is good with ada-002. The system works. Any migration is an improvement, not a fix.

---

## 5. Recommendation

### Phase 4A (Now): Cleanup Only — No Embedding Migration

Do the non-breaking Phase 4 cleanup work immediately:
1. Consolidate 4 duplicated `generateEmbedding()` functions into `_shared/embeddings.ts`
2. Drop OpenAI-specific DB columns (`openai_response_id`, `openai_file_id`, etc.)
3. Drop `user_vector_stores` table
4. Delete 9 replaced edge functions
5. Clean up frontend types/services
6. Delete old scripts

**This eliminates OpenAI from everything except the single `_shared/embeddings.ts` file.**

### Phase 4B (Later): Evaluate Embedding Migration When Needed

Defer the embedding provider migration until one of these triggers:
- **Scale trigger**: Embedding costs become material (>$50/month)
- **Quality trigger**: Users report poor RAG retrieval or document search results
- **Vendor trigger**: OpenAI deprecates ada-002 or changes pricing significantly
- **Feature trigger**: Need for 32K context chunks or multilingual embeddings

When that trigger occurs, the migration is straightforward because:
- `_shared/embeddings.ts` is the single point of change (after Phase 4A consolidation)
- The re-embedding script and migration SQL are already drafted in `PHASE4-CLEANUP-PLAN.md`
- Voyage AI voyage-3.5 is the likely target (Anthropic-aligned, best quality/price)

### Why Not Migrate Now?

1. **"If it ain't broke, don't fix it"** — users report good quality
2. The dimension change (1536→1024) requires re-embedding all content and altering DB columns
3. Risk of RAG quality regression during migration with no user-facing benefit
4. Engineering time is better spent on P0 features than provider optimization
5. At current scale, embedding costs are negligible regardless of provider

---

## 6. Action Items

### Immediate (Phase 4A)

- [ ] Consolidate duplicated `generateEmbedding()` into `_shared/embeddings.ts` in:
  - `idea-framework-consultant-claude/context.ts`
  - `brand-copy-generator/index.ts`
  - `generate-brand-strategy-section/context.ts`
  - `idea-framework-consultant/rag.ts` (delete with old function)
- [ ] Migrate `generate-brand-strategy-section/skills.ts` from OpenAI VS search to pgvector
- [ ] Drop OpenAI DB columns and `user_vector_stores` table
- [ ] Delete 9 replaced edge functions
- [ ] Client-side cleanup (types, services, components)
- [ ] Delete old scripts, remove `openai` npm package dependency

### Future (Phase 4B — When Triggered)

- [ ] Set `VOYAGE_API_KEY` in Supabase secrets
- [ ] Update `_shared/embeddings.ts` to call Voyage AI API
- [ ] Run re-embedding script for all existing content
- [ ] Alter pgvector columns from `vector(1536)` to `vector(1024)`
- [ ] Update RPC functions with new dimensions
- [ ] Remove `OPENAI_API_KEY` from Supabase secrets

---

## 7. References

- [Anthropic Embeddings Docs](https://platform.claude.com/docs/en/build-with-claude/embeddings) — "Anthropic does not offer its own embedding model"
- [Voyage AI Pricing](https://docs.voyageai.com/docs/pricing) — voyage-3.5 at $0.06/MTok + 200M free
- [OpenAI Embeddings Pricing](https://platform.openai.com/docs/pricing/) — ada-002 at $0.10/MTok
- [MTEB Leaderboard (March 2026)](https://awesomeagents.ai/leaderboards/embedding-model-leaderboard-mteb-march-2026/)
- [MongoDB Acquires Voyage AI](https://www.prnewswire.com/news-releases/mongodb-announces-acquisition-of-voyage-ai-302382979.html)
- [Supabase AI Models in Edge Functions](https://supabase.com/docs/guides/functions/ai-models)
- [Phase 4 Cleanup Plan](../PHASE4-CLEANUP-PLAN.md)
- [ADR: Claude Agent SDK Migration](./ADR-CLAUDE-AGENT-SDK-MIGRATION.md)

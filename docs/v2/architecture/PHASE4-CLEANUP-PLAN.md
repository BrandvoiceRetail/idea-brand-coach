# Phase 4: Embeddings Migration + OpenAI Dependency Cleanup Plan

> Research and planning document. Do NOT implement until Phases 2 and 3 are verified.

Created: 2026-04-06
Status: Planning

---

## Table of Contents

1. [Complete OpenAI Dependency Inventory](#1-complete-openai-dependency-inventory)
2. [Voyage AI Embeddings Migration Plan](#2-voyage-ai-embeddings-migration-plan)
3. [Database Column Cleanup](#3-database-column-cleanup)
4. [Edge Function Cleanup](#4-edge-function-cleanup)
5. [Client-Side Cleanup](#5-client-side-cleanup)
6. [Scripts and Tooling Cleanup](#6-scripts-and-tooling-cleanup)
7. [Documentation Updates](#7-documentation-updates)
8. [Order of Operations](#8-order-of-operations)
9. [Effort Estimates](#9-effort-estimates)

---

## 1. Complete OpenAI Dependency Inventory

### 1.1 Edge Functions — LLM Inference (Chat/Completions)

| File | OpenAI Usage | Model | Phase Addressing |
|------|-------------|-------|-----------------|
| `supabase/functions/idea-framework-consultant/index.ts` | Chat completions, file_search (Responses API), embeddings | gpt-4o-mini, gpt-4.1, ada-002 | **Phase 1** (replaced by `idea-framework-consultant-claude`) |
| `supabase/functions/idea-framework-consultant-test/index.ts` | Chat completions | gpt-4.1-2025-04-14 | **Phase 1** (test variant, delete with original) |
| `supabase/functions/generate-session-title/index.ts` | Chat completions | gpt-4o-mini | **Phase 3** (migrate to Haiku) |
| `supabase/functions/ai-insight-guidance/index.ts` | Chat completions | gpt-4o-mini | **Phase 3** (migrate to Haiku) |
| `supabase/functions/competitive-analysis-orchestrator/index.ts` | Chat completions | gpt-4o | **Phase 3** (migrate to Haiku or Sonnet) |
| `supabase/functions/brand-copy-generator/index.ts` | Chat completions + embeddings | gpt-4-turbo-preview, ada-002 | **Phase 3** (LLM) + **Phase 4** (embeddings) |
| `supabase/functions/brand-copy-generator-test/index.ts` | Responses API, embeddings | gpt-4o-mini, ada-002 | **Phase 3** (test variant, delete with original) |
| `supabase/functions/generate-brand-strategy-document/index.ts` | Chat completions + embeddings | gpt-4o-mini, gpt-4o, ada-002 | **Phase 3** (LLM) + **Phase 4** (embeddings) |
| `supabase/functions/generate-brand-strategy-document-v2/index.ts` | Chat completions + embeddings + VS search | gpt-4o-mini, ada-002 | **Phase 3** (LLM) + **Phase 4** (embeddings) |
| `supabase/functions/generate-brand-strategy-section/index.ts` | Chat completions + embeddings + VS search | gpt-4o-mini, ada-002 | **Phase 3** (LLM) + **Phase 4** (embeddings) |
| `supabase/functions/extract-fields-from-document/index.ts` | Responses API (file_search) | gpt-4o-mini | **Phase 2** (migrate to pgvector search) |
| `supabase/functions/file-conversation-insights/index.ts` | Files API + VS API | N/A (file ops only) | **Phase 2** (migrate to pgvector) |

### 1.2 Edge Functions — OpenAI Vector Store Operations

| File | OpenAI Usage | Phase Addressing |
|------|-------------|-----------------|
| `supabase/functions/sync-to-openai-vector-store/index.ts` | Files API upload, VS file add/delete | **Phase 2** (replaced by pgvector sync) |
| `supabase/functions/upload-document-to-vector-store/index.ts` | Files API, VS create, VS file add | **Phase 2** (replaced by pgvector indexing) |
| `supabase/functions/create-user-kb/index.ts` | VS create (5 stores per user) | **Phase 2** (no longer needed with pgvector) |
| `supabase/functions/ensure-user-kb/index.ts` | VS create (5 stores per user) | **Phase 2** (no longer needed with pgvector) |
| `supabase/functions/list-vector-stores/index.ts` | VS list | **Phase 4** (delete — admin/debug tool) |
| `supabase/functions/sync-diagnostic-to-user-kb/index.ts` | Files API upload, VS file add | **Phase 2** (replaced by pgvector sync) |

### 1.3 Edge Functions — Embeddings Only (ada-002)

| File | Lines | Phase Addressing |
|------|-------|-----------------|
| `supabase/functions/idea-framework-consultant-claude/context.ts` | L14, L25-34 | **Phase 4** (swap to Voyage AI) |
| `supabase/functions/sync-diagnostic-to-embeddings/index.ts` | L148, L177-187 | **Phase 4** (swap to Voyage AI) |
| `supabase/functions/brand-copy-generator/index.ts` | L52-60 | **Phase 4** (swap to Voyage AI) |
| `supabase/functions/generate-brand-strategy-document/index.ts` | L140-147 | **Phase 4** (swap to Voyage AI) |
| `supabase/functions/generate-brand-strategy-document-v2/index.ts` | L702-709 | **Phase 4** (swap to Voyage AI) |
| `supabase/functions/generate-brand-strategy-section/index.ts` | L722 | **Phase 4** (swap to Voyage AI) |
| `supabase/functions/brand-copy-generator-test/index.ts` | L126-134 | **Phase 4** (delete with original) |

### 1.4 Edge Functions — Already Migrated to Anthropic (No OpenAI)

| File | Provider | Model |
|------|----------|-------|
| `supabase/functions/idea-framework-consultant-claude/index.ts` | Anthropic | claude-sonnet-4-20250514 |
| `supabase/functions/brand-ai-assistant/index.ts` | Anthropic | claude-haiku-4-5-20251001 |
| `supabase/functions/buyer-intent-analyzer/index.ts` | Anthropic | claude-haiku-4-5-20251001 |
| `supabase/functions/contextual-help/index.ts` | Anthropic | (Anthropic API) |

### 1.5 Edge Functions — No AI Provider (Pure Logic / External APIs)

| File | What It Does |
|------|-------------|
| `supabase/functions/document-processor/index.ts` | Supabase storage operations |
| `supabase/functions/competitor-discovery/index.ts` | Google Search API |
| `supabase/functions/review-scraper/index.ts` | Firecrawl API |
| `supabase/functions/review-scraper-deep/index.ts` | Firecrawl API |
| `supabase/functions/generate-brand-strategy-pdf/index.ts` | PDF generation (no AI) |
| `supabase/functions/generate-competitor-analysis-pdf/index.ts` | PDF generation (no AI) |
| `supabase/functions/save-beta-comment/index.ts` | DB write |
| `supabase/functions/save-beta-feedback/index.ts` | DB write |
| `supabase/functions/save-beta-tester/index.ts` | DB write |
| `supabase/functions/send-framework-email/index.ts` | Email sending |

### 1.6 Frontend Code (src/)

| File | Reference | What It Does | Phase Addressing |
|------|-----------|-------------|-----------------|
| `src/integrations/supabase/types.ts` | `openai_response_id` (L271, 285, 299) | DB type for chat_sessions | **Phase 4** (rename or deprecate) |
| `src/integrations/supabase/types.ts` | `openai_file_id` (L467, 486, 505, 565, 585, 605) | DB type for uploaded_documents + user_knowledge_base | **Phase 4** (deprecate) |
| `src/integrations/supabase/types.ts` | `openai_synced_at` (L566, 586, 606) | DB type for user_knowledge_base | **Phase 4** (deprecate) |
| `src/types/chat.ts` | `openai_response_id` (L175, 227) | ChatSession + ChatSessionUpdate interfaces | **Phase 4** (remove) |
| `src/types/document.ts` | `openai_file_id` (L14) | UploadedDocument interface | **Phase 4** (remove) |
| `src/services/chat/ChatSessionService.ts` | `openai_response_id` (L149, 213) | Session update + DB mapping | **Phase 4** (remove) |
| `src/services/chat/ChatEdgeFunctionService.ts` | `openai_file_id` (L68, 76) | Document status check | **Phase 4** (update to check pgvector_indexed) |
| `src/components/DocumentUpload.tsx` | "OpenAI" in privacy text (L188) | User-facing privacy notice | **Phase 4** (update copy) |
| `src/hooks/useFieldExtractionOrchestrator.ts` | Comment referencing OpenAI (L105) | Code comment | **Phase 4** (update comment) |
| `src/lib/knowledge-base/supabase-sync-service.ts` | `triggerOpenAISync`, `sync-to-openai-vector-store` (L171-211) | Triggers VS sync after field save | **Phase 2/4** (remove or replace with pgvector sync) |
| `src/lib/chapterContentRAG.ts` | "OpenAI vector store" comments, SYSTEM_VECTOR_STORE_ID (L17, 23, 58) | Chapter content retrieval via old edge function | **Phase 2** (update to use pgvector-based function) |

### 1.7 Scripts

| File | OpenAI Usage | Phase Addressing |
|------|-------------|-----------------|
| `scripts/upload-system-kb.ts` | OpenAI SDK (`import OpenAI from 'openai'`), VS upload | **Phase 4** (delete or rewrite for pgvector) |
| `scripts/test-system-kb.ts` | OpenAI SDK, gpt-4o-mini, VS search | **Phase 4** (delete or rewrite) |
| `scripts/upload-skills-to-vector-store.ts` | OpenAI API, VS create/upload | **Phase 4** (delete or rewrite for pgvector) |
| `scripts/check-field-sync-status.ts` | References `openai_file_id`, `openai_synced_at` | **Phase 4** (update to check pgvector status) |
| `scripts/fix-supabase-406.sql` | `vector(1536)` reference | **Phase 4** (update dimension) |

### 1.8 Database Migrations

| File | OpenAI Reference | Phase Addressing |
|------|-----------------|-----------------|
| `supabase/migrations/20241123_user_knowledge_base.sql` | `vector(1536)` ada-002 dimension, `match_user_knowledge` function | **Phase 4** (alter column + update functions) |
| `supabase/migrations/20241124_openai_sync_columns.sql` | `openai_file_id`, `openai_synced_at` columns | **Phase 4** (drop columns) |
| `supabase/migrations/20251115000000_user_vector_stores.sql` | Entire table tracks OpenAI VS IDs | **Phase 4** (drop table) |
| `supabase/migrations/20251227150731_add_openai_file_id_to_documents.sql` | `openai_file_id` on uploaded_documents | **Phase 4** (drop column) |
| `supabase/migrations/20260321100000_add_openai_response_id.sql` | `openai_response_id` on chat_sessions | **Phase 4** (drop column) |
| `supabase/migrations/20260406000000_pgvector_rag_migration.sql` | `vector(1536)` in `match_document_chunks` | **Phase 4** (update dimension after re-embedding) |
| `supabase/migrations/20251108065320_*.sql` | `vector(1536)` in user_knowledge_chunks | **Phase 4** (alter column) |

### 1.9 Package Dependencies

| Package | File | Phase Addressing |
|---------|------|-----------------|
| `openai` (^6.15.0) | `package.json` L66 | **Phase 4** (remove after scripts migrated) |

### 1.10 Documentation with OpenAI References

| File | Nature of References |
|------|---------------------|
| `README.md` | Architecture description, env vars, integration docs |
| `docs/TECHNICAL_ARCHITECTURE.md` | vector(1536), data flow diagrams |
| `docs/P0_FEATURES.md` | vector(1536), schema examples |
| `docs/P0_IMPLEMENTATION_PLAN.md` | vector(1536) references |
| `docs/USER_KNOWLEDGE_BASE_DESIGN.md` | vector(1536), ada-002 references |
| `docs/USER_KNOWLEDGE_BASE_MIGRATION_PLAN.md` | vector(1536) references |
| `docs/DEPLOY_KNOWLEDGE_BASE_SCHEMA.md` | vector(1536) references |
| `docs/costs/AI_FEATURES_COST_ANALYSIS.md` | GPT-4 pricing, ada-002 costs |
| `docs/MVP-PLAN-11-23-25/*.md` | OpenAI VS architecture, vector_store_ids |
| `docs/MVP-PLAN-11-13-2025/*.md` | OpenAI VS architecture, vector_store_ids |

---

## 2. Voyage AI Embeddings Migration Plan

### 2.1 Current State: OpenAI ada-002

- **Model:** text-embedding-ada-002
- **Dimensions:** 1536
- **Cost:** ~$0.10 per 1M tokens
- **API endpoint:** `https://api.openai.com/v1/embeddings`
- **Used in:** 7 edge functions + 3 scripts + pgvector columns

### 2.2 Target State: Voyage AI voyage-3

- **Model:** voyage-3 (recommended by Anthropic as partner model)
- **Dimensions:** 1024 (default), also supports 512 and 256
- **Cost:** Free tier of 200M tokens, then ~$0.06 per 1M tokens (cheaper than ada-002)
- **API endpoint:** `POST https://api.voyageai.com/v1/embeddings`
- **Auth:** `Authorization: Bearer <VOYAGE_API_KEY>` header
- **Recommended:** Use `input_type: "document"` for indexing, `input_type: "query"` for search queries

### 2.3 API Format Comparison

**Current (ada-002):**
```json
POST https://api.openai.com/v1/embeddings
{
  "model": "text-embedding-ada-002",
  "input": "text to embed"
}
// Response: { "data": [{ "embedding": [0.1, 0.2, ...] }] }
```

**Target (Voyage AI):**
```json
POST https://api.voyageai.com/v1/embeddings
{
  "model": "voyage-3",
  "input": "text to embed",
  "input_type": "document"
}
// Response: { "data": [{ "embedding": [0.1, 0.2, ...] }] }
```

The response format is nearly identical. The migration is primarily:
1. Change URL from `api.openai.com` to `api.voyageai.com`
2. Change model from `text-embedding-ada-002` to `voyage-3`
3. Change auth header key name from `OPENAI_API_KEY` to `VOYAGE_API_KEY`
4. Add `input_type` parameter (`"document"` for indexing, `"query"` for search)
5. Handle dimension change: 1536 -> 1024

### 2.4 Dimension Change: Critical Migration Requirement

**The dimension change from 1536 to 1024 is a breaking change.** Ada-002 embeddings (1536-dim) and Voyage-3 embeddings (1024-dim) are NOT compatible. You cannot do cosine similarity between vectors of different dimensions.

**This means:**
1. ALL existing embeddings in the database must be re-generated
2. pgvector column types must be altered from `vector(1536)` to `vector(1024)`
3. All RPC functions that accept `vector(1536)` parameters must be updated
4. IVFFlat indexes must be rebuilt after the column change

### 2.5 Re-Embedding Strategy

**Tables with embeddings:**

| Table | Column | Est. Rows | Source |
|-------|--------|-----------|--------|
| `user_knowledge_base` | `embedding` | ~500-2000 per active user | Field values from brand profiles |
| `user_knowledge_chunks` | `embedding` | ~1000-5000 per active user | Diagnostic chunks, document chunks |

**Migration steps:**

1. **Add new column** (non-breaking): `ALTER TABLE ... ADD COLUMN embedding_v3 vector(1024);`
2. **Create re-embedding edge function**: Batch process all rows, generating new Voyage-3 embeddings
3. **Backfill in batches**: Process 50-100 rows per invocation to stay within edge function timeouts
4. **Validate**: Compare old and new semantic search results for quality
5. **Swap columns**: Drop old `embedding` column, rename `embedding_v3` to `embedding`
6. **Update RPC functions**: Change `vector(1536)` to `vector(1024)` in all function signatures
7. **Rebuild indexes**: `REINDEX INDEX idx_user_knowledge_embedding;`

**Alternative (simpler, riskier):**
1. Take the system offline briefly (maintenance window)
2. Truncate all embedding columns (set to NULL)
3. Alter column type to `vector(1024)`
4. Re-embed all content via batch edge function
5. Bring system back online

The first approach (dual-column) is safer as it allows zero-downtime migration and validation before cutover.

### 2.6 Shared Embedding Utility

Create a shared Deno module that all edge functions import:

```
supabase/functions/_shared/embeddings.ts
```

```typescript
const VOYAGE_API_KEY = Deno.env.get('VOYAGE_API_KEY');
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3';

export async function generateEmbedding(
  text: string,
  inputType: 'document' | 'query' = 'document'
): Promise<number[]> {
  if (!VOYAGE_API_KEY) {
    console.warn('[Embeddings] No VOYAGE_API_KEY - skipping');
    return [];
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: text,
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage AI embedding failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

export async function generateEmbeddings(
  texts: string[],
  inputType: 'document' | 'query' = 'document'
): Promise<number[][]> {
  // Voyage supports batch embedding natively
  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage AI batch embedding failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}
```

### 2.7 Supabase Secret

Add new secret:
```
VOYAGE_API_KEY=<voyage-ai-api-key>
```

This can coexist with `OPENAI_API_KEY` during the transition period.

---

## 3. Database Column Cleanup

### 3.1 Columns to Drop

| Table | Column | Why |
|-------|--------|-----|
| `chat_sessions` | `openai_response_id` | Was used for OpenAI Responses API conversation chaining. Claude uses explicit chat_history instead. |
| `user_knowledge_base` | `openai_file_id` | Tracked OpenAI Files API file ID for VS sync. No longer needed with pgvector. |
| `user_knowledge_base` | `openai_synced_at` | Tracked when entry was synced to OpenAI VS. Replaced by `pgvector_synced_at` (added in Phase 2 migration). |
| `uploaded_documents` | `openai_file_id` | Tracked OpenAI file ID for uploaded docs. Replaced by `pgvector_indexed` flag (added in Phase 2 migration). |

### 3.2 Tables to Drop

| Table | Why |
|-------|-----|
| `user_vector_stores` | Tracked 5 OpenAI vector store IDs per user (diagnostic, avatar, canvas, capture, core). Entirely replaced by pgvector categories. |

### 3.3 Indexes to Drop

| Index | Table | Why |
|-------|-------|-----|
| `idx_user_kb_needs_openai_sync` | `user_knowledge_base` | Filtered on `openai_file_id IS NULL`. No longer relevant. |
| `idx_uploaded_documents_openai_file_id` | `uploaded_documents` | Index on `openai_file_id`. Column being dropped. |

### 3.4 Columns to Alter (Embedding Dimensions)

| Table | Column | Current | Target |
|-------|--------|---------|--------|
| `user_knowledge_base` | `embedding` | `vector(1536)` | `vector(1024)` |
| `user_knowledge_chunks` | `embedding` | `vector(1536)` | `vector(1024)` |

### 3.5 Functions to Update

| Function | Parameter Change |
|----------|-----------------|
| `match_user_knowledge` | `query_embedding vector(1536)` -> `vector(1024)` |
| `match_user_documents` | `query_embedding vector(1536)` -> `vector(1024)` |
| `match_document_chunks` | `query_embedding vector(1536)` -> `vector(1024)` |

### 3.6 Cleanup Migration SQL (Draft)

```sql
-- Phase 4 cleanup migration: Remove OpenAI-specific columns and update dimensions
-- IMPORTANT: Only run AFTER all embeddings are re-generated with Voyage AI

-- ─── Drop OpenAI tracking columns ─────────────────────────────────────────
ALTER TABLE public.chat_sessions DROP COLUMN IF EXISTS openai_response_id;
ALTER TABLE public.user_knowledge_base DROP COLUMN IF EXISTS openai_file_id;
ALTER TABLE public.user_knowledge_base DROP COLUMN IF EXISTS openai_synced_at;
ALTER TABLE public.uploaded_documents DROP COLUMN IF EXISTS openai_file_id;

-- ─── Drop OpenAI vector stores table ──────────────────────────────────────
DROP TABLE IF EXISTS public.user_vector_stores CASCADE;

-- ─── Drop orphaned indexes ────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_user_kb_needs_openai_sync;
DROP INDEX IF EXISTS idx_uploaded_documents_openai_file_id;

-- ─── Update embedding dimensions (1536 -> 1024) ──────────────────────────
-- NOTE: This requires all embeddings to already be re-generated at 1024 dims.
-- Null out any stale 1536-dim embeddings first.
UPDATE public.user_knowledge_base SET embedding = NULL
WHERE embedding IS NOT NULL AND array_length(embedding::real[], 1) = 1536;

ALTER TABLE public.user_knowledge_base
ALTER COLUMN embedding TYPE vector(1024);

UPDATE public.user_knowledge_chunks SET embedding = NULL
WHERE embedding IS NOT NULL AND array_length(embedding::real[], 1) = 1536;

ALTER TABLE public.user_knowledge_chunks
ALTER COLUMN embedding TYPE vector(1024);

-- ─── Update RPC functions ─────────────────────────────────────────────────
-- (Recreate with vector(1024) parameter types)
-- match_user_knowledge, match_user_documents, match_document_chunks
-- ... (full function bodies omitted for brevity — copy from existing, change 1536 to 1024)

-- ─── Rebuild indexes ──────────────────────────────────────────────────────
REINDEX INDEX idx_user_knowledge_embedding;
```

---

## 4. Edge Function Cleanup

### 4.1 Functions to Delete After Migration Verified

| Function | Reason | Replaced By |
|----------|--------|-------------|
| `idea-framework-consultant/` | Original OpenAI version | `idea-framework-consultant-claude/` |
| `idea-framework-consultant-test/` | Test variant of original | No longer needed |
| `brand-copy-generator-test/` | Test variant | `brand-copy-generator/` (after Phase 3 migration) |
| `sync-to-openai-vector-store/` | Syncs to OpenAI VS | pgvector sync (Phase 2) |
| `upload-document-to-vector-store/` | Uploads to OpenAI VS | pgvector indexing (Phase 2) |
| `create-user-kb/` | Creates OpenAI VS per user | Not needed with pgvector |
| `ensure-user-kb/` | Creates OpenAI VS per user | Not needed with pgvector |
| `list-vector-stores/` | Admin/debug for OpenAI VS | Not needed with pgvector |
| `sync-diagnostic-to-user-kb/` | Syncs diagnostic to OpenAI VS | Replaced by `sync-diagnostic-to-embeddings` |

### 4.2 Functions to Update (Swap Embeddings)

| Function | Change Needed |
|----------|--------------|
| `idea-framework-consultant-claude/context.ts` | Replace `generateEmbedding` with shared Voyage AI module |
| `sync-diagnostic-to-embeddings/index.ts` | Replace OpenAI embedding calls with Voyage AI |
| `brand-copy-generator/index.ts` | Replace `generateEmbedding` + LLM calls (Phase 3 covers LLM, Phase 4 covers embeddings) |
| `generate-brand-strategy-document/index.ts` | Replace embeddings + LLM calls |
| `generate-brand-strategy-document-v2/index.ts` | Replace embeddings + VS search + LLM calls |
| `generate-brand-strategy-section/index.ts` | Replace embeddings + VS search + LLM calls |

### 4.3 Functions Requiring No Changes

| Function | Status |
|----------|--------|
| `idea-framework-consultant-claude/index.ts` | Already Anthropic |
| `brand-ai-assistant/index.ts` | Already Anthropic (Haiku) |
| `buyer-intent-analyzer/index.ts` | Already Anthropic (Haiku) |
| `contextual-help/index.ts` | Already Anthropic |
| `document-processor/index.ts` | No AI provider |
| `competitor-discovery/index.ts` | Google Search only |
| `review-scraper/index.ts` | Firecrawl only |
| `review-scraper-deep/index.ts` | Firecrawl only |
| `generate-brand-strategy-pdf/index.ts` | No AI provider |
| `generate-competitor-analysis-pdf/index.ts` | No AI provider |
| `save-beta-*/index.ts` | DB writes only |
| `send-framework-email/index.ts` | Email only |

---

## 5. Client-Side Cleanup

### 5.1 Type Interface Changes

**`src/types/chat.ts`:**
- Remove `openai_response_id` from `ChatSession` interface (L174-175)
- Remove `openai_response_id` from `ChatSessionUpdate` interface (L226-227)

**`src/types/document.ts`:**
- Remove `openai_file_id` from `UploadedDocument` interface (L14)

**`src/integrations/supabase/types.ts`:**
- This is auto-generated from the database schema. After running the cleanup migration and regenerating types, the OpenAI columns will automatically disappear.

### 5.2 Service Changes

**`src/services/chat/ChatSessionService.ts`:**
- Remove `openai_response_id` from `updateSession` method (L149)
- Remove `openai_response_id` from `mapSessionFromDb` method (L213)

**`src/services/chat/ChatEdgeFunctionService.ts`:**
- Change `.select('id, openai_file_id')` to `.select('id, pgvector_indexed')` (L68)
- Update `hasOpenAIFileId` check to `hasPgvectorIndex` (L76)

**`src/lib/knowledge-base/supabase-sync-service.ts`:**
- Remove entire `triggerOpenAISync` method (L181-211)
- Remove the call to `triggerOpenAISync` in the sync method (L172-174)
- Optionally replace with a pgvector embedding sync trigger

**`src/lib/chapterContentRAG.ts`:**
- Remove `SYSTEM_VECTOR_STORE_ID` constant (L17)
- Update edge function invocation from `idea-framework-consultant` to `idea-framework-consultant-claude` (L59)
- Update comments referencing "OpenAI vector store" (L23, L58)

### 5.3 Component Changes

**`src/components/DocumentUpload.tsx`:**
- Update privacy notice text (L188): Replace "We use trusted service providers (like OpenAI and our cloud infrastructure)" with "We use trusted service providers (like Anthropic and our cloud infrastructure)" or similar

### 5.4 Comment Updates

**`src/hooks/useFieldExtractionOrchestrator.ts`:**
- Update comment at L105 from "from OpenAI tool calls" to "from Claude tool calls"

---

## 6. Scripts and Tooling Cleanup

### 6.1 Scripts to Delete

| Script | Reason |
|--------|--------|
| `scripts/upload-system-kb.ts` | Uploads to OpenAI VS. System KB now in pgvector. |
| `scripts/test-system-kb.ts` | Tests OpenAI VS search. No longer relevant. |
| `scripts/upload-skills-to-vector-store.ts` | Uploads skills to OpenAI VS. |

### 6.2 Scripts to Update

| Script | Changes Needed |
|--------|---------------|
| `scripts/check-field-sync-status.ts` | Replace `openai_file_id`/`openai_synced_at` checks with `pgvector_synced_at` checks |
| `scripts/fix-supabase-406.sql` | Update `vector(1536)` to `vector(1024)` |

### 6.3 New Scripts Needed

| Script | Purpose |
|--------|---------|
| `scripts/reembed-all-content.ts` | Batch re-embed all user_knowledge_base and user_knowledge_chunks entries using Voyage AI |
| `scripts/validate-embeddings.ts` | Compare semantic search quality before/after migration (sample queries, check result overlap) |

### 6.4 Package.json Cleanup

Remove `openai` dependency after all scripts are migrated:
```json
// Remove:
"openai": "^6.15.0"
```

---

## 7. Documentation Updates

### 7.1 Files to Update

| File | What to Change |
|------|---------------|
| `README.md` | Remove OpenAI from tech stack, add Anthropic + Voyage AI, update env vars, update architecture diagram |
| `docs/TECHNICAL_ARCHITECTURE.md` | Update embedding model, dimensions, data flow, remove OpenAI VS references |
| `docs/P0_FEATURES.md` | Update vector(1536) references to vector(1024) |
| `docs/P0_IMPLEMENTATION_PLAN.md` | Update vector dimension references |
| `docs/USER_KNOWLEDGE_BASE_DESIGN.md` | Update ada-002 -> voyage-3, 1536 -> 1024 |
| `docs/USER_KNOWLEDGE_BASE_MIGRATION_PLAN.md` | Update dimension references |
| `docs/DEPLOY_KNOWLEDGE_BASE_SCHEMA.md` | Update schema examples |
| `docs/costs/AI_FEATURES_COST_ANALYSIS.md` | Complete rewrite: Claude Sonnet/Haiku pricing, Voyage AI pricing, remove GPT-4 pricing |
| `CLAUDE.md` | Minor updates if any OpenAI-specific instructions remain |

### 7.2 Files to Archive (Historical — Do Not Update)

| Directory | Reason |
|-----------|--------|
| `docs/MVP-PLAN-11-13-2025/` | Historical planning docs, referenced OpenAI VS architecture |
| `docs/MVP-PLAN-11-23-25/` | Historical planning docs |

---

## 8. Order of Operations

Phase 4 work should proceed in this specific order, as each step depends on the previous:

### Step 1: Prerequisites (Verify Phases 2 and 3)
- [ ] Phase 2 (pgvector RAG) is deployed and verified in production
- [ ] Phase 3 (secondary functions to Haiku) is deployed and verified in production
- [ ] All edge functions are using `idea-framework-consultant-claude` (not the OpenAI original)
- [ ] No production traffic is flowing to old OpenAI edge functions

### Step 2: Add Voyage AI Secret + Shared Module
- [ ] Create `VOYAGE_API_KEY` Supabase secret
- [ ] Create shared `supabase/functions/_shared/embeddings.ts` module
- [ ] Estimated effort: **0.5 day**

### Step 3: Swap Embedding Generation in Edge Functions
- [ ] Update `idea-framework-consultant-claude/context.ts` to use Voyage AI
- [ ] Update `sync-diagnostic-to-embeddings/index.ts` to use Voyage AI
- [ ] Update remaining edge functions that generate embeddings (brand-copy-generator, generate-brand-strategy-*)
- [ ] Deploy updated functions
- [ ] **Critical:** At this point, new embeddings are Voyage-3 (1024-dim) but the DB columns are still vector(1536). This is OK temporarily because pgvector accepts vectors smaller than the declared dimension, padding with zeros. However, similarity search will be BROKEN for mixed-dimension data.
- [ ] Estimated effort: **1 day**

### Step 4: Re-Embed All Existing Content
- [ ] Create and run `scripts/reembed-all-content.ts`
- [ ] Process all rows in `user_knowledge_base` where `embedding IS NOT NULL`
- [ ] Process all rows in `user_knowledge_chunks` where `embedding IS NOT NULL`
- [ ] Validate with sample queries using `scripts/validate-embeddings.ts`
- [ ] Estimated effort: **1 day** (mostly waiting for batch processing)

### Step 5: Database Schema Migration
- [ ] Run cleanup migration: alter column types from `vector(1536)` to `vector(1024)`
- [ ] Update RPC functions (match_user_knowledge, match_document_chunks, etc.)
- [ ] Rebuild IVFFlat indexes
- [ ] Estimated effort: **0.5 day**

### Step 6: Client-Side Cleanup
- [ ] Update frontend types (ChatSession, UploadedDocument)
- [ ] Update services (ChatSessionService, ChatEdgeFunctionService)
- [ ] Remove `triggerOpenAISync` from supabase-sync-service.ts
- [ ] Update chapterContentRAG.ts
- [ ] Update DocumentUpload.tsx privacy text
- [ ] Regenerate Supabase types
- [ ] Estimated effort: **1 day**

### Step 7: Delete Old Edge Functions
- [ ] Delete `idea-framework-consultant/` (original OpenAI)
- [ ] Delete `idea-framework-consultant-test/`
- [ ] Delete `brand-copy-generator-test/`
- [ ] Delete `sync-to-openai-vector-store/`
- [ ] Delete `upload-document-to-vector-store/`
- [ ] Delete `create-user-kb/`
- [ ] Delete `ensure-user-kb/`
- [ ] Delete `list-vector-stores/`
- [ ] Delete `sync-diagnostic-to-user-kb/`
- [ ] Estimated effort: **0.5 day**

### Step 8: Drop Database Columns + Table
- [ ] Drop `openai_response_id` from `chat_sessions`
- [ ] Drop `openai_file_id`, `openai_synced_at` from `user_knowledge_base`
- [ ] Drop `openai_file_id` from `uploaded_documents`
- [ ] Drop `user_vector_stores` table
- [ ] Drop orphaned indexes
- [ ] Estimated effort: **0.5 day**

### Step 9: Scripts and Package Cleanup
- [ ] Delete `scripts/upload-system-kb.ts`
- [ ] Delete `scripts/test-system-kb.ts`
- [ ] Delete `scripts/upload-skills-to-vector-store.ts`
- [ ] Update `scripts/check-field-sync-status.ts`
- [ ] Remove `openai` from `package.json`
- [ ] Run `npm install` to update lockfile
- [ ] Estimated effort: **0.5 day**

### Step 10: Remove OPENAI_API_KEY Secret
- [ ] Verify ZERO references to `OPENAI_API_KEY` remain in deployed functions
- [ ] Remove `OPENAI_API_KEY` from Supabase secrets
- [ ] Estimated effort: **15 minutes**

### Step 11: Documentation Update
- [ ] Update README.md, TECHNICAL_ARCHITECTURE.md, cost analysis, etc.
- [ ] Estimated effort: **1 day**

---

## 9. Effort Estimates

| Step | Description | Effort |
|------|-------------|--------|
| 1 | Verify Phases 2 and 3 | 0 (prerequisite) |
| 2 | Voyage AI secret + shared module | 0.5 day |
| 3 | Swap embedding generation | 1 day |
| 4 | Re-embed all existing content | 1 day |
| 5 | Database schema migration | 0.5 day |
| 6 | Client-side cleanup | 1 day |
| 7 | Delete old edge functions | 0.5 day |
| 8 | Drop DB columns/tables | 0.5 day |
| 9 | Scripts and package cleanup | 0.5 day |
| 10 | Remove OPENAI_API_KEY | 15 min |
| 11 | Documentation update | 1 day |
| **Total** | | **~6.5 days** |

### Risk Factors

- **Re-embedding quality:** Voyage-3 embeddings may produce different semantic search rankings than ada-002. Budget time for quality validation.
- **Downtime during dimension change:** The column alter from vector(1536) to vector(1024) requires all embeddings to be re-generated first. If any stale 1536-dim embeddings remain, the ALTER will fail.
- **Batch processing time:** Re-embedding all content depends on the volume of data and Voyage AI rate limits. For a small beta user base this should be fast; for thousands of users it could take hours.
- **Frontend type regeneration:** After dropping DB columns, `npx supabase gen types typescript` must be run and the entire frontend should be tested for compile errors.

---

## References

- [Voyage AI Embeddings API](https://docs.voyageai.com/reference/embeddings-api)
- [Voyage AI Text Embeddings Documentation](https://docs.voyageai.com/docs/embeddings)
- [Voyage AI Pricing](https://docs.voyageai.com/docs/pricing)
- [ADR: Claude Agent SDK Migration](./adr/ADR-CLAUDE-AGENT-SDK-MIGRATION.md)

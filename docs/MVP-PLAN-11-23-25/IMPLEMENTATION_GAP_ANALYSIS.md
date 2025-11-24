# Implementation Gap Analysis

**Version:** 1.0
**Date:** 2025-11-23
**Status:** Analysis Complete

---

## Executive Summary

This document compares the **target architecture** (5+5 OpenAI Vector Stores) with the **current implementation** to identify gaps that need to be addressed.

### Overall Status

| Component | Target | Current | Gap |
|-----------|--------|---------|-----|
| System KB (5 stores) | OpenAI Vector Stores with Trevor's content | **Not created** | Critical |
| User KB (5 stores per user) | OpenAI Vector Stores | Created but **empty** | Critical |
| Data Sync | Supabase → OpenAI | **Not implemented** | Critical |
| Query Engine | Responses API with file_search | Chat Completions + pgvector | Major |
| Local-First | IndexedDB → Supabase | **Implemented** | None |

---

## Detailed Gap Analysis

### 1. System Knowledge Base

#### Target State
```
5 OpenAI Vector Stores (shared):
├── vs_system_diagnostic  (Trevor's assessment frameworks)
├── vs_system_avatar      (Customer profiling methods)
├── vs_system_canvas      (Business Model frameworks)
├── vs_system_capture     (Content strategy)
└── vs_system_core        (Brand philosophy)
```

#### Current State
- **Status:** NOT CREATED
- No system vector stores exist
- Trevor's book not uploaded
- No marketing framework syntheses

#### Gap
| Item | Status |
|------|--------|
| Create 5 system vector stores | ❌ Not done |
| Upload Trevor's book | ❌ Not done |
| Upload marketing syntheses | ❌ Not done |
| Store IDs in config/database | ❌ Not done |

#### Files Affected
- Need new: `supabase/functions/create-system-kb/index.ts`
- Need new: `supabase/migrations/XXXXXX_system_vector_stores.sql`
- Need new: `scripts/upload-trevor-book.ts`

---

### 2. User Knowledge Base (Vector Store Creation)

#### Target State
```
5 OpenAI Vector Stores per user:
├── vs_user_{userId}_diagnostic
├── vs_user_{userId}_avatar
├── vs_user_{userId}_canvas
├── vs_user_{userId}_capture
└── vs_user_{userId}_core
```

#### Current State
- **Status:** PARTIALLY IMPLEMENTED ⚠️
- `create-user-kb` Edge Function exists and creates 5 vector stores
- `user_vector_stores` table exists
- Vector stores are created but **never populated with data**

#### Evidence
```typescript
// supabase/functions/create-user-kb/index.ts - Line 18-44
// Creates 5 vector stores per user ✅
async function createUserVectorStores(userId, userEmail, openaiKey) {
  const stores = await Promise.all([
    createVectorStore(openaiKey, `User ${userEmail} - Diagnostic`, userId, "diagnostic"),
    createVectorStore(openaiKey, `User ${userEmail} - Avatar`, userId, "avatar"),
    createVectorStore(openaiKey, `User ${userEmail} - Canvas`, userId, "canvas"),
    createVectorStore(openaiKey, `User ${userEmail} - CAPTURE`, userId, "capture"),
    createVectorStore(openaiKey, `User ${userEmail} - Core`, userId, "core"),
  ]);
  // ...stores created but never populated
}
```

#### Gap
| Item | Status |
|------|--------|
| Create 5 vector stores per user | ✅ Done |
| Store vector store IDs | ✅ Done |
| Sync diagnostic data to vector store | ❌ Not done |
| Sync avatar data to vector store | ❌ Not done |
| Sync canvas data to vector store | ❌ Not done |
| Sync copy data to vector store | ❌ Not done |
| Sync conversation insights to vector store | ❌ Not done |

#### Files Affected
- Need new: `supabase/functions/sync-to-openai-vector-store/index.ts`
- Modify: `supabase/functions/sync-diagnostic-to-embeddings/index.ts` → use OpenAI VS instead of pgvector

---

### 3. Data Sync (Supabase → OpenAI Vector Stores)

#### Target State
```
User edits field
       ↓
IndexedDB (instant)
       ↓
Supabase user_knowledge_base (background)
       ↓
Database Trigger → Edge Function
       ↓
OpenAI Vector Store (async)
```

#### Current State
- **Status:** NOT IMPLEMENTED ❌
- Local-first sync to Supabase works
- No sync from Supabase to OpenAI Vector Stores
- `sync-diagnostic-to-embeddings` uses pgvector (`user_knowledge_chunks`), not OpenAI

#### Evidence
```typescript
// supabase/functions/sync-diagnostic-to-embeddings/index.ts
// Syncs to PostgreSQL user_knowledge_chunks, NOT OpenAI
await supabaseClient
  .from("user_knowledge_chunks")
  .insert({ user_id, content, embedding, ... });
// Should sync to OpenAI vector store instead
```

#### Gap
| Item | Status |
|------|--------|
| Trigger on user_knowledge_base INSERT/UPDATE | ❌ Not done |
| Edge Function to sync to OpenAI | ❌ Not done |
| Track openai_file_id in Supabase | ❌ Not done |
| Handle file updates (delete old, create new) | ❌ Not done |

#### Files Affected
- Need new: `supabase/functions/sync-to-openai-vector-store/index.ts`
- Need new: `supabase/migrations/XXXXXX_add_openai_sync_columns.sql`
- Modify: `src/lib/knowledge-base/supabase-sync-service.ts` → trigger OpenAI sync

---

### 4. Query Engine (brand-coach-gpt)

#### Target State
```typescript
// Use Responses API with file_search
const response = await openai.responses.create({
  model: "gpt-4o",
  input: userQuestion,
  tools: [{
    type: "file_search",
    vector_store_ids: [
      "vs_system_canvas",           // Trevor's expertise
      userStores.canvas_store_id    // User's data
    ]
  }]
});
```

#### Current State
- **Status:** USES LEGACY APPROACH ❌
- Uses Chat Completions API (not Responses API)
- RAG via pgvector (`match_user_documents` function)
- No file_search integration
- No System KB querying

#### Evidence
```typescript
// supabase/functions/brand-coach-gpt/index.ts - Line 56-103
// Uses PostgreSQL for RAG, not OpenAI file_search
async function retrieveRelevantContext(...) {
  const queryEmbedding = await generateEmbedding(query, openaiKey);
  const { data: matches } = await supabaseClient.rpc("match_user_documents", {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: 3,
  });
  // ...
}

// Line 211-223 - Uses Chat Completions, not Responses API
const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
  body: JSON.stringify({
    model: "gpt-4-turbo-preview",
    messages,
    // NO file_search, NO vector_store_ids
  }),
});
```

#### Gap
| Item | Status |
|------|--------|
| Use Responses API | ❌ Not done |
| Use file_search tool | ❌ Not done |
| Query System KB | ❌ Not done |
| Query User KB via OpenAI | ❌ Not done |
| Intent-based routing | ❌ Not done |
| Remove pgvector dependency | ❌ Not done |

#### Files Affected
- Major rewrite: `supabase/functions/brand-coach-gpt/index.ts`
- Need new: `supabase/functions/brand-coach-gpt/router.ts` (intent classification)

---

### 5. Local-First Architecture

#### Target State
```
User Input → IndexedDB → Supabase user_knowledge_base
```

#### Current State
- **Status:** IMPLEMENTED ✅
- `usePersistedField` hook works
- `KnowledgeRepository` (IndexedDB) works
- `SupabaseSyncService` works
- Brand Canvas and Avatar Builder migrated

#### Evidence
```typescript
// src/hooks/usePersistedField.ts - Implemented ✅
// src/lib/knowledge-base/knowledge-repository.ts - Implemented ✅
// src/lib/knowledge-base/supabase-sync-service.ts - Implemented ✅
// src/pages/BrandCanvas.tsx - Uses usePersistedField ✅
// src/pages/AvatarBuilder.tsx - Uses usePersistedField ✅
```

#### Gap
| Item | Status |
|------|--------|
| IndexedDB storage | ✅ Done |
| Background sync to Supabase | ✅ Done |
| Brand Canvas migration | ✅ Done |
| Avatar Builder migration | ✅ Done |
| Diagnostic migration | ❌ Not done |
| Copy Generator migration | ❌ Not done |
| IDEA Insight migration | ❌ Not done |
| Trigger OpenAI sync after Supabase sync | ❌ Not done |

---

### 6. Database Schema

#### Target State
```sql
-- Track OpenAI sync status
ALTER TABLE user_knowledge_base ADD COLUMN openai_file_id TEXT;
ALTER TABLE user_knowledge_base ADD COLUMN openai_synced_at TIMESTAMPTZ;

-- System vector stores config
CREATE TABLE system_vector_stores (
  category TEXT PRIMARY KEY,
  vector_store_id TEXT NOT NULL
);
```

#### Current State
- `user_knowledge_base` exists but missing OpenAI sync columns
- `user_vector_stores` exists ✅
- `system_vector_stores` does not exist

#### Gap
| Item | Status |
|------|--------|
| user_knowledge_base table | ✅ Done |
| user_vector_stores table | ✅ Done |
| openai_file_id column | ❌ Not done |
| openai_synced_at column | ❌ Not done |
| system_vector_stores table | ❌ Not done |
| Database trigger for sync | ❌ Not done |

---

## Summary: What Needs to Be Built

### Critical (Blocking)

1. **System KB Creation & Population**
   - Create 5 system vector stores
   - Upload Trevor's book
   - Create marketing syntheses
   - Effort: 3-5 days

2. **Supabase → OpenAI Sync**
   - Edge Function: `sync-to-openai-vector-store`
   - Database trigger on user_knowledge_base
   - Effort: 2-3 days

3. **Query Engine Rewrite**
   - Migrate to Responses API
   - Implement file_search with both System + User KB
   - Intent-based routing
   - Effort: 3-4 days

### High Priority

4. **Page Migrations to Local-First**
   - Diagnostic page
   - Copy Generator page
   - IDEA Insight page
   - Effort: 2-3 days

### Medium Priority

5. **Database Schema Updates**
   - Add OpenAI sync columns
   - Create system_vector_stores table
   - Add triggers
   - Effort: 1 day

6. **Deprecate pgvector**
   - Remove `user_knowledge_chunks` usage
   - Remove `match_user_documents` calls
   - Effort: 1 day

---

## Current vs Target Architecture Diagram

```
CURRENT IMPLEMENTATION:
======================

User Input → IndexedDB → Supabase user_knowledge_base
                              ↓
                    [Diagnostic only]
                              ↓
               sync-diagnostic-to-embeddings
                              ↓
                    PostgreSQL (pgvector)
                    user_knowledge_chunks
                              ↓
                    brand-coach-gpt
                    (Chat Completions API)
                              ↓
                    Response (no System KB context)


TARGET IMPLEMENTATION:
=====================

User Input → IndexedDB → Supabase user_knowledge_base
                              ↓
                    [All categories]
                              ↓
                sync-to-openai-vector-store
                              ↓
              ┌───────────────┴───────────────┐
              ↓                               ↓
     OpenAI User KB (5 stores)    OpenAI System KB (5 stores)
              ↓                               ↓
              └───────────────┬───────────────┘
                              ↓
                    brand-coach-gpt
                    (Responses API + file_search)
                              ↓
                    Response (System + User context)
```

---

## Files to Create/Modify

### New Files Needed

| File | Purpose |
|------|---------|
| `supabase/functions/sync-to-openai-vector-store/index.ts` | Sync user_knowledge_base → OpenAI |
| `supabase/functions/create-system-kb/index.ts` | Create 5 system vector stores |
| `supabase/migrations/XXXXXX_system_vector_stores.sql` | System KB tracking table |
| `supabase/migrations/XXXXXX_openai_sync_columns.sql` | Add sync tracking columns |
| `scripts/upload-trevor-book.ts` | Upload Trevor's content |
| `scripts/upload-marketing-syntheses.ts` | Upload framework docs |

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/brand-coach-gpt/index.ts` | Rewrite to use Responses API |
| `src/lib/knowledge-base/supabase-sync-service.ts` | Trigger OpenAI sync |
| `src/pages/IdeaDiagnostic.tsx` | Migrate to usePersistedField |
| `src/pages/ValueLens.tsx` | Migrate to usePersistedField |
| `src/pages/IdeaInsight.tsx` | Migrate to usePersistedField |

### Files to Deprecate

| File | Reason |
|------|--------|
| `supabase/functions/sync-diagnostic-to-embeddings/index.ts` | Replace with OpenAI sync |
| `user_knowledge_chunks` table | No longer needed |
| `match_user_documents` function | No longer needed |

---

## Related Documents

- [KNOWLEDGE_BASE_ARCHITECTURE.md](./KNOWLEDGE_BASE_ARCHITECTURE.md) - Target architecture
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Prioritized implementation steps

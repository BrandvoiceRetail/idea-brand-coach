# Knowledge Base Architecture - 5+5 Vector Store Design

**Version:** 1.0
**Date:** 2025-11-23
**Status:** Design Complete

---

## Executive Summary

The IDEA Brand Coach uses a **5+5 Vector Store Architecture**:
- **5 System Knowledge Bases** (shared across all users) - Trevor's expertise
- **5 User Knowledge Bases per user** (isolated per user) - User's brand data

Both are hosted on **OpenAI Vector Stores** and queried via the **Responses API** with `file_search`.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    IDEA Brand Coach - Knowledge Architecture                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     SYSTEM KNOWLEDGE BASE (5 Vector Stores)                  │
│                              SHARED - All Users                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ vs_system_      │  │ vs_system_      │  │ vs_system_      │             │
│  │ diagnostic      │  │ avatar          │  │ canvas          │             │
│  │ (10K docs, 5GB) │  │ (8K docs, 4GB)  │  │ (7K docs, 3.5GB)│             │
│  │                 │  │                 │  │                 │             │
│  │ • Trevor's      │  │ • Customer      │  │ • Business      │             │
│  │   assessment    │  │   profiling     │  │   Model Canvas  │             │
│  │ • SWOT          │  │ • StoryBrand    │  │ • Blue Ocean    │             │
│  │ • Positioning   │  │ • Personas      │  │ • Value Props   │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                                   │
│  │ vs_system_      │  │ vs_system_      │                                   │
│  │ capture         │  │ core            │                                   │
│  │ (12K docs, 6GB) │  │ (5K docs, 2.5GB)│                                   │
│  │                 │  │                 │                                   │
│  │ • Content       │  │ • Brand         │                                   │
│  │   strategy      │  │   foundations   │                                   │
│  │ • Contagious    │  │ • Mission/      │                                   │
│  │ • Made to Stick │  │   Vision        │                                   │
│  └─────────────────┘  └─────────────────┘                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      USER KNOWLEDGE BASE (5 Vector Stores)                   │
│                           PER-USER - Isolated by user_id                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  For each user (e.g., user_abc123):                                         │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ vs_user_abc123_ │  │ vs_user_abc123_ │  │ vs_user_abc123_ │             │
│  │ diagnostic      │  │ avatar          │  │ canvas          │             │
│  │                 │  │                 │  │                 │             │
│  │ • IDEA scores   │  │ • Demographics  │  │ • Brand purpose │             │
│  │ • Assessment    │  │ • Psychology    │  │ • Vision/mission│             │
│  │   answers       │  │ • Buying        │  │ • Values        │             │
│  │ • Weaknesses    │  │   behavior      │  │ • Positioning   │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                                   │
│  │ vs_user_abc123_ │  │ vs_user_abc123_ │                                   │
│  │ capture         │  │ core            │                                   │
│  │                 │  │                 │                                   │
│  │ • Copy inputs   │  │ • Uploaded docs │                                   │
│  │ • Generated     │  │ • Conversation  │                                   │
│  │   copy history  │  │   insights      │                                   │
│  │ • Campaigns     │  │ • Filed notes   │                                   │
│  └─────────────────┘  └─────────────────┘                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Category Mapping

### What Goes in Each Category

| Category | System KB (Trevor's Expertise) | User KB (User's Data) |
|----------|-------------------------------|----------------------|
| **Diagnostic** | Assessment frameworks, SWOT analysis, brand audit methodologies | User's 6-question IDEA scores, assessment answers, identified weaknesses |
| **Avatar** | Customer profiling methods, StoryBrand, persona frameworks | User's avatar: demographics, psychology, buying behavior, VoC |
| **Canvas** | Business Model Canvas, Blue Ocean, value proposition design | User's brand canvas: purpose, vision, mission, values, positioning |
| **Capture** | Content strategy, Contagious (STEPPS), Made to Stick (SUCCESs) | User's copy generator inputs, generated copy, campaign history |
| **Core** | Brand philosophy, mission/vision frameworks, storytelling | User's uploaded documents, conversation insights, filed notes |

### Field Identifier Reference

For complete field specifications per category, see:
- **[USER_KNOWLEDGE_BASE_DESIGN.md](../USER_KNOWLEDGE_BASE_DESIGN.md)** - Full field specs with TypeScript interfaces
- **[USER_KNOWLEDGE_BASE_MIGRATION_PLAN.md](../USER_KNOWLEDGE_BASE_MIGRATION_PLAN.md)** - Field identifiers organized by page

**Quick Reference (field counts per category):**

*UPDATED 2025-12-27: Insights fields now use semantic IDEA prefixes (`insight_*`, `empathy_*`) for better AI context and Canvas export.*

| Category | Fields | Key Identifiers |
|----------|--------|-----------------|
| diagnostic | 11 | `diagnostic_q1_answer`, `diagnostic_overall_score`, etc. |
| avatar | 14 | `avatar_demographics_age`, `avatar_psychology_values`, etc. |
| insights | 11 | `insight_buyer_intent`, `insight_buyer_motivation`, `empathy_emotional_triggers`, `insight_search_terms`, `empathy_trigger_profile`, etc. |
| canvas | 10 | `canvas_brand_purpose`, `canvas_brand_values`, etc. |
| copy | 12 | `copy_input_product_name`, `copy_generated_content`, etc. |

**Field Mapping Update (2025-12-27):**
Previous `insights_framework_stepN_response` fields have been renamed to semantic identifiers:
- Step 1 → `insight_buyer_intent` (Buyer Intent)
- Step 2 → `insight_buyer_motivation` (Buyer Motivation)
- Step 3 → `empathy_emotional_triggers` (Emotional Triggers)
- Step 4 → `insight_shopper_type` (Shopper Type)
- Step 5 → `insight_demographics` (Demographics)

---

## Data Flow Architecture

### 1. Data Entry Flow

```
User enters data in UI (e.g., Brand Canvas)
            ↓
    IndexedDB (instant, <10ms)
    [Local-first for responsiveness]
            ↓
    Supabase user_knowledge_base (background sync)
    [Source of truth, relational data]
            ↓
    OpenAI Vector Store (async trigger)
    [For RAG retrieval via file_search]
```

### 2. Query Flow (Responses API)

```
User asks: "How can I improve my brand positioning?"
            ↓
    Router classifies intent: "canvas"
            ↓
    Responses API with file_search
    ┌─────────────────────────────────────┐
    │ tools: [{                           │
    │   type: "file_search",              │
    │   vector_store_ids: [               │
    │     "vs_system_canvas",    ← System │
    │     "vs_user_abc123_canvas" ← User  │
    │   ]                                 │
    │ }]                                  │
    └─────────────────────────────────────┘
            ↓
    GPT receives context from BOTH:
    • Trevor's positioning frameworks (System)
    • User's current brand canvas data (User)
            ↓
    Personalized response with expert guidance
```

### 3. Sync Flow (Supabase → OpenAI)

```
Supabase user_knowledge_base INSERT/UPDATE
            ↓
    Database trigger fires
            ↓
    Edge Function: sync-to-openai-vector-store
            ↓
    OpenAI Files API: Upload document
            ↓
    OpenAI Vector Store: Add file to user's category store
```

---

## Implementation Details

### Vector Store Naming Convention

```
System stores (5 total):
  vs_system_diagnostic
  vs_system_avatar
  vs_system_canvas
  vs_system_capture
  vs_system_core

User stores (5 per user):
  vs_user_{userId}_diagnostic
  vs_user_{userId}_avatar
  vs_user_{userId}_canvas
  vs_user_{userId}_capture
  vs_user_{userId}_core

Example for user "abc123":
  vs_user_abc123_diagnostic
  vs_user_abc123_avatar
  vs_user_abc123_canvas
  vs_user_abc123_capture
  vs_user_abc123_core
```

### Vector Store Management

```typescript
// Create user's 5 vector stores on account creation
async function createUserVectorStores(userId: string): Promise<void> {
  const categories = ['diagnostic', 'avatar', 'canvas', 'capture', 'core'];

  for (const category of categories) {
    const vectorStore = await openai.vectorStores.create({
      name: `vs_user_${userId}_${category}`,
      metadata: {
        user_id: userId,
        category: category,
        created_at: new Date().toISOString()
      }
    });

    // Store vector store ID in Supabase for lookup
    await supabase.from('user_vector_stores').insert({
      user_id: userId,
      category: category,
      vector_store_id: vectorStore.id
    });
  }
}
```

### File Upload to User Vector Store

```typescript
// Sync field to OpenAI Vector Store
async function syncFieldToVectorStore(
  userId: string,
  category: string,
  fieldIdentifier: string,
  content: string
): Promise<void> {
  // Get user's vector store ID for this category
  const { data: storeRecord } = await supabase
    .from('user_vector_stores')
    .select('vector_store_id')
    .eq('user_id', userId)
    .eq('category', category)
    .single();

  if (!storeRecord) throw new Error('Vector store not found');

  // Create document with metadata
  const document = `
# ${fieldIdentifier}
Category: ${category}
User: ${userId}
Updated: ${new Date().toISOString()}

${content}
  `.trim();

  // Upload as file
  const file = await openai.files.create({
    file: new Blob([document], { type: 'text/markdown' }),
    purpose: 'assistants'
  });

  // Add to vector store
  await openai.vectorStores.files.create(storeRecord.vector_store_id, {
    file_id: file.id
  });
}
```

### Query with Both System + User KB

```typescript
async function queryWithContext(
  userId: string,
  userQuestion: string,
  intent: string // 'diagnostic' | 'avatar' | 'canvas' | 'capture' | 'core'
): Promise<string> {
  // Get user's vector store ID for this intent
  const { data: userStore } = await supabase
    .from('user_vector_stores')
    .select('vector_store_id')
    .eq('user_id', userId)
    .eq('category', intent)
    .single();

  // System store ID (from config)
  const systemStoreId = SYSTEM_VECTOR_STORES[intent];

  // Query with both stores
  const response = await openai.responses.create({
    model: 'gpt-4o',
    input: userQuestion,
    instructions: getSystemPrompt(intent),
    tools: [{
      type: 'file_search',
      vector_store_ids: [
        systemStoreId,           // Trevor's expertise
        userStore.vector_store_id // User's data
      ],
      file_search: {
        max_num_results: 20,
        score_threshold: 0.7
      }
    }]
  });

  return response.output_text;
}
```

---

## Database Schema

### Supabase Tables

```sql
-- Source of truth for user knowledge (existing)
CREATE TABLE user_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    category TEXT NOT NULL CHECK (category IN ('diagnostic', 'avatar', 'canvas', 'capture', 'core')),
    subcategory TEXT,
    field_identifier TEXT NOT NULL,
    content TEXT NOT NULL,
    structured_data JSONB,
    metadata JSONB,
    version INTEGER DEFAULT 1,
    is_current BOOLEAN DEFAULT true,
    -- Sync tracking
    openai_file_id TEXT,           -- NEW: Track OpenAI file
    openai_synced_at TIMESTAMPTZ,  -- NEW: Last sync time
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Track user's vector stores (new)
CREATE TABLE user_vector_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    category TEXT NOT NULL CHECK (category IN ('diagnostic', 'avatar', 'canvas', 'capture', 'core')),
    vector_store_id TEXT NOT NULL,  -- OpenAI vector store ID
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, category)
);

-- Track system vector stores (new)
CREATE TABLE system_vector_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL UNIQUE,
    vector_store_id TEXT NOT NULL,
    document_count INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT now()
);
```

---

## Cost Analysis

### OpenAI Vector Store Pricing

| Component | Cost | Notes |
|-----------|------|-------|
| Vector storage | $0.10/GB/day | Per vector store |
| File search | $0.003/query | Included in Responses API |

### Estimated Costs

**System KB (fixed):**
- 5 stores × ~5GB avg = 25GB
- Cost: 25GB × $0.10/day = **$2.50/day = $75/month**

**User KB (scales with users):**
- 5 stores per user × ~100KB avg = 500KB per user
- 1,000 users = 500MB total
- Cost: 0.5GB × $0.10/day = **$0.05/day = $1.50/month**

**Total for 1,000 users: ~$77/month**

---

## Migration Path

### Phase 1: System KB Setup
1. Create 5 system vector stores
2. Upload Trevor's book (split by chapter to categories)
3. Upload marketing framework syntheses
4. Test retrieval quality

### Phase 2: User KB Infrastructure
1. Create `user_vector_stores` table
2. Build Edge Function for vector store creation
3. Create vector stores for existing users
4. Build sync Edge Function (Supabase → OpenAI)

### Phase 3: Data Migration
1. Migrate `user_knowledge_chunks` → OpenAI vector stores
2. Sync existing `user_knowledge_base` entries
3. Deprecate pgvector embeddings

### Phase 4: Query Integration
1. Update brand-coach-gpt to use Responses API
2. Implement intent-based routing
3. Query both System + User KB per category

---

## Security Considerations

### Data Isolation

```
✅ User data isolated by separate vector stores
✅ Vector store IDs only accessible via user's Supabase record
✅ RLS on user_vector_stores table
✅ No cross-user data leakage possible
```

### Access Control

```typescript
// Edge Function validates user owns the vector store
const { data: storeRecord, error } = await supabase
  .from('user_vector_stores')
  .select('vector_store_id')
  .eq('user_id', authenticatedUserId)  // From JWT
  .eq('category', requestedCategory)
  .single();

if (error || !storeRecord) {
  throw new Error('Unauthorized');
}
```

---

## Related Documents

- [IMPLEMENTATION_GAP_ANALYSIS.md](./IMPLEMENTATION_GAP_ANALYSIS.md)
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
- Previous: [MVP-PLAN-11-13-2025/SYSTEM_USER_KNOWLEDGE_BASE_SEPARATION_GUIDE.md](../MVP-PLAN-11-13-2025/SYSTEM_USER_KNOWLEDGE_BASE_SEPARATION_GUIDE.md)

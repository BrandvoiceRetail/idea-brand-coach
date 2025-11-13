# QMR Knowledge Base Integration Guide
## Architectural Separation and Runtime Aggregation

**Version:** 2.0
**Last Updated:** 2025-11-13
**Status:** Implementation Guide

---

## Executive Summary

This guide explains the **architectural separation** between two knowledge bases and how they are **aggregated at runtime** to populate the Query in the QMR (Query → Model → Response) framework.

### Two Knowledge Bases

**1. System Knowledge Base (Shared)**
- Trevor's book + marketing framework syntheses
- Shared across ALL users
- 5 domain-specific vector stores (Diagnostic, Avatar, Canvas, CAPTURE, Core)
- ~42,000 documents, 25GB total

**2. User Knowledge Base (Per-User Isolated)**
- User's diagnostic results (P0 - core functionality) ✅
- User's conversation history (P0 - automatic) ✅
- User's uploaded documents (P0 - UI exists, needs embeddings integration)
- **Strictly isolated per user** (via user_id filtering)

### Runtime Aggregation

At query time, the system:
1. Retrieves relevant chunks from **System KB** (Trevor's expertise)
2. Retrieves relevant chunks from **User KB** (user's specific context)
3. Aggregates both into a single Query
4. Sends to Model for personalized response

**Key Principle**: The Model ONLY sees what's in the Query. File search intelligently selects the MOST relevant chunks from BOTH knowledge bases and combines them.

---

## Table of Contents

1. [Architectural Separation](#architectural-separation)
2. [Runtime Aggregation Strategy](#runtime-aggregation-strategy)
3. [System Knowledge Base Integration](#system-knowledge-base-integration)
4. [User Knowledge Base Integration](#user-knowledge-base-integration)
5. [Query Construction with Both Sources](#query-construction-with-both-sources)
6. [Security & Data Isolation](#security--data-isolation)
7. [Optimization Strategies](#optimization-strategies)
8. [Retrieval Quality Metrics](#retrieval-quality-metrics)
9. [Configuration Best Practices](#configuration-best-practices)

---

## Architectural Separation

### Knowledge Base Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   IDEA Brand Coach                          │
│                   Knowledge Architecture                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│          SYSTEM KNOWLEDGE BASE (Shared)                     │
│          ===================================                 │
│                                                              │
│  Purpose: Trevor's expertise + marketing frameworks          │
│  Scope: Shared across ALL users                             │
│  Storage: OpenAI Vector Stores                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Diagnostic KB (10K docs)                             │  │
│  │ - Trevor's brand assessment chapters                 │  │
│  │ - SWOT framework syntheses (Ries & Trout)           │  │
│  │ - Positioning strategies (marketing classics)        │  │
│  │ Vector Store ID: vs_system_diagnostic                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Avatar KB (8K docs)                                  │  │
│  │ - Trevor's customer profiling methods                │  │
│  │ - StoryBrand synthesis (Miller)                      │  │
│  │ - Persona development frameworks                     │  │
│  │ Vector Store ID: vs_system_avatar                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Canvas KB, CAPTURE KB, Core KB                       │  │
│  │ (similar structure)                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│          USER KNOWLEDGE BASE (Per-User)                     │
│          ==================================                  │
│                                                              │
│  Purpose: User's specific brand context                     │
│  Scope: ISOLATED per user_id                                │
│  Storage: PostgreSQL + OpenAI Vector Stores (filtered)      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ User Diagnostic Data (P0 - Core)                    │  │
│  │ - 6-question IDEA assessment results                │  │
│  │ - Category scores (Insight, Distinctive, etc.)      │  │
│  │ - Formatted as context document                     │  │
│  │ Storage: user_knowledge_chunks table                │  │
│  │ Filter: WHERE user_id = 'user_123'                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Conversation History (P0 - Automatic)                │  │
│  │ - Past questions and answers                         │  │
│  │ - Extracted insights from coaching sessions          │  │
│  │ Storage: chat_messages table                        │  │
│  │ Filter: WHERE user_id = 'user_123'                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ User Uploaded Documents (P0 - Partial)               │  │
│  │ - Brand guidelines PDF                               │  │
│  │ - Business plan                                      │  │
│  │ - Marketing materials                                │  │
│  │ Storage: uploaded_documents table (text extraction)│  │
│  │ TODO: Sync to user_knowledge_chunks (embeddings)    │  │
│  │ Filter: WHERE user_id = 'user_123'                  │  │
│  │ Status: UI ✅, Storage ✅, Embeddings ❌            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│          RUNTIME AGGREGATION                                │
│          ==================                                  │
│                                                              │
│  At query time, retrieve from BOTH:                         │
│  ├─ System KB: Trevor's expertise (10-15 chunks)           │
│  └─ User KB: User's context (5-10 chunks)                  │
│                                                              │
│  Aggregate → Single Query → Model                           │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema for User Knowledge Base

```sql
-- User-specific knowledge chunks (isolated per user)
CREATE TABLE user_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 dimension
  metadata JSONB,
  source TEXT, -- 'diagnostic', 'uploaded_document', 'conversation_insight'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- IVFFlat index for fast vector search
CREATE INDEX ON user_knowledge_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- B-tree index for user filtering (CRITICAL for data isolation)
CREATE INDEX idx_user_knowledge_user_id
ON user_knowledge_chunks(user_id);

-- Row Level Security (RLS) - ENFORCE per-user isolation
ALTER TABLE user_knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own chunks"
ON user_knowledge_chunks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert own chunks"
ON user_knowledge_chunks FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### Vector Search Function (User-Filtered)

```sql
CREATE OR REPLACE FUNCTION match_user_documents(
  query_embedding vector(1536),
  match_user_id UUID,
  match_count INT DEFAULT 10,
  filter JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    user_knowledge_chunks.id,
    user_knowledge_chunks.content,
    user_knowledge_chunks.metadata,
    1 - (user_knowledge_chunks.embedding <=> query_embedding) AS similarity
  FROM user_knowledge_chunks
  WHERE user_knowledge_chunks.user_id = match_user_id  -- CRITICAL: User isolation
    AND (filter = '{}'::jsonb OR user_knowledge_chunks.metadata @> filter)
  ORDER BY user_knowledge_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## Runtime Aggregation Strategy

### The Aggregation Flow

```
User Query: "How do I improve my brand positioning?"
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Intent Classification                               │
│ Router Prompt determines: "diagnostic"                      │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Parallel Retrieval from BOTH Knowledge Bases       │
│                                                              │
│ ┌─────────────────────────┐  ┌─────────────────────────┐  │
│ │ System KB Search        │  │ User KB Search          │  │
│ │                         │  │                         │  │
│ │ Vector Store:           │  │ Database Query:         │  │
│ │ vs_system_diagnostic    │  │ match_user_documents()  │  │
│ │                         │  │ WHERE user_id='user_123'│  │
│ │ Retrieves:              │  │                         │  │
│ │ - 15 chunks from Trevor │  │ Retrieves:              │  │
│ │ - Positioning frameworks│  │ - 5 chunks from user    │  │
│ │ - SWOT strategies       │  │ - Diagnostic results    │  │
│ │ - Marketing concepts    │  │ - Past conversations    │  │
│ │                         │  │ - User's brand context  │  │
│ │ Similarity: 0.92-0.78   │  │ Similarity: 0.88-0.72   │  │
│ └─────────────────────────┘  └─────────────────────────┘  │
│         ↓                              ↓                    │
│         └──────────────┬───────────────┘                    │
│                        ↓                                     │
│              [Aggregate 20 chunks]                          │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Build Augmented Query                               │
│                                                              │
│ Query Components:                                            │
│ ├─ System Prompt (500 tokens)                              │
│ │  "You are the IDEA Brand Coach..."                       │
│ │                                                            │
│ ├─ System KB Context (1,500 tokens)                        │
│ │  [Chunk 1] Trevor's positioning framework...             │
│ │  [Chunk 2] SWOT analysis for brand positioning...        │
│ │  [Chunk 3] Competitive differentiation strategies...     │
│ │  ...                                                      │
│ │  [Chunk 15] Positioning statement templates...           │
│ │                                                            │
│ ├─ User KB Context (500 tokens)                            │
│ │  [Chunk 16] User's diagnostic: Distinctive score=45/100  │
│ │  [Chunk 17] Previous conversation: discussed target...   │
│ │  [Chunk 18] User's industry: B2B SaaS for marketing...   │
│ │  [Chunk 19] User's challenge: blending with competitors  │
│ │  [Chunk 20] User previously asked about values...        │
│ │                                                            │
│ ├─ Conversation History (800 tokens)                       │
│ │  [From previous_response_id]                             │
│ │                                                            │
│ └─ User's Current Question (50 tokens)                     │
│    "How do I improve my brand positioning?"                │
│                                                              │
│ Total Query: 3,350 tokens                                   │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Model Processing                                    │
│                                                              │
│ GPT-5 receives the complete Query with:                     │
│ ✅ Trevor's expert frameworks (System KB)                   │
│ ✅ User's specific brand context (User KB)                  │
│ ✅ Past conversation context                                │
│                                                              │
│ Generates personalized response:                            │
│ "Based on Trevor's positioning framework and your           │
│  diagnostic showing a Distinctive score of 45/100,          │
│  here's how to improve your brand positioning..."           │
└─────────────────────────────────────────────────────────────┘
```

### Implementation: Parallel Retrieval

```python
async def retrieve_aggregated_context(
    user_id: str,
    query: str,
    intent: str,
    max_system_chunks: int = 15,
    max_user_chunks: int = 5
) -> Dict[str, List[Chunk]]:
    """
    Retrieve and aggregate from both System KB and User KB in parallel
    """

    # Parallel retrieval from both knowledge bases
    system_chunks, user_chunks = await asyncio.gather(
        retrieve_from_system_kb(query, intent, max_system_chunks),
        retrieve_from_user_kb(user_id, query, max_user_chunks)
    )

    return {
        "system_chunks": system_chunks,  # Trevor's expertise
        "user_chunks": user_chunks,       # User's context
        "total_chunks": len(system_chunks) + len(user_chunks)
    }


async def retrieve_from_system_kb(
    query: str,
    intent: str,
    max_chunks: int = 15
) -> List[Chunk]:
    """
    Retrieve from System Knowledge Base (Trevor's book + frameworks)
    Shared across all users - no user_id filtering needed
    """
    vector_store_map = {
        "diagnostic": "vs_system_diagnostic",
        "avatar": "vs_system_avatar",
        "canvas": "vs_system_canvas",
        "capture": "vs_system_capture",
        "core": "vs_system_core"
    }

    vector_store_id = vector_store_map[intent]

    # Search System KB via OpenAI Vector Store
    response = openai_client.responses.create(
        model="gpt-5",
        prompt_id=f"{intent}_prompt",
        input=query,
        tools=[{
            "type": "file_search",
            "vector_store_ids": [vector_store_id],
            "file_search": {
                "max_num_results": max_chunks,
                "score_threshold": 0.7
            }
        }],
        store_response=False  # Temporary retrieval, not persisted
    )

    return response.retrieved_chunks


async def retrieve_from_user_kb(
    user_id: str,
    query: str,
    max_chunks: int = 5
) -> List[Chunk]:
    """
    Retrieve from User Knowledge Base (user's diagnostic + documents)
    STRICTLY filtered by user_id for data isolation
    """

    # Generate embedding for query
    query_embedding = await generate_embedding(query)

    # Query PostgreSQL with user filtering
    chunks = await supabase.rpc(
        'match_user_documents',
        {
            'query_embedding': query_embedding,
            'match_user_id': user_id,  # CRITICAL: User isolation
            'match_count': max_chunks
        }
    ).execute()

    return [
        Chunk(
            id=c['id'],
            content=c['content'],
            similarity_score=c['similarity'],
            metadata=c['metadata']
        )
        for c in chunks.data
    ]


async def build_query_with_aggregated_context(
    user_query: str,
    system_chunks: List[Chunk],
    user_chunks: List[Chunk],
    conversation_history: str
) -> str:
    """
    Build final Query with both System and User KB context
    """

    query = f"""
You are the IDEA Brand Coach, an expert in brand strategy using Trevor's framework.

=== EXPERT KNOWLEDGE (Trevor's Framework) ===
{format_chunks(system_chunks)}

=== USER'S BRAND CONTEXT ===
{format_chunks(user_chunks)}

=== CONVERSATION HISTORY ===
{conversation_history}

=== USER'S QUESTION ===
{user_query}

Provide expert coaching that combines Trevor's methodology with the user's specific brand context.
"""

    return query
```

---

## System Knowledge Base Integration

### Purpose
Provides **expert guidance** applicable to all users:
- Trevor's proprietary brand methodology
- Marketing framework syntheses (Positioning, StoryBrand, etc.)
- Best practices and templates

### Structure

```
System KB: 5 Domain-Specific Vector Stores

1. vs_system_diagnostic (10,000 docs, 5GB)
   ├─ Trevor's brand assessment chapters
   ├─ SWOT framework syntheses
   ├─ Competitive positioning strategies
   └─ Brand audit methodologies

2. vs_system_avatar (8,000 docs, 4GB)
   ├─ Trevor's customer profiling methods
   ├─ StoryBrand synthesis (Miller)
   ├─ Persona development frameworks
   └─ Customer journey mapping

3. vs_system_canvas (7,000 docs, 3.5GB)
   ├─ Business Model Canvas explanations
   ├─ Trevor's business strategy guidance
   ├─ Revenue model patterns
   └─ Blue Ocean Strategy synthesis

4. vs_system_capture (12,000 docs, 6GB)
   ├─ Trevor's content strategy chapters
   ├─ Contagious synthesis (Berger)
   ├─ Made to Stick synthesis (Heath)
   └─ Marketing campaign frameworks

5. vs_system_core (5,000 docs, 2.5GB)
   ├─ Trevor's brand foundation philosophy
   ├─ Mission/vision development
   ├─ Brand storytelling principles
   └─ Authenticity frameworks
```

### Upload Process

See [SYSTEM_KNOWLEDGE_BASE_PLAN.md](./SYSTEM_KNOWLEDGE_BASE_PLAN.md) for complete upload instructions.

**Quick Summary:**
1. Upload Trevor's book PDF to OpenAI
2. Distribute chapters to 5 vector stores based on topic
3. Add marketing framework syntheses
4. Configure retrieval parameters

---

## User Knowledge Base Integration

### Purpose
Provides **personalized context** specific to each user:
- **P0 ✅**: User's diagnostic assessment results (6-question IDEA assessment)
- **P0 ✅**: User's past conversation insights (automatic from chat history)
- **P0 Partial**: User's uploaded documents - UI and text extraction exist, needs embeddings sync

### Structure

```
User KB: Per-User Isolated Storage

PostgreSQL Table: user_knowledge_chunks
├─ user_id (UUID) - Foreign key to auth.users
├─ content (TEXT) - Chunk content
├─ embedding (vector(1536)) - Semantic vector
├─ metadata (JSONB) - Source, timestamp, etc.
└─ source (TEXT) - 'diagnostic', 'uploaded_document', 'conversation'

Row Level Security (RLS):
- Users can ONLY access their own chunks
- Enforced at database level
```

### Data Flow: Diagnostic → User KB

```
User completes 6-question diagnostic
    ↓
Format as context document:
"""
BRAND DIAGNOSTIC RESULTS
Company: Acme Corp
Industry: B2B SaaS

IDEA Scores:
- Insight: 75/100 - Good customer understanding
- Distinctive: 45/100 - Needs differentiation work  ← LOW SCORE
- Empathetic: 80/100 - Strong emotional connection
- Authentic: 70/100 - Solid brand authenticity

Overall: 68/100
"""
    ↓
Chunk into smaller pieces (800 tokens each)
    ↓
Generate embeddings for each chunk
    ↓
Store in user_knowledge_chunks table
    ↓
INSERT INTO user_knowledge_chunks (user_id, content, embedding, source)
VALUES ('user_123', 'Distinctive: 45/100...', vector, 'diagnostic');
```

### Implementation: Sync Diagnostic to User KB

```python
async def sync_diagnostic_to_user_kb(
    user_id: str,
    diagnostic_data: DiagnosticAnswers,
    scores: DiagnosticScores
) -> None:
    """
    Convert diagnostic results to embeddings and store in User KB
    """

    # Format diagnostic as context document
    context_doc = format_diagnostic_as_context(diagnostic_data, scores)

    # Chunk the document
    chunks = chunk_text(
        context_doc,
        max_chunk_size=800,
        overlap=400
    )

    # Generate embeddings for each chunk
    for chunk in chunks:
        embedding = await generate_embedding(chunk.content)

        # Insert into user_knowledge_chunks with user_id
        await supabase.from_('user_knowledge_chunks').insert({
            'user_id': user_id,  # CRITICAL: Associate with user
            'content': chunk.content,
            'embedding': embedding,
            'metadata': {
                'source': 'diagnostic',
                'category': chunk.category,
                'score': chunk.score,
                'timestamp': datetime.now().isoformat()
            },
            'source': 'diagnostic'
        }).execute()

    logger.info(f"Synced {len(chunks)} diagnostic chunks for user {user_id}")
```

### Implementation: Sync Uploaded Documents to User KB (P0 TODO)

**Current Status**:
- ✅ UI for document upload exists (`src/components/DocumentUpload.tsx`)
- ✅ Storage in `uploaded_documents` table with text extraction
- ✅ `document-processor` Edge Function extracts text from PDFs/DOCs
- ❌ **Missing**: Sync extracted text to `user_knowledge_chunks` with embeddings

**What Needs to be Built**:

```python
async def sync_document_to_user_kb(
    document_id: str,
    user_id: str
) -> None:
    """
    Sync uploaded document's extracted content to User KB with embeddings

    This function should be called after document-processor completes
    """

    # Fetch document with extracted content
    document = await supabase.from_('uploaded_documents').select('*').eq('id', document_id).single()

    if not document.data or not document.data.get('extracted_content'):
        raise ValueError("Document has no extracted content")

    extracted_text = document.data['extracted_content']

    # Chunk the extracted text
    chunks = chunk_text(
        extracted_text,
        max_chunk_size=800,
        overlap=400
    )

    # Generate embeddings and store in user_knowledge_chunks
    for chunk in chunks:
        embedding = await generate_embedding(chunk.content)

        await supabase.from_('user_knowledge_chunks').insert({
            'user_id': user_id,  # CRITICAL: User isolation
            'content': chunk.content,
            'embedding': embedding,
            'metadata': {
                'source': 'uploaded_document',
                'document_id': document_id,
                'document_name': document.data['filename'],
                'timestamp': datetime.now().isoformat()
            },
            'source': 'uploaded_document'
        }).execute()

    logger.info(f"Synced document '{document.data['filename']}' to User KB with {len(chunks)} chunks")
```

**Integration Point**:
Modify `document-processor` Edge Function to call this after text extraction:

```typescript
// In document-processor/index.ts, after successful extraction:

// Update document status
await supabase
  .from('uploaded_documents')
  .update({
    extracted_content: extractedContent,
    status: 'completed'
  })
  .eq('id', documentId);

// NEW: Sync to embeddings
const { error: embeddingError } = await supabase.functions.invoke('sync-document-to-embeddings', {
  body: {
    documentId: documentId,
    userId: document.user_id
  }
});

if (embeddingError) {
  console.error('Failed to create embeddings:', embeddingError);
}
```

**Create New Edge Function**: `sync-document-to-embeddings`
- Similar to `sync-diagnostic-to-embeddings` (already exists)
- Takes extracted text from `uploaded_documents.extracted_content`
- Chunks and generates embeddings
- Stores in `user_knowledge_chunks` table with `source='uploaded_document'`

---

## Query Construction with Both Sources

### Optimal Chunk Distribution

```
Total Query Budget: ~3,500 tokens
├─ System Prompt: 500 tokens
├─ Retrieved Context: 2,000 tokens
│  ├─ System KB: ~1,500 tokens (15 chunks @ 100 tokens each)
│  └─ User KB: ~500 tokens (5 chunks @ 100 tokens each)
├─ Conversation History: 800 tokens
└─ User Question: 200 tokens
```

**Rationale:**
- **System KB (75%)**: Trevor's expertise is the primary guidance
- **User KB (25%)**: User's context personalizes the advice
- Balance ensures both expert methodology and personalized relevance

### Query Template

```python
QUERY_TEMPLATE = """
You are the IDEA Brand Coach, an expert in brand strategy and marketing.

### EXPERT METHODOLOGY (Trevor's Framework)
{system_kb_chunks}

### THIS USER'S BRAND CONTEXT
{user_kb_chunks}

### CONVERSATION HISTORY
{conversation_history}

### USER'S QUESTION
{user_question}

INSTRUCTIONS:
1. Apply Trevor's methodology from the Expert Methodology section
2. Personalize your advice using This User's Brand Context
3. Reference specific frameworks and scores when relevant
4. Provide actionable next steps

Your response:
"""


def construct_query(
    system_chunks: List[Chunk],
    user_chunks: List[Chunk],
    conversation_history: str,
    user_question: str
) -> str:
    """
    Construct final Query with both System and User KB
    """

    # Format System KB chunks
    system_context = "\n\n".join([
        f"[Trevor's Framework - {chunk.metadata.get('topic')}]\n{chunk.content}"
        for chunk in system_chunks
    ])

    # Format User KB chunks
    user_context = "\n\n".join([
        f"[User Context - {chunk.metadata.get('source')}]\n{chunk.content}"
        for chunk in user_chunks
    ])

    # Build final query
    query = QUERY_TEMPLATE.format(
        system_kb_chunks=system_context,
        user_kb_chunks=user_context,
        conversation_history=conversation_history,
        user_question=user_question
    )

    return query
```

---

## Security & Data Isolation

### Critical Security Principles

```
1. User KB MUST be filtered by user_id at database level
2. Row Level Security (RLS) enforced on PostgreSQL
3. No cross-user data leakage possible
4. System KB is shared (safe - contains no user data)
```

### Security Implementation

```python
async def retrieve_from_user_kb_secure(
    user_id: str,
    query: str,
    max_chunks: int = 5
) -> List[Chunk]:
    """
    SECURE retrieval from User KB with mandatory user_id filtering
    """

    # CRITICAL: Always include user_id filter
    chunks = await supabase.rpc(
        'match_user_documents',
        {
            'query_embedding': await generate_embedding(query),
            'match_user_id': user_id,  # NEVER omit this
            'match_count': max_chunks
        }
    ).execute()

    # RLS at database level ensures only this user's chunks are returned
    return chunks.data
```

### Testing Data Isolation

```python
@pytest.mark.asyncio
async def test_user_kb_isolation():
    """
    Test: Users cannot access other users' knowledge chunks
    """

    # Setup: Create two users with diagnostic data
    user1_id = "user_123"
    user2_id = "user_456"

    await sync_diagnostic_to_user_kb(user1_id, diagnostic1, scores1)
    await sync_diagnostic_to_user_kb(user2_id, diagnostic2, scores2)

    # Test: User 1 retrieves - should only get their chunks
    user1_chunks = await retrieve_from_user_kb(user1_id, "brand positioning")

    for chunk in user1_chunks:
        assert chunk.metadata['user_id'] == user1_id, \
            "User 1 retrieved User 2's data - SECURITY VIOLATION"

    # Test: User 2 retrieves - should only get their chunks
    user2_chunks = await retrieve_from_user_kb(user2_id, "brand positioning")

    for chunk in user2_chunks:
        assert chunk.metadata['user_id'] == user2_id, \
            "User 2 retrieved User 1's data - SECURITY VIOLATION"

    # Test: No overlap between users
    user1_chunk_ids = set(c.id for c in user1_chunks)
    user2_chunk_ids = set(c.id for c in user2_chunks)

    assert len(user1_chunk_ids & user2_chunk_ids) == 0, \
        "Chunks shared between users - DATA ISOLATION FAILED"
```

---

## Optimization Strategies

### Strategy 1: Adaptive Chunk Distribution

**Goal**: Adjust System KB vs User KB ratio based on query type

```python
def determine_chunk_distribution(intent: str, user_has_diagnostic: bool):
    """
    Adaptive distribution based on query intent and user data availability
    """

    distributions = {
        # Generic queries: More Trevor's guidance
        "core": {
            "system_chunks": 18,
            "user_chunks": 2 if user_has_diagnostic else 0
        },

        # Assessment queries: Balanced
        "diagnostic": {
            "system_chunks": 12,
            "user_chunks": 8 if user_has_diagnostic else 0
        },

        # Personalized queries: More user context
        "avatar": {
            "system_chunks": 10,
            "user_chunks": 10 if user_has_diagnostic else 0
        }
    }

    return distributions.get(intent, {"system_chunks": 15, "user_chunks": 5})
```

### Strategy 2: Prioritize Low-Scoring Dimensions

**Goal**: Surface Trevor's guidance for user's weakest areas

```python
def prioritize_low_scores(user_chunks: List[Chunk]) -> List[Chunk]:
    """
    Boost retrieval for dimensions where user scored low
    """

    # Identify low-scoring dimensions from diagnostic
    low_scores = [
        chunk for chunk in user_chunks
        if 'score' in chunk.metadata and chunk.metadata['score'] < 60
    ]

    # If user has low Distinctive score (45/100), prioritize:
    # - Trevor's differentiation frameworks from System KB
    # - User's diagnostic highlighting the low score

    return sorted(
        user_chunks,
        key=lambda c: c.metadata.get('score', 100),  # Lower scores first
        reverse=False
    )
```

### Strategy 3: Boost Trevor's Content

**Goal**: Ensure Trevor's book is primary source

```python
def boost_trevors_content(system_chunks: List[Chunk]) -> List[Chunk]:
    """
    Boost Trevor's book chunks over marketing syntheses
    """

    for chunk in system_chunks:
        if 'trevors_book' in chunk.metadata.get('source', ''):
            chunk.similarity_score *= 1.15  # 15% boost

    return sorted(
        system_chunks,
        key=lambda c: c.similarity_score,
        reverse=True
    )
```

### Strategy 4: Cross-Reference System + User Context

**Goal**: Find System KB chunks that relate to User KB context

```python
async def retrieve_with_user_context_awareness(
    user_id: str,
    query: str,
    intent: str
) -> Dict[str, List[Chunk]]:
    """
    Retrieve System KB chunks that are relevant to user's diagnostic
    """

    # First, get user's context
    user_chunks = await retrieve_from_user_kb(user_id, query, max_chunks=5)

    # Extract key themes from user's diagnostic
    user_themes = extract_themes(user_chunks)
    # Example: ["low_distinctive_score", "b2b_saas", "competitor_differentiation"]

    # Enhance query with user themes for System KB search
    enhanced_query = f"{query} {' '.join(user_themes)}"

    # Retrieve from System KB with enhanced query
    system_chunks = await retrieve_from_system_kb(
        enhanced_query,
        intent,
        max_chunks=15
    )

    return {
        "system_chunks": system_chunks,
        "user_chunks": user_chunks
    }
```

---

## Retrieval Quality Metrics

### Metric 1: System vs User Balance

**Definition**: Verify appropriate mix of System and User KB chunks

```python
def measure_kb_balance(retrieved_chunks: List[Chunk]) -> Dict:
    """
    Measure distribution of System KB vs User KB
    """

    system_chunks = [c for c in retrieved_chunks if c.source == 'system_kb']
    user_chunks = [c for c in retrieved_chunks if c.source == 'user_kb']

    return {
        "system_count": len(system_chunks),
        "user_count": len(user_chunks),
        "system_percentage": len(system_chunks) / len(retrieved_chunks),
        "user_percentage": len(user_chunks) / len(retrieved_chunks),
        "balance_score": min(len(system_chunks), len(user_chunks)) / max(len(system_chunks), len(user_chunks))
    }

# Target:
# system_percentage: 70-80%
# user_percentage: 20-30%
```

### Metric 2: Trevor's Content Representation

**Definition**: Ensure Trevor's book is well-represented in System KB results

```python
def measure_trevors_representation(system_chunks: List[Chunk]) -> Dict:
    """
    Measure how much Trevor's book content is retrieved
    """

    trevors_chunks = [
        c for c in system_chunks
        if 'trevors_book' in c.metadata.get('source', '')
    ]

    return {
        "trevors_count": len(trevors_chunks),
        "trevors_percentage": len(trevors_chunks) / len(system_chunks),
        "avg_similarity": sum(c.similarity_score for c in trevors_chunks) / len(trevors_chunks)
    }

# Target:
# trevors_percentage: > 60% (Trevor's book should dominate)
# avg_similarity: > 0.80 (highly relevant)
```

### Metric 3: User Context Relevance

**Definition**: Verify user's diagnostic/documents are relevant to query

```python
def measure_user_context_relevance(
    user_chunks: List[Chunk],
    query: str
) -> Dict:
    """
    Measure relevance of user's context to current query
    """

    diagnostic_chunks = [c for c in user_chunks if c.source == 'diagnostic']
    document_chunks = [c for c in user_chunks if c.source == 'uploaded_document']

    return {
        "diagnostic_count": len(diagnostic_chunks),
        "document_count": len(document_chunks),
        "avg_similarity": sum(c.similarity_score for c in user_chunks) / len(user_chunks),
        "low_score_mentioned": any(
            c.metadata.get('score', 100) < 60
            for c in diagnostic_chunks
        )
    }

# Target:
# avg_similarity: > 0.75 (user context is relevant)
# low_score_mentioned: True (addressing user's weak areas)
```

---

## Configuration Best Practices

### Recommended Configuration

```python
# config/rag_config.py

RAG_CONFIG = {
    # System Knowledge Base (Shared)
    "system_kb": {
        "vector_stores": {
            "diagnostic": "vs_system_diagnostic",
            "avatar": "vs_system_avatar",
            "canvas": "vs_system_canvas",
            "capture": "vs_system_capture",
            "core": "vs_system_core"
        },
        "retrieval": {
            "max_chunks": 15,
            "score_threshold": 0.7,
            "boost_trevors_content": True,
            "trevor_boost_factor": 1.15
        }
    },

    # User Knowledge Base (Per-User)
    "user_kb": {
        "database": "postgresql",
        "table": "user_knowledge_chunks",
        "retrieval": {
            "max_chunks": 5,
            "score_threshold": 0.65,  # Slightly lower - user context is valuable
            "prioritize_low_scores": True,
            "sources": ["diagnostic", "uploaded_document", "conversation"]
        }
    },

    # Aggregation Strategy
    "aggregation": {
        "total_chunks": 20,
        "system_ratio": 0.75,  # 75% System KB
        "user_ratio": 0.25,    # 25% User KB
        "adaptive_distribution": True,  # Adjust based on query intent
        "cross_reference": True  # Use user context to enhance System KB search
    },

    # Security
    "security": {
        "enforce_user_filtering": True,  # MANDATORY
        "enable_rls": True,
        "log_access": True,
        "audit_cross_user_leakage": True
    }
}
```

### Intent-Specific Configurations

```python
INTENT_CONFIGS = {
    "diagnostic": {
        "system_chunks": 12,
        "user_chunks": 8,
        "rationale": "Assessment needs balanced System + User context"
    },

    "avatar": {
        "system_chunks": 10,
        "user_chunks": 10,
        "rationale": "Customer profiling highly personalized"
    },

    "canvas": {
        "system_chunks": 14,
        "user_chunks": 6,
        "rationale": "Business models need expert frameworks (Trevor)"
    },

    "capture": {
        "system_chunks": 13,
        "user_chunks": 7,
        "rationale": "Marketing execution balanced"
    },

    "core": {
        "system_chunks": 18,
        "user_chunks": 2,
        "rationale": "Brand foundations are universal (Trevor's philosophy)"
    }
}
```

---

## Complete Implementation Example

```python
class AggregatedRAGSystem:
    """
    Complete RAG system with System KB + User KB aggregation
    """

    def __init__(self, config: Dict):
        self.config = config
        self.openai_client = OpenAI()
        self.supabase = create_supabase_client()

    async def process_user_query(
        self,
        user_id: str,
        query: str,
        conversation_history: str = ""
    ) -> str:
        """
        Main entry point: Process user query with aggregated RAG
        """

        # Step 1: Classify intent
        intent = await self.classify_intent(query)

        # Step 2: Determine chunk distribution
        distribution = self.get_chunk_distribution(intent, user_id)

        # Step 3: Retrieve from both knowledge bases in parallel
        system_chunks, user_chunks = await asyncio.gather(
            self.retrieve_system_kb(query, intent, distribution["system_chunks"]),
            self.retrieve_user_kb(user_id, query, distribution["user_chunks"])
        )

        # Step 4: Boost Trevor's content in System KB
        if self.config["system_kb"]["retrieval"]["boost_trevors_content"]:
            system_chunks = self.boost_trevors_content(system_chunks)

        # Step 5: Prioritize low-scoring dimensions in User KB
        if self.config["user_kb"]["retrieval"]["prioritize_low_scores"]:
            user_chunks = self.prioritize_low_scores(user_chunks)

        # Step 6: Construct augmented Query
        query_text = self.construct_query(
            system_chunks=system_chunks,
            user_chunks=user_chunks,
            conversation_history=conversation_history,
            user_question=query
        )

        # Step 7: Send to Model
        response = await self.openai_client.responses.create(
            model="gpt-5",
            prompt_id=f"{intent}_prompt",
            input=query_text,
            store_response=True
        )

        # Step 8: Log for monitoring
        await self.log_retrieval_quality(
            user_id=user_id,
            query=query,
            system_chunks=system_chunks,
            user_chunks=user_chunks,
            response=response
        )

        return response.output

    async def retrieve_system_kb(
        self,
        query: str,
        intent: str,
        max_chunks: int
    ) -> List[Chunk]:
        """Retrieve from System KB (Trevor's book + frameworks)"""
        vector_store_id = self.config["system_kb"]["vector_stores"][intent]

        response = await self.openai_client.responses.create(
            model="gpt-5",
            prompt_id=f"{intent}_prompt",
            input=query,
            tools=[{
                "type": "file_search",
                "vector_store_ids": [vector_store_id],
                "file_search": {
                    "max_num_results": max_chunks,
                    "score_threshold": self.config["system_kb"]["retrieval"]["score_threshold"]
                }
            }],
            store_response=False
        )

        return response.retrieved_chunks

    async def retrieve_user_kb(
        self,
        user_id: str,
        query: str,
        max_chunks: int
    ) -> List[Chunk]:
        """Retrieve from User KB (user's diagnostic + documents)"""

        query_embedding = await self.generate_embedding(query)

        chunks = await self.supabase.rpc(
            'match_user_documents',
            {
                'query_embedding': query_embedding,
                'match_user_id': user_id,  # CRITICAL: User isolation
                'match_count': max_chunks
            }
        ).execute()

        return [Chunk(**c) for c in chunks.data]
```

---

## Key Takeaways

### Architectural Principles

1. ✅ **Two Knowledge Bases**: System (shared) + User (isolated)
2. ✅ **Runtime Aggregation**: Retrieve from both, combine in Query
3. ✅ **Data Isolation**: User KB strictly filtered by user_id
4. ✅ **Optimal Balance**: 75% System KB (Trevor) + 25% User KB (context)
5. ✅ **Security First**: RLS enforced, no cross-user leakage

### Implementation Checklist

- [ ] System KB: 5 vector stores with Trevor's book + frameworks
- [ ] User KB: PostgreSQL table with RLS enabled
- [ ] Parallel retrieval from both knowledge bases
- [ ] Query construction with both sources
- [ ] Security testing for data isolation
- [ ] Monitoring for retrieval quality (System vs User balance)
- [ ] Configuration per intent (adaptive distribution)

---

**Document Version:** 2.0
**Last Updated:** 2025-11-13
**Status:** ✅ Implementation Guide Complete - Architectural Separation Defined

**Related Documents:**
- [System Knowledge Base Plan](./SYSTEM_KNOWLEDGE_BASE_PLAN.md)
- [High-Level Design](./IDEA_BRAND_COACH_HIGH_LEVEL_DESIGN.md)
- [Model Comparison Testing Framework](./MODEL_COMPARISON_TESTING_FRAMEWORK.md)

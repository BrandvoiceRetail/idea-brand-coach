# QMR Knowledge Base Integration Guide
## Ensuring Relevant System Knowledge Reaches the Model

**Version:** 1.0
**Last Updated:** 2025-11-13
**Status:** Implementation Guide

---

## Executive Summary

This guide explains how to ensure that relevant information from the **System Knowledge Base** (Trevor's book + marketing frameworks) is properly included in the **Query** portion of the QMR (Query → Model → Response) framework. The goal is to maximize retrieval quality so that the Model receives the most relevant context for generating expert brand coaching responses.

**Key Principle**: The Model ONLY sees what's in the Query. File search's job is to intelligently select ONLY relevant chunks from 10,000+ documents and include them in the Query.

---

## Table of Contents

1. [Understanding QMR in the Context of Knowledge Base](#understanding-qmr-in-the-context-of-knowledge-base)
2. [The File Search Mechanism](#the-file-search-mechanism)
3. [Optimization Strategies](#optimization-strategies)
4. [Retrieval Quality Metrics](#retrieval-quality-metrics)
5. [Troubleshooting Poor Retrieval](#troubleshooting-poor-retrieval)
6. [Testing & Validation](#testing--validation)
7. [Configuration Best Practices](#configuration-best-practices)

---

## Understanding QMR in the Context of Knowledge Base

### The QMR Framework Revisited

From the High-Level Design document, QMR stands for:

```
Query → Model → Response

Query = TOTAL INPUT to the Model, including:
├─ System Prompt (IDEA Brand Coach instructions)
├─ Retrieved Context (from file search - TOP 20 relevant chunks)
├─ Conversation History (via previous_response_id)
└─ User's Current Message
```

### Why This Matters for Knowledge Base

**Problem**: We have 42,000+ documents across 5 vector stores (~25GB total knowledge)

**Challenge**: We can only send ~3,500 tokens of context to the Model (top 20 chunks ≈ 2,000 tokens)

**Solution**: Intelligent semantic retrieval ensures the Model gets the MOST RELEVANT 2,000 tokens out of 25GB

### Visual Flow

```
User asks: "How do I improve my brand positioning?"
    ↓
Step 1: Identify Intent
├─ Router analyzes: "positioning" → Diagnostic prompt
└─ Select vector store: diagnostic_kb (10,000 docs)
    ↓
Step 2: Semantic Search
├─ Convert query to embedding vector
├─ Compare to ALL 10,000 doc vectors in diagnostic_kb
├─ Rank by cosine similarity
└─ Result: Top 20 chunks (similarity 0.92-0.78)
    ↓
Step 3: Build Query
Query = System Prompt (500 tokens)
      + Top 20 Chunks (2,000 tokens) ← THIS IS CRITICAL
      + Conversation History (800 tokens)
      + User Question (50 tokens)
    = 3,350 total tokens sent to Model
    ↓
Step 4: Model Processes Query
├─ Attention mechanism weights chunks by relevance
├─ Generates response using retrieved knowledge
└─ Cites sources from retrieved chunks
    ↓
Response: "To improve your brand positioning, based on Trevor's
framework... [cites retrieved chunks]"
```

---

## The File Search Mechanism

### How OpenAI File Search Works

**File Search is the engine that populates the Query with relevant knowledge.**

#### Step-by-Step Process

```python
# When you call Responses API with file search:
response = client.responses.create(
    model="gpt-5",
    prompt_id="diagnostic_prompt",
    input="How do I improve my brand positioning?",
    previous_response_id=last_response_id,
    tools=[{
        "type": "file_search",
        "vector_store_ids": ["vs_diagnostic_kb"],
        "file_search": {
            "max_num_results": 20,  # Top-K retrieval
            "ranking_options": {
                "ranker": "default_2024_08_21",
                "score_threshold": 0.7  # Minimum relevance
            }
        }
    }],
    store_response=True
)

# What happens behind the scenes:
```

**Behind the Scenes:**

1. **Query Embedding** (automatic)
   ```
   User Query: "How do I improve my brand positioning?"
   ↓
   OpenAI embeds with text-embedding-3-large
   ↓
   Query Vector: [-0.023, 0.156, -0.089, ..., 0.234] (3072 dimensions)
   ```

2. **Vector Similarity Search** (automatic)
   ```
   For each of 10,000 chunks in diagnostic_kb:
       Calculate cosine_similarity(query_vector, chunk_vector)

   Results (sorted by similarity):
   1. "Brand positioning frameworks" → 0.94
   2. "Competitive differentiation strategies" → 0.91
   3. "Market positioning analysis" → 0.89
   4. "Positioning statement templates" → 0.87
   5. "Trevor's positioning methodology" → 0.86
   ...
   9,996. "Tomato gardening guide" → 0.12 (irrelevant)
   ```

3. **Top-K Selection** (automatic)
   ```
   Select top 20 chunks with similarity > 0.7
   ↓
   Total context: ~2,000 tokens
   ↓
   These 20 chunks are added to the Query
   ```

4. **Query Construction** (automatic)
   ```
   Final Query sent to GPT-5:

   [System Prompt]
   You are the IDEA Brand Coach, an expert in brand strategy...

   [Retrieved Context - Top 20 Chunks]
   Chunk 1 (similarity 0.94): "Brand positioning is the process of..."
   Chunk 2 (similarity 0.91): "Competitive differentiation requires..."
   Chunk 3 (similarity 0.89): "Market analysis for positioning involves..."
   ...
   Chunk 20 (similarity 0.78): "Positioning statements should include..."

   [Conversation History]
   User previously asked: "What's my brand strength?"
   Assistant responded: "Let's assess your brand..."

   [Current User Question]
   User: "How do I improve my brand positioning?"
   ```

5. **Model Processing** (automatic)
   ```
   GPT-5 receives the complete Query (3,350 tokens)
   ↓
   Attention mechanism focuses on most relevant parts
   ↓
   Generates response using retrieved knowledge
   ```

### What You Control vs What's Automatic

**You Control:**
- ✅ Which vector store to search (`diagnostic_kb`, `avatar_kb`, etc.)
- ✅ How many chunks to retrieve (`max_num_results: 20`)
- ✅ Minimum relevance threshold (`score_threshold: 0.7`)
- ✅ Which embedding model to use (text-embedding-3-large)
- ✅ Chunking strategy when uploading documents (800 tokens, 400 overlap)

**OpenAI Handles Automatically:**
- ✅ Converting query to embedding vector
- ✅ Comparing to all chunk vectors
- ✅ Ranking by semantic similarity
- ✅ Building the final Query
- ✅ Sending Query to Model

---

## Optimization Strategies

### Strategy 1: Intelligent Routing to Correct Vector Store

**Goal**: Send queries to the vector store with the most relevant knowledge

**How It Works:**

```
User Query → Router Prompt → Intent Classification → Select Vector Store

Examples:
"Assess my brand" → Diagnostic → diagnostic_kb ✅
"Define my ideal customer" → Avatar → avatar_kb ✅
"Create content strategy" → CAPTURE → capture_kb ✅
```

**Implementation:**

```python
# Route to appropriate vector store based on intent
routing_map = {
    "diagnostic": "vs_diagnostic_kb",
    "avatar": "vs_avatar_kb",
    "canvas": "vs_canvas_kb",
    "capture": "vs_capture_kb",
    "core": "vs_core_kb"
}

# Router determines intent
intent = route_user_query(user_message)  # Returns: "diagnostic"

# Select correct vector store
vector_store_id = routing_map[intent]

# File search now searches ONLY the relevant 10K docs (not all 42K)
response = client.responses.create(
    model="gpt-5",
    prompt_id=f"{intent}_prompt",
    input=user_message,
    tools=[{
        "type": "file_search",
        "vector_store_ids": [vector_store_id]  # Focused search!
    }]
)
```

**Why This Matters:**

- ❌ Without routing: Search all 42,000 docs → diluted results
- ✅ With routing: Search relevant 10,000 docs → focused results

### Strategy 2: Optimize Chunking During Upload

**Goal**: Ensure documents are chunked at the right granularity for retrieval

**Trevor's Book Upload Configuration:**

```python
from openai import OpenAI
client = OpenAI()

# Upload Trevor's book with optimal chunking
file = client.files.create(
    file=open("trevors_book.pdf", "rb"),
    purpose="assistants"
)

# Add to vector store with chunking strategy
vector_store = client.vector_stores.create(
    name="Diagnostic Knowledge Base",
    file_ids=[file.id],
    chunking_strategy={
        "type": "static",
        "static": {
            "max_chunk_size_tokens": 800,  # Sweet spot for retrieval
            "chunk_overlap_tokens": 400     # Preserve context across chunks
        }
    }
)
```

**Chunking Guidelines:**

| Chunk Size | Pros | Cons | Best For |
|------------|------|------|----------|
| **400 tokens** | More granular, precise matches | May lose context | Short, specific facts |
| **800 tokens** ⭐ | **Balanced context + precision** | **Recommended default** | **Most use cases** |
| **1200 tokens** | More context per chunk | Less precise matching | Long-form explanations |

**Why 800 Tokens Works Best:**

- ✅ One complete concept or framework per chunk
- ✅ Enough context for Model to understand
- ✅ Not so large that irrelevant info dilutes relevance
- ✅ 400-token overlap preserves cross-chunk context

### Strategy 3: Tune Retrieval Parameters

**Goal**: Balance between precision (quality) and recall (coverage)

**Key Parameters:**

```python
tools=[{
    "type": "file_search",
    "vector_store_ids": ["vs_diagnostic_kb"],
    "file_search": {
        "max_num_results": 20,  # Top-K: How many chunks to retrieve
        "ranking_options": {
            "ranker": "default_2024_08_21",  # Latest algorithm
            "score_threshold": 0.7  # Minimum similarity (0.0-1.0)
        }
    }
}]
```

**Parameter Tuning Guide:**

#### `max_num_results` (Top-K)

| Value | Context Size | When to Use | Tradeoff |
|-------|--------------|-------------|----------|
| **10** | ~1,000 tokens | Simple queries, fast responses | Less comprehensive |
| **20** ⭐ | **~2,000 tokens** | **Most queries (recommended)** | **Balanced** |
| **50** | ~5,000 tokens | Complex analysis, research queries | Slower, higher cost |

**Example Configurations:**

```python
# Configuration A: Fast, Precise (for simple queries)
"file_search": {
    "max_num_results": 10,
    "score_threshold": 0.8  # High threshold = only very relevant chunks
}

# Configuration B: Balanced (recommended default)
"file_search": {
    "max_num_results": 20,
    "score_threshold": 0.7  # Good balance
}

# Configuration C: Comprehensive (for complex queries)
"file_search": {
    "max_num_results": 50,
    "score_threshold": 0.6  # Lower threshold = more inclusive
}
```

#### `score_threshold` (Minimum Relevance)

| Value | Effect | When to Use |
|-------|--------|-------------|
| **0.9** | Only highly similar chunks | Queries needing exact matches |
| **0.7** ⭐ | **Good balance (recommended)** | **Most use cases** |
| **0.5** | More inclusive, some noise | Exploratory queries |

**How to Choose:**

```python
def select_retrieval_config(query_complexity, user_intent):
    if query_complexity == "simple":
        return {
            "max_num_results": 10,
            "score_threshold": 0.8
        }
    elif query_complexity == "medium":
        return {
            "max_num_results": 20,  # Default
            "score_threshold": 0.7
        }
    elif query_complexity == "complex":
        return {
            "max_num_results": 50,
            "score_threshold": 0.6
        }
```

### Strategy 4: Enhance Queries with Context

**Goal**: Help file search understand user intent better

**Technique: Query Expansion**

Instead of sending raw user query, expand it with context:

```python
# Basic approach (less effective)
raw_query = "How do I improve positioning?"

# Enhanced approach (more effective)
enhanced_query = f"""
User Context:
- Company: {user_profile.company}
- Industry: {user_profile.industry}
- Current Challenge: Struggling with brand positioning

User Question: How do I improve positioning?

Additional Context from Conversation:
- User previously completed brand diagnostic
- IDEA Scores: Insight=75, Distinctive=45, Empathetic=80, Authentic=70
- Low Distinctive score suggests positioning is the key issue
"""

response = client.responses.create(
    model="gpt-5",
    prompt_id="diagnostic_prompt",
    input=enhanced_query,  # More context = better retrieval
    tools=[{"type": "file_search", "vector_store_ids": ["vs_diagnostic_kb"]}]
)
```

**Why This Works:**

- ✅ File search embeds the enhanced query (more semantic info)
- ✅ Better matches to relevant positioning content
- ✅ Model receives both context AND retrieved knowledge

### Strategy 5: Multi-Store Search for Cross-Domain Queries

**Goal**: Handle queries that span multiple domains

**Example Query:**
"How do I position my brand to attract my ideal customer?"

This requires knowledge from:
- `diagnostic_kb` (positioning frameworks)
- `avatar_kb` (customer understanding)

**Implementation:**

```python
# Approach A: Sequential search (recommended for most cases)
def handle_cross_domain_query(user_query, intents):
    """
    intents = ["diagnostic", "avatar"]
    """
    all_retrieved_chunks = []

    for intent in intents:
        vector_store_id = routing_map[intent]

        # Search each relevant vector store
        temp_response = client.responses.create(
            model="gpt-5",
            prompt_id=f"{intent}_prompt",
            input=user_query,
            tools=[{
                "type": "file_search",
                "vector_store_ids": [vector_store_id],
                "file_search": {
                    "max_num_results": 10  # 10 from each store
                }
            }],
            store_response=False  # Don't persist temporary calls
        )

        all_retrieved_chunks.extend(temp_response.retrieved_chunks)

    # Now create final response with all retrieved knowledge
    final_response = client.responses.create(
        model="gpt-5",
        prompt_id="diagnostic_prompt",  # Primary domain
        input=user_query,
        # Include all retrieved chunks in system prompt
        # (manual context injection)
    )

    return final_response

# Approach B: Multi-store search (simpler, if supported)
response = client.responses.create(
    model="gpt-5",
    prompt_id="diagnostic_prompt",
    input=user_query,
    tools=[{
        "type": "file_search",
        "vector_store_ids": [
            "vs_diagnostic_kb",  # Search both stores
            "vs_avatar_kb"
        ],
        "file_search": {
            "max_num_results": 20  # Total across both stores
        }
    }]
)
```

**When to Use:**
- Complex queries spanning multiple IDEA dimensions
- User asks about relationships between concepts
- Rare for most brand coaching queries (single-domain is typical)

---

## Retrieval Quality Metrics

### How to Measure If Relevant Knowledge Is Reaching the Model

#### Metric 1: Retrieval Precision

**Definition**: Percentage of retrieved chunks that are actually relevant

```python
def calculate_retrieval_precision(retrieved_chunks, ground_truth_relevant_chunks):
    """
    retrieved_chunks: Top 20 chunks file search returned
    ground_truth_relevant_chunks: Manually labeled relevant chunks
    """
    relevant_retrieved = sum(
        1 for chunk in retrieved_chunks
        if chunk.id in ground_truth_relevant_chunks
    )

    precision = relevant_retrieved / len(retrieved_chunks)
    return precision

# Example:
# Retrieved 20 chunks
# 18 are actually relevant to user's query
# Precision = 18/20 = 0.90 (90%)
```

**Target**: > 80% precision

#### Metric 2: Retrieval Recall

**Definition**: Percentage of relevant chunks that were actually retrieved

```python
def calculate_retrieval_recall(retrieved_chunks, ground_truth_relevant_chunks):
    """
    How many of the relevant chunks did we find?
    """
    relevant_retrieved = sum(
        1 for chunk_id in ground_truth_relevant_chunks
        if chunk_id in [c.id for c in retrieved_chunks]
    )

    recall = relevant_retrieved / len(ground_truth_relevant_chunks)
    return recall

# Example:
# 25 total relevant chunks in knowledge base
# Retrieved 18 of them
# Recall = 18/25 = 0.72 (72%)
```

**Target**: > 70% recall

#### Metric 3: Mean Reciprocal Rank (MRR)

**Definition**: How quickly do relevant chunks appear in results?

```python
def calculate_mrr(retrieved_chunks, ground_truth_relevant_chunks):
    """
    Measures ranking quality - are relevant chunks at the top?
    """
    for rank, chunk in enumerate(retrieved_chunks, start=1):
        if chunk.id in ground_truth_relevant_chunks:
            return 1.0 / rank  # Reciprocal of first relevant chunk's rank

    return 0.0  # No relevant chunks found

# Example:
# First relevant chunk appears at position 2
# MRR = 1/2 = 0.50

# Ideal: First relevant chunk at position 1
# MRR = 1/1 = 1.00
```

**Target**: > 0.7 MRR (relevant chunks in top 3)

#### Metric 4: Similarity Score Distribution

**Definition**: What's the similarity range of retrieved chunks?

```python
def analyze_similarity_distribution(retrieved_chunks):
    similarities = [chunk.similarity_score for chunk in retrieved_chunks]

    return {
        "max": max(similarities),
        "min": min(similarities),
        "mean": sum(similarities) / len(similarities),
        "range": max(similarities) - min(similarities)
    }

# Good distribution:
# {
#   "max": 0.94,  # Highly relevant
#   "min": 0.78,  # Still reasonably relevant
#   "mean": 0.86,
#   "range": 0.16  # Tight distribution
# }

# Poor distribution:
# {
#   "max": 0.92,
#   "min": 0.42,  # Some irrelevant chunks
#   "mean": 0.67,
#   "range": 0.50  # Wide distribution (indicates noise)
# }
```

**Target**: Mean similarity > 0.75, range < 0.25

### Monitoring Retrieval Quality in Production

```python
class RetrievalQualityMonitor:
    def __init__(self):
        self.metrics = []

    def log_retrieval(self, user_query, retrieved_chunks, user_feedback=None):
        """Log every retrieval for analysis"""

        metric = {
            "timestamp": datetime.now().isoformat(),
            "query": user_query,
            "num_chunks": len(retrieved_chunks),
            "similarity_scores": [c.similarity_score for c in retrieved_chunks],
            "avg_similarity": sum(c.similarity_score for c in retrieved_chunks) / len(retrieved_chunks),
            "min_similarity": min(c.similarity_score for c in retrieved_chunks),
            "chunk_sources": [c.metadata.get("source") for c in retrieved_chunks],
            "user_feedback": user_feedback  # "helpful" / "not helpful"
        }

        self.metrics.append(metric)

        # Alert if quality drops
        if metric["avg_similarity"] < 0.65:
            self.alert_low_retrieval_quality(metric)

    def analyze_retrieval_patterns(self):
        """Weekly analysis of retrieval quality"""

        return {
            "avg_similarity_all_queries": statistics.mean(
                m["avg_similarity"] for m in self.metrics
            ),
            "queries_below_threshold": sum(
                1 for m in self.metrics if m["avg_similarity"] < 0.7
            ),
            "most_common_sources": Counter(
                source
                for m in self.metrics
                for source in m["chunk_sources"]
            ).most_common(10),
            "user_satisfaction": sum(
                1 for m in self.metrics
                if m["user_feedback"] == "helpful"
            ) / len([m for m in self.metrics if m["user_feedback"]])
        }
```

---

## Troubleshooting Poor Retrieval

### Symptom 1: Model Gives Generic Responses

**Indicators:**
- Responses don't reference Trevor's methodology
- No specific frameworks mentioned
- Feels like ChatGPT, not IDEA Brand Coach

**Diagnosis:**

```python
# Check retrieved chunks
for chunk in retrieved_chunks:
    print(f"Similarity: {chunk.similarity_score}")
    print(f"Source: {chunk.metadata['source']}")
    print(f"Content preview: {chunk.content[:200]}")
    print("---")

# If similarity scores are low (< 0.7), retrieval is failing
```

**Solutions:**

1. **Lower similarity threshold:**
   ```python
   "score_threshold": 0.6  # Was 0.7, now more inclusive
   ```

2. **Increase retrieval count:**
   ```python
   "max_num_results": 30  # Was 20, now more comprehensive
   ```

3. **Check if query is being routed to correct vector store:**
   ```python
   # Verify routing logic
   intent = route_user_query("Assess my brand")
   assert intent == "diagnostic"  # Should be True
   ```

4. **Enhance query with context:**
   ```python
   enhanced_query = f"[Brand Assessment Context]\n{user_query}"
   ```

### Symptom 2: Irrelevant Chunks Retrieved

**Indicators:**
- Retrieved chunks talk about unrelated topics
- Wide similarity score range (0.95 to 0.40)
- Model response uses irrelevant information

**Diagnosis:**

```python
# Check chunk relevance manually
for chunk in retrieved_chunks:
    is_relevant = manually_assess_relevance(chunk.content, user_query)
    if not is_relevant and chunk.similarity_score > 0.7:
        print(f"FALSE POSITIVE: {chunk.id}")
        print(f"Similarity: {chunk.similarity_score}")
        print(f"Content: {chunk.content[:500]}")
```

**Solutions:**

1. **Raise similarity threshold:**
   ```python
   "score_threshold": 0.8  # Was 0.7, now more selective
   ```

2. **Reduce retrieval count:**
   ```python
   "max_num_results": 10  # Was 20, focus on top results
   ```

3. **Improve document tagging during upload:**
   ```python
   # Add metadata to chunks for better filtering
   client.files.create(
       file=open("positioning_chapter.pdf", "rb"),
       purpose="assistants",
       metadata={
           "category": "diagnostic",
           "topic": "positioning",
           "source": "trevors_book_chapter_7"
       }
   )
   ```

4. **Use metadata filtering:**
   ```python
   "file_search": {
       "max_num_results": 20,
       "metadata_filter": {
           "topic": "positioning"  # Only retrieve positioning chunks
       }
   }
   ```

### Symptom 3: Missing Key Information

**Indicators:**
- Model doesn't cite Trevor's specific frameworks
- Important concepts from the book aren't mentioned
- Response quality lower than expected

**Diagnosis:**

```python
# Check if Trevor's book chunks are being retrieved
trevors_chunks = [
    chunk for chunk in retrieved_chunks
    if "trevors_book" in chunk.metadata.get("source", "")
]

print(f"Trevor's chunks retrieved: {len(trevors_chunks)}/20")
# Should be > 50% for most queries

# Check if specific concepts exist in knowledge base
search_result = client.vector_stores.search(
    vector_store_id="vs_diagnostic_kb",
    query="SWOT analysis framework Trevor",
    max_results=5
)
```

**Solutions:**

1. **Verify Trevor's book was uploaded correctly:**
   ```bash
   # Check file status
   file = client.files.retrieve(file_id)
   print(f"Status: {file.status}")  # Should be "processed"

   # Check vector store file count
   vs = client.vector_stores.retrieve("vs_diagnostic_kb")
   print(f"Files: {vs.file_counts}")
   ```

2. **Re-chunk Trevor's book with smaller chunks:**
   ```python
   # If book chunks are too large, they may not match well
   "chunking_strategy": {
       "static": {
           "max_chunk_size_tokens": 600,  # Smaller = more granular
           "chunk_overlap_tokens": 300
       }
   }
   ```

3. **Boost Trevor's content in retrieval:**
   ```python
   # Custom ranking that prioritizes Trevor's book
   def rerank_chunks(chunks, boost_sources=["trevors_book"]):
       for chunk in chunks:
           if any(source in chunk.metadata.get("source", "") for source in boost_sources):
               chunk.similarity_score *= 1.1  # 10% boost

       chunks.sort(key=lambda c: c.similarity_score, reverse=True)
       return chunks[:20]
   ```

### Symptom 4: Inconsistent Retrieval Quality

**Indicators:**
- Some queries retrieve great content, others don't
- User experience is unpredictable
- Hard to identify pattern

**Diagnosis:**

```python
# Analyze retrieval quality by query category
categories = ["diagnostic", "avatar", "canvas", "capture", "core"]

for category in categories:
    queries = [q for q in test_queries if q.category == category]

    avg_similarity = statistics.mean(
        q.avg_retrieval_similarity for q in queries
    )

    print(f"{category}: avg similarity = {avg_similarity:.2f}")

# Identify which categories have poor retrieval
# Example output:
# diagnostic: 0.86 ✅
# avatar: 0.82 ✅
# canvas: 0.65 ❌ <- Problem category
# capture: 0.88 ✅
# core: 0.84 ✅
```

**Solutions:**

1. **Add more content to underperforming categories:**
   ```python
   # If canvas_kb has poor retrieval, add more business model content
   ```

2. **Improve query classification:**
   ```python
   # Some queries may be misrouted
   # "Design my revenue model" misrouted to diagnostic instead of canvas
   # Fix: Improve router prompt
   ```

3. **Category-specific retrieval configs:**
   ```python
   retrieval_configs = {
       "diagnostic": {"max_num_results": 20, "score_threshold": 0.7},
       "avatar": {"max_num_results": 20, "score_threshold": 0.7},
       "canvas": {"max_num_results": 30, "score_threshold": 0.6},  # More lenient
       "capture": {"max_num_results": 20, "score_threshold": 0.7},
       "core": {"max_num_results": 15, "score_threshold": 0.75}    # More selective
   }
   ```

---

## Testing & Validation

### Test Suite for Retrieval Quality

```python
import pytest

class TestRetrievalQuality:
    """Automated tests for knowledge base retrieval"""

    def test_diagnostic_retrieval(self):
        """Test: Diagnostic queries retrieve Trevor's assessment frameworks"""

        queries = [
            "Assess my brand strength",
            "Perform SWOT analysis",
            "Analyze competitive positioning"
        ]

        for query in queries:
            chunks = retrieve_chunks(
                query=query,
                vector_store_id="vs_diagnostic_kb",
                max_results=20
            )

            # Assert: High average similarity
            avg_similarity = sum(c.similarity_score for c in chunks) / len(chunks)
            assert avg_similarity > 0.75, f"Low similarity for: {query}"

            # Assert: Trevor's book content is retrieved
            trevors_chunks = [c for c in chunks if "trevors_book" in c.metadata.get("source", "")]
            assert len(trevors_chunks) >= 10, f"Not enough Trevor content for: {query}"

    def test_avatar_retrieval(self):
        """Test: Avatar queries retrieve customer profiling frameworks"""

        queries = [
            "Define my ideal customer",
            "Create customer persona",
            "Segment my audience"
        ]

        for query in queries:
            chunks = retrieve_chunks(
                query=query,
                vector_store_id="vs_avatar_kb",
                max_results=20
            )

            # Assert: Customer-related content retrieved
            customer_keywords = ["customer", "persona", "audience", "demographic", "psychographic"]
            relevant_chunks = sum(
                1 for c in chunks
                if any(keyword in c.content.lower() for keyword in customer_keywords)
            )

            assert relevant_chunks >= 15, f"Not enough customer content for: {query}"

    def test_cross_category_queries(self):
        """Test: Cross-category queries retrieve from multiple domains"""

        query = "How do I position my brand to attract my ideal customer?"
        # Should retrieve from both diagnostic_kb and avatar_kb

        diagnostic_chunks = retrieve_chunks(query, "vs_diagnostic_kb", 10)
        avatar_chunks = retrieve_chunks(query, "vs_avatar_kb", 10)

        # Both should have reasonable similarity
        assert sum(c.similarity_score for c in diagnostic_chunks) / 10 > 0.70
        assert sum(c.similarity_score for c in avatar_chunks) / 10 > 0.70

    def test_retrieval_speed(self):
        """Test: Retrieval completes within performance SLA"""

        import time

        query = "Assess my brand positioning"

        start = time.time()
        chunks = retrieve_chunks(query, "vs_diagnostic_kb", 20)
        elapsed = time.time() - start

        # Assert: Retrieval < 500ms
        assert elapsed < 0.5, f"Retrieval too slow: {elapsed:.2f}s"

    def test_similarity_threshold(self):
        """Test: All retrieved chunks meet minimum similarity threshold"""

        query = "How to improve brand distinctiveness"

        chunks = retrieve_chunks(
            query=query,
            vector_store_id="vs_diagnostic_kb",
            max_results=20,
            score_threshold=0.7
        )

        # Assert: All chunks above threshold
        for chunk in chunks:
            assert chunk.similarity_score >= 0.7, \
                f"Chunk below threshold: {chunk.similarity_score}"
```

### Manual Validation Process

**Weekly Retrieval Audit:**

```markdown
## Retrieval Quality Audit - Week of [Date]

### Sample Size
- 20 random queries from production logs
- 5 queries per category (diagnostic, avatar, canvas, capture, core)

### Evaluation Criteria
For each query, rate retrieved chunks (1-5 scale):

1. **Relevance**: Are chunks relevant to user query?
   - 5 = All chunks highly relevant
   - 3 = Most chunks relevant, some noise
   - 1 = Many irrelevant chunks

2. **Authority**: Do chunks cite Trevor's methodology?
   - 5 = >75% of chunks from Trevor's book
   - 3 = 50-75% from Trevor's book
   - 1 = <50% from Trevor's book

3. **Completeness**: Do chunks provide enough info for Model?
   - 5 = Comprehensive coverage of topic
   - 3 = Adequate coverage
   - 1 = Missing key information

4. **Ranking**: Are most relevant chunks at top?
   - 5 = Top 5 chunks are most relevant
   - 3 = Relevant chunks scattered
   - 1 = Most relevant chunks at bottom

### Results Template

| Query | Relevance | Authority | Completeness | Ranking | Overall | Notes |
|-------|-----------|-----------|--------------|---------|---------|-------|
| "Assess brand" | 5 | 4 | 5 | 5 | 4.75 | Great retrieval |
| "Define customer" | 4 | 3 | 4 | 4 | 3.75 | Could use more Trevor content |
| ... | | | | | | |

### Action Items
- [ ] Issue 1: Canvas category retrieval needs improvement
- [ ] Issue 2: Add more Trevor content on X topic
- [ ] Issue 3: Adjust similarity threshold for Y category
```

---

## Configuration Best Practices

### Recommended Default Configuration

```python
# config/rag_config.py

RAG_CONFIG = {
    # Vector Store IDs (set after uploading knowledge base)
    "vector_stores": {
        "diagnostic": "vs_diagnostic_xxx",
        "avatar": "vs_avatar_xxx",
        "canvas": "vs_canvas_xxx",
        "capture": "vs_capture_xxx",
        "core": "vs_core_xxx"
    },

    # Retrieval Settings (per category)
    "retrieval": {
        "diagnostic": {
            "max_num_results": 20,
            "score_threshold": 0.7,
            "ranker": "default_2024_08_21"
        },
        "avatar": {
            "max_num_results": 20,
            "score_threshold": 0.7,
            "ranker": "default_2024_08_21"
        },
        "canvas": {
            "max_num_results": 25,  # Business models may need more context
            "score_threshold": 0.65,
            "ranker": "default_2024_08_21"
        },
        "capture": {
            "max_num_results": 20,
            "score_threshold": 0.7,
            "ranker": "default_2024_08_21"
        },
        "core": {
            "max_num_results": 15,  # Brand foundations more focused
            "score_threshold": 0.75,
            "ranker": "default_2024_08_21"
        }
    },

    # Chunking Strategy (used during document upload)
    "chunking": {
        "max_chunk_size_tokens": 800,
        "chunk_overlap_tokens": 400
    },

    # Embedding Model
    "embedding_model": "text-embedding-3-large",

    # Quality Monitoring
    "monitoring": {
        "log_all_retrievals": True,
        "alert_threshold": 0.65,  # Alert if avg similarity < 0.65
        "weekly_audit": True
    }
}
```

### Environment-Specific Configurations

```python
# Development: More verbose, lower thresholds for testing
DEV_CONFIG = {
    **RAG_CONFIG,
    "retrieval": {
        category: {
            **settings,
            "score_threshold": settings["score_threshold"] - 0.1  # More lenient
        }
        for category, settings in RAG_CONFIG["retrieval"].items()
    },
    "monitoring": {
        "log_all_retrievals": True,
        "alert_threshold": 0.60,
        "weekly_audit": False  # Manual testing instead
    }
}

# Production: Optimized for performance and quality
PROD_CONFIG = {
    **RAG_CONFIG,
    "monitoring": {
        "log_all_retrievals": True,  # For analytics
        "alert_threshold": 0.70,  # Higher quality bar
        "weekly_audit": True
    }
}
```

---

## Key Takeaways

### Checklist: Ensuring Relevant Knowledge Reaches the Model

- [ ] **Router correctly classifies user intent** (diagnostic, avatar, etc.)
- [ ] **Query routed to appropriate vector store** (10K relevant docs, not all 42K)
- [ ] **Trevor's book uploaded and processed** (verify file status = "processed")
- [ ] **Optimal chunking configured** (800 tokens, 400 overlap)
- [ ] **Retrieval parameters tuned** (20 results, 0.7 threshold)
- [ ] **Similarity scores are high** (avg > 0.75, min > 0.65)
- [ ] **Trevor's content represented** (>50% of retrieved chunks)
- [ ] **No irrelevant chunks** (all chunks above threshold)
- [ ] **Monitoring in place** (log retrievals, weekly audits)
- [ ] **Tests passing** (automated retrieval quality tests)

### Quick Reference: Troubleshooting Guide

| Problem | Quick Fix |
|---------|-----------|
| Generic responses | Lower threshold to 0.6, increase to 30 results |
| Irrelevant chunks | Raise threshold to 0.8, reduce to 10 results |
| Missing Trevor content | Verify book upload, check source metadata, boost Trevor chunks |
| Slow retrieval | Reduce max_num_results to 10 |
| Inconsistent quality | Category-specific configs, improve routing |

---

**Document Version:** 1.0
**Last Updated:** 2025-11-13
**Status:** ✅ Implementation Guide Complete

**Related Documents:**
- [System Knowledge Base Plan](./SYSTEM_KNOWLEDGE_BASE_PLAN.md)
- [High-Level Design](./IDEA_BRAND_COACH_HIGH_LEVEL_DESIGN.md)
- [Model Comparison Testing Framework](./MODEL_COMPARISON_TESTING_FRAMEWORK.md)

# Chatbot Data Access Tools Plan
## Unified Tool-Based Architecture for System KB and User KB Access

**Version:** 1.0
**Last Updated:** 2025-11-14
**Status:** Implementation Plan

---

## Executive Summary

This document defines the **complete tool architecture** for the IDEA Brand Coach chatbot to access both System Knowledge Base (shared expert knowledge) and User Knowledge Base (personalized user data).

### Architectural Principle: Parallel Tool-Based Access

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHATBOT TOOL ARCHITECTURE                    │
│                                                                  │
│  All knowledge access via OpenAI file_search tools              │
│  • Consistent retrieval pattern                                 │
│  • Parallel execution (System + User tools called together)     │
│  • Domain-specific organization (5 domains)                     │
└─────────────────────────────────────────────────────────────────┘

System KB Tools (SHARED):              User KB Tools (PER-USER):
├─ system_diagnostic_search            ├─ user_diagnostic_search
├─ system_avatar_search                ├─ user_avatar_search
├─ system_canvas_search                ├─ user_canvas_search
├─ system_capture_search               ├─ user_capture_search
└─ system_core_search                  └─ user_core_search

[10 tools total: 5 System + 5 User]
```

### Key Design Decisions

1. **✅ 10 Total Tools**: 5 for System KB + 5 for User KB
2. **✅ Domain-Specific**: Each tool specializes in one IDEA domain
3. **✅ Parallel Execution**: System and User tools called simultaneously
4. **✅ Separate Vector Stores**: System stores are shared, User stores are per-user
5. **✅ Consistent Interface**: Same file_search API for both knowledge bases

---

## Table of Contents

1. [Tool Architecture Overview](#tool-architecture-overview)
2. [System KB Tools (Shared)](#system-kb-tools-shared)
3. [User KB Tools (Per-User)](#user-kb-tools-per-user)
4. [Tool Selection Logic](#tool-selection-logic)
5. [Parallel Tool Execution](#parallel-tool-execution)
6. [Vector Store Organization](#vector-store-organization)
7. [Implementation Details](#implementation-details)
8. [Configuration & Tuning](#configuration--tuning)
9. [Security & Isolation](#security--isolation)
10. [Migration from Current Architecture](#migration-from-current-architecture)

---

## Tool Architecture Overview

### Complete Tool Inventory

```
┌─────────────────────────────────────────────────────────────────┐
│                  SYSTEM KNOWLEDGE BASE TOOLS                    │
│                  (Shared Across All Users)                      │
└─────────────────────────────────────────────────────────────────┘

1. system_diagnostic_search
   Purpose: Trevor's brand assessment methodologies, SWOT frameworks
   Vector Store: vs_system_diagnostic
   Content: ~10,000 docs (5GB)

2. system_avatar_search
   Purpose: Customer profiling, StoryBrand, persona frameworks
   Vector Store: vs_system_avatar
   Content: ~8,000 docs (4GB)

3. system_canvas_search
   Purpose: Business models, value propositions, Blue Ocean
   Vector Store: vs_system_canvas
   Content: ~7,000 docs (3.5GB)

4. system_capture_search
   Purpose: Content strategy, viral marketing, STEPPS/SUCCESs
   Vector Store: vs_system_capture
   Content: ~12,000 docs (6GB)

5. system_core_search
   Purpose: Brand foundations, mission/vision, storytelling
   Vector Store: vs_system_core
   Content: ~5,000 docs (2.5GB)

┌─────────────────────────────────────────────────────────────────┐
│                   USER KNOWLEDGE BASE TOOLS                     │
│                   (Per-User Isolated)                           │
└─────────────────────────────────────────────────────────────────┘

6. user_diagnostic_search
   Purpose: User's diagnostic results, IDEA scores, weaknesses
   Vector Store: vs_user_{user_id}_diagnostic
   Content: ~5-20 chunks per user

7. user_avatar_search
   Purpose: User's customer personas, target audience notes
   Vector Store: vs_user_{user_id}_avatar
   Content: ~10-50 chunks per user

8. user_canvas_search
   Purpose: User's business model, uploaded business plans
   Vector Store: vs_user_{user_id}_canvas
   Content: ~20-100 chunks per user

9. user_capture_search
   Purpose: User's marketing materials, campaign docs
   Vector Store: vs_user_{user_id}_capture
   Content: ~10-100 chunks per user

10. user_core_search
    Purpose: User's brand story, mission/vision documents
    Vector Store: vs_user_{user_id}_core
    Content: ~5-30 chunks per user
```

### Tool vs Knowledge Base Mapping

```
Query Intent: "diagnostic"
    ↓
Tools Called in Parallel:
    ├─ system_diagnostic_search → vs_system_diagnostic
    │  Returns: Trevor's SWOT frameworks (15 chunks)
    │
    └─ user_diagnostic_search → vs_user_123_diagnostic
       Returns: User's diagnostic results (5 chunks)

Aggregated Context: 20 chunks total
    ├─ 75% System KB (expert methodology)
    └─ 25% User KB (personalized context)
```

---

## System KB Tools (Shared)

### Tool 1: system_diagnostic_search

**Purpose**: Access Trevor's brand assessment methodologies and diagnostic frameworks

**Vector Store**: `vs_system_diagnostic` (shared across all users)

**Content Sources**:
- Trevor's book chapters on brand assessment (40%)
- SWOT analysis frameworks from marketing classics (30%)
- Positioning strategy syntheses (Ries & Trout) (20%)
- Brand audit case studies (10%)

**Typical Queries**:
- "How do I assess my brand strength?"
- "What is SWOT analysis?"
- "How to evaluate competitive positioning?"

**Tool Configuration**:
```json
{
  "type": "file_search",
  "file_search": {
    "vector_store_ids": ["vs_system_diagnostic"],
    "max_num_results": 15,
    "score_threshold": 0.7,
    "ranking_options": {
      "score_threshold": 0.7,
      "ranker": "auto"
    }
  }
}
```

**Expected Results**: 10-15 chunks of Trevor's diagnostic methodology

---

### Tool 2: system_avatar_search

**Purpose**: Access customer profiling and persona development frameworks

**Vector Store**: `vs_system_avatar` (shared)

**Content Sources**:
- Trevor's customer profiling methods (45%)
- StoryBrand synthesis (Donald Miller) (25%)
- Persona development frameworks (20%)
- Jobs-to-be-Done methodologies (10%)

**Typical Queries**:
- "How do I define my ideal customer?"
- "What is a customer persona?"
- "How to map the customer journey?"

**Tool Configuration**:
```json
{
  "type": "file_search",
  "file_search": {
    "vector_store_ids": ["vs_system_avatar"],
    "max_num_results": 12,
    "score_threshold": 0.7
  }
}
```

**Expected Results**: 10-12 chunks of customer profiling guidance

---

### Tool 3: system_canvas_search

**Purpose**: Access business model and strategy frameworks

**Vector Store**: `vs_system_canvas` (shared)

**Content Sources**:
- Trevor's business strategy chapters (35%)
- Business Model Canvas synthesis (Osterwalder) (30%)
- Blue Ocean Strategy synthesis (20%)
- Revenue model patterns (15%)

**Typical Queries**:
- "What is the Business Model Canvas?"
- "How to design a value proposition?"
- "What revenue models should I consider?"

**Tool Configuration**:
```json
{
  "type": "file_search",
  "file_search": {
    "vector_store_ids": ["vs_system_canvas"],
    "max_num_results": 12,
    "score_threshold": 0.7
  }
}
```

**Expected Results**: 10-12 chunks of business model frameworks

---

### Tool 4: system_capture_search

**Purpose**: Access content strategy and marketing execution frameworks

**Vector Store**: `vs_system_capture` (shared)

**Content Sources**:
- Trevor's marketing execution chapters (30%)
- Contagious synthesis (Berger STEPPS) (25%)
- Made to Stick synthesis (Heath SUCCESs) (20%)
- Content marketing playbooks (15%)
- Social media strategies (10%)

**Typical Queries**:
- "How to create a content strategy?"
- "What makes content go viral?"
- "How to plan a marketing campaign?"

**Tool Configuration**:
```json
{
  "type": "file_search",
  "file_search": {
    "vector_store_ids": ["vs_system_capture"],
    "max_num_results": 15,
    "score_threshold": 0.7
  }
}
```

**Expected Results**: 12-15 chunks of marketing execution guidance

---

### Tool 5: system_core_search

**Purpose**: Access brand foundation and storytelling frameworks

**Vector Store**: `vs_system_core` (shared)

**Content Sources**:
- Trevor's brand philosophy chapters (50%)
- StoryBrand narrative synthesis (20%)
- Mission/vision development guides (15%)
- Brand personality frameworks (15%)

**Typical Queries**:
- "How do I define my brand mission?"
- "What are brand core values?"
- "How to develop my brand story?"

**Tool Configuration**:
```json
{
  "type": "file_search",
  "file_search": {
    "vector_store_ids": ["vs_system_core"],
    "max_num_results": 15,
    "score_threshold": 0.7
  }
}
```

**Expected Results**: 12-15 chunks of brand foundation guidance

---

## User KB Tools (Per-User)

### Tool 6: user_diagnostic_search

**Purpose**: Access user's diagnostic results and IDEA scores

**Vector Store**: `vs_user_{user_id}_diagnostic` (isolated per user)

**Content Sources** (Per User):
- 6-question IDEA diagnostic results
- Category scores (Insight, Distinctive, Empathetic, Authentic)
- Score interpretations and weak areas
- Previous diagnostic submissions (retakes)

**Typical Queries**:
- "Based on my diagnostic, what should I focus on?"
- "How can I improve my Distinctive score?"
- "What are my brand's weaknesses?"

**Tool Configuration**:
```json
{
  "type": "file_search",
  "file_search": {
    "vector_store_ids": ["vs_user_123_diagnostic"],  // Dynamic per user
    "max_num_results": 5,
    "score_threshold": 0.65  // Slightly lower - user context always relevant
  }
}
```

**Expected Results**: 3-5 chunks of user's diagnostic data

**Content Example**:
```
User's Diagnostic Results:
- Insight: 75/100 (Good customer understanding)
- Distinctive: 40/100 (WEAK - needs differentiation)
- Empathetic: 80/100 (Strong emotional connection)
- Authentic: 70/100 (Solid brand authenticity)

Industry: B2B SaaS
Challenge: Blending in with competitors
```

---

### Tool 7: user_avatar_search

**Purpose**: Access user's customer persona and audience data

**Vector Store**: `vs_user_{user_id}_avatar` (isolated per user)

**Content Sources** (Per User):
- Uploaded customer persona documents
- Target audience notes
- Customer research files
- Demographic/psychographic data

**Typical Queries**:
- "Who is my ideal customer?"
- "What does my target audience care about?"
- "How should I segment my market?"

**Tool Configuration**:
```json
{
  "type": "file_search",
  "file_search": {
    "vector_store_ids": ["vs_user_123_avatar"],
    "max_num_results": 5,
    "score_threshold": 0.65
  }
}
```

**Expected Results**: 3-5 chunks of user's audience data

---

### Tool 8: user_canvas_search

**Purpose**: Access user's business model and strategy documents

**Vector Store**: `vs_user_{user_id}_canvas` (isolated per user)

**Content Sources** (Per User):
- Uploaded business plans
- Revenue model documents
- Value proposition canvases
- Business strategy files

**Typical Queries**:
- "What is my current business model?"
- "How should I price my offering?"
- "What value do I provide customers?"

**Tool Configuration**:
```json
{
  "type": "file_search",
  "file_search": {
    "vector_store_ids": ["vs_user_123_canvas"],
    "max_num_results": 5,
    "score_threshold": 0.65
  }
}
```

**Expected Results**: 3-5 chunks of user's business model data

---

### Tool 9: user_capture_search

**Purpose**: Access user's marketing materials and campaigns

**Vector Store**: `vs_user_{user_id}_capture` (isolated per user)

**Content Sources** (Per User):
- Uploaded marketing materials
- Campaign briefs
- Content calendars
- Social media strategies

**Typical Queries**:
- "Review my current marketing approach"
- "How can I improve my content strategy?"
- "What campaigns have I run?"

**Tool Configuration**:
```json
{
  "type": "file_search",
  "file_search": {
    "vector_store_ids": ["vs_user_123_capture"],
    "max_num_results": 5,
    "score_threshold": 0.65
  }
}
```

**Expected Results**: 3-5 chunks of user's marketing data

---

### Tool 10: user_core_search

**Purpose**: Access user's brand foundation documents

**Vector Store**: `vs_user_{user_id}_core` (isolated per user)

**Content Sources** (Per User):
- Brand guidelines
- Mission/vision statements
- Brand story documents
- Core values documentation

**Typical Queries**:
- "What is my brand story?"
- "What are my core values?"
- "How should I communicate my mission?"

**Tool Configuration**:
```json
{
  "type": "file_search",
  "file_search": {
    "vector_store_ids": ["vs_user_123_core"],
    "max_num_results": 5,
    "score_threshold": 0.65
  }
}
```

**Expected Results**: 3-5 chunks of user's brand foundation data

---

## Tool Selection Logic

### Router Prompt → Tool Mapping

```python
INTENT_TO_TOOLS_MAP = {
    "diagnostic": {
        "system_tools": ["system_diagnostic_search"],
        "user_tools": ["user_diagnostic_search"]
    },

    "avatar": {
        "system_tools": ["system_avatar_search"],
        "user_tools": ["user_avatar_search"]
    },

    "canvas": {
        "system_tools": ["system_canvas_search"],
        "user_tools": ["user_canvas_search"]
    },

    "capture": {
        "system_tools": ["system_capture_search"],
        "user_tools": ["user_capture_search"]
    },

    "core": {
        "system_tools": ["system_core_search"],
        "user_tools": ["user_core_search"]
    },

    # Cross-domain queries
    "general": {
        "system_tools": [
            "system_diagnostic_search",
            "system_core_search"
        ],
        "user_tools": [
            "user_diagnostic_search",
            "user_core_search"
        ]
    }
}
```

### Example: Diagnostic Query

```
User Query: "How can I improve my brand positioning?"

Step 1: Router Prompt classifies intent → "diagnostic"

Step 2: Select tools from map:
    system_tools: ["system_diagnostic_search"]
    user_tools: ["user_diagnostic_search"]

Step 3: Execute tools in parallel (see next section)

Step 4: Aggregate results:
    ├─ System results: 15 chunks (Trevor's positioning frameworks)
    └─ User results: 5 chunks (User's Distinctive score: 40/100)

Step 5: Build Query with both contexts

Step 6: Send to Model for response
```

### Multi-Tool Selection

For complex queries, multiple tools can be invoked:

```python
# Example: Cross-domain query about brand strategy
query = "How do I build a complete brand strategy from scratch?"

selected_tools = {
    "system_tools": [
        "system_diagnostic_search",  # Assessment frameworks
        "system_core_search",        # Brand foundations
        "system_canvas_search"       # Business strategy
    ],
    "user_tools": [
        "user_diagnostic_search",    # Current brand state
        "user_core_search",          # Existing brand docs
        "user_canvas_search"         # Business context
    ]
}

# Result: 6 tools called in parallel
# Aggregate: ~40-50 chunks total (within Query budget)
```

---

## Parallel Tool Execution

### Implementation Pattern

```python
async def execute_knowledge_retrieval(
    user_id: str,
    query: str,
    intent: str
) -> dict:
    """
    Execute System and User KB tools in parallel
    """

    # Step 1: Get tool configuration for intent
    tool_config = INTENT_TO_TOOLS_MAP[intent]

    # Step 2: Build tool calls
    system_tool_calls = [
        build_tool_call(tool_name, query, user_id=None)  # System KB - no user_id
        for tool_name in tool_config["system_tools"]
    ]

    user_tool_calls = [
        build_tool_call(tool_name, query, user_id=user_id)  # User KB - with user_id
        for tool_name in tool_config["user_tools"]
    ]

    # Step 3: Execute all tools in parallel
    system_results, user_results = await asyncio.gather(
        execute_tools_parallel(system_tool_calls),
        execute_tools_parallel(user_tool_calls)
    )

    # Step 4: Aggregate and format
    return {
        "system_chunks": flatten_results(system_results),
        "user_chunks": flatten_results(user_results),
        "total_chunks": len(system_results) + len(user_results)
    }


def build_tool_call(tool_name: str, query: str, user_id: Optional[str]) -> dict:
    """
    Build OpenAI file_search tool call configuration
    """

    # Get vector store ID based on tool name and user_id
    vector_store_id = get_vector_store_id(tool_name, user_id)

    return {
        "type": "file_search",
        "file_search": {
            "vector_store_ids": [vector_store_id],
            "max_num_results": get_max_results(tool_name),
            "score_threshold": get_score_threshold(tool_name),
            "ranking_options": {
                "ranker": "auto",
                "score_threshold": get_score_threshold(tool_name)
            }
        }
    }


def get_vector_store_id(tool_name: str, user_id: Optional[str]) -> str:
    """
    Map tool name to vector store ID
    """

    # System KB tools (shared)
    if tool_name.startswith("system_"):
        domain = tool_name.replace("system_", "").replace("_search", "")
        return f"vs_system_{domain}"

    # User KB tools (per-user)
    elif tool_name.startswith("user_"):
        if not user_id:
            raise ValueError("user_id required for User KB tools")
        domain = tool_name.replace("user_", "").replace("_search", "")
        return f"vs_user_{user_id}_{domain}"

    else:
        raise ValueError(f"Unknown tool: {tool_name}")
```

### Execution Flow Diagram

```
User Query: "How to improve Distinctive score?"
    ↓
Router: intent="diagnostic"
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Parallel Tool Execution                                     │
│                                                              │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │ system_diagnostic_search│  │ user_diagnostic_search  │  │
│  │                         │  │                         │  │
│  │ Vector Store:           │  │ Vector Store:           │  │
│  │ vs_system_diagnostic    │  │ vs_user_123_diagnostic  │  │
│  │                         │  │                         │  │
│  │ Max Results: 15         │  │ Max Results: 5          │  │
│  │ Threshold: 0.7          │  │ Threshold: 0.65         │  │
│  │                         │  │                         │  │
│  │ ⏱️ 200ms                 │  │ ⏱️ 150ms                 │  │
│  └──────────┬──────────────┘  └──────────┬──────────────┘  │
│             │                             │                 │
│             └─────────────┬───────────────┘                 │
│                           ↓                                 │
│                  Aggregate Results                          │
│                  (20 chunks total)                          │
└─────────────────────────────────────────────────────────────┘
    ↓
Build Query with both contexts
    ↓
Send to GPT-5 Model
```

### Performance Considerations

**Parallel Execution Benefits**:
- Total latency: `max(system_time, user_time)` not `system_time + user_time`
- Typical: 200ms vs 350ms sequential
- 43% faster retrieval

**Chunking Budget**:
- System KB: 10-15 chunks per tool
- User KB: 3-5 chunks per tool
- Total: 15-20 chunks (fits in ~2,000 tokens)
- Leaves room for conversation history and user query

---

## Vector Store Organization

### System KB Vector Stores (5 Total - Shared)

```
vs_system_diagnostic
├─ 10,000 documents
├─ 5GB storage
├─ Content: Trevor's book (40%) + SWOT syntheses (30%) + positioning (20%) + audits (10%)
└─ Shared across ALL users

vs_system_avatar
├─ 8,000 documents
├─ 4GB storage
├─ Content: Trevor's profiling (45%) + StoryBrand (25%) + personas (20%) + JTBD (10%)
└─ Shared across ALL users

vs_system_canvas
├─ 7,000 documents
├─ 3.5GB storage
├─ Content: Trevor's strategy (35%) + BMC (30%) + Blue Ocean (20%) + revenue models (15%)
└─ Shared across ALL users

vs_system_capture
├─ 12,000 documents
├─ 6GB storage
├─ Content: Trevor's marketing (30%) + Contagious (25%) + Made to Stick (20%) + playbooks (25%)
└─ Shared across ALL users

vs_system_core
├─ 5,000 documents
├─ 2.5GB storage
├─ Content: Trevor's philosophy (50%) + StoryBrand (20%) + mission/vision (15%) + personality (15%)
└─ Shared across ALL users

TOTAL: 42,000 documents, 21GB, $63/month (OpenAI storage)
```

### User KB Vector Stores (5 Per User - Isolated)

```
For user_id = "123":

vs_user_123_diagnostic
├─ 5-20 documents (diagnostic results)
├─ ~50KB storage
├─ Content: IDEA scores, assessments, retakes
└─ ISOLATED to user_id=123

vs_user_123_avatar
├─ 10-50 documents
├─ ~500KB storage
├─ Content: Customer personas, audience research
└─ ISOLATED to user_id=123

vs_user_123_canvas
├─ 20-100 documents
├─ ~1MB storage
├─ Content: Business plans, revenue models
└─ ISOLATED to user_id=123

vs_user_123_capture
├─ 10-100 documents
├─ ~1MB storage
├─ Content: Marketing materials, campaigns
└─ ISOLATED to user_id=123

vs_user_123_core
├─ 5-30 documents
├─ ~300KB storage
├─ Content: Brand guidelines, mission/vision
└─ ISOLATED to user_id=123

Per-User Total: 50-300 documents, ~3MB, $0.09/month per user
```

### Vector Store Lifecycle

**System KB** (One-time setup):
1. Upload Trevor's book → OpenAI
2. Distribute chapters to 5 vector stores
3. Add marketing syntheses
4. Update quarterly with new content

**User KB** (Per-user lifecycle):
1. User completes diagnostic → Create `vs_user_{id}_diagnostic`
2. User uploads documents → Add to appropriate domain stores
3. User updates data → Re-chunk and update stores
4. User deletes account → Delete all 5 user vector stores

---

## Implementation Details

### OpenAI Responses API Integration

```python
from openai import OpenAI

client = OpenAI()

async def query_with_tools(
    user_id: str,
    query: str,
    intent: str,
    conversation_history: list
) -> str:
    """
    Query using System + User KB tools
    """

    # Step 1: Build tool configurations
    tools = build_tools_for_intent(intent, user_id)

    # Step 2: Create response with tools
    response = await client.responses.create(
        model="gpt-5",
        prompt_id=f"{intent}_prompt",  # Domain-specific prompt
        input=query,
        tools=tools,  # List of file_search tools
        previous_response_id=get_previous_response_id(conversation_history),
        store_response=True  # Persist for conversation history
    )

    # Step 3: Extract response and sources
    return {
        "answer": response.output,
        "system_sources": extract_sources(response, "system"),
        "user_sources": extract_sources(response, "user"),
        "response_id": response.id
    }


def build_tools_for_intent(intent: str, user_id: str) -> list:
    """
    Build list of file_search tools for the given intent
    """

    tool_config = INTENT_TO_TOOLS_MAP[intent]
    tools = []

    # Add System KB tools
    for tool_name in tool_config["system_tools"]:
        tools.append({
            "type": "file_search",
            "file_search": {
                "vector_store_ids": [get_vector_store_id(tool_name, None)],
                "max_num_results": 15,
                "score_threshold": 0.7
            }
        })

    # Add User KB tools
    for tool_name in tool_config["user_tools"]:
        tools.append({
            "type": "file_search",
            "file_search": {
                "vector_store_ids": [get_vector_store_id(tool_name, user_id)],
                "max_num_results": 5,
                "score_threshold": 0.65
            }
        })

    return tools
```

### Edge Function Implementation

```typescript
// supabase/functions/brand-coach-gpt/index.ts

import { OpenAI } from "https://esm.sh/openai@4.20.1";

Deno.serve(async (req) => {
  // Step 1: Authenticate user
  const authHeader = req.headers.get('Authorization')!;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Step 2: Parse request
  const { message, previousResponseId } = await req.json();

  // Step 3: Classify intent
  const intent = await classifyIntent(message);

  // Step 4: Build tools for intent
  const tools = buildToolsForIntent(intent, user.id);

  // Step 5: Query with tools
  const openai = new OpenAI();
  const response = await openai.responses.create({
    model: "gpt-5",
    prompt_id: `${intent}_prompt`,
    input: message,
    tools: tools,  // System + User KB tools
    previous_response_id: previousResponseId,
    store_response: true
  });

  // Step 6: Save to chat_messages
  await saveChatMessage(user.id, message, response.output, response.id);

  // Step 7: Return response
  return new Response(JSON.stringify({
    answer: response.output,
    responseId: response.id,
    sources: extractSources(response)
  }), {
    headers: { "Content-Type": "application/json" }
  });
});


function buildToolsForIntent(intent: string, userId: string) {
  const toolConfig = INTENT_TO_TOOLS_MAP[intent];
  const tools = [];

  // System KB tools (shared vector stores)
  for (const toolName of toolConfig.system_tools) {
    const domain = toolName.replace("system_", "").replace("_search", "");
    tools.push({
      type: "file_search",
      file_search: {
        vector_store_ids: [`vs_system_${domain}`],
        max_num_results: 15,
        score_threshold: 0.7
      }
    });
  }

  // User KB tools (per-user vector stores)
  for (const toolName of toolConfig.user_tools) {
    const domain = toolName.replace("user_", "").replace("_search", "");
    tools.push({
      type: "file_search",
      file_search: {
        vector_store_ids: [`vs_user_${userId}_${domain}`],
        max_num_results: 5,
        score_threshold: 0.65
      }
    });
  }

  return tools;
}
```

---

## Configuration & Tuning

### Tool-Specific Configuration

```python
TOOL_CONFIGS = {
    # System KB Tools
    "system_diagnostic_search": {
        "max_num_results": 15,
        "score_threshold": 0.7,
        "boost_factor": 1.1,  # Boost Trevor's content
        "typical_usage": "diagnostic queries, brand assessment"
    },

    "system_avatar_search": {
        "max_num_results": 12,
        "score_threshold": 0.7,
        "boost_factor": 1.0,
        "typical_usage": "customer profiling, persona development"
    },

    "system_canvas_search": {
        "max_num_results": 12,
        "score_threshold": 0.7,
        "boost_factor": 1.0,
        "typical_usage": "business model, strategy questions"
    },

    "system_capture_search": {
        "max_num_results": 15,
        "score_threshold": 0.7,
        "boost_factor": 1.0,
        "typical_usage": "marketing execution, content strategy"
    },

    "system_core_search": {
        "max_num_results": 15,
        "score_threshold": 0.7,
        "boost_factor": 1.15,  # Boost brand foundations
        "typical_usage": "mission/vision, brand story"
    },

    # User KB Tools
    "user_diagnostic_search": {
        "max_num_results": 5,
        "score_threshold": 0.65,  # Lower threshold - user data always relevant
        "prioritize_low_scores": True,  # Boost chunks with low IDEA scores
        "typical_usage": "personalized diagnostic insights"
    },

    "user_avatar_search": {
        "max_num_results": 5,
        "score_threshold": 0.65,
        "typical_usage": "user's customer personas"
    },

    "user_canvas_search": {
        "max_num_results": 5,
        "score_threshold": 0.65,
        "typical_usage": "user's business model documents"
    },

    "user_capture_search": {
        "max_num_results": 5,
        "score_threshold": 0.65,
        "typical_usage": "user's marketing materials"
    },

    "user_core_search": {
        "max_num_results": 5,
        "score_threshold": 0.65,
        "typical_usage": "user's brand foundation docs"
    }
}
```

### Adaptive Configuration

```python
def get_adaptive_config(intent: str, user_has_data: dict) -> dict:
    """
    Adjust tool configuration based on intent and available user data
    """

    configs = {
        # Diagnostic queries: balanced System + User
        "diagnostic": {
            "system_diagnostic_search": {"max_num_results": 12},
            "user_diagnostic_search": {"max_num_results": 8} if user_has_data["diagnostic"] else {"max_num_results": 0}
        },

        # Avatar queries: more personalized if user has personas
        "avatar": {
            "system_avatar_search": {"max_num_results": 10},
            "user_avatar_search": {"max_num_results": 10} if user_has_data["avatar"] else {"max_num_results": 0}
        },

        # Core queries: mostly expert guidance
        "core": {
            "system_core_search": {"max_num_results": 18},
            "user_core_search": {"max_num_results": 2} if user_has_data["core"] else {"max_num_results": 0}
        }
    }

    return configs.get(intent, default_config)
```

---

## Security & Isolation

### Critical Security Principles

```
1. ✅ User vector stores MUST be isolated by user_id
2. ✅ Never allow cross-user vector store access
3. ✅ Validate user_id before building User KB tool calls
4. ✅ System KB tools have NO user_id (shared safely)
5. ✅ Log all tool calls for audit trail
```

### Implementation Safeguards

```python
def build_user_tool_call(tool_name: str, query: str, user_id: str) -> dict:
    """
    Build User KB tool call with security checks
    """

    # CRITICAL: Validate user_id
    if not user_id:
        raise SecurityError("user_id required for User KB tools")

    # CRITICAL: Validate user_id format (prevent injection)
    if not is_valid_uuid(user_id):
        raise SecurityError(f"Invalid user_id format: {user_id}")

    # CRITICAL: Verify vector store exists and belongs to user
    vector_store_id = f"vs_user_{user_id}_{get_domain(tool_name)}"
    if not vector_store_exists(vector_store_id):
        # Return empty results if user has no data in this domain
        return None

    # Build tool call with validated user_id
    return {
        "type": "file_search",
        "file_search": {
            "vector_store_ids": [vector_store_id],
            "max_num_results": 5,
            "score_threshold": 0.65
        }
    }
```

### Audit Logging

```python
async def log_tool_execution(
    user_id: str,
    tool_name: str,
    vector_store_id: str,
    results_count: int
) -> None:
    """
    Log all tool executions for security audit
    """

    await supabase.from_("tool_execution_log").insert({
        "user_id": user_id,
        "tool_name": tool_name,
        "vector_store_id": vector_store_id,
        "results_count": results_count,
        "timestamp": datetime.now().isoformat()
    })
```

---

## Migration from Current Architecture

### Current State (PostgreSQL Vector Search)

```typescript
// Current: Direct PostgreSQL vector search for User KB
const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: "user_knowledge_chunks",
  queryName: "match_user_documents",
  filter: { user_id: user.id }
});
```

### New State (OpenAI file_search Tools)

```typescript
// New: OpenAI file_search tools for both System + User KB
const tools = [
  {
    type: "file_search",
    file_search: {
      vector_store_ids: ["vs_system_diagnostic"],  // System KB
      max_num_results: 15,
      score_threshold: 0.7
    }
  },
  {
    type: "file_search",
    file_search: {
      vector_store_ids: [`vs_user_${userId}_diagnostic`],  // User KB
      max_num_results: 5,
      score_threshold: 0.65
    }
  }
];

const response = await openai.responses.create({
  model: "gpt-5",
  tools: tools,
  input: query
});
```

### Migration Steps

**Phase 1: Dual Operation (2 weeks)**

1. Keep PostgreSQL `user_knowledge_chunks` table
2. Add OpenAI User KB vector stores in parallel
3. Sync both systems during diagnostic save
4. Compare retrieval quality

**Phase 2: Testing & Validation (1 week)**

1. A/B test: PostgreSQL vs OpenAI retrieval
2. Measure latency, relevance, cost
3. Validate security (no cross-user leakage)
4. Fix any issues

**Phase 3: Cutover (1 day)**

1. Switch `brand-coach-gpt` to use OpenAI tools
2. Deprecate PostgreSQL vector search code
3. Keep table for rollback (1 month)
4. Monitor errors

**Phase 4: Cleanup (After 1 month)**

1. If stable, drop `user_knowledge_chunks` table
2. Remove LangChain dependencies
3. Update documentation
4. Archive migration code

---

## Summary

### Tool Architecture At-a-Glance

```
10 Total Tools:
├─ 5 System KB Tools (Shared)
│  ├─ system_diagnostic_search  → vs_system_diagnostic
│  ├─ system_avatar_search      → vs_system_avatar
│  ├─ system_canvas_search      → vs_system_canvas
│  ├─ system_capture_search     → vs_system_capture
│  └─ system_core_search        → vs_system_core
│
└─ 5 User KB Tools (Per-User)
   ├─ user_diagnostic_search    → vs_user_{id}_diagnostic
   ├─ user_avatar_search        → vs_user_{id}_avatar
   ├─ user_canvas_search        → vs_user_{id}_canvas
   ├─ user_capture_search       → vs_user_{id}_capture
   └─ user_core_search          → vs_user_{id}_core

Execution: Parallel (System + User tools called together)
Aggregation: 75% System KB + 25% User KB (typical)
Security: User KB isolated by user_id in vector store names
```

### Key Benefits

1. **✅ Consistent Architecture**: All knowledge access via same tool type
2. **✅ Parallel Execution**: System + User KB retrieved simultaneously (43% faster)
3. **✅ Domain Organization**: 5 domains match IDEA framework structure
4. **✅ Easy Configuration**: Single tool interface, tunable parameters
5. **✅ Secure Isolation**: User vector stores completely separate
6. **✅ Scalable**: OpenAI handles vector search optimization
7. **✅ Observable**: Built-in source attribution and logging

---

**Document Version:** 1.0
**Last Updated:** 2025-11-14
**Status:** ✅ Implementation Plan Complete - Ready for Development

**Next Steps:**
1. Create System KB vector stores (5 stores) with Trevor's book
2. Implement User KB vector store creation on diagnostic submission
3. Update `brand-coach-gpt` Edge Function with tool-based retrieval
4. Test parallel tool execution and aggregation
5. Migrate from PostgreSQL vector search to OpenAI tools
6. Monitor performance and tune configurations

**Related Documents:**
- [System Knowledge Base Plan](./SYSTEM_KNOWLEDGE_BASE_PLAN.md)
- [System/User Knowledge Base Separation Guide](./SYSTEM_USER_KNOWLEDGE_BASE_SEPARATION_GUIDE.md)
- [Technical Architecture](../TECHNICAL_ARCHITECTURE.md)

# IDEA Brand Coach - Prompt Definitions
## OpenAI Responses API System Prompts

**Version:** 1.0
**Last Updated:** 2025-11-15
**Status:** In Development
**Framework:** 7-Step Prompt Engineering (Prompt Alchemy)

---

## 📋 Overview

This directory contains the **complete system prompt definitions** for the IDEA Brand Coach chatbot, built on OpenAI's Responses API with GPT-5. Each prompt follows the 7-step framework from "Building a Prompt Step-by-Step":

1. **Define the Role** 🎭
2. **Specify the Task** 📝
3. **Add Specifics** 🎯
4. **Provide Context** 🌐
5. **Include Examples** 🎓
6. **Add Notes** 📌
7. **Use Markdown Formatting** 📝

---

## 🎯 Prompt Inventory

### Total: 7 Prompts

| # | Prompt File | Domain | Tools | Status |
|---|-------------|--------|-------|--------|
| 1 | [router-prompt.md](./router-prompt.md) | Intent Classification | None | ✅ Complete |
| 2 | [synthesis-prompt.md](./synthesis-prompt.md) | Multi-Domain Response Aggregation | None (receives outputs from specialized prompts) | ⏳ In Progress |
| 3 | [diagnostic-prompt.md](./diagnostic-prompt.md) | Brand Assessment (I - Identify) | `system_diagnostic_search`<br>`user_diagnostic_search`<br>`web_search` | ⏳ In Progress |
| 4 | [avatar-prompt.md](./avatar-prompt.md) | Customer Personas (D - Discover) | `system_avatar_search`<br>`user_avatar_search`<br>`web_search` | ⏳ In Progress |
| 5 | [canvas-prompt.md](./canvas-prompt.md) | Business Models (E - Execute) | `system_canvas_search`<br>`user_canvas_search`<br>`web_search` | ⏳ In Progress |
| 6 | [capture-prompt.md](./capture-prompt.md) | Content & Marketing (A - Analyze) | `system_capture_search`<br>`user_capture_search`<br>`web_search` | ⏳ In Progress |
| 7 | [core-prompt.md](./core-prompt.md) | Brand Foundations | `system_core_search`<br>`user_core_search`<br>`web_search` | ⏳ In Progress |

---

## 🔧 Tool Definitions

### File Search Tools (10 Total)

#### System Knowledge Base Tools (Shared)

```json
{
  "system_diagnostic_search": {
    "type": "file_search",
    "description": "Search Trevor's brand assessment methodologies, SWOT frameworks, and diagnostic tools from marketing classics",
    "vector_store": "vs_system_diagnostic",
    "max_results": 15,
    "score_threshold": 0.7
  },
  "system_avatar_search": {
    "type": "file_search",
    "description": "Search customer profiling methods, StoryBrand frameworks, and persona development from Trevor's book and marketing classics",
    "vector_store": "vs_system_avatar",
    "max_results": 15,
    "score_threshold": 0.7
  },
  "system_canvas_search": {
    "type": "file_search",
    "description": "Search business model frameworks, value proposition design, and Blue Ocean Strategy from Trevor's book and marketing classics",
    "vector_store": "vs_system_canvas",
    "max_results": 15,
    "score_threshold": 0.7
  },
  "system_capture_search": {
    "type": "file_search",
    "description": "Search content strategy, viral marketing (STEPPS, Made to Stick), and engagement frameworks from Trevor's book and marketing classics",
    "vector_store": "vs_system_capture",
    "max_results": 15,
    "score_threshold": 0.7
  },
  "system_core_search": {
    "type": "file_search",
    "description": "Search brand storytelling, mission/vision frameworks, and brand foundation methods from Trevor's book and marketing classics",
    "vector_store": "vs_system_core",
    "max_results": 15,
    "score_threshold": 0.7
  }
}
```

#### User Knowledge Base Tools (Per-User Isolated)

```json
{
  "user_diagnostic_search": {
    "type": "file_search",
    "description": "Search this user's diagnostic results, IDEA scores, and brand assessment data",
    "vector_store": "vs_user_{user_id}_diagnostic",
    "max_results": 5,
    "score_threshold": 0.6
  },
  "user_avatar_search": {
    "type": "file_search",
    "description": "Search this user's customer personas, target audience definitions, and demographic research",
    "vector_store": "vs_user_{user_id}_avatar",
    "max_results": 5,
    "score_threshold": 0.6
  },
  "user_canvas_search": {
    "type": "file_search",
    "description": "Search this user's business model documents, uploaded business plans, and strategy notes",
    "vector_store": "vs_user_{user_id}_canvas",
    "max_results": 5,
    "score_threshold": 0.6
  },
  "user_capture_search": {
    "type": "file_search",
    "description": "Search this user's marketing materials, content calendars, and campaign documents",
    "vector_store": "vs_user_{user_id}_capture",
    "max_results": 5,
    "score_threshold": 0.6
  },
  "user_core_search": {
    "type": "file_search",
    "description": "Search this user's brand story, mission/vision documents, and values statements",
    "vector_store": "vs_user_{user_id}_core",
    "max_results": 5,
    "score_threshold": 0.6
  }
}
```

### Web Search Tool (NEW)

```json
{
  "web_search": {
    "type": "web_search",
    "description": "Search the public web for marketing framework guidance, case studies, and publicly available marketing book summaries",
    "enabled": true,
    "max_results": 5
  }
}
```

**⚠️ P1 BLOCKER - Open Question:**
Should we use real-time web search during conversations OR implement a separate ingestion pipeline that pre-fetches and audits external marketing content for copyright compliance? Legal review needed before paid launch.

**Current Approach (MVP):** Real-time web search with proper attribution in responses
**Alternative Approach:** Pre-ingestion pipeline with compliance auditing

---

## 🏗️ Prompt Architecture

### Multi-Stage Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Intent Classification & Routing                    │
│ Router Prompt (no tools)                                    │
│                                                              │
│ Output Options:                                             │
│   A) Single domain → ["diagnostic"]                         │
│   B) Multiple domains → ["avatar", "capture"]               │
│   C) Clarification needed → Ask user question               │
│                                                              │
│ Internal tracking: confidence_score (not shown to user)     │
└─────────────────────────────┬───────────────────────────────┘
                              ↓
                    ┌─────────┴─────────┐
                    │                   │
        Single Domain             Multiple Domains
                    │                   │
                    ↓                   ↓
┌──────────────────────────┐   ┌────────────────────────────┐
│ Stage 2: Specialized     │   │ Stage 2: Parallel Execution│
│ Response Generation      │   │ Run ALL domain prompts     │
│                          │   │                            │
│ Domain Prompt + Tools:   │   │ Example: avatar + capture  │
│  ├─ System KB (15)       │   │  ├─ Avatar Prompt          │
│  ├─ User KB (5)          │   │  └─ CAPTURE Prompt         │
│  └─ Web Search (5)       │   │                            │
│                          │   │ Each returns response      │
│ Total: ~3,500 tokens     │   └────────┬───────────────────┘
└──────────┬───────────────┘            │
           │                            ↓
           │                ┌────────────────────────────────┐
           │                │ Stage 3: Response Synthesis    │
           │                │ Synthesis Prompt combines      │
           │                │ multiple domain responses into │
           │                │ cohesive answer + offers       │
           │                │ deeper exploration options     │
           │                └────────┬───────────────────────┘
           │                         │
           └─────────────┬───────────┘
                         ↓
              Final Response to User
```

### Domain-Specific Tone Matrix

| Domain | Primary Tone | Question Style | Strategic Approach |
|--------|-------------|----------------|-------------------|
| **Diagnostic** | Direct & analytical | "What data do we need?" | Data-driven assessment |
| **Avatar** | Empathetic & curious | "Who are we serving?" | Human-centered discovery |
| **Canvas** | Strategic & pragmatic | "How does this work?" | Business model thinking |
| **CAPTURE** | Creative & energetic | "What will resonate?" | Engagement-focused |
| **Core** | Reflective & inspirational | "Why does this matter?" | Purpose-driven |

**Common Across All Domains:**
- Ask clarifying questions when context is missing
- Be supportive and encouraging throughout
- Ground advice in Trevor's IDEA framework
- Cite sources from System KB (Trevor's book) and User KB (user's data)

---

## 📚 Knowledge Base Structure

### System KB: Trevor's Book Organization

Trevor's book is already structured by the IDEA framework:

```
Trevor's Book Content Mapping:
├─ Identify (Diagnostic) → vs_system_diagnostic
│  └─ Brand assessment, competitive analysis, SWOT
│
├─ Discover (Avatar) → vs_system_avatar
│  └─ Customer profiling, persona development
│
├─ Execute (Canvas) → vs_system_canvas
│  └─ Business models, value propositions
│
├─ Analyze (CAPTURE) → vs_system_capture
│  └─ Content strategy, marketing campaigns
│
└─ Core (Foundations) → vs_system_core
   └─ Brand story, mission, vision, values
```

**Supplemental Content (Via Web Search):**
- Marketing framework summaries (publicly available)
- Case study references
- Industry best practices
- Attribution required in all responses

---

## 🎯 Response Format Guidelines

Each domain has its own preferred response structure:

### Diagnostic Responses
- **Format:** Scores, ratings, gap analysis
- **Structure:** Assessment → Insights → Recommendations
- **Visual:** Tables, bullet-point findings

### Avatar Responses
- **Format:** Persona profiles, demographic breakdowns
- **Structure:** Who → Needs → Behaviors → How to Reach
- **Visual:** Persona cards, audience segments

### Canvas Responses
- **Format:** Business model components, strategic frameworks
- **Structure:** Current State → Gaps → Opportunities → Actions
- **Visual:** Canvas diagrams, value prop statements

### CAPTURE Responses
- **Format:** Content calendars, campaign blueprints
- **Structure:** Strategy → Tactics → Channels → Metrics
- **Visual:** Campaign outlines, content matrices

### Core Responses
- **Format:** Brand narratives, mission statements
- **Structure:** Purpose → Values → Story → Expression
- **Visual:** Brand foundation documents

---

## 📝 Individual Prompt Files

### 1. [Router Prompt](./router-prompt.md) ✅
**Purpose:** Intent classification and routing
**Output:** JSON with domain(s) or clarification request
**Status:** Complete

### 2. [Synthesis Prompt](./synthesis-prompt.md) ⏳
**Purpose:** Combine multiple domain responses into cohesive answer
**Output:** Unified response with exploration options
**Status:** In Progress

### 3. [Diagnostic Prompt](./diagnostic-prompt.md) ⏳
**Purpose:** Brand assessment and competitive analysis
**Domain:** Identify (I in IDEA)
**Status:** In Progress

### 4. [Avatar Prompt](./avatar-prompt.md) ⏳
**Purpose:** Customer persona development
**Domain:** Discover (D in IDEA)
**Status:** In Progress

### 5. [Canvas Prompt](./canvas-prompt.md) ⏳
**Purpose:** Business model design
**Domain:** Execute (E in IDEA)
**Status:** In Progress

### 6. [CAPTURE Prompt](./capture-prompt.md) ⏳
**Purpose:** Content and marketing strategy
**Domain:** Analyze (A in IDEA)
**Status:** In Progress

### 7. [Core Prompt](./core-prompt.md) ⏳
**Purpose:** Brand foundations and storytelling
**Domain:** Core (supports all IDEA stages)
**Status:** In Progress

---

## 🔄 Next Steps

1. ✅ Define tool architecture
2. ✅ Map Trevor's book to vector stores
3. ✅ Build Router Prompt
4. ⏳ Build Synthesis Prompt
5. ⏳ Build 5 Specialized Domain Prompts
6. ⏳ Test with hypothetical examples
7. ⏳ Refine based on testing
8. ⏳ Resolve P1 blocker (web search vs ingestion pipeline)

---

## 📞 Related Documentation

- [High-Level Design](../IDEA_BRAND_COACH_HIGH_LEVEL_DESIGN.md)
- [Chatbot Data Access Tools Plan](../CHATBOT_DATA_ACCESS_TOOLS_PLAN.md)
- [System Knowledge Base Plan](../SYSTEM_KNOWLEDGE_BASE_PLAN.md)
- [System/User KB Separation Guide](../SYSTEM_USER_KNOWLEDGE_BASE_SEPARATION_GUIDE.md)

---

**Document Owner:** Development Team
**Last Review:** 2025-11-15
**Next Review:** After all prompts completed

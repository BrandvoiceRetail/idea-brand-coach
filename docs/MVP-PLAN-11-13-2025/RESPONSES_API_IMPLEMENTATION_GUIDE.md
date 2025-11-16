# Responses API Implementation Guide
## Simplified OpenAI Integration for IDEA Brand Coach

**Version:** 1.0
**Last Updated:** 2025-11-15
**Status:** Ready for Implementation

---

## Executive Summary

This guide provides the **correct, simplified implementation** using OpenAI's Responses API. The key insight: **configure prompts and vector stores in the OpenAI Platform UI**, then make simple API calls with just `prompt_id`.

### Why This is Simple

❌ **You DON'T need to:**
- Configure tools in code
- Pass vector_store_ids in every API call
- Build complex tool configurations
- Manually manage file search setup

✅ **You ONLY need to:**
- Create prompts in OpenAI Platform (one-time setup)
- Attach vector stores to prompts (via UI)
- Make simple API calls with `prompt_id`
- Track `response_id` for conversation memory

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│         OpenAI Platform (One-Time Setup)                    │
│                                                              │
│  Create 7 Prompts + Attach Vector Stores:                   │
│  ├─ router_prompt → (no vector stores)                      │
│  ├─ diagnostic_prompt → System Diagnostic KB + User KB      │
│  ├─ avatar_prompt → System Avatar KB + User KB              │
│  ├─ canvas_prompt → System Canvas KB + User KB              │
│  ├─ capture_prompt → System CAPTURE KB + User KB            │
│  ├─ core_prompt → System Core KB + User KB                  │
│  └─ synthesis_prompt → (no vector stores)                   │
│                                                              │
│  Result: Get 7 prompt IDs                                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│         Your Edge Functions (Simple Code)                   │
│                                                              │
│  response = client.responses.create({                       │
│    prompt_id: "diagnostic_prompt",  ← That's it!            │
│    input: userMessage,                                      │
│    previous_response_id: lastResponseId                     │
│  })                                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Phase 1: OpenAI Platform Setup](#phase-1-openai-platform-setup)
2. [Phase 2: User Vector Stores](#phase-2-user-vector-stores)
3. [Phase 3: Edge Function Implementation](#phase-3-edge-function-implementation)
4. [Phase 4: Conversation Management](#phase-4-conversation-management)
5. [Phase 5: Testing](#phase-5-testing)
6. [Database Schema (Minimal)](#database-schema-minimal)
7. [Cost Analysis](#cost-analysis)

---

## Phase 1: OpenAI Platform Setup

### Step 1.1: Create System KB Vector Stores

**Location:** https://platform.openai.com/storage/vector_stores

**Create 5 shared vector stores:**

1. **System Diagnostic KB**
   - Name: `IDEA System KB - Diagnostic`
   - Upload: Trevor's book chapters on brand assessment
   - Upload: SWOT framework syntheses
   - Upload: Positioning strategy documents
   - **Save the vector_store_id**

2. **System Avatar KB**
   - Name: `IDEA System KB - Avatar`
   - Upload: Trevor's customer profiling chapters
   - Upload: StoryBrand framework synthesis
   - Upload: Persona development guides
   - **Save the vector_store_id**

3. **System Canvas KB**
   - Name: `IDEA System KB - Canvas`
   - Upload: Trevor's business model chapters
   - Upload: Business Model Canvas synthesis
   - Upload: Blue Ocean Strategy synthesis
   - **Save the vector_store_id**

4. **System CAPTURE KB**
   - Name: `IDEA System KB - CAPTURE`
   - Upload: Trevor's marketing execution chapters
   - Upload: Contagious (STEPPS) synthesis
   - Upload: Made to Stick synthesis
   - **Save the vector_store_id**

5. **System Core KB**
   - Name: `IDEA System KB - Core`
   - Upload: Trevor's brand philosophy chapters
   - Upload: Brand storytelling frameworks
   - Upload: Mission/vision development guides
   - **Save the vector_store_id**

### Step 1.2: Create Prompts in OpenAI Platform

**Location:** https://platform.openai.com/chat

**Create 7 prompts:**

#### Prompt 1: Router Prompt

**Name:** `router_prompt`

**System Instructions:**
```
You are an intelligent router for the IDEA Brand Coach system. Your job is to analyze the user's question and determine which domain(s) it belongs to.

DOMAINS:
- diagnostic: Brand assessment, SWOT analysis, competitive positioning, brand strength evaluation
- avatar: Customer profiling, personas, target audience, demographics, market segmentation
- canvas: Business models, value propositions, revenue streams, partnerships, channels
- capture: Content strategy, marketing execution, campaigns, social media, engagement
- core: Brand foundations, mission, vision, values, brand story, authenticity

INSTRUCTIONS:
1. Analyze the user's question
2. Determine if it maps to ONE domain or MULTIPLE domains
3. If unclear, ask a clarifying question

OUTPUT FORMAT:
{
  "domains": ["domain_name"],  // Single domain: ["diagnostic"]
                               // Multiple domains: ["avatar", "capture"]
  "confidence": 0.95,
  "reasoning": "Brief explanation"
}

OR if clarification needed:
{
  "clarification_needed": true,
  "question": "Are you asking about..."
}
```

**Model:** `gpt-4o`
**Temperature:** 0.3
**Tools:** None
**Vector Stores:** None

**Save the prompt_id:** `router_prompt_abc123`

---

#### Prompt 2: Diagnostic Prompt

**Name:** `diagnostic_prompt`

**System Instructions:**
```
You are an expert brand strategist specializing in brand assessment using the IDEA framework (Insight, Distinctive, Empathetic, Authentic).

Your expertise comes from Trevor's proprietary methodologies and proven marketing frameworks. You have access to:
1. SYSTEM KNOWLEDGE: Trevor's book chapters and marketing framework syntheses
2. USER CONTEXT: This specific user's diagnostic results and brand information

INSTRUCTIONS:
- Provide detailed, actionable insights based on Trevor's methodologies
- Reference the user's specific diagnostic scores when relevant
- Identify weak areas and prioritize improvements
- Use proven frameworks (SWOT, positioning, competitive analysis)
- Be specific and tactical, not generic
- Cite sources when using specific frameworks

TONE: Expert consultant, encouraging but direct, focused on actionable insights
```

**Model:** `gpt-4o`
**Temperature:** 0.7
**Tools:** File Search (enabled)
**Vector Stores:**
- System Diagnostic KB: `vs_system_diagnostic_xyz`
- User Diagnostic KB: `vs_user_{user_id}_diagnostic` (dynamic - see Phase 2)

**Save the prompt_id:** `diagnostic_prompt_def456`

---

#### Prompt 3: Avatar Prompt

**Name:** `avatar_prompt`

**System Instructions:**
```
You are an expert in customer profiling and persona development. You help users define their ideal customer using Trevor's methods and frameworks like StoryBrand.

Your expertise comes from:
1. SYSTEM KNOWLEDGE: Trevor's customer profiling methodologies and StoryBrand synthesis
2. USER CONTEXT: This user's target audience data and customer research

INSTRUCTIONS:
- Help users create detailed, actionable customer personas
- Use the StoryBrand framework to position the customer as the hero
- Guide demographic and psychographic profiling
- Map customer journeys and pain points
- Connect customer insights to brand strategy
- Reference the user's specific audience data when available

TONE: Empathetic guide, asking probing questions, helping users understand their customers deeply
```

**Model:** `gpt-4o`
**Temperature:** 0.7
**Tools:** File Search (enabled)
**Vector Stores:**
- System Avatar KB: `vs_system_avatar_xyz`
- User Avatar KB: `vs_user_{user_id}_avatar` (dynamic)

**Save the prompt_id:** `avatar_prompt_ghi789`

---

#### Prompt 4: Canvas Prompt

**Name:** `canvas_prompt`

**System Instructions:**
```
You are a business model expert helping users design and optimize their business models using frameworks like Business Model Canvas and Blue Ocean Strategy.

Your expertise comes from:
1. SYSTEM KNOWLEDGE: Trevor's business strategy guidance and BMC/Blue Ocean syntheses
2. USER CONTEXT: This user's business model documents and strategy materials

INSTRUCTIONS:
- Guide users through Business Model Canvas development
- Help identify value propositions and revenue streams
- Apply Blue Ocean Strategy for differentiation
- Analyze partnerships, channels, and resources
- Connect business model to brand strategy
- Reference the user's specific business context

TONE: Strategic advisor, thinking long-term, challenging assumptions constructively
```

**Model:** `gpt-4o`
**Temperature:** 0.7
**Tools:** File Search (enabled)
**Vector Stores:**
- System Canvas KB: `vs_system_canvas_xyz`
- User Canvas KB: `vs_user_{user_id}_canvas` (dynamic)

**Save the prompt_id:** `canvas_prompt_jkl012`

---

#### Prompt 5: CAPTURE Prompt

**Name:** `capture_prompt`

**System Instructions:**
```
You are a content strategy and marketing execution expert. You help users create engaging content and marketing campaigns using proven frameworks like STEPPS (Contagious) and SUCCESs (Made to Stick).

Your expertise comes from:
1. SYSTEM KNOWLEDGE: Trevor's marketing execution chapters and viral marketing frameworks
2. USER CONTEXT: This user's marketing materials and campaign documents

INSTRUCTIONS:
- Help users develop content strategies that resonate
- Apply STEPPS framework (Social Currency, Triggers, Emotion, Public, Practical Value, Stories)
- Apply SUCCESs framework (Simple, Unexpected, Concrete, Credible, Emotional, Stories)
- Guide campaign planning and execution
- Provide tactical marketing recommendations
- Reference the user's specific marketing context

TONE: Creative partner, energetic, focused on practical execution and engagement
```

**Model:** `gpt-4o`
**Temperature:** 0.7
**Tools:** File Search (enabled)
**Vector Stores:**
- System CAPTURE KB: `vs_system_capture_xyz`
- User CAPTURE KB: `vs_user_{user_id}_capture` (dynamic)

**Save the prompt_id:** `capture_prompt_mno345`

---

#### Prompt 6: Core Prompt

**Name:** `core_prompt`

**System Instructions:**
```
You are a brand foundation expert helping users define their mission, vision, values, and brand story.

Your expertise comes from:
1. SYSTEM KNOWLEDGE: Trevor's brand philosophy and storytelling frameworks
2. USER CONTEXT: This user's brand guidelines and foundation documents

INSTRUCTIONS:
- Help users articulate their brand mission and vision
- Guide values definition and brand personality development
- Develop compelling brand stories
- Ensure authenticity and consistency
- Connect brand foundations to all other brand elements
- Reference the user's specific brand context

TONE: Inspiring guide, philosophical yet practical, focused on authenticity and meaning
```

**Model:** `gpt-4o`
**Temperature:** 0.7
**Tools:** File Search (enabled)
**Vector Stores:**
- System Core KB: `vs_system_core_xyz`
- User Core KB: `vs_user_{user_id}_core` (dynamic)

**Save the prompt_id:** `core_prompt_pqr678`

---

#### Prompt 7: Synthesis Prompt

**Name:** `synthesis_prompt`

**System Instructions:**
```
You are a synthesis expert who combines multiple specialized responses into a cohesive, comprehensive answer.

You will receive:
1. The user's original question
2. Responses from multiple domain experts (e.g., Avatar + CAPTURE)

INSTRUCTIONS:
- Combine the specialized responses into a unified answer
- Eliminate redundancy and contradictions
- Maintain the key insights from each domain
- Create smooth transitions between topics
- Offer the user options to explore specific domains deeper
- Keep the synthesized response concise but comprehensive

STRUCTURE:
1. Direct answer to the user's question
2. Integrated insights from all domains
3. Clear next steps or recommendations
4. Optional: "Would you like to explore [specific domain] in more detail?"

TONE: Clear, organized, comprehensive yet concise
```

**Model:** `gpt-4o`
**Temperature:** 0.7
**Tools:** None
**Vector Stores:** None

**Save the prompt_id:** `synthesis_prompt_stu901`

---

### Step 1.3: Save All Prompt IDs

**Add to your `.env` file:**

```bash
# OpenAI Responses API Prompt IDs
ROUTER_PROMPT_ID=router_prompt_abc123
DIAGNOSTIC_PROMPT_ID=diagnostic_prompt_def456
AVATAR_PROMPT_ID=avatar_prompt_ghi789
CANVAS_PROMPT_ID=canvas_prompt_jkl012
CAPTURE_PROMPT_ID=capture_prompt_mno345
CORE_PROMPT_ID=core_prompt_pqr678
SYNTHESIS_PROMPT_ID=synthesis_prompt_stu901

# System Vector Store IDs
SYSTEM_DIAGNOSTIC_STORE_ID=vs_system_diagnostic_xyz
SYSTEM_AVATAR_STORE_ID=vs_system_avatar_xyz
SYSTEM_CANVAS_STORE_ID=vs_system_canvas_xyz
SYSTEM_CAPTURE_STORE_ID=vs_system_capture_xyz
SYSTEM_CORE_STORE_ID=vs_system_core_xyz
```

---

## Phase 2: User Vector Stores

### Creating Per-User Vector Stores

**When:** User completes diagnostic OR uploads first document

**Edge Function:** `supabase/functions/create-user-kb/index.ts`

```typescript
import { OpenAI } from "https://esm.sh/openai@4.20.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')!;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Check if user already has vector stores
  const { data: existing } = await supabase
    .from('user_vector_stores')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (existing) {
    return new Response(JSON.stringify(existing), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Create 5 user vector stores
  const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });

  const diagnosticStore = await openai.beta.vectorStores.create({
    name: `User ${user.email} - Diagnostic`,
    metadata: { user_id: user.id, domain: "diagnostic" }
  });

  const avatarStore = await openai.beta.vectorStores.create({
    name: `User ${user.email} - Avatar`,
    metadata: { user_id: user.id, domain: "avatar" }
  });

  const canvasStore = await openai.beta.vectorStores.create({
    name: `User ${user.email} - Canvas`,
    metadata: { user_id: user.id, domain: "canvas" }
  });

  const captureStore = await openai.beta.vectorStores.create({
    name: `User ${user.email} - CAPTURE`,
    metadata: { user_id: user.id, domain: "capture" }
  });

  const coreStore = await openai.beta.vectorStores.create({
    name: `User ${user.email} - Core`,
    metadata: { user_id: user.id, domain: "core" }
  });

  // Save to database
  const userStores = {
    user_id: user.id,
    diagnostic_store_id: diagnosticStore.id,
    avatar_store_id: avatarStore.id,
    canvas_store_id: canvasStore.id,
    capture_store_id: captureStore.id,
    core_store_id: coreStore.id,
  };

  await supabase.from('user_vector_stores').insert(userStores);

  return new Response(JSON.stringify(userStores), {
    headers: { "Content-Type": "application/json" }
  });
});
```

### Adding Diagnostic Data to User KB

**Edge Function:** `supabase/functions/sync-diagnostic-to-user-kb/index.ts`

```typescript
import { OpenAI } from "https://esm.sh/openai@4.20.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')!;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { diagnosticData, scores } = await req.json();

  // Ensure user has vector stores
  await supabase.functions.invoke('create-user-kb');

  // Get user's diagnostic store ID
  const { data: userStores } = await supabase
    .from('user_vector_stores')
    .select('diagnostic_store_id')
    .eq('user_id', user.id)
    .single();

  // Format diagnostic as text document
  const diagnosticText = `
# Brand Diagnostic Results - ${user.email}

**Date:** ${new Date().toISOString()}

## IDEA Framework Scores

- **Insight:** ${scores.insight}/100 - ${getInterpretation(scores.insight)}
- **Distinctive:** ${scores.distinctive}/100 - ${getInterpretation(scores.distinctive)}
- **Empathetic:** ${scores.empathetic}/100 - ${getInterpretation(scores.empathetic)}
- **Authentic:** ${scores.authentic}/100 - ${getInterpretation(scores.authentic)}

**Overall Brand Strength:** ${scores.overall}/100

## Priority Areas for Improvement

${identifyWeakAreas(scores)}

## Detailed Assessment Responses

${formatResponses(diagnosticData)}
  `.trim();

  // Upload to OpenAI as file
  const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });

  const file = await openai.files.create({
    file: new Blob([diagnosticText], { type: 'text/plain' }),
    purpose: "assistants",
  });

  // Add to user's diagnostic vector store
  await openai.beta.vectorStores.files.create(
    userStores.diagnostic_store_id,
    { file_id: file.id }
  );

  return new Response(JSON.stringify({ success: true, file_id: file.id }), {
    headers: { "Content-Type": "application/json" }
  });
});

function getInterpretation(score: number): string {
  if (score >= 80) return "Strong performance";
  if (score >= 60) return "Room for improvement";
  if (score >= 40) return "Needs significant work";
  return "Critical - requires immediate attention";
}

function identifyWeakAreas(scores: any): string {
  const weak = Object.entries(scores)
    .filter(([key, value]) => key !== 'overall' && (value as number) < 60)
    .map(([key, value]) => `- **${key.toUpperCase()}**: ${value}/100 - Priority for coaching`)
    .join('\n');
  return weak || "All dimensions performing well!";
}

function formatResponses(data: any): string {
  return Object.entries(data.answers || {})
    .map(([q, a]) => `**Q:** ${q}\n**A:** ${a}`)
    .join('\n\n');
}
```

---

## Phase 3: Edge Function Implementation

### Main Chatbot: `brand-coach-gpt`

**This is where it gets REALLY simple:**

```typescript
import { OpenAI } from "https://esm.sh/openai@4.20.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DOMAIN_TO_PROMPT = {
  diagnostic: Deno.env.get('DIAGNOSTIC_PROMPT_ID')!,
  avatar: Deno.env.get('AVATAR_PROMPT_ID')!,
  canvas: Deno.env.get('CANVAS_PROMPT_ID')!,
  capture: Deno.env.get('CAPTURE_PROMPT_ID')!,
  core: Deno.env.get('CORE_PROMPT_ID')!,
};

Deno.serve(async (req) => {
  // 1. Authenticate user
  const authHeader = req.headers.get('Authorization')!;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Parse request
  const { message } = await req.json();

  // 3. Get conversation history
  const { data: conversation } = await supabase
    .from('user_conversations')
    .select('latest_response_id')
    .eq('user_id', user.id)
    .single();

  const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });

  // 4. STEP 1: Route the query
  const routerResponse = await openai.responses.create({
    prompt_id: Deno.env.get('ROUTER_PROMPT_ID')!,
    input: message,
    previous_response_id: conversation?.latest_response_id,
    store_response: true
  });

  const routing = JSON.parse(routerResponse.output);

  // Handle clarification
  if (routing.clarification_needed) {
    return new Response(JSON.stringify({
      answer: routing.question,
      type: "clarification"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // 5. STEP 2: Call specialized prompt(s)
  const domains = routing.domains || ['diagnostic'];

  if (domains.length === 1) {
    // Single domain - direct response
    const domain = domains[0];
    const promptId = DOMAIN_TO_PROMPT[domain];

    const response = await openai.responses.create({
      prompt_id: promptId,  // ← That's it! Vector stores auto-attached
      input: message,
      previous_response_id: routerResponse.id,
      store_response: true
    });

    // Update conversation tracking
    await supabase.from('user_conversations').upsert({
      user_id: user.id,
      latest_response_id: response.id,
      last_message_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      answer: response.output,
      domain: domain,
      responseId: response.id
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // 6. STEP 3: Multiple domains - synthesize
  const specializedResponses = await Promise.all(
    domains.map(domain =>
      openai.responses.create({
        prompt_id: DOMAIN_TO_PROMPT[domain],
        input: message,
        previous_response_id: routerResponse.id,
        store_response: true
      })
    )
  );

  // Combine responses with synthesis prompt
  const synthesisInput = `
Original Question: ${message}

Specialized Responses:
${specializedResponses.map((r, i) => `
${domains[i].toUpperCase()} Response:
${r.output}
`).join('\n---\n')}

Synthesize these responses into a cohesive answer.
  `;

  const finalResponse = await openai.responses.create({
    prompt_id: Deno.env.get('SYNTHESIS_PROMPT_ID')!,
    input: synthesisInput,
    previous_response_id: specializedResponses[specializedResponses.length - 1].id,
    store_response: true
  });

  // Update conversation tracking
  await supabase.from('user_conversations').upsert({
    user_id: user.id,
    latest_response_id: finalResponse.id,
    last_message_at: new Date().toISOString()
  });

  return new Response(JSON.stringify({
    answer: finalResponse.output,
    domains: domains,
    responseId: finalResponse.id
  }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

**That's the ENTIRE chatbot implementation!** Notice:
- ✅ No manual tool configuration
- ✅ No vector_store_ids in API calls
- ✅ Just `prompt_id` and `input`
- ✅ OpenAI handles file search automatically

---

## Phase 4: Conversation Management

### Database Schema (Minimal)

```sql
-- User vector store tracking
CREATE TABLE user_vector_stores (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  diagnostic_store_id TEXT NOT NULL,
  avatar_store_id TEXT NOT NULL,
  canvas_store_id TEXT NOT NULL,
  capture_store_id TEXT NOT NULL,
  core_store_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Conversation tracking (just response IDs)
CREATE TABLE user_conversations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  latest_response_id TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS policies
ALTER TABLE user_vector_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own vector stores"
ON user_vector_stores FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users own conversations"
ON user_conversations FOR ALL
USING (auth.uid() = user_id);
```

### Conversation Memory

**It's automatic!** Just pass `previous_response_id`:

```typescript
const response = await openai.responses.create({
  prompt_id: "diagnostic_prompt",
  input: "What's my Distinctive score?",
  previous_response_id: "resp_abc123",  // ← Auto-loads conversation history
  store_response: true
});
```

OpenAI handles:
- ✅ Loading previous conversation context
- ✅ Maintaining conversation state
- ✅ Storing new responses server-side

---

## Phase 5: Testing

### Test 1: Prompt Configuration

**Verify in OpenAI Platform:**
1. Go to https://platform.openai.com/chat
2. Check each of the 7 prompts exists
3. Verify vector stores are attached to domain prompts
4. Test each prompt with sample queries

### Test 2: User KB Creation

```typescript
// Test creating user vector stores
const result = await supabase.functions.invoke('create-user-kb');
console.log(result.data);
// Expected: 5 vector store IDs

// Verify in database
const { data } = await supabase
  .from('user_vector_stores')
  .select('*')
  .eq('user_id', userId);
console.log(data);
```

### Test 3: Diagnostic Sync

```typescript
// Sync diagnostic to user KB
await supabase.functions.invoke('sync-diagnostic-to-user-kb', {
  body: {
    diagnosticData: { answers: {...} },
    scores: { insight: 75, distinctive: 40, ... }
  }
});

// Verify file added to vector store
// Check in OpenAI Platform → Vector Stores → User's Diagnostic Store
```

### Test 4: End-to-End Chat

```typescript
// Send message to chatbot
const response = await supabase.functions.invoke('brand-coach-gpt', {
  body: { message: "How can I improve my Distinctive score?" }
});

console.log(response.data.answer);
// Expected: Personalized response mentioning user's actual score (40/100)
//           and Trevor's differentiation frameworks
```

---

## Database Schema (Minimal)

**Migration:** `supabase/migrations/20251115_responses_api.sql`

```sql
-- User vector store IDs (just tracking)
CREATE TABLE user_vector_stores (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  diagnostic_store_id TEXT NOT NULL,
  avatar_store_id TEXT NOT NULL,
  canvas_store_id TEXT NOT NULL,
  capture_store_id TEXT NOT NULL,
  core_store_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Conversation tracking (just response IDs)
CREATE TABLE user_conversations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  latest_response_id TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Document upload metadata (optional)
CREATE TABLE uploaded_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_id TEXT NOT NULL,
  vector_store_domain TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS
ALTER TABLE user_vector_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own vector stores" ON user_vector_stores FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own conversations" ON user_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own documents" ON uploaded_documents FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_user_conversations_user_id ON user_conversations(user_id);
CREATE INDEX idx_uploaded_documents_user_id ON uploaded_documents(user_id);
```

**That's ALL the database you need!**

No:
- ❌ `user_knowledge_chunks` table
- ❌ Embedding columns
- ❌ Vector similarity functions
- ❌ pgvector extension

---

## Cost Analysis

### OpenAI Responses API Pricing

**Vector Storage:** $0.10/GB/day

**System KB (Shared):**
- 5 stores × ~5GB each = 25GB
- Cost: 25GB × $0.10/day = **$75/month**

**User KB (Per User):**
- 5 stores × ~3MB each = 15MB per user
- 1,000 users = 15GB
- Cost: 15GB × $0.10/day = **$45/month for 1,000 users**

**Total:** ~$120/month for 1,000 users

**Responses API Calls:**
- Router call: ~$0.01
- Specialized call: ~$0.02
- Synthesis call (if multi-domain): ~$0.01
- **Per conversation: ~$0.03-0.04**

**Monthly at 10,000 conversations:** ~$300-400

**Total Platform Cost:** ~$420-520/month for 1,000 users with 10,000 conversations

---

## Implementation Checklist

### Day 1: OpenAI Platform Setup
- [ ] Create 5 System KB vector stores
- [ ] Upload Trevor's book and syntheses to each store
- [ ] Create 7 prompts (Router + 5 domains + Synthesis)
- [ ] Attach vector stores to domain prompts
- [ ] Save all prompt IDs to `.env`
- [ ] Test each prompt in OpenAI playground

### Day 2: Database & User KB
- [ ] Create database migration
- [ ] Implement `create-user-kb` Edge Function
- [ ] Implement `sync-diagnostic-to-user-kb` Edge Function
- [ ] Test user vector store creation
- [ ] Test diagnostic sync

### Day 3: Chatbot Implementation
- [ ] Implement `brand-coach-gpt` Edge Function
- [ ] Implement routing logic
- [ ] Implement single-domain flow
- [ ] Implement multi-domain synthesis flow
- [ ] Test end-to-end conversations

### Day 4: Frontend Integration
- [ ] Update `useDiagnostic` hook to call sync function
- [ ] Update `useChat` hook to call brand-coach-gpt
- [ ] Test diagnostic → sync → chat flow
- [ ] Add conversation history display

### Day 5: Testing & Polish
- [ ] Security testing (user isolation)
- [ ] Performance testing (response times)
- [ ] Quality testing (response accuracy)
- [ ] Fix any bugs
- [ ] Deploy to production

**Total: 5 days**

---

## Key Differences from Previous Implementation

### What Changed

**Before (Overcomplicated):**
```typescript
// Manual tool configuration in code
const tools = [
  {
    type: "file_search",
    file_search: {
      vector_store_ids: [systemStoreId, userStoreId],
      max_num_results: 15,
      ranking_options: { ... }
    }
  }
];

const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [...],
  tools: tools  // ← Passing tools manually
});
```

**After (Correct & Simple):**
```typescript
// Just reference the prompt (tools auto-attached)
const response = await openai.responses.create({
  prompt_id: "diagnostic_prompt",  // ← Vector stores already attached in UI
  input: userMessage,
  previous_response_id: lastResponseId
});
```

### Why This is Better

✅ **Simpler Code:** 90% less configuration code
✅ **No Tool Management:** Vector stores attached once in UI
✅ **Easier Updates:** Change vector stores in UI, not in code
✅ **Better Separation:** Prompts managed by product team, not buried in code
✅ **Faster Development:** Set up prompts once, use everywhere

---

## Next Steps

1. **Start with OpenAI Platform UI:**
   - Create vector stores
   - Upload Trevor's book
   - Create prompts
   - Attach vector stores to prompts

2. **Then write minimal code:**
   - User vector store creation
   - Edge Function with `prompt_id` calls
   - Conversation tracking

**That's it!**

---

**Document Version:** 1.0
**Last Updated:** 2025-11-15
**Status:** ✅ Correct Implementation Guide

**Related Documents:**
- [High-Level Design](./IDEA_BRAND_COACH_HIGH_LEVEL_DESIGN.md)
- [Chatbot Data Access Tools Plan](./CHATBOT_DATA_ACCESS_TOOLS_PLAN.md)

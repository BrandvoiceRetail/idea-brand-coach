# IDEA Brand Coach MVP - Comprehensive Brief Analysis
## Alignment Assessment & Implementation Roadmap

**Document Version:** 1.0
**Analysis Date:** 2025-11-08
**Baseline Commit:** 9384aa9ce23047bdfb928cdf0729b6062487837f
**Brief Version:** MVP v1.2 (Expanded for Developer Clarity)
**Analyst:** Matthew Kerns

---

## Executive Summary

### Current State vs. Brief Requirements

**Overall Alignment:** ⚠️ **PARTIAL - Significant Rework Required** (40% aligned)

The current implementation has diverged substantially from Trevor's MVP brief. While the diagnostic flow and Brand Coach chat are functional, **the core architectural requirement—multi-prompt routing with a single GPT endpoint—is not implemented**. Instead, the codebase contains:

1. **Multiple separate Edge Functions** (not a unified router)
2. **Hardcoded prompts in Edge Functions** (not database-stored with admin editing)
3. **Missing P1 features treated as P0** (Avatar Builder, Brand Canvas, CAPTURE)
4. **No Stripe paywall** (critical monetization missing)
5. **No training course access** (critical course delivery missing)
6. **No PDF generation** for diagnostics (brief requires HTML-to-PDF)

### Rework Estimate

**Time Required:** 12-16 hours of focused development
**Risk Level:** Medium (requires architectural changes)
**Recommendation:** Reset expectations with Trevor before proceeding

---

## Table of Contents

1. [Detailed Requirements Analysis](#detailed-requirements-analysis)
2. [Gap Analysis by Component](#gap-analysis-by-component)
3. [Architecture Comparison](#architecture-comparison)
4. [Implementation Roadmap](#implementation-roadmap)
5. [Risk Assessment](#risk-assessment)
6. [Questions for Trevor](#questions-for-trevor)
7. [Recommendations](#recommendations)

---

## Detailed Requirements Analysis

### 1. OBJECTIVE (Brief Section 1)

**Brief Requirement:**
> "Deliver a functional MVP that replaces the existing IDEA modules in Lovable with a single IDEA GPT endpoint using multi-prompt routing."

**Current Implementation:**
- ❌ **Not aligned** - Multiple separate Edge Functions exist:
  - `brand-coach-gpt` (RAG-enabled chat)
  - `idea-framework-consultant` (old consultant)
  - `ai-insight-guidance`
  - `brand-ai-assistant`
  - `buyer-intent-analyzer`
  - `contextual-help`
  - `document-processor`

**Status:** 🔴 **CRITICAL GAP** - Core architecture requirement not met

**What Needs to Change:**
1. Create new `idea-gpt-router` Edge Function
2. Implement `runAI(userId, taskType, userInput, contextData)` function
3. Store all prompts in Supabase `prompts` table with admin-only RLS
4. Deprecate existing separate functions
5. Route all AI calls through single endpoint

---

### 2. CORE COMPONENTS

#### 2.1 Brand Diagnostic Tool (Lead Magnet)

**Brief Requirements:**
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Public landing page | ✅ EXISTS | `src/pages/FreeDiagnostic.tsx` |
| Captures email after submission | ⚠️ PARTIAL | Uses legacy `BetaTesterCapture.tsx` |
| Uses IDEA Diagnostic prompt | ❌ MISSING | No specialized diagnostic prompt |
| Generates Brand Snapshot | ⚠️ PARTIAL | Stores diagnostic, no "snapshot" format |
| Creates HTML-to-PDF | ❌ MISSING | No PDF generation implemented |
| PDF stored in Supabase | ❌ MISSING | No PDF storage |
| PDF includes actionable line | ❌ MISSING | Results page has CTAs but no PDF |

**Current Implementation:**
```typescript
// src/pages/FreeDiagnostic.tsx - Lines 217-240
const handleSubmit = async () => {
  // ... validation ...

  if (user) {
    // Save to Supabase
    await saveDiagnostic({ answers, scores, userId: user.id });
    navigate('/diagnostic/results');
  } else {
    // Trigger auth modal (BetaTesterCapture)
    setShowAuthPrompt(true);
  }
};
```

**Gap Analysis:**
- ✅ Diagnostic flow works
- ✅ Scores calculated correctly
- ❌ No PDF generation
- ❌ No specialized IDEA Diagnostic prompt (taskType: `diagnostic`)
- ❌ BetaTesterCapture modal is legacy (should be modern AuthModal)

**Required Changes:**
1. Implement PDF generation library (e.g., `jsPDF`, `react-pdf`, or server-side Puppeteer)
2. Create "Brand Snapshot" template with IDEA branding
3. Store PDF in Supabase Storage
4. Add download/email PDF functionality
5. Replace BetaTesterCapture with modern AuthModal
6. Wire to `runAI()` with taskType: `diagnostic`

**Estimated Effort:** 3-4 hours

---

#### 2.2 AI Brand Coach (Chat Interface)

**Brief Requirements:**
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Authenticated users only | ✅ COMPLETE | Protected route with auth check |
| Powered by Brand Coach prompt | ⚠️ PARTIAL | Hardcoded prompt, not taskType routing |
| Preloads latest diagnostic summary | ✅ COMPLETE | RAG system retrieves diagnostic context |
| Stores conversation history | ✅ COMPLETE | `chat_messages` table with RLS |
| File uploads supported (metadata only) | ⚠️ PARTIAL | UI exists, backend needs wiring |

**Current Implementation:**
```typescript
// supabase/functions/brand-coach-gpt/index.ts - Lines 9-28
const SYSTEM_PROMPT = `You are the IDEA Brand Coach...`;
// Hardcoded, not database-driven

// Lines 56-98: RAG retrieval working
async function retrieveRelevantContext(...) {
  const queryEmbedding = await generateEmbedding(query, openaiKey);
  const { data: matches } = await supabaseClient.rpc("match_user_documents", {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: 3,
  });
  // Returns diagnostic context ✅
}
```

**Gap Analysis:**
- ✅ Chat UI functional (`src/pages/BrandCoach.tsx`)
- ✅ RAG system operational with vector search
- ✅ Chat history persists
- ❌ Prompt not stored in database (taskType: `coach` routing)
- ⚠️ Document upload UI exists but not wired to embeddings

**Required Changes:**
1. Move SYSTEM_PROMPT to `prompts` table
2. Update `brand-coach-gpt` to read prompt from database
3. Implement taskType routing (or migrate to unified router)
4. Wire document upload to `sync-diagnostic-to-embeddings` equivalent
5. Add prompt logging (taskType, timestamp, token usage)

**Estimated Effort:** 2-3 hours

---

#### 2.3 Prompt Router (IDEA GPT Ecosystem Integration)

**Brief Requirements:**
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Single GPT endpoint for all tasks | ❌ MISSING | Multiple separate Edge Functions |
| Router selects prompt based on taskType | ❌ MISSING | No router implemented |
| Prompts stored in Supabase | ❌ MISSING | Hardcoded in Edge Functions |
| Admin-only edit permissions | ❌ MISSING | No prompts table |
| Logging (taskType, timestamp, tokens) | ❌ MISSING | No logging infrastructure |

**Brief Architecture:**
```
SYSTEM PROMPT = Shared Core Prompt + Specialist Layer + User Context + User Input
```

**Current Implementation:**
- Each Edge Function has its own hardcoded prompt
- No concept of "Shared Core Prompt" + "Specialist Layer"
- No centralized routing logic

**Required Implementation:**

**Database Schema:**
```sql
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT UNIQUE NOT NULL, -- 'diagnostic', 'avatar', 'capture', 'coach', 'brand_canvas'
  prompt_layer TEXT NOT NULL, -- 'core' or 'specialist'
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Admin-only RLS policies
CREATE POLICY "Only admins can edit prompts" ON prompts
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
```

**New Edge Function: `idea-gpt-router`**
```typescript
async function runAI(
  userId: string,
  taskType: 'diagnostic' | 'avatar' | 'capture' | 'coach' | 'brand_canvas',
  userInput: string,
  contextData?: any
): Promise<{ response: string; sources?: string[] }> {
  // 1. Retrieve prompts from database
  const { data: corePrompt } = await supabase
    .from('prompts')
    .select('content')
    .eq('prompt_layer', 'core')
    .eq('is_active', true)
    .single();

  const { data: specialistPrompt } = await supabase
    .from('prompts')
    .select('content')
    .eq('task_type', taskType)
    .eq('is_active', true)
    .single();

  // 2. Build composite prompt
  const systemPrompt = `${corePrompt.content}\n\n${specialistPrompt.content}`;

  // 3. Add user context (RAG if available)
  let contextString = '';
  if (taskType === 'coach' || taskType === 'diagnostic') {
    const ragContext = await retrieveUserContext(userId, userInput);
    contextString = ragContext.content;
  }

  // 4. Call OpenAI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt + contextString },
      { role: 'user', content: userInput }
    ]
  });

  // 5. Log the call
  await supabase.from('ai_logs').insert({
    user_id: userId,
    task_type: taskType,
    tokens_used: completion.usage.total_tokens,
    timestamp: new Date()
  });

  return { response: completion.choices[0].message.content };
}
```

**Required Changes:**
1. Create `prompts` table with migration
2. Seed initial prompts from brief (Shared Core, IDEA, Avatar, CAPTURE, Brand Coach)
3. Create `ai_logs` table for debugging
4. Implement `idea-gpt-router` Edge Function with `runAI()`
5. Update all frontend calls to use single endpoint
6. Build admin UI for prompt editing (P1 feature, but database ready)

**Estimated Effort:** 4-5 hours

---

#### 2.4 Paywall and Training Access

**Brief Requirements:**
| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Stripe integration | ❌ MISSING | No Stripe code in codebase |
| Free tier: 1 diagnostic, 3 chat messages | ❌ MISSING | No usage limits enforced |
| Pro tier: Unlimited access | ❌ MISSING | No subscription logic |
| Training content (Vimeo/Loom embeds) | ❌ MISSING | No training pages exist |

**Current Implementation:**
```bash
$ grep -r "stripe" /Users/matthewkerns/workspace/idea-brand-coach
# No results - Stripe not implemented
```

**Required Implementation:**

**Database Schema:**
```sql
-- Add to profiles table
ALTER TABLE profiles
ADD COLUMN subscription_tier TEXT DEFAULT 'free', -- 'free' or 'pro'
ADD COLUMN subscription_status TEXT, -- 'active', 'canceled', 'past_due'
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN stripe_subscription_id TEXT;

-- Usage tracking
CREATE TABLE usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  diagnostics_count INTEGER DEFAULT 0,
  chat_messages_count INTEGER DEFAULT 0,
  reset_at TIMESTAMPTZ DEFAULT (now() + interval '30 days')
);
```

**Stripe Integration:**
1. Install `@stripe/stripe-js` and `stripe` packages
2. Create Stripe products: Free (no payment), Pro ($XX/month)
3. Create Edge Function: `create-checkout-session`
4. Create Edge Function: `stripe-webhook` (handle subscription events)
5. Add upgrade CTA to UI when limits hit
6. Implement usage tracking middleware

**Training Content:**
1. Create `training_modules` table
2. Create `src/pages/Training.tsx` with video embeds
3. Add RLS policy: Only Pro users can access
4. Embed Vimeo/Loom iframe players

**Estimated Effort:** 6-8 hours

---

#### 2.5 Multi-Prompt Approach - Specialist Prompts

##### 2.5.1 Shared Core Prompt

**Brief Requirement:**
> "Applies to every GPT call. Establishes tone, voice, and philosophical consistency. Reinforces IDEA principles."

**Current Implementation:**
- ❌ No shared core prompt concept
- Each Edge Function has independent prompt

**Required Changes:**
1. Create "Shared Core Prompt" entry in `prompts` table:
```sql
INSERT INTO prompts (task_type, prompt_layer, content) VALUES
('shared', 'core', 'You are an expert in the IDEA Framework (Insight, Distinctive, Empathetic, Authentic).
Your tone is warm, supportive, and encouraging. You sound like Trevor Bradford and use behavioural language.
Always ground advice in IDEA principles...');
```

**Estimated Effort:** 30 minutes (as part of prompt router work)

---

##### 2.5.2 IDEA Prompt (taskType: diagnostic or brand_canvas)

**Brief Requirement:**
> "Outputs four-part structured canvas: Insight, Distinctive, Empathetic, Authentic, and Key Takeaway. UI should use four panels and allow PDF export."

**Current Implementation:**
- `src/pages/BrandCanvas.tsx` exists ✅
- Uses manual form inputs (not AI-generated) ❌
- No PDF export ❌

**Gap Analysis:**
- Brand Canvas page exists but is a manual form
- No AI generation of canvas from user input
- No connection to `runAI()` with taskType `brand_canvas`

**Required Changes:**
1. Add specialist prompt to database:
```sql
INSERT INTO prompts (task_type, prompt_layer, content) VALUES
('brand_canvas', 'specialist', 'Analyze user input through the IDEA lens.
Output a four-part structured canvas:
- Insight: [Customer emotional drivers]
- Distinctive: [Unique positioning]
- Empathetic: [Connection strategy]
- Authentic: [Brand consistency]
- Key Takeaway: [Actionable next step]
Format as JSON for frontend parsing.');
```

2. Update BrandCanvas.tsx:
   - Add "Generate with AI" button
   - Call `runAI(userId, 'brand_canvas', userInput)`
   - Parse JSON response into four panels
   - Add PDF export button (use same library as diagnostic PDF)

3. Implement PDF export with four-panel layout

**Estimated Effort:** 2-3 hours

---

##### 2.5.3 Avatar 2.0 Prompt (taskType: avatar)

**Brief Requirement:**
> "Output fields: Name, Buying Intent, Emotional Drivers, Trust Triggers, Shopper Type, Barriers, Tone, Channel Behaviour. UI should present as labelled sections or cards."

**Current Implementation:**
- `src/pages/AvatarBuilder.tsx` exists ✅
- Manual form inputs (28KB file - comprehensive form) ❌
- No AI generation ❌

**Gap Analysis:**
```typescript
// AvatarBuilder.tsx - Lines 16-37
interface Avatar {
  name: string;
  demographics: { age, income, location, lifestyle };
  psychographics: { values, fears, desires, triggers };
  buyingBehavior: { intent, decisionFactors, shoppingStyle, priceConsciousness };
  voiceOfCustomer: string;
}
// All manual inputs - no AI generation
```

**Required Changes:**
1. Add specialist prompt:
```sql
INSERT INTO prompts (task_type, prompt_layer, content) VALUES
('avatar', 'specialist', 'Create an advanced customer avatar profile focusing on psychology and buying intent.
Output as structured JSON:
{
  "name": "[Persona name]",
  "buyingIntent": "[Intent description]",
  "emotionalDrivers": ["driver1", "driver2"],
  "trustTriggers": ["trigger1", "trigger2"],
  "shopperType": "[Type]",
  "barriers": ["barrier1"],
  "tone": "[Preferred communication tone]",
  "channelBehaviour": "[How they shop/research]"
}');
```

2. Add AI generation feature to AvatarBuilder.tsx:
   - "Generate Avatar from Brand Description" button
   - Call `runAI(userId, 'avatar', brandDescription)`
   - Populate form fields with AI response
   - Allow manual editing after generation

3. Store generated avatars for CAPTURE/Coach reuse

**Estimated Effort:** 2 hours

---

##### 2.5.4 CAPTURE Prompt (taskType: capture)

**Brief Requirement:**
> "Evaluates content using CAPTURE model. Outputs score /100, breakdown by category, and rewritten improved version. UI shows Original vs Improved columns."

**Current Implementation:**
- ❌ **DOES NOT EXIST** - No CAPTURE tool in codebase
- No files found with "CAPTURE" (only false positives like `BetaTesterCapture`)

**Required Changes:**
1. Create new page: `src/pages/CaptureAnalysis.tsx`
2. Add specialist prompt:
```sql
INSERT INTO prompts (task_type, prompt_layer, content) VALUES
('capture', 'specialist', 'Evaluate the provided content using the CAPTURE model:
- Clarity: How clear is the message?
- Authenticity: Does it sound genuine?
- Personal Relevance: Will the target audience care?
- Tone: Is it appropriate for the brand?
- Uniqueness: Does it stand out?
- Resonance: Will it stick in their mind?
- Engagement: Does it drive action?

Output as JSON:
{
  "overallScore": 85,
  "breakdown": {
    "clarity": 90,
    "authenticity": 80,
    ...
  },
  "originalContent": "[User input]",
  "improvedVersion": "[Rewritten version]",
  "feedback": {
    "clarity": "[Why this score]",
    ...
  }
}');
```

3. Build UI:
   - Textarea for content input
   - "Analyze with CAPTURE" button
   - Two-column layout: Original | Improved
   - Score display (total + breakdown)
   - Expandable feedback per category

4. Wire to `runAI(userId, 'capture', contentToAnalyze)`

**Estimated Effort:** 3-4 hours

---

##### 2.5.5 Brand Coach Prompt (taskType: coach)

**Brief Requirement:**
> "Provides practical next steps. Always suggests which tool or action to take next. UI should enable one-click access to suggested tool."

**Current Implementation:**
- ✅ Chat interface exists and works
- ⚠️ Prompt is hardcoded, not taskType routing
- ❌ No "suggested next tool" integration

**Required Changes:**
1. Move existing Brand Coach prompt to database
2. Enhance prompt to include tool suggestions:
```sql
UPDATE prompts SET content = content || '

After providing advice, always suggest the next action:
- If discussing customer understanding → "Run the Avatar 2.0 tool"
- If discussing positioning → "Create your Brand Canvas"
- If discussing content → "Use CAPTURE to analyze your copy"
- If needing fresh data → "Retake the diagnostic"

Format suggestions as JSON: {"suggestedTool": "avatar", "reason": "..."}'
WHERE task_type = 'coach';
```

3. Update BrandCoach.tsx UI:
   - Parse AI response for tool suggestions
   - Display CTA button: "Go to Avatar Builder →"
   - One-click navigation to suggested tool

**Estimated Effort:** 1-2 hours

---

##### 2.5.6 UI to Prompt Mapping

**Brief Table:**
| UI Section | Task Type | Prompt Used |
|------------|-----------|-------------|
| Diagnostic Page | diagnostic | IDEA Prompt |
| Brand Canvas Tool | brand_canvas | IDEA Prompt |
| Avatar Builder | avatar | Avatar 2.0 Prompt |
| Copy Analysis (CAPTURE) | capture | CAPTURE Prompt |
| Brand Coach Chat | coach | Brand Coach Prompt |

**Current Implementation Status:**
| UI Section | Status | Task Type Routing |
|------------|--------|-------------------|
| Diagnostic Page | ✅ Exists (FreeDiagnostic.tsx) | ❌ Not using taskType |
| Brand Canvas Tool | ⚠️ Manual form only | ❌ Not implemented |
| Avatar Builder | ⚠️ Manual form only | ❌ Not implemented |
| CAPTURE | ❌ Does not exist | ❌ Not implemented |
| Brand Coach Chat | ✅ Functional | ❌ Not using taskType |

**Required Changes:**
1. Implement `runAI()` router with taskType parameter
2. Update all frontend components to call router:
```typescript
// Example for Diagnostic
const result = await supabase.functions.invoke('idea-gpt-router', {
  body: {
    userId: user.id,
    taskType: 'diagnostic',
    userInput: diagnosticAnswersText,
    contextData: scores
  }
});
```

3. Ensure consistent error handling across all UIs

**Estimated Effort:** Included in router implementation (4-5 hours)

---

### 3. ARCHITECTURE SUMMARY

**Brief Requirements:**
| Layer | Function | Platform | Complexity | Status |
|-------|----------|----------|------------|--------|
| Frontend | Diagnostic, chat, uploads, course pages | Lovable.dev | Low | ⚠️ Partial |
| Backend | Auth, data, prompt routing | Supabase | Low | ⚠️ Partial |
| AI Layer | OpenAI IDEA GPT | OpenAI API | Low | ❌ Wrong architecture |
| Storage | Files and PDFs | Supabase Storage | Low | ❌ Not implemented |
| Payments | Stripe paywall | Stripe | Low | ❌ Not implemented |
| Embeddings | Document recall | Lovable KB or Convex | Very Low | ✅ Complete (pgvector) |

**Current Architecture:**
- ✅ Frontend in Lovable.dev
- ✅ Backend in Supabase (auth, data)
- ❌ AI Layer: Multiple Edge Functions instead of single router
- ❌ Storage: No PDF generation or Supabase Storage usage
- ❌ Payments: Not implemented
- ✅ Embeddings: pgvector implemented with RAG

**Deviation Score:** 50% aligned

---

## Gap Analysis by Component

### Summary Table

| Component | Brief Required | Current Status | Rework Needed | Effort |
|-----------|----------------|----------------|---------------|--------|
| **1. Diagnostic Tool** | PDF generation, email capture | Functional flow, no PDF | Medium | 3-4h |
| **2. Brand Coach** | DB prompts, tool suggestions | Hardcoded, no suggestions | Low | 2-3h |
| **3. Prompt Router** | Single endpoint, DB prompts | Multiple functions | High | 4-5h |
| **4. Paywall** | Stripe, usage limits | Not implemented | High | 6-8h |
| **5. Training Access** | Pro user video embeds | Not implemented | Medium | 2-3h |
| **6. Shared Core Prompt** | Every call uses core + specialist | No concept | Medium | Included |
| **7. IDEA Prompt** | AI canvas generation | Manual form | Medium | 2-3h |
| **8. Avatar 2.0** | AI avatar generation | Manual form | Medium | 2h |
| **9. CAPTURE** | Full analysis tool | Does not exist | High | 3-4h |
| **10. Tool Integration** | One-click from Coach | No integration | Low | 1-2h |
| **11. Admin Prompt Edit** | Admin UI for prompts | Not implemented | Low (defer to P1) | - |
| **12. Logging** | taskType, timestamp, tokens | No logging | Low | 1h |

**Total Rework Effort:** 26-37 hours

---

## Architecture Comparison

### Brief Architecture (Required)

```
┌─────────────────────────────────────────────────────────┐
│                      User (Web Browser)                  │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────┐
│              Lovable.dev Frontend                         │
│  - FreeDiagnostic → Email Capture → PDF Download         │
│  - BrandCoach Chat → Tool Suggestions                    │
│  - Avatar Builder → AI Generation                        │
│  - CAPTURE → Content Analysis                            │
│  - Brand Canvas → AI Canvas Generation                   │
│  - Training → Vimeo Embeds (Pro only)                    │
└───────────────┬───────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────┐
│              Supabase Backend                             │
│  1. Auth (email/password)                                 │
│  2. Database:                                             │
│     - profiles (with subscription_tier)                   │
│     - prompts (core + specialist)                         │
│     - ai_logs                                             │
│     - usage_limits                                        │
│     - diagnostic_submissions                              │
│     - chat_messages                                       │
│     - user_knowledge_chunks (embeddings)                  │
│  3. Storage (PDFs)                                        │
│  4. Edge Functions:                                       │
│     - idea-gpt-router (SINGLE ENDPOINT)                   │
│     - stripe-webhook                                      │
└───────────────┬───────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────┐
│         idea-gpt-router Function Logic                    │
│                                                           │
│  runAI(userId, taskType, userInput, contextData) {       │
│    1. Fetch prompts from DB:                             │
│       - Shared Core Prompt                               │
│       - Specialist Prompt (based on taskType)            │
│    2. Retrieve RAG context (if applicable)               │
│    3. Build composite system prompt                      │
│    4. Call OpenAI API                                    │
│    5. Log usage (ai_logs table)                          │
│    6. Check usage limits (usage_limits table)            │
│    7. Return structured response                         │
│  }                                                        │
└───────────────┬───────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────┐
│              OpenAI API (GPT-4)                           │
│  - Single model for all tasks                            │
│  - Differentiated by system prompts                      │
└───────────────────────────────────────────────────────────┘

                AND

┌───────────────────────────────────────────────────────────┐
│              Stripe API                                   │
│  - Checkout sessions                                      │
│  - Subscription management                                │
│  - Webhooks → Update user tier                           │
└───────────────────────────────────────────────────────────┘
```

---

### Current Architecture (Implemented)

```
┌─────────────────────────────────────────────────────────┐
│                      User (Web Browser)                  │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────┐
│              Lovable.dev Frontend                         │
│  - FreeDiagnostic → ✅ Functional                        │
│  - BrandCoach Chat → ✅ Functional                       │
│  - Avatar Builder → ⚠️  Manual form only                 │
│  - CAPTURE → ❌ Does not exist                           │
│  - Brand Canvas → ⚠️  Manual form only                   │
│  - Training → ❌ Does not exist                          │
└───────────────┬───────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────┐
│              Supabase Backend                             │
│  1. Auth ✅ Working                                       │
│  2. Database:                                             │
│     - profiles ✅ (missing subscription fields)           │
│     - prompts ❌ Table does not exist                    │
│     - ai_logs ❌ Table does not exist                    │
│     - usage_limits ❌ Table does not exist               │
│     - diagnostic_submissions ✅ Complete                  │
│     - chat_messages ✅ Complete                           │
│     - user_knowledge_chunks ✅ Complete                   │
│  3. Storage ❌ Not used                                   │
│  4. Edge Functions (FRAGMENTED):                          │
│     - brand-coach-gpt ✅ RAG chat                         │
│     - sync-diagnostic-to-embeddings ✅ Working            │
│     - idea-framework-consultant (old)                     │
│     - ai-insight-guidance                                 │
│     - brand-ai-assistant                                  │
│     - buyer-intent-analyzer                               │
│     - contextual-help                                     │
│     - document-processor ⚠️ UI exists, not wired          │
└───────────────┬───────────────────────────────────────────┘
                │
                ▼ (Multiple calls, no routing)
┌───────────────────────────────────────────────────────────┐
│              OpenAI API                                   │
│  - Called directly from each Edge Function                │
│  - No unified prompt strategy                             │
│  - No logging or usage tracking                           │
└───────────────────────────────────────────────────────────┘

                ❌ NO STRIPE INTEGRATION
```

---

## Implementation Roadmap

### Phase 1: Core Router & Prompts (Critical - 6-8 hours)

**Objective:** Implement single GPT endpoint with database-driven prompts

**Tasks:**
1. **Create Database Schema** (1 hour)
   - `prompts` table with RLS policies
   - `ai_logs` table for tracking
   - `usage_limits` table for paywall
   - Add subscription fields to `profiles`

2. **Seed Prompts** (1 hour)
   - Shared Core Prompt (from brief)
   - IDEA Prompt (diagnostic + brand_canvas)
   - Avatar 2.0 Prompt
   - CAPTURE Prompt
   - Brand Coach Prompt

3. **Build Router Edge Function** (3-4 hours)
   - `supabase/functions/idea-gpt-router/index.ts`
   - Implement `runAI()` function
   - Add RAG context injection for applicable taskTypes
   - Add logging to `ai_logs`
   - Add usage limit checks

4. **Migrate Existing Calls** (1-2 hours)
   - Update `FreeDiagnostic.tsx` → `taskType: 'diagnostic'`
   - Update `BrandCoach.tsx` → `taskType: 'coach'`
   - Test end-to-end

**Deliverable:** Single AI endpoint operational with diagnostic and coach working

---

### Phase 2: Missing Features (High Priority - 8-10 hours)

**Objective:** Build CAPTURE, PDF generation, and enhance existing tools

**Tasks:**
1. **CAPTURE Tool** (3-4 hours)
   - Create `src/pages/CaptureAnalysis.tsx`
   - Implement two-column UI (Original | Improved)
   - Wire to router with `taskType: 'capture'`
   - Add score visualization

2. **PDF Generation** (3-4 hours)
   - Install PDF library (recommend `react-pdf` or Puppeteer Edge Function)
   - Create Brand Snapshot PDF template
   - Add "Download PDF" button to DiagnosticResults
   - Store PDFs in Supabase Storage
   - Add email PDF option

3. **AI Generation for Canvas/Avatar** (2-3 hours)
   - Add "Generate with AI" to BrandCanvas.tsx → `taskType: 'brand_canvas'`
   - Add "Generate Avatar" to AvatarBuilder.tsx → `taskType: 'avatar'`
   - Parse JSON responses into form fields

**Deliverable:** All IDEA tools functional with AI generation

---

### Phase 3: Monetization (Critical - 6-8 hours)

**Objective:** Stripe paywall and training content access

**Tasks:**
1. **Stripe Setup** (2 hours)
   - Create Stripe account and products
   - Install Stripe packages
   - Create checkout Edge Function
   - Create webhook Edge Function
   - Add subscription status to profiles

2. **Usage Limits** (2 hours)
   - Implement middleware to check `usage_limits`
   - Block diagnostic after 1 for free users
   - Block chat after 3 messages for free users
   - Show upgrade prompt when limit hit

3. **Training Content** (2-3 hours)
   - Create `training_modules` table
   - Create `src/pages/Training.tsx`
   - Embed Vimeo/Loom videos
   - Add RLS: Pro users only
   - Link from dashboard/nav

4. **Upgrade Flow** (1 hour)
   - Add "Upgrade to Pro" CTA in UI
   - Create checkout flow
   - Handle success/cancel redirects

**Deliverable:** Full monetization flow working

---

### Phase 4: Polish & Integration (Low Priority - 4-6 hours)

**Objective:** Tool suggestions, admin features, logging dashboard

**Tasks:**
1. **Tool Suggestions** (1-2 hours)
   - Enhance Brand Coach to suggest next tools
   - Add one-click navigation buttons
   - Test cross-tool workflows

2. **Replace BetaTesterCapture** (1 hour)
   - Create modern `AuthModal.tsx`
   - Replace legacy capture modal

3. **Admin Panel** (2-3 hours) - DEFER to P1
   - Create `/admin/prompts` page
   - Allow editing prompts in database
   - Add preview before saving

4. **Logging Dashboard** (1 hour) - DEFER to P1
   - Create `/admin/logs` page
   - Show ai_logs with filters
   - Display token usage stats

**Deliverable:** Polished, production-ready MVP

---

## Risk Assessment

### High-Risk Items

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Architectural rework breaks existing features** | High | Medium | Implement router alongside existing functions, migrate incrementally, keep old functions as backup |
| **Stripe integration delays launch** | High | Low | Simple implementation first, defer complex features (usage limits exact to messages vs. characters) |
| **PDF generation performance issues** | Medium | Medium | Use server-side rendering (Puppeteer in Edge Function) not client-side jsPDF |
| **Prompt quality issues after migration** | Medium | Low | Test extensively, keep old prompts as fallback, A/B test responses |
| **Trevor expectations misalignment** | High | High | **CRITICAL: Discuss this analysis before proceeding** |

### Medium-Risk Items

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Database migration issues | Medium | Low | Use `IF NOT EXISTS` clauses, test migrations on dev first |
| CAPTURE UI/UX complexity | Low | Medium | Start simple (basic two-column), iterate based on feedback |
| Training content embedding issues | Low | Low | Use Vimeo's standard embed code, test on multiple devices |

---

## Questions for Trevor

**CRITICAL - Must answer before proceeding:**

1. **Scope Confirmation:**
   - Do you want Avatar Builder, Brand Canvas, and CAPTURE to be **AI-generated tools** (per brief) or **manual form tools** (as currently implemented)?
   - Should we remove/deprecate the existing manual versions?

2. **Prioritization:**
   - What is more important for MVP launch:
     a) Stripe paywall + training content (monetization) → 6-8 hours
     b) CAPTURE tool + PDF generation (feature completeness) → 6-8 hours
     c) Both (recommended, 12-16 hours total)

3. **Architecture:**
   - Are you committed to the single `idea-gpt-router` endpoint architecture from the brief?
   - Or can we keep multiple Edge Functions if they're simpler to maintain?

4. **PDF Requirements:**
   - What should the Brand Snapshot PDF look like? (need template/mockup)
   - Should it be auto-emailed or just downloadable?
   - Any IDEA branding assets (logo, colors) to include?

5. **Training Content:**
   - Do you have Vimeo/Loom links ready for training modules?
   - How many videos should be in initial MVP?
   - What are module titles/descriptions?

6. **Stripe Pricing:**
   - What should Pro tier cost per month?
   - Any other tiers (e.g., Team, Enterprise)?
   - Annual discount?

7. **Timeline:**
   - When do you need this MVP live?
   - Is there flexibility if we find more issues during implementation?

8. **Existing Features:**
   - The current app has many P1-looking features (ValueLens, multiple IDEA pages). Should these be removed or hidden for MVP focus?

---

## Recommendations

### Option A: Full Brief Compliance (Recommended for Long-Term)

**Approach:** Implement everything in the brief exactly as specified

**Pros:**
- Matches Trevor's vision completely
- Clean architecture for future scaling
- Single codebase aligned with documentation

**Cons:**
- 26-37 hours of work (over budget?)
- Requires removing/refactoring significant existing code
- Higher risk of breaking current functionality

**Timeline:** 3-4 full days of focused development

---

### Option B: Hybrid MVP (Recommended for Fast Launch)

**Approach:** Keep what works, add critical missing pieces

**Keep:**
- ✅ Diagnostic flow (add PDF generation only)
- ✅ Brand Coach chat (migrate prompt to database)
- ✅ RAG system with embeddings

**Add (Critical):**
- ❌ Stripe paywall (6-8 hours)
- ❌ Training content pages (2-3 hours)
- ❌ PDF generation (3-4 hours)
- ❌ CAPTURE tool (3-4 hours)

**Defer to V2:**
- Router architecture (use multiple functions for now)
- AI generation for Canvas/Avatar (keep manual forms)
- Admin prompt editing UI
- Advanced logging dashboard

**Effort:** 14-19 hours (MVP launch viable)

**Timeline:** 2 days of focused development

---

### Option C: Minimal MVP (Budget-Conscious)

**Approach:** Launch with existing features + Stripe only

**Keep Everything As-Is:**
- Diagnostic flow (no PDF)
- Brand Coach chat
- Manual Avatar Builder
- Manual Brand Canvas

**Add Only:**
- ❌ Stripe paywall (6-8 hours)
- ❌ Basic training page (1-2 hours)

**Effort:** 7-10 hours

**Pros:**
- Fastest path to revenue
- Low risk
- Can validate demand before investing more

**Cons:**
- Significantly deviates from brief
- Missing CAPTURE tool
- No PDF lead magnet

---

## Final Summary

### Current Alignment with Brief: 40%

**What's Good:**
- ✅ Diagnostic flow functional
- ✅ Brand Coach with RAG system working
- ✅ Database schema mostly correct
- ✅ Auth system working

**What's Missing:**
- ❌ Single router architecture (core requirement)
- ❌ Database-driven prompts
- ❌ Stripe paywall (monetization)
- ❌ Training content access
- ❌ CAPTURE tool
- ❌ PDF generation
- ❌ AI generation for Canvas/Avatar

### Recommended Path Forward

**Step 1:** Discuss with Trevor
- Share this analysis document
- Clarify priorities (monetization vs. features)
- Set realistic timeline expectations
- Choose Option A, B, or C

**Step 2:** Create Updated P0 Plan
- Based on chosen option
- Break down into daily tasks
- Set launch date

**Step 3:** Execute Implementation
- Start with highest-value items (likely Stripe)
- Test thoroughly as we go
- Keep Trevor updated on progress

**Step 4:** Beta Launch
- Deploy with explicit "beta" label
- Gather user feedback
- Iterate based on actual usage

---

**Document Author:** Matthew Kerns
**Next Action:** Send to Trevor for review and decision on approach
**Estimated Response Time:** Allow 24-48 hours for Trevor's input

---

## Appendix: Migration Commands

### Database Migration for Router Architecture

```sql
-- File: supabase/migrations/YYYYMMDD_prompt_router.sql

-- Prompts table
CREATE TABLE IF NOT EXISTS public.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  prompt_layer TEXT NOT NULL CHECK (prompt_layer IN ('core', 'specialist')),
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_prompts_task_layer ON public.prompts(task_type, prompt_layer) WHERE is_active = true;

-- RLS policies
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active prompts" ON public.prompts
  FOR SELECT USING (is_active = true);

CREATE POLICY "Only service role can modify prompts" ON public.prompts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- AI logs table
CREATE TABLE IF NOT EXISTS public.ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  task_type TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  model TEXT DEFAULT 'gpt-4',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_logs_user_task ON public.ai_logs(user_id, task_type, created_at DESC);

-- Usage limits table
CREATE TABLE IF NOT EXISTS public.usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  diagnostics_count INTEGER DEFAULT 0,
  chat_messages_count INTEGER DEFAULT 0,
  period_start TIMESTAMPTZ DEFAULT now(),
  period_end TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add subscription fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
ADD COLUMN IF NOT EXISTS subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX idx_profiles_subscription ON public.profiles(subscription_tier, subscription_status);

-- Seed initial prompts
INSERT INTO public.prompts (task_type, prompt_layer, content) VALUES
('shared', 'core', 'You are an expert in the IDEA Framework (Insight, Distinctive, Empathetic, Authentic). Your communication style is warm, supportive, and encouraging. You sound like Trevor Bradford and use behavioural language focused on customer psychology. Always ground your advice in IDEA principles.'),

('diagnostic', 'specialist', 'Analyze the user''s brand diagnostic responses through the IDEA lens. Provide a structured four-part analysis: Insight (customer understanding), Distinctive (unique positioning), Empathetic (emotional connection), Authentic (brand consistency). Include a Key Takeaway with actionable next steps.'),

('brand_canvas', 'specialist', 'Generate a comprehensive Brand Canvas using the IDEA framework. Structure your response as JSON with these fields: insight, distinctive, empathetic, authentic, keyTakeaway. Each should be a concise, actionable statement based on user input.'),

('avatar', 'specialist', 'Create a detailed customer avatar focused on psychology and buying intent. Return JSON with: name, buyingIntent, emotionalDrivers (array), trustTriggers (array), shopperType, barriers (array), tone, channelBehaviour.'),

('capture', 'specialist', 'Evaluate the provided content using the CAPTURE model (Clarity, Authenticity, Personal Relevance, Tone, Uniqueness, Resonance, Engagement). Return JSON with: overallScore (0-100), breakdown (object with each CAPTURE score), feedback (object with explanations), originalContent, improvedVersion.'),

('coach', 'specialist', 'You are a conversational brand coach. Analyze the user''s question, retrieve their diagnostic context, and provide practical next steps. Always suggest which tool to use next (avatar, brand_canvas, capture, or retake diagnostic). Format suggestions as: {"suggestedTool": "avatar", "reason": "..."}');
```

### Frontend Migration Example

```typescript
// Before: Direct function call
const { data } = await supabase.functions.invoke('brand-coach-gpt', {
  body: { message: userMessage }
});

// After: Router with taskType
const { data } = await supabase.functions.invoke('idea-gpt-router', {
  body: {
    userId: user.id,
    taskType: 'coach',
    userInput: userMessage,
    contextData: {} // Optional
  }
});
```

---

**END OF COMPREHENSIVE ANALYSIS**

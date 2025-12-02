# P0 Features - Beta Launch Requirements
## IDEA Brand Coach Platform

**Version:** 1.1
**Last Updated:** 2025-11-28
**Status:** Active Development (~85-90% Complete)

---

## Overview

This document defines the **three core features** required for P0 beta launch:
1. Brand Diagnostic with Supabase Integration
2. Sign Up / Sign In Flow
3. Brand Coach GPT with LangChain RAG

All other features are scoped as **P1 (post-launch)** - see [P1_FEATURES.md](./P1_FEATURES.md).

---

## Feature 1: Brand Diagnostic with Supabase Integration

### Current State (Existing Implementation)
- ✅ **FreeDiagnostic UI** - Complete 6-question assessment (`src/pages/FreeDiagnostic.tsx`)
- ✅ **BetaTesterCapture** - Email collection modal (`src/components/BetaTesterCapture.tsx`)
- ✅ **Score Calculation** - IDEA framework scoring logic
- ⚠️ **localStorage Only** - No Supabase persistence yet
- ⚠️ **Beta Testers Table** - Exists but not fully integrated

### P0 Requirements

#### User Journey
```
1. Visit /diagnostic (no auth required)
2. Complete 6-question IDEA framework assessment
3. See summary scores on completion
4. Prompted to create account to receive full results
5. Account creation/login
6. Diagnostic data automatically saved to profile
7. Redirect to /diagnostic/results with personalized insights
```

#### Database Schema Required
```sql
-- Add diagnostic fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  latest_diagnostic_data JSONB,
  latest_diagnostic_score INTEGER,
  diagnostic_completed_at TIMESTAMP WITH TIME ZONE;

-- Historical diagnostic submissions
CREATE TABLE diagnostic_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  category_scores JSONB NOT NULL,
  overall_score INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Policies
CREATE POLICY "Users can view own submissions"
ON diagnostic_submissions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own submissions"
ON diagnostic_submissions FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

#### Technical Implementation
- **Pre-Auth**: Store diagnostic in localStorage temporarily
- **Post-Auth**:
  - Call `SupabaseDiagnosticService.syncFromLocalStorage()`
  - Saves to `profiles.latest_diagnostic_data`
  - Inserts into `diagnostic_submissions` for history
  - Triggers `sync-diagnostic-to-embeddings` Edge Function
  - Clears localStorage

#### UI Components to Modify
| Component | Current State | Changes Needed |
|-----------|---------------|----------------|
| `FreeDiagnostic.tsx` | Saves to localStorage | Add call to `useDiagnostic().syncFromLocalStorage()` after auth |
| `BetaTesterCapture.tsx` | Saves email to beta_testers | Replace with account creation flow |
| `DiagnosticResults.tsx` | Reads from localStorage | Read from `useDiagnostic().latestDiagnostic` |

---

## Feature 2: Sign Up / Sign In Flow

### Current State (Existing Implementation)
- ✅ **Auth Page** - UI exists (`src/pages/Auth.tsx`)
- ✅ **Supabase Auth** - Configured and working
- ✅ **ProtectedRoute** - Route guarding functional (`src/components/ProtectedRoute.tsx`)
- ✅ **AuthProvider** - Context provider (`src/hooks/useAuth.tsx`)
- ⚠️ **Not Integrated** - Diagnostic flow doesn't trigger auth

### P0 Requirements

#### Sign Up Flow
```
User Journey:
1. User completes diagnostic
2. Modal: "Create Account to See Full Results"
3. Sign up options:
   - Email + password
   - Google OAuth (optional for P0)
4. Email verification (optional for beta - skip for less friction)
5. Profile auto-created via database trigger
6. Diagnostic data synced from localStorage
7. Redirect to /diagnostic/results
```

#### Sign In Flow
```
User Journey:
1. Returning user visits /auth
2. Sign in with credentials or OAuth
3. Redirect to intended destination (or /dashboard)
4. Access all saved diagnostic data
```

#### Database Schema (Existing - Enhance)
```sql
-- Profiles table (already exists, may need enhancements)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  company TEXT,
  industry TEXT,
  avatar_url TEXT,
  latest_diagnostic_data JSONB,
  latest_diagnostic_score INTEGER,
  diagnostic_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Auto-create profile trigger (may already exist)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### Technical Implementation

**Service Layer Integration:**
```typescript
// Use IAuthService for all auth operations
import { useAuth } from '@/hooks/useAuth';

const { signUp, signIn, signInWithOAuth } = useAuth();

// Sign up
await signUp(email, password);

// Google OAuth (optional)
await signInWithOAuth('google');
```

**Post-Diagnostic Auth Modal:**
- Replace `BetaTesterCapture` with `AuthModal` component
- Show auth options after diagnostic completion
- On successful auth:
  1. Retrieve diagnostic from localStorage
  2. Call `useDiagnostic().syncFromLocalStorage()`
  3. Navigate to `/diagnostic/results`

#### UI Components to Build/Modify
| Component | Action | Priority |
|-----------|--------|----------|
| `Auth.tsx` | Enhance UX, add Google OAuth button | P0 |
| `AuthModal.tsx` | **NEW** - Reusable auth modal for post-diagnostic | P0 |
| `BetaTesterCapture.tsx` | Replace with AuthModal trigger | P0 |
| `ProtectedRoute.tsx` | Add redirect URL preservation | P0 (nice-to-have) |

---

## Feature 3: Brand Coach GPT with LangChain RAG

### Current State (phase-2-mvp-beta Implementation)

**✅ FULLY IMPLEMENTED:**

**Database Layer:**
- ✅ `chat_messages` table with RLS policies
- ✅ `chat_sessions` table with session management
- ✅ `user_knowledge_base` table with pgvector (1536 dimensions)
- ✅ Vector similarity search function (`match_user_knowledge`)
- ✅ Automated updated_at triggers

**Service Layer:**
- ✅ `IChatService` interface with full session support
- ✅ `SupabaseChatService` implementation with:
  - Message persistence
  - Session management (create, list, rename, delete)
  - Session-based message retrieval
  - Auto-title generation for new sessions
- ✅ Uses service layer pattern (no direct Supabase calls in UI)

**Edge Functions:**
- ✅ `brand-coach-gpt` - RAG-enabled GPT-4 consultant with:
  - Vector similarity search for user context
  - Diagnostic data retrieval
  - Embedding generation (text-embedding-ada-002)
  - Sources returned with responses
- ✅ `idea-framework-consultant` - IDEA Framework specialist
- ✅ `generate-session-title` - AI-powered session titles
- ✅ `sync-diagnostic-to-user-kb` - Sync diagnostic → vector embeddings

**UI Components:**
- ✅ `IdeaFrameworkConsultant.tsx` with full chat interface
- ✅ `ChatSidebar` component for session management:
  - List all sessions
  - Create new sessions
  - Rename sessions (inline editing)
  - Delete sessions
  - Switch between sessions
- ✅ Message persistence across sessions
- ✅ Copy/Download conversation buttons
- ✅ Responsive layout with collapsible sidebar
- ✅ Document upload integration (via `DocumentUpload`)
- ✅ Routed at `/idea/consultant` (behind ProtectedRoute)

**React Hooks:**
- ✅ `useChat` - Message operations with React Query caching
- ✅ `useChatSessions` - Session management with auto-create
- ✅ `useDiagnostic` - Diagnostic data access

**⚠️ REMAINING WORK:**
- ⚠️ Suggested prompts based on diagnostic scores (UI wiring)
- ⚠️ "Sources" section in UI showing which diagnostic data was used
- ⚠️ Polish and testing

### Migration Strategy

**Approach: Upgrade in Place (Not Rebuild)**

1. **Keep:**
   - `IdeaFrameworkConsultant.tsx` UI (rename to `BrandCoach.tsx`)
   - Route at `/idea/consultant` (add alias `/brand-coach`)
   - GPT-4 integration and IDEA framework system prompt
   - Document upload functionality
   - Follow-up suggestions feature
   - UI/UX (styling, layout, animations)

2. **Upgrade:**
   - Add LangChain to Edge Function
   - Implement RAG with vector search
   - Auto-retrieve diagnostic data
   - Save chat to `chat_messages` table
   - Refactor UI to use `useChat()` hook

3. **Timeline:** 2-3 day refactor (not weeks)

### P0 Requirements

#### LangChain Integration

**Dependencies (Deno ESM Imports):**
```typescript
import { ChatOpenAI } from "https://esm.sh/langchain@0.1.0/chat_models/openai";
import { OpenAIEmbeddings } from "https://esm.sh/langchain@0.1.0/embeddings/openai";
import { SupabaseVectorStore } from "https://esm.sh/langchain@0.1.0/vectorstores/supabase";
import { ConversationalRetrievalQAChain } from "https://esm.sh/langchain@0.1.0/chains";
import { BufferMemory } from "https://esm.sh/langchain@0.1.0/memory";
import { RecursiveCharacterTextSplitter } from "https://esm.sh/langchain@0.1.0/text_splitter";
import { PromptTemplate } from "https://esm.sh/langchain@0.1.0/prompts";
```

**RAG Pattern:**
- **Simple RAG with Conversational Memory**
- LangChain's `ConversationalRetrievalQAChain` handles:
  - Query reformulation based on chat history
  - Vector retrieval (filtered by user_id)
  - Prompt construction with context
  - Response generation
  - Memory management

#### Database Schema Required

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- User knowledge base chunks
CREATE TABLE user_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 dimension
  metadata JSONB,
  source TEXT, -- 'diagnostic', 'profile', 'document'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Vector similarity search function (required by LangChain)
CREATE OR REPLACE FUNCTION match_user_documents(
  query_embedding vector(1536),
  match_user_id UUID,
  match_count INT DEFAULT 5,
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
  WHERE user_knowledge_chunks.user_id = match_user_id
    AND (filter = '{}'::jsonb OR user_knowledge_chunks.metadata @> filter)
  ORDER BY user_knowledge_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Indexes for fast vector search
CREATE INDEX ON user_knowledge_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_user_knowledge_user_id ON user_knowledge_chunks(user_id);

-- Chat history table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_chat_messages_user_created ON chat_messages(user_id, created_at DESC);
```

#### User Context Embedded

**What Gets Converted to Embeddings:**

1. **Diagnostic Data** (Priority 1)
   - Question responses
   - Category scores with interpretations
   - Overall brand strength
   - Example:
     ```
     BRAND DIAGNOSTIC RESULTS FOR Acme Corp

     Industry: B2B SaaS

     IDEA Framework Scores:
     - Insight Score: 60/100 - Basic customer knowledge but lacks depth
     - Distinctive Score: 40/100 - Brand blends in with competitors
     - Empathetic Score: 75/100 - Good emotional connection
     - Authentic Score: 55/100 - Shows some personality
     ```

2. **Profile Information** (Priority 2)
   - Company name
   - Industry
   - Business description (if added in P1)

#### Edge Functions

**Function 1: `sync-diagnostic-to-embeddings`**

Triggered after diagnostic completion to create vector embeddings:

```typescript
// Flow:
1. Fetch user's diagnostic data from profiles table
2. Format as structured context document
3. Use RecursiveCharacterTextSplitter (chunk_size: 500, overlap: 50)
4. Generate embeddings with OpenAI (text-embedding-ada-002)
5. Store chunks in user_knowledge_chunks table
6. Return success
```

**Function 2: `brand-coach-gpt` (Upgraded from `idea-framework-consultant`)**

Migration approach:
1. Copy existing function to `brand-coach-gpt`
2. Preserve IDEA framework system prompt
3. Add LangChain imports
4. Initialize RAG components
5. Replace raw OpenAI call with ConversationalRetrievalQAChain
6. Save messages to chat_messages table
7. Keep old function temporarily for rollback

#### UI Component Refactoring

**Refactor `IdeaFrameworkConsultant.tsx` → `BrandCoach.tsx`:**

```typescript
// BEFORE (existing code):
const { data, error } = await supabase.functions.invoke('idea-framework-consultant', {
  body: { message, context }
});

// AFTER (refactored):
import { useChat } from '@/hooks/useChat';
import { useDiagnostic } from '@/hooks/useDiagnostic';

const { messages, sendMessage, isLoading } = useChat();
const { latestDiagnostic } = useDiagnostic();

// Auto-generate suggested prompts
const suggestedPrompts = generateSuggestedPrompts(latestDiagnostic);

// Send message via service layer
await sendMessage(userMessage);
```

**Preserve Existing Features:**
- Document upload integration
- Follow-up suggestions
- Conversation display format
- UI styling and animations

**Add New Features:**
- Suggested prompts based on diagnostic scores
- "Sources" section showing which diagnostic data was used (from RAG)
- Chat history persisted to database

---

## Success Criteria

### Feature 1: Diagnostic
- [ ] Users can complete 6-question assessment without auth
- [ ] Diagnostic saves to Supabase after account creation
- [ ] Historical diagnostics viewable in dashboard
- [ ] Data syncs from localStorage successfully
- [ ] No data loss during auth flow

### Feature 2: Auth
- [ ] Sign up with email/password works
- [ ] Google OAuth works (optional)
- [ ] Profile auto-created on signup
- [ ] Protected routes enforce authentication
- [ ] Session persists across page refreshes

### Feature 3: Brand Coach GPT
- [x] RAG retrieves user's diagnostic data correctly
- [x] Chat responses reference diagnostic scores
- [x] Chat history persists to database
- [x] Conversation continuity across sessions
- [x] Session management (create, list, rename, delete)
- [x] AI-powered session title generation
- [x] Copy/Download conversation buttons
- [ ] Suggested prompts based on low scores (UI pending)
- [ ] Sources display in UI (data available, UI pending)
- [ ] API response time < 5 seconds (p95) - needs testing

---

## Out of Scope (P1 Features)

These features exist in the codebase but are **deferred to P1**:

- Full IDEA Framework modules (/idea/insight, /idea/distinctive, etc.)
- Avatar Builder
- Brand Canvas
- Value Lens
- Research & Learning hub
- Advanced dashboard analytics
- Document upload RAG integration (schema exists, defer implementation)
- Team collaboration
- PDF/PowerPoint exports

See [P1_FEATURES.md](./P1_FEATURES.md) for complete P1 scope.

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-07 | 1.0 | Extracted from P0_BETA_LAUNCH_ROADMAP.md v1.3 |
| 2025-11-28 | 1.1 | **Major implementation update** - Updated Feature 3 (Brand Coach GPT) to reflect actual implementation:<br>- Documented fully implemented database layer (chat_messages, chat_sessions, user_knowledge_base)<br>- Documented service layer with IChatService and SupabaseChatService<br>- Documented Edge Functions (brand-coach-gpt with RAG, generate-session-title, etc.)<br>- Documented UI components (ChatSidebar, Copy/Download buttons, session management)<br>- Updated success criteria checkboxes to reflect completed items<br>- Status updated to "Active Development (~85-90% Complete)" |

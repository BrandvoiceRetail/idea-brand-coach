# Technical Architecture
## IDEA Brand Coach Platform - P0 Beta

**Version:** 1.0
**Last Updated:** 2025-11-07
**Status:** Planning Phase

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Data Access Layer](#data-access-layer)
3. [RAG Implementation](#rag-implementation)
4. [Database Schema](#database-schema)
5. [Security & Privacy](#security--privacy)
6. [Data Flow](#data-flow)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend (React + Vite)                         │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────────┐             │
│  │  FreeDiagnostic │  │  Auth Pages  │  │  Brand Coach  │             │
│  │   (anonymous)   │  │  (sign up/in)│  │     (chat)    │             │
│  └────────┬────────┘  └──────┬───────┘  └───────┬───────┘             │
│           │                   │                   │                      │
│           └───────────────────┼───────────────────┘                      │
│                               │                                          │
│                               ▼                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │              Data Access Layer (TypeScript)                     │    │
│  │  ┌──────────────────────────────────────────────────────────┐  │    │
│  │  │  Interfaces (contracts)                                   │  │    │
│  │  │  • IDiagnosticService                                     │  │    │
│  │  │  • IUserProfileService                                    │  │    │
│  │  │  • IChatService                                           │  │    │
│  │  │  • IAuthService                                           │  │    │
│  │  └──────────────────────────────────────────────────────────┘  │    │
│  │  ┌──────────────────────────────────────────────────────────┐  │    │
│  │  │  Implementations (Supabase-specific)                      │  │    │
│  │  │  • SupabaseDiagnosticService                             │  │    │
│  │  │  • SupabaseUserProfileService                            │  │    │
│  │  │  • SupabaseChatService                                   │  │    │
│  │  │  • SupabaseAuthService                                   │  │    │
│  │  └──────────────────────────────────────────────────────────┘  │    │
│  │  ┌──────────────────────────────────────────────────────────┐  │    │
│  │  │  React Hooks (UI integration)                             │  │    │
│  │  │  • useDiagnostic()                                        │  │    │
│  │  │  • useProfile()                                           │  │    │
│  │  │  • useChat()                                              │  │    │
│  │  └──────────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────┬───────────────────────────────────┘    │
│                                │                                        │
└────────────────────────────────┼────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Supabase Backend                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              PostgreSQL Database (with pgvector)                  │  │
│  │  • auth.users            • diagnostic_submissions                │  │
│  │  • profiles              • user_knowledge_chunks (vector)        │  │
│  │  • chat_messages         • beta_testers                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Edge Functions (Deno)                                │  │
│  │  • brand-coach-gpt (LangChain + RAG)                             │  │
│  │  • sync-diagnostic-to-embeddings (LangChain)                      │  │
│  │  • save-beta-tester (legacy - may deprecate)                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Storage                                               │  │
│  │  • documents bucket (P1 - schema ready, defer implementation)    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    External APIs                                        │
│  • OpenAI API (GPT-4.1 + text-embedding-ada-002)                       │
│  • (Optional) Google OAuth                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Access Layer

### Architecture Pattern: Repository Pattern

The P0 implementation uses a **Repository Pattern** with TypeScript interfaces to decouple UI components from database implementation.

#### Benefits
- **Testability**: Mock services for unit tests
- **Flexibility**: Swap Supabase for another backend without touching UI
- **Type Safety**: Full TypeScript contracts between layers
- **Maintainability**: Single source of truth for data operations
- **Error Handling**: Centralized error transformation

#### File Structure
```
src/
├── services/
│   ├── interfaces/
│   │   ├── IDiagnosticService.ts      # Contract for diagnostic operations
│   │   ├── IUserProfileService.ts     # Contract for profile operations
│   │   ├── IChatService.ts            # Contract for chat operations
│   │   └── IAuthService.ts            # Contract for auth operations
│   ├── supabase/
│   │   ├── SupabaseDiagnosticService.ts    # Supabase implementation
│   │   ├── SupabaseUserProfileService.ts   # Supabase implementation
│   │   ├── SupabaseChatService.ts          # Supabase implementation
│   │   └── SupabaseAuthService.ts          # Supabase implementation
│   └── ServiceProvider.tsx            # Dependency injection container
├── hooks/
│   ├── useDiagnostic.ts              # React hook using IDiagnosticService
│   ├── useProfile.ts                  # React hook using IUserProfileService
│   ├── useChat.ts                     # React hook using IChatService
│   └── useAuth.ts                     # React hook using IAuthService (existing)
└── types/
    ├── diagnostic.ts                  # Type definitions
    ├── profile.ts                     # Type definitions
    └── chat.ts                        # Type definitions
```

### Service Interfaces

#### IDiagnosticService
```typescript
export interface IDiagnosticService {
  saveDiagnostic(
    userId: string,
    answers: DiagnosticAnswers,
    scores: DiagnosticScores
  ): Promise<DiagnosticSubmission>;

  getLatestDiagnostic(userId: string): Promise<DiagnosticSubmission | null>;

  getDiagnosticHistory(userId: string): Promise<DiagnosticSubmission[]>;

  syncFromLocalStorage(
    userId: string,
    diagnosticData: { answers: DiagnosticAnswers; scores: DiagnosticScores }
  ): Promise<DiagnosticSubmission>;
}
```

#### IChatService
```typescript
export interface IChatService {
  sendMessage(userId: string, message: string): Promise<ChatMessage>;
  getChatHistory(userId: string, limit?: number): Promise<ChatMessage[]>;
  clearChatHistory(userId: string): Promise<void>;
}
```

#### IUserProfileService
```typescript
export interface IUserProfileService {
  getProfile(userId: string): Promise<UserProfile | null>;
  updateProfile(userId: string, updates: UserProfileUpdate): Promise<UserProfile>;
  createProfile(userId: string, initialData: Partial<UserProfile>): Promise<UserProfile>;
}
```

#### IAuthService
```typescript
export interface IAuthService {
  signUp(email: string, password: string): Promise<{ user: User; session: Session }>;
  signIn(email: string, password: string): Promise<{ user: User; session: Session }>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  signInWithOAuth(provider: 'google' | 'github'): Promise<void>;
}
```

### React Hooks Layer

React hooks provide a clean interface between UI components and services, leveraging React Query for caching and state management.

**Example: useChat Hook**
```typescript
export function useChat() {
  const { chatService } = useServices();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-history', user?.id],
    queryFn: () => chatService.getChatHistory(user!.id),
    enabled: !!user,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!user) throw new Error('User must be authenticated');
      return chatService.sendMessage(user.id, message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-history', user?.id] });
    },
  });

  return {
    messages,
    isLoading,
    sendMessage: sendMessageMutation.mutateAsync,
    isSending: sendMessageMutation.isPending,
  };
}
```

---

## RAG Implementation

### LangChain Integration

**RAG Pattern**: Simple RAG with Conversational Memory (recommended for 2025)

**LangChain Components**:
- `ConversationalRetrievalQAChain` - Orchestrates entire RAG pipeline
- `OpenAIEmbeddings` - Generate embeddings for queries and documents
- `SupabaseVectorStore` - Vector similarity search with user filtering
- `ChatOpenAI` - GPT-4 language model
- `BufferMemory` - Conversation state management
- `RecursiveCharacterTextSplitter` - Document chunking

### Dependencies (Deno ESM)
```typescript
// Supabase Edge Functions use ESM imports (no package.json)
import { ChatOpenAI } from "https://esm.sh/langchain@0.1.0/chat_models/openai";
import { OpenAIEmbeddings } from "https://esm.sh/langchain@0.1.0/embeddings/openai";
import { SupabaseVectorStore } from "https://esm.sh/langchain@0.1.0/vectorstores/supabase";
import { ConversationalRetrievalQAChain } from "https://esm.sh/langchain@0.1.0/chains";
import { BufferMemory } from "https://esm.sh/langchain@0.1.0/memory";
import { RecursiveCharacterTextSplitter } from "https://esm.sh/langchain@0.1.0/text_splitter";
import { PromptTemplate } from "https://esm.sh/langchain@0.1.0/prompts";
```

### RAG Flow

```
User Query
    ↓
1. Embed query with OpenAI (text-embedding-ada-002)
    ↓
2. Vector similarity search in user_knowledge_chunks
   - Filter by user_id (data isolation)
   - Return top 5 most relevant chunks
   - Uses cosine similarity
    ↓
3. Load recent chat history from chat_messages table
    ↓
4. ConversationalRetrievalQAChain:
   - Reformulates query based on history
   - Constructs prompt with:
     * IDEA Framework system prompt
     * Retrieved context (diagnostic data)
     * Conversation history
     * Current user query
    ↓
5. GPT-4 generates personalized response
    ↓
6. Save user + assistant messages to chat_messages
    ↓
7. Return response + source documents to UI
```

### Edge Functions

#### 1. sync-diagnostic-to-embeddings

**Purpose**: Convert diagnostic data to vector embeddings for RAG retrieval

**Trigger**: Called after user completes diagnostic and creates account

**Flow**:
```typescript
1. Authenticate user via JWT
2. Fetch diagnostic data from profiles.latest_diagnostic_data
3. Format as structured context document
4. Split into chunks (RecursiveCharacterTextSplitter):
   - chunk_size: 500 characters
   - chunk_overlap: 50 characters
5. Generate embeddings for each chunk (OpenAI ada-002)
6. Store in user_knowledge_chunks table with metadata
7. Return success + chunk count
```

**Example Context Document**:
```
BRAND DIAGNOSTIC RESULTS FOR Acme Corp

Industry: B2B SaaS

IDEA Framework Scores:
- Insight Score: 60/100 - Basic customer knowledge but lacks depth in emotional triggers
- Distinctive Score: 40/100 - Brand currently blends in with competitors, needs unique positioning
- Empathetic Score: 75/100 - Good emotional connection, customers appreciate the service
- Authentic Score: 55/100 - Shows some personality but could be more transparent

Overall Brand Strength: 58/100
```

#### 2. brand-coach-gpt

**Purpose**: RAG-powered conversational AI using user's diagnostic data

**Upgrade Strategy**: Copy `idea-framework-consultant` → enhance with LangChain

**Flow**:
```typescript
1. Authenticate user via Supabase Auth header
2. Parse request: { message, chatHistory }
3. Initialize LangChain components:
   - OpenAIEmbeddings (ada-002)
   - SupabaseVectorStore (filter: { user_id })
   - ChatOpenAI (gpt-4-turbo-preview)
   - BufferMemory (load from chatHistory parameter)
   - PromptTemplate (IDEA Framework system prompt)
4. Create ConversationalRetrievalQAChain
5. Execute chain.call({ question: message })
   → LangChain handles: embed → retrieve → augment → generate
6. Save message pair to chat_messages table
7. Return { response, sourceDocuments }
```

**Key Configuration**:
```typescript
const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: "user_knowledge_chunks",
  queryName: "match_user_documents",
  filter: { user_id: user.id }, // CRITICAL: User data isolation
});

const retriever = vectorStore.asRetriever({
  k: 5,                    // Top 5 most relevant chunks
  searchType: "similarity",
});
```

---

## Database Schema

### Profiles Table (Enhanced)
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  latest_diagnostic_data JSONB,
  latest_diagnostic_score INTEGER,
  diagnostic_completed_at TIMESTAMP WITH TIME ZONE;
```

### Diagnostic Submissions
```sql
CREATE TABLE diagnostic_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  category_scores JSONB NOT NULL,
  overall_score INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_diagnostic_user_created
ON diagnostic_submissions(user_id, created_at DESC);
```

### User Knowledge Chunks (Vector Store)
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE user_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 dimension
  metadata JSONB,
  source TEXT, -- 'diagnostic', 'profile', 'document'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- IVFFlat index for fast cosine similarity search
CREATE INDEX ON user_knowledge_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- B-tree index for user filtering
CREATE INDEX idx_user_knowledge_user_id
ON user_knowledge_chunks(user_id);
```

### Vector Search Function (Required by LangChain)
```sql
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
```

### Chat Messages
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_chat_messages_user_created
ON chat_messages(user_id, created_at DESC);
```

### Row Level Security (RLS)

All tables have RLS enabled with user-scoped policies:

```sql
-- Example: diagnostic_submissions
ALTER TABLE diagnostic_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own submissions"
ON diagnostic_submissions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own submissions"
ON diagnostic_submissions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Similar policies for:
-- - user_knowledge_chunks
-- - chat_messages
-- - profiles
```

---

## Security & Privacy

### Authentication
- **Supabase Auth** with JWT tokens
- **Row Level Security (RLS)** on all tables
- **User Data Isolation**: All queries filtered by `auth.uid()`
- **Session Management**: Persistent sessions with auto-refresh

### Data Privacy
- **Private by Default**: Each user's data is inaccessible to others
- **Encrypted in Transit**: HTTPS for all API calls
- **Encrypted at Rest**: Supabase handles database encryption
- **GDPR Compliance**: CASCADE delete on user account removal
- **No Cross-User Data Leakage**: Vector search filtered by user_id

### API Security
- **Secret Management**: OpenAI API key in Supabase secrets (not environment variables)
- **Rate Limiting**: 100 requests/min/user on Edge Functions
- **Input Validation**: Sanitization of all user inputs
- **SQL Injection Prevention**: Parameterized queries via Supabase client
- **CORS**: Configured headers for frontend-only access

### Vector Search Security

**Critical**: SupabaseVectorStore must always filter by user_id:

```typescript
const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: "user_knowledge_chunks",
  queryName: "match_user_documents",
  filter: { user_id: user.id }, // ENFORCES DATA ISOLATION
});
```

Without this filter, users could retrieve other users' diagnostic data.

---

## Data Flow

### Complete End-to-End Flow

```
1. User completes diagnostic (anonymous)
   ↓ FreeDiagnostic.tsx saves to localStorage
   ↓ { answers, scores, completedAt }

2. User prompted to create account
   ↓ BetaTesterCapture (modified) → Auth modal
   ↓ User signs up via SupabaseAuthService.signUp()

3. Account created, profile auto-generated
   ↓ Database trigger creates profile record
   ↓ Frontend receives auth.user object

4. Frontend calls sync-diagnostic-to-embeddings
   ↓ useDiagnostic().syncFromLocalStorage()
   ↓ Sends diagnostic data from localStorage

5. sync-diagnostic-to-embeddings Edge Function:
   ↓ Saves to profiles.latest_diagnostic_data
   ↓ Inserts into diagnostic_submissions table
   ↓ Formats diagnostic as context document
   ↓ Chunks with RecursiveCharacterTextSplitter
   ↓ Generates embeddings (OpenAI ada-002)
   ↓ Stores in user_knowledge_chunks with embeddings

6. User navigates to /brand-coach
   ↓ BrandCoach.tsx loads
   ↓ useChat() hook fetches chat history
   ↓ useDiagnostic() hook fetches diagnostic
   ↓ Suggested prompts displayed

7. User sends first message
   ↓ useChat().sendMessage("How can I improve my Distinctive score?")
   ↓ SupabaseChatService.sendMessage(userId, message)

8. brand-coach-gpt Edge Function (LangChain RAG):
   ↓ Authenticates user via JWT
   ↓ Fetches recent chat history from chat_messages
   ↓ Initializes LangChain components:
   ↓   - Embeddings, VectorStore, LLM, Memory
   ↓ ConversationalRetrievalQAChain.call():
   ↓   - Embeds user query
   ↓   - Performs vector similarity search
   ↓   - Retrieves top 5 diagnostic chunks
   ↓   - Reformulates query with chat history
   ↓   - Constructs augmented prompt
   ↓   - Generates GPT-4 response
   ↓ Saves user + assistant messages to chat_messages
   ↓ Returns { response, sourceDocuments }

9. Frontend receives personalized response
   ↓ useChat() hook updates React Query cache
   ↓ ChatMessage.tsx renders new message
   ↓ Optional: Display source documents (which diagnostic insights were used)
```

### Key Integration Points

- **IDiagnosticService** → Saves diagnostic → Triggers embedding sync
- **IChatService** → Sends message → Invokes RAG pipeline
- **LangChain** → Orchestrates: embed → retrieve → augment → generate
- **SupabaseVectorStore** → Ensures user data isolation via RLS + filter

---

## Performance Considerations

### Vector Search Optimization
- **IVFFlat Index**: Fast approximate nearest neighbor search
- **List Count**: 100 (balance between accuracy and speed)
- **Chunk Size**: 500 characters (balance between granularity and recall)
- **Retrieval Limit**: Top 5 chunks (prevents context overflow)

### Edge Function Optimization
- **Cold Start Mitigation**: Keep functions warm with periodic pings
- **Timeout**: 30 seconds max (RAG pipeline typically < 5s)
- **Streaming**: Optional P1 feature for real-time responses

### Frontend Optimization
- **React Query Caching**: Avoids redundant API calls
- **Lazy Loading**: All routes code-split
- **Optimistic Updates**: UI updates before server confirmation (chat messages)

---

## Technology Stack

### Frontend
- **Framework**: React 18 + Vite
- **Routing**: React Router v6
- **State Management**: React Query (TanStack Query)
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **Type Safety**: TypeScript

### Backend
- **Database**: Supabase PostgreSQL with pgvector
- **Auth**: Supabase Auth (JWT-based)
- **Edge Functions**: Deno runtime
- **Vector Search**: pgvector + IVFFlat index
- **Storage**: Supabase Storage (P1)

### AI/ML
- **LLM**: OpenAI GPT-4.1 (gpt-4.1-2025-04-14)
- **Embeddings**: OpenAI text-embedding-ada-002
- **RAG Framework**: LangChain 0.1.0
- **Vector Store**: SupabaseVectorStore (LangChain integration)

### Development
- **Version Control**: Git
- **Package Manager**: npm
- **Build Tool**: Vite
- **Linting**: ESLint

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-07 | 1.0 | Extracted from P0_BETA_LAUNCH_ROADMAP.md v1.3 |

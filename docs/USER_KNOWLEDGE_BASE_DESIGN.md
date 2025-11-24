# User Knowledge Base Design
## Hybrid Storage Architecture for IDEA Brand Coach

**Version:** 1.2
**Created:** 2025-11-22
**Updated:** 2025-11-22 (Added Local-First Architecture for enhanced performance)
**Status:** Design Phase - Ready for Implementation
**Author:** Matthew Kerns & Claude

---

## Executive Summary

This document outlines a hybrid database architecture that combines traditional relational storage with vector embeddings to support both:
1. **Exact data retrieval** - Populate form fields with user's previous entries
2. **Semantic search (RAG)** - AI consultant can access all user context

The design uses Supabase's pgvector extension alongside regular PostgreSQL columns, following 2024 best practices for production RAG systems.

### Update Notes

#### Version 1.2 (2025-11-22)
**Added Local-First Architecture for enhanced performance:**
- **Local SQLite caching**: Enables <10ms field load times (vs 200-500ms with API calls)
- **Full offline support**: Users can work without internet connection
- **Background sync**: Changes save locally first, then sync to Supabase when online
- **Instant UI updates**: No loading states needed - all interactions feel immediate
- **Multiple storage options**: IndexedDB, SQL.js, or OPFS depending on needs

#### Version 1.1 (2025-11-22)
**All field names and data models have been updated to match the actual React implementation:**
- **Avatar Builder**: Corrected subcategories to Demographics, Psychology, Buying Behavior, and Voice
- **Interactive Insights**: Clarified that most are conceptual categories; actual input fields are limited to buyer intent research
- **Brand Canvas**: Updated with exact field names (brandPurpose, brandVision, etc.) from BrandCanvas.tsx
- **Copy Generator**: Updated with ValueLens fields including emotional payoffs and copy formats
- **Field Identifiers**: All use consistent naming pattern: `category_subcategory_field`

---

## Architecture Overview

### Hybrid Storage Pattern

```sql
-- Each knowledge category has both original content AND vector embeddings
CREATE TABLE user_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Category & identification
  category TEXT NOT NULL, -- 'diagnostic', 'avatar', 'insights', 'canvas', 'copy'
  subcategory TEXT,       -- e.g., 'avatar_demographics', 'canvas_value_prop'
  field_identifier TEXT,  -- Unique identifier for form field (e.g., 'avatar_pain_point_1')

  -- Original content (for exact retrieval)
  content TEXT NOT NULL,           -- The actual user input
  structured_data JSONB,           -- Structured version for complex data

  -- Vector embedding (for RAG/semantic search)
  embedding vector(1536),          -- OpenAI ada-002 embeddings

  -- Metadata
  metadata JSONB,                  -- Additional context (question, options, etc.)
  source_page TEXT,                -- Which page/module this came from
  version INTEGER DEFAULT 1,       -- Version tracking
  is_current BOOLEAN DEFAULT true, -- Mark latest version

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_user_knowledge_user_category
  ON user_knowledge_base(user_id, category, is_current);

CREATE INDEX idx_user_knowledge_field_lookup
  ON user_knowledge_base(user_id, field_identifier, is_current);

CREATE INDEX idx_user_knowledge_embedding
  ON user_knowledge_base USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

---

## Knowledge Base Categories

### 1. Diagnostic Data
**Source:** Free Brand Diagnostic (6 questions)
**Storage Strategy:** Individual entries per answer for granular RAG retrieval

```typescript
interface DiagnosticKnowledgeEntry {
  category: 'diagnostic';
  subcategory: 'insight' | 'distinctive' | 'empathetic' | 'authentic';
  field_identifier: `diagnostic_q${1-6}_answer`;
  content: string; // The selected answer text
  structured_data: {
    question_id: string;
    question_text: string;
    selected_option: string;
    option_value: number; // Score value
    idea_category: string;
  };
  metadata: {
    diagnostic_session_id: string;
    overall_score: number;
    category_scores: Record<string, number>;
    completion_date: string;
  };
}
```

**Example Entry:**
```json
{
  "category": "diagnostic",
  "subcategory": "insight",
  "field_identifier": "diagnostic_q1_answer",
  "content": "We have basic demographic data but don't deeply understand customer emotions",
  "structured_data": {
    "question_id": "q1",
    "question_text": "How well do you understand your target customers?",
    "selected_option": "basic_understanding",
    "option_value": 3,
    "idea_category": "insight"
  }
}
```

### 2. Avatar Data
**Source:** Avatar 2.0 Builder (4 sections)
**Storage Strategy:** One entry per text field for fine-grained updates

```typescript
interface AvatarKnowledgeEntry {
  category: 'avatar';
  subcategory: 'demographics' | 'psychology' | 'buying_behavior' | 'voice';
  field_identifier: `avatar_${section}_${field}`;
  content: string; // User's text entry
  structured_data: {
    avatar_name?: string;
    field_type: string;
    field_label: string;
  };
}
```

**Fields to Track (from actual implementation):**
- **Demographics**:
  - `avatar_demographics_age` (age range select)
  - `avatar_demographics_income` (income level select)
  - `avatar_demographics_location` (location type select)
  - `avatar_demographics_lifestyle` (lifestyle description textarea)
- **Psychology (Psychographics)**:
  - `avatar_psychology_values` (array of value tags)
  - `avatar_psychology_fears` (array of fear tags)
  - `avatar_psychology_desires` (array of desire tags)
  - `avatar_psychology_triggers` (array of trigger tags)
- **Buying Behavior**:
  - `avatar_buying_behavior_intent` (buying intent select)
  - `avatar_buying_behavior_decision_factors` (array of decision factor tags)
  - `avatar_buying_behavior_shopping_style` (shopping style select)
  - `avatar_buying_behavior_price_consciousness` (price consciousness select)
- **Voice**:
  - `avatar_voice_customer_feedback` (voice of customer textarea)

### 3. Interactive Insights
**Source:** Interactive Insight Module (IdeaInsight page)
**Storage Strategy:** Store each component's inputs and generated insights separately

```typescript
interface InsightKnowledgeEntry {
  category: 'insights';
  subcategory: 'buyer_intent' | 'buyer_motivation' | 'emotional_triggers' | 'shopper_type' | 'relevant_demographics';
  field_identifier: `insights_${component}_${field}`;
  content: string;
  structured_data: {
    component_name: string;
    field_type: string;
    field_label: string;
  };
  metadata: {
    session_id: string;
    generation_model?: string;
    parent_entry_id?: string; // Links input to generated insight
  };
}
```

**Fields to Track (from actual implementation):**
- **Buyer Intent** (from BuyerIntentResearch component):
  - `insights_buyer_intent_search_terms` (comma-separated search terms)
  - `insights_buyer_intent_industry` (industry/niche text)
  - `insights_buyer_intent_analysis` (AI-generated analysis)
- **Buyer Motivation** (conceptual categories shown but no input fields found):
  - Social status desires
  - Convenience seeking
  - Self-expression needs
  - Prestige motivations
- **Emotional Triggers** (from EmotionalTriggerAssessment component):
  - Assessment results and trigger identification
- **Shopper Type** (categories displayed but no input fields):
  - Cost Sensitive (50%)
  - Quality Focused (39%)
  - Conscious (9%)
  - Connected (2%)
- **Relevant Demographics** (behavioral data points):
  - Usage patterns
  - Purchase frequency
  - Channel preferences
  - Lifestyle indicators

**Note:** The Interactive Insight module is primarily educational with limited input fields. Most subcategories are conceptual frameworks rather than data entry points.

### 4. IDEA Brand Canvas
**Source:** Brand Canvas Builder (BrandCanvas page)
**Storage Strategy:** Individual entries per canvas field + PDF reference

```typescript
interface CanvasKnowledgeEntry {
  category: 'canvas';
  subcategory: 'core' | 'identity' | 'positioning' | 'document';
  field_identifier: `canvas_${field}`;
  content: string;
  structured_data: {
    canvas_version: string;
    field_name: string;
    field_type: 'text' | 'array' | 'statement';
  };
  metadata: {
    canvas_id: string;
    pdf_url?: string; // For generated PDF entry
    completion_status: 'draft' | 'complete';
  };
}
```

**Fields to Track (from actual implementation):**
- **Core Elements**:
  - `canvas_brand_purpose` (Brand Purpose textarea)
  - `canvas_brand_vision` (Vision Statement textarea)
  - `canvas_brand_mission` (Mission Statement textarea)
  - `canvas_brand_values` (Brand Values array of tags)
- **Positioning & Value**:
  - `canvas_positioning_statement` (Positioning Statement textarea)
  - `canvas_value_proposition` (Value Proposition textarea)
- **Brand Identity**:
  - `canvas_brand_personality` (Brand Personality array of traits)
  - `canvas_brand_voice` (Brand Voice description textarea)

### 5. Copy Generator (ValueLens)
**Source:** ValueLens AI Copy Generator Page
**Storage Strategy:** Store inputs and outputs as linked entries

```typescript
interface CopyKnowledgeEntry {
  category: 'copy';
  subcategory: 'input' | 'generated' | 'edited';
  field_identifier: `copy_${type}_${field}`;
  content: string;
  structured_data: {
    copy_format: string; // 'amazon-bullet', 'pdp-description', 'ad-headline', etc.
    tone?: string;
    emotional_payoff?: string;
    target_audience?: string;
    features?: string[];
  };
  metadata: {
    generation_id: string;
    model_used?: string;
    user_rating?: number;
    is_saved: boolean;
  };
}
```

**Fields to Track (from actual implementation):**
- **Product Details**:
  - `copy_input_product_name` (Product name text)
  - `copy_input_category` (Product category text)
  - `copy_input_features` (Key features array)
  - `copy_input_target_audience` (Target audience textarea)
- **Copy Parameters**:
  - `copy_input_emotional_payoff` (Emotional payoff selection)
  - `copy_input_tone` (Tone selection)
  - `copy_input_format` (Copy format selection)
  - `copy_input_additional_context` (Additional context textarea)
- **Generated Output**:
  - `copy_generated_content` (The AI-generated copy)
  - `copy_edited_content` (User-edited version if modified)

**Copy Format Options:**
- Amazon Bullet Points
- Product Description (PDP)
- Ad Headline
- Social Media Caption
- Email Subject Line
- TikTok Hook
- Landing Page Hero

**Emotional Payoff Options:**
- Confidence & Self-Assurance
- Peace of Mind & Security
- Status & Recognition
- Time Freedom & Convenience
- Health & Vitality
- Love & Connection
- Achievement & Success
- Transformation & Growth

---

## Implementation Architecture

### Data Flow for Form Population

```typescript
// Service for populating forms with existing data
class UserKnowledgeService {
  // Retrieve exact user data for form fields
  async getFieldValues(
    userId: string,
    fieldIdentifiers: string[]
  ): Promise<Map<string, string>> {
    const { data } = await supabase
      .from('user_knowledge_base')
      .select('field_identifier, content')
      .eq('user_id', userId)
      .in('field_identifier', fieldIdentifiers)
      .eq('is_current', true);

    return new Map(
      data.map(item => [item.field_identifier, item.content])
    );
  }

  // Retrieve all data for a category (e.g., populate entire Avatar form)
  async getCategoryData(
    userId: string,
    category: string
  ): Promise<Record<string, any>> {
    const { data } = await supabase
      .from('user_knowledge_base')
      .select('field_identifier, content, structured_data')
      .eq('user_id', userId)
      .eq('category', category)
      .eq('is_current', true);

    return data.reduce((acc, item) => {
      acc[item.field_identifier] = {
        value: item.content,
        data: item.structured_data
      };
      return acc;
    }, {});
  }
}
```

### Data Flow for RAG/Semantic Search

```typescript
// Edge Function for RAG retrieval
async function retrieveUserContext(
  userId: string,
  query: string,
  categories?: string[]
): Promise<RetrievedContext[]> {
  // 1. Generate query embedding
  const queryEmbedding = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: query,
  });

  // 2. Semantic search with category filtering
  const { data } = await supabase.rpc('match_user_knowledge', {
    query_embedding: queryEmbedding.data[0].embedding,
    match_threshold: 0.7,
    match_count: 10,
    user_id: userId,
    categories: categories || ['diagnostic', 'avatar', 'insights', 'canvas', 'copy']
  });

  // 3. Return with original content + metadata
  return data.map(item => ({
    content: item.content,
    category: item.category,
    relevance_score: item.similarity,
    metadata: item.metadata
  }));
}
```

### React Hook for Form Integration

```typescript
// Custom hook for form persistence
export function usePersistedField(fieldIdentifier: string) {
  const { user } = useAuth();
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load existing value on mount
  useEffect(() => {
    if (user?.id) {
      loadFieldValue();
    }
  }, [user?.id, fieldIdentifier]);

  const loadFieldValue = async () => {
    const knowledge = new UserKnowledgeService();
    const values = await knowledge.getFieldValues(
      user.id,
      [fieldIdentifier]
    );
    setValue(values.get(fieldIdentifier) || '');
    setIsLoading(false);
  };

  // Debounced save to knowledge base
  const debouncedSave = useMemo(
    () => debounce(async (newValue: string) => {
      await saveToKnowledgeBase({
        user_id: user.id,
        field_identifier: fieldIdentifier,
        content: newValue,
        category: getCategoryFromField(fieldIdentifier),
        // Generate embedding asynchronously via Edge Function
        trigger_embedding: true
      });
    }, 1000),
    [user?.id, fieldIdentifier]
  );

  const handleChange = (newValue: string) => {
    setValue(newValue);
    debouncedSave(newValue);
  };

  return {
    value,
    onChange: handleChange,
    isLoading
  };
}

// Usage in component (matching actual Avatar Builder implementation)
function AvatarDemographics() {
  const age = usePersistedField('avatar_demographics_age');
  const income = usePersistedField('avatar_demographics_income');
  const location = usePersistedField('avatar_demographics_location');
  const lifestyle = usePersistedField('avatar_demographics_lifestyle');

  return (
    <div>
      <Select
        value={age.value}
        onValueChange={(value) => age.onChange(value)}
        disabled={age.isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select age range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="18-24">18-24</SelectItem>
          <SelectItem value="25-34">25-34</SelectItem>
          <SelectItem value="35-44">35-44</SelectItem>
        </SelectContent>
      </Select>

      <Textarea
        placeholder="Describe their typical day, family situation, work life, hobbies..."
        value={lifestyle.value}
        onChange={(e) => lifestyle.onChange(e.target.value)}
        disabled={lifestyle.isLoading}
      />
    </div>
  );
}
```

---

## Data Management Strategies

### Versioning Strategy
When users update their information:
1. Set `is_current = false` on existing entry
2. Create new entry with `version = old_version + 1`
3. Keep last 3 versions for context continuity
4. Older versions are archived but not deleted

```sql
-- Function to handle versioned updates
CREATE OR REPLACE FUNCTION update_knowledge_entry(
  p_user_id UUID,
  p_field_identifier TEXT,
  p_new_content TEXT,
  p_new_structured_data JSONB
) RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
  v_current_version INTEGER;
BEGIN
  -- Get current version number
  SELECT COALESCE(MAX(version), 0) INTO v_current_version
  FROM user_knowledge_base
  WHERE user_id = p_user_id
    AND field_identifier = p_field_identifier;

  -- Mark old versions as not current
  UPDATE user_knowledge_base
  SET is_current = false
  WHERE user_id = p_user_id
    AND field_identifier = p_field_identifier
    AND is_current = true;

  -- Insert new version
  INSERT INTO user_knowledge_base (
    user_id, field_identifier, content,
    structured_data, version, is_current
  ) VALUES (
    p_user_id, p_field_identifier, p_new_content,
    p_new_structured_data, v_current_version + 1, true
  ) RETURNING id INTO v_new_id;

  -- Trigger embedding generation
  PERFORM net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/generate-embedding',
    body := jsonb_build_object('entry_id', v_new_id)
  );

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;
```

### Embedding Generation Pipeline

```typescript
// Edge Function: generate-embedding
export async function generateEmbedding(req: Request) {
  const { entry_id } = await req.json();

  // 1. Fetch the entry
  const { data: entry } = await supabase
    .from('user_knowledge_base')
    .select('*')
    .eq('id', entry_id)
    .single();

  // 2. Format content for embedding
  const embeddingText = formatForEmbedding(entry);

  // 3. Generate embedding
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: embeddingText,
  });

  // 4. Update entry with embedding
  await supabase
    .from('user_knowledge_base')
    .update({
      embedding: response.data[0].embedding,
      updated_at: new Date().toISOString()
    })
    .eq('id', entry_id);

  return new Response(JSON.stringify({ success: true }));
}

function formatForEmbedding(entry: KnowledgeEntry): string {
  // Create rich context for better semantic search
  const parts = [
    `Category: ${entry.category}`,
    `Type: ${entry.subcategory}`,
    `Content: ${entry.content}`
  ];

  if (entry.metadata?.question_text) {
    parts.push(`Context: ${entry.metadata.question_text}`);
  }

  if (entry.structured_data?.field_label) {
    parts.push(`Field: ${entry.structured_data.field_label}`);
  }

  return parts.join('\n');
}
```

---

## Implementation Phases

### Phase 1: P0 Beta Launch (Priority)
1. **Diagnostic Data** ✅ Critical for Brand Coach GPT
   - Implement on account creation after diagnostic
   - Generate embeddings immediately
   - Test RAG retrieval

2. **Basic Persistence** ✅ Core UX requirement
   - Implement `usePersistedField` hook
   - Add to existing diagnostic flow
   - Ensure refresh maintains state

### Phase 2: Enhanced Features
3. **Avatar Builder Integration**
   - Add persistence to all Avatar fields
   - Batch embedding generation
   - Test form population on return visits

4. **Interactive Insights Module**
   - Capture all user inputs
   - Store generated insights
   - Link inputs to outputs

### Phase 3: Complete System
5. **IDEA Canvas Builder**
   - Store all canvas fields
   - PDF generation and storage
   - Version management for drafts

6. **Copy Generator**
   - Input/output pairing
   - Rating and feedback storage
   - A/B test tracking

---

## Performance Optimizations

### Caching Strategy
```typescript
// Use React Query for intelligent caching
export function useUserKnowledge(category: string) {
  return useQuery({
    queryKey: ['user-knowledge', user?.id, category],
    queryFn: () => knowledgeService.getCategoryData(user.id, category),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
}
```

### Local-First Architecture (Enhanced Option)

**Performance Improvements:**
- **Current**: 200-500ms to load each field (requires API call)
- **With Local-First**: <10ms instant load from local SQLite cache
- **Full offline support**: Works on planes, in tunnels, anywhere

```typescript
// Local SQLite schema (via SQL.js or wa-sqlite)
const localSchema = `
CREATE TABLE IF NOT EXISTS local_knowledge (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  field_identifier TEXT NOT NULL,
  content TEXT,
  version INTEGER,
  last_synced_at INTEGER,
  local_changes BLOB,
  UNIQUE(user_id, field_identifier)
);

CREATE INDEX idx_field_lookup ON local_knowledge(field_identifier);
`;

// LocalKnowledgeStore for instant field access
class LocalKnowledgeStore {
  private db: SQLiteDatabase;

  constructor(userId: string) {
    this.db = await openDB('knowledge.db');
    await this.db.exec(localSchema);
  }

  // Instant local write with background sync
  async setField(fieldId: string, content: string): Promise<void> {
    await this.db.run(
      'INSERT OR REPLACE INTO local_knowledge (id, user_id, field_identifier, content, version, last_synced_at) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), this.userId, fieldId, content, Date.now(), null]
    );

    // Queue for background sync to Supabase
    this.queueSync(fieldId, content);
  }

  // Instant local read (<10ms)
  async getField(fieldId: string): Promise<string | null> {
    const result = await this.db.get(
      'SELECT content FROM local_knowledge WHERE field_identifier = ? AND user_id = ?',
      [fieldId, this.userId]
    );
    return result?.content || null;
  }

  // Background sync to Supabase
  private async queueSync(fieldId: string, content: string): Promise<void> {
    // Non-blocking background sync
    requestIdleCallback(async () => {
      try {
        await supabase
          .from('user_knowledge_base')
          .upsert({
            field_identifier: fieldId,
            content,
            user_id: this.userId
          });

        await this.db.run(
          'UPDATE local_knowledge SET last_synced_at = ? WHERE field_identifier = ?',
          [Date.now(), fieldId]
        );
      } catch (error) {
        // Sync will retry on next app load
        console.log('Sync queued for retry');
      }
    });
  }
}

// Enhanced hook with local-first support
export function usePersistedFieldLocalFirst(fieldIdentifier: string) {
  const { user } = useAuth();
  const [value, setValue] = useState('');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const localStore = useLocalKnowledgeStore();

  useEffect(() => {
    // Load from local cache instantly
    const loadLocal = async () => {
      const cached = await localStore.getField(fieldIdentifier);
      if (cached) {
        setValue(cached);
      }
    };
    loadLocal();
  }, [fieldIdentifier]);

  const handleChange = async (newValue: string) => {
    // Instant local update
    setValue(newValue);
    await localStore.setField(fieldIdentifier, newValue);

    // Visual feedback for sync status
    setSyncStatus('syncing');

    // Background sync happens automatically
    setTimeout(() => {
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    }, 500);
  };

  return {
    value,
    onChange: handleChange,
    syncStatus,
    isLoading: false // Never loading - always instant
  };
}
```

**Implementation Options:**
1. **IndexedDB**: Built-in browser storage, no dependencies
2. **SQL.js**: SQLite compiled to WebAssembly for browser
3. **OPFS (Origin Private File System)**: Modern file system API for larger datasets

**Offline Sync Strategy:**
- All changes saved locally first
- Background sync when online
- Conflict resolution: Last-write-wins or version-based
- Service Worker for true offline capability

### Batch Operations
```typescript
// Batch save multiple fields
async function batchSaveFields(
  userId: string,
  updates: Array<{ field: string; content: string }>
) {
  // Save all at once
  const entries = updates.map(u => ({
    user_id: userId,
    field_identifier: u.field,
    content: u.content,
    category: getCategoryFromField(u.field),
  }));

  await supabase
    .from('user_knowledge_base')
    .upsert(entries, {
      onConflict: 'user_id,field_identifier',
      ignoreDuplicates: false
    });

  // Trigger batch embedding generation
  await supabase.functions.invoke('batch-generate-embeddings', {
    body: { user_id: userId, fields: updates.map(u => u.field) }
  });
}
```

---

## Security & Privacy

### Row Level Security (RLS)
```sql
-- Users can only access their own knowledge base
CREATE POLICY "Users can view own knowledge" ON user_knowledge_base
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own knowledge" ON user_knowledge_base
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own knowledge" ON user_knowledge_base
  FOR UPDATE USING (auth.uid() = user_id);

-- No delete policy - use soft deletes via is_current flag
```

### Data Isolation
- All queries filtered by user_id
- Vector searches scoped to user's data only
- No cross-user data leakage in RAG

---

## Migration Path

### From Current System
```sql
-- Migrate existing diagnostic data
INSERT INTO user_knowledge_base (
  user_id,
  category,
  field_identifier,
  content,
  structured_data,
  created_at
)
SELECT
  user_id,
  'diagnostic' as category,
  'diagnostic_complete' as field_identifier,
  latest_diagnostic_data::text as content,
  latest_diagnostic_data as structured_data,
  diagnostic_completed_at as created_at
FROM profiles
WHERE latest_diagnostic_data IS NOT NULL;
```

---

## Testing Strategy

### Unit Tests
- Test field persistence and retrieval
- Test embedding generation
- Test version management
- Test caching behavior

### Integration Tests
- Test form population after refresh
- Test RAG retrieval accuracy
- Test cross-category search
- Test real-time updates

### Load Tests
- Test with 1000+ entries per user
- Test concurrent updates
- Test embedding generation at scale
- Test search performance

---

## Monitoring & Analytics

### Key Metrics
```sql
-- Dashboard queries
-- Average entries per user by category
SELECT
  category,
  COUNT(*)::float / COUNT(DISTINCT user_id) as avg_entries_per_user
FROM user_knowledge_base
WHERE is_current = true
GROUP BY category;

-- Embedding generation lag
SELECT
  COUNT(*) FILTER (WHERE embedding IS NULL) as pending_embeddings,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) as completed_embeddings
FROM user_knowledge_base
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Most updated fields (identify high-value areas)
SELECT
  field_identifier,
  COUNT(*) as update_count,
  AVG(version) as avg_version
FROM user_knowledge_base
GROUP BY field_identifier
ORDER BY update_count DESC
LIMIT 20;
```

---

## API Documentation

### REST Endpoints (via Supabase)
```typescript
// Get field values
GET /rest/v1/user_knowledge_base
  ?user_id=eq.{userId}
  &field_identifier=in.({fields})
  &is_current=eq.true
  &select=field_identifier,content

// Save field value
POST /rest/v1/user_knowledge_base
{
  "user_id": "uuid",
  "field_identifier": "avatar_demographics_age",
  "content": "35",
  "category": "avatar"
}

// Update field (triggers versioning)
PATCH /rest/v1/user_knowledge_base
  ?user_id=eq.{userId}
  &field_identifier=eq.{field}
  &is_current=eq.true
{
  "content": "new value"
}
```

### Edge Functions
```typescript
// Generate embeddings
POST /functions/v1/generate-embedding
{ "entry_id": "uuid" }

// Retrieve context for RAG
POST /functions/v1/retrieve-user-context
{
  "user_id": "uuid",
  "query": "tell me about the target audience",
  "categories": ["avatar", "diagnostic"]
}

// Batch operations
POST /functions/v1/batch-save-knowledge
{
  "user_id": "uuid",
  "entries": [...]
}
```

---

## Decision Log

### Why Hybrid Approach?
- **Vector-only doesn't work for exact retrieval** - Vectors find similar content, not exact matches
- **Traditional-only misses semantic search** - Can't power intelligent RAG without embeddings
- **Hybrid gives both capabilities** - Exact field values + semantic context

### Why Single Table vs Multiple?
- **Simplicity** - One table to maintain, one schema to evolve
- **Flexibility** - Easy to add new categories without migrations
- **Performance** - Single index for all vector searches
- **Trade-off** - Slightly larger table, but PostgreSQL handles this well

### Why Version Instead of Replace?
- **Context preservation** - AI can reference user's journey/changes
- **Undo capability** - Users can revert if needed
- **Audit trail** - Track how brand understanding evolves
- **Storage cost** - Minimal with text data

---

## Future Enhancements

### P1 Considerations
- **Document uploads** - Store PDFs, images in knowledge base
- **External data sources** - Import from Google Docs, Notion
- **Team knowledge bases** - Shared brand knowledge across team
- **Knowledge graphs** - Add relationship mapping between entries

### P2 Vision
- **Auto-categorization** - ML to categorize unstructured inputs
- **Smart suggestions** - Predict field values based on patterns
- **Knowledge synthesis** - Generate summary documents
- **Export capabilities** - Download knowledge base as structured data

---

## Implementation Checklist

### Database Setup
- [ ] Create user_knowledge_base table
- [ ] Add indexes for performance
- [ ] Enable RLS policies
- [ ] Create versioning function
- [ ] Add match_user_knowledge RPC function

### Edge Functions
- [ ] Create generate-embedding function
- [ ] Create batch-generate-embeddings function
- [ ] Update brand-coach-gpt to use new knowledge base
- [ ] Add retrieve-user-context helper

### Frontend Integration
- [ ] Implement UserKnowledgeService
- [ ] Create usePersistedField hook
- [ ] Add to DiagnosticForm
- [ ] Add to Avatar Builder
- [ ] Update BrandContext

### Testing
- [ ] Unit tests for services
- [ ] Integration tests for data flow
- [ ] Load test embedding generation
- [ ] Test RAG retrieval accuracy

### Documentation
- [ ] Update API documentation
- [ ] Add to developer guide
- [ ] Create migration guide
- [ ] Update architecture diagram

---

## Conclusion

This hybrid architecture provides the best of both worlds:
1. **Exact data retrieval** for populating form fields (traditional columns)
2. **Semantic search** for RAG-powered AI consultant (vector embeddings)
3. **Scalable and maintainable** single-table design
4. **Privacy-first** with user data isolation

The phased implementation allows for immediate P0 value (diagnostic persistence) while building toward a comprehensive knowledge management system.
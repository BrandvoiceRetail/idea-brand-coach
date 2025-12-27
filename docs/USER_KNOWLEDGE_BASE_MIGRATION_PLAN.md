# User Knowledge Base Migration Plan

## Overview

This document outlines the migration plan for storing all user-generated data into the `user_knowledge_base` table with local-first architecture. Data will be persisted to IndexedDB for instant access and background-synced to Supabase.

## Architecture

### Local-First Pattern
```
User Input → IndexedDB (instant) → Background Sync → Supabase
                ↓
         Page Load < 10ms
```

### Key Components
- `usePersistedField` hook - Single text/select field persistence
- `usePersistedArrayField` hook - Array field persistence (tags, lists)
- `KnowledgeRepository` - IndexedDB operations
- `SupabaseSyncService` - Background sync to `user_knowledge_base` table

---

## 1. Diagnostic Data (Category: `diagnostic`)

**Source Page:** `/idea-diagnostic` (IdeaDiagnostic.tsx)

**Trigger:** Insert on account creation IF user completed diagnostic before signup

### Field Identifiers

| Field Identifier | Type | Description | UI Element |
|-----------------|------|-------------|------------|
| `diagnostic_insight1_answer` | text | Customer motivation understanding | Radio (score label) |
| `diagnostic_insight2_answer` | text | Emotional vs functional benefits | Radio (score label) |
| `diagnostic_distinctiveness1_answer` | text | Brand differentiation | Radio (score label) |
| `diagnostic_empathy1_answer` | text | Messaging addresses fears | Radio (score label) |
| `diagnostic_authenticity1_answer` | text | Brand voice consistency | Radio (score label) |
| `diagnostic_overall_score` | text | Overall score percentage | Calculated |
| `diagnostic_insight_score` | text | Insight category score | Calculated |
| `diagnostic_distinctiveness_score` | text | Distinctiveness score | Calculated |
| `diagnostic_empathy_score` | text | Empathy category score | Calculated |
| `diagnostic_authenticity_score` | text | Authenticity score | Calculated |
| `diagnostic_completed_at` | text | ISO timestamp | System |

### Migration Notes
- Store the **text label** of the selected option, not the score
- Scores stored separately for analytics
- Insert all fields atomically on account creation
- Use `subcategory` field for grouping: `question`, `score`, `metadata`

### Example Entry
```json
{
  "user_id": "uuid",
  "category": "diagnostic",
  "subcategory": "question",
  "field_identifier": "diagnostic_insight1_answer",
  "content": "Very well - I know their deep emotional drivers",
  "structured_data": { "score": 5, "question_id": "insight1" },
  "source_page": "/idea-diagnostic"
}
```

---

## 2. Avatar Data (Category: `avatar`)

**Source Page:** `/avatar` (AvatarBuilder.tsx)

**Status:** Already migrated to `usePersistedField`

### Field Identifiers

#### Demographics (subcategory: `demographics`)
| Field Identifier | Type | Description |
|-----------------|------|-------------|
| `avatar_name` | text | Avatar profile name |
| `avatar_demographics_age` | select | Age range (18-24, 25-34, etc.) |
| `avatar_demographics_income` | select | Income level |
| `avatar_demographics_location` | select | Urban/Suburban/Rural |
| `avatar_demographics_lifestyle` | textarea | Lifestyle description |

#### Psychology (subcategory: `psychology`)
| Field Identifier | Type | Description |
|-----------------|------|-------------|
| `avatar_psychology_values` | json_array | Core values tags |
| `avatar_psychology_fears` | json_array | Primary fears tags |
| `avatar_psychology_desires` | json_array | Deep desires tags |
| `avatar_psychology_triggers` | json_array | Emotional triggers tags |

#### Buying Behavior (subcategory: `buying_behavior`)
| Field Identifier | Type | Description |
|-----------------|------|-------------|
| `avatar_buying_behavior_intent` | select | Buying intent level |
| `avatar_buying_behavior_decision_factors` | json_array | Decision factors tags |
| `avatar_buying_behavior_shopping_style` | select | Shopping style type |
| `avatar_buying_behavior_price_consciousness` | select | Price sensitivity |

#### Voice of Customer (subcategory: `voice`)
| Field Identifier | Type | Description |
|-----------------|------|-------------|
| `avatar_voice_customer_feedback` | textarea | Customer reviews/feedback text |

#### PDF Export (subcategory: `export`)
| Field Identifier | Type | Description |
|-----------------|------|-------------|
| `avatar_pdf_export` | blob/base64 | Generated PDF document |

---

## 3. Interactive Insight Module (Category: `insights`)

**Source Page:** `/idea-insight` (IdeaInsight.tsx)

**Components:** InteractiveIdeaFramework, BuyerIntentResearch, EmotionalTriggerAssessment

### Field Identifiers

#### Interactive Framework (subcategory: `framework`)

**UPDATED 2025-12-27: Field identifiers now use semantic IDEA prefixes for better AI context and Canvas export grouping.**

| Field Identifier | Type | Description | IDEA Category |
|-----------------|------|-------------|---------------|
| `insight_buyer_intent` | textarea | What customers search for, their immediate needs | Insight |
| `insight_buyer_motivation` | textarea | Psychological drivers behind buying decisions | Insight |
| `empathy_emotional_triggers` | textarea | Emotional triggers that drive purchase decisions | Empathy |
| `insight_shopper_type` | textarea | Customer behavioral category (cost-sensitive, quality-focused, etc.) | Insight |
| `insight_demographics` | textarea | Relevant demographic patterns and behaviors | Insight |

#### Buyer Intent Research (subcategory: `research`)
| Field Identifier | Type | Description | IDEA Category |
|-----------------|------|-------------|---------------|
| `insight_search_terms` | text | Analyzed search terms | Insight |
| `insight_industry` | text | Industry/niche context | Insight |
| `insight_intent_analysis` | textarea | AI-generated buyer intent analysis | Insight |

#### Emotional Trigger Assessment (subcategory: `assessment`)
| Field Identifier | Type | Description | IDEA Category |
|-----------------|------|-------------|---------------|
| `empathy_trigger_responses` | json | Assessment question responses | Empathy |
| `empathy_trigger_profile` | json | Generated emotional trigger profile | Empathy |
| `empathy_assessment_completed` | boolean | Assessment completion status | Empathy |

#### Historical Field Mapping (for backward compatibility)
**Previous identifiers (deprecated 2025-12-27):**
- `insights_framework_step1_response` → `insight_buyer_intent`
- `insights_framework_step2_response` → `insight_buyer_motivation`
- `insights_framework_step3_response` → `empathy_emotional_triggers`
- `insights_framework_step4_response` → `insight_shopper_type`
- `insights_framework_step5_response` → `insight_demographics`
- `insights_research_search_terms` → `insight_search_terms`
- `insights_research_industry` → `insight_industry`
- `insights_research_analysis` → `insight_intent_analysis`
- `insights_assessment_answers` → `empathy_trigger_responses`
- `insights_assessment_complete` → `empathy_assessment_completed`
- `insights_assessment_results` → `empathy_trigger_profile`

---

## 4. Brand Canvas (Category: `canvas`)

**Source Page:** `/brand-canvas` (BrandCanvas.tsx)

**Status:** Already migrated to `usePersistedField`

### Field Identifiers

| Field Identifier | Type | Description |
|-----------------|------|-------------|
| `canvas_brand_purpose` | textarea | Brand purpose statement |
| `canvas_brand_vision` | textarea | Vision statement |
| `canvas_brand_mission` | textarea | Mission statement |
| `canvas_brand_values` | json_array | Brand values tags |
| `canvas_positioning_statement` | textarea | Positioning statement |
| `canvas_value_proposition` | textarea | Value proposition |
| `canvas_brand_personality` | json_array | Brand personality traits |
| `canvas_brand_voice` | textarea | Brand voice description |
| `canvas_pdf_export` | blob/base64 | Generated Canvas PDF |
| `canvas_completed` | boolean | Canvas completion status |

---

## 5. Copy Generator (Category: `copy`)

**Source Page:** `/valuelens` (ValueLens.tsx)

### Field Identifiers

#### Input Fields (subcategory: `input`)
| Field Identifier | Type | Description |
|-----------------|------|-------------|
| `copy_input_product_name` | text | Product name |
| `copy_input_category` | text | Product category |
| `copy_input_features` | json_array | Key features list |
| `copy_input_target_audience` | textarea | Target audience description |
| `copy_input_emotional_payoff` | select | Selected emotional payoff |
| `copy_input_tone` | select | Selected tone |
| `copy_input_format` | select | Selected copy format |
| `copy_input_additional_context` | textarea | Additional context |

#### Generated Copy (subcategory: `output`)
| Field Identifier | Type | Description |
|-----------------|------|-------------|
| `copy_generated_content` | textarea | AI-generated copy text |
| `copy_generated_format` | text | Format used for generation |
| `copy_generated_timestamp` | text | Generation timestamp |

#### Copy History (subcategory: `history`)
| Field Identifier | Type | Description |
|-----------------|------|-------------|
| `copy_history_entries` | json_array | Array of past generations |

---

## Implementation Priority

### Phase 1: Already Migrated
1. Brand Canvas fields
2. Avatar Builder fields

### Phase 2: High Priority
1. **Diagnostic Data** - Critical for account creation flow
2. **Copy Generator inputs/outputs** - User value demonstration

### Phase 3: Medium Priority
1. **Interactive Insight Module** - Complex multi-component migration
2. **PDF exports** - Large blob storage consideration

---

## Migration Checklist

### Per-Page Migration Steps

1. **Import hooks:**
   ```typescript
   import { usePersistedField, usePersistedArrayField } from '@/hooks/usePersistedField';
   ```

2. **Replace useState with usePersistedField:**
   ```typescript
   // Before
   const [productName, setProductName] = useState("");

   // After
   const productName = usePersistedField({
     fieldIdentifier: 'copy_input_product_name',
     category: 'copy',
     debounceDelay: 500
   });
   ```

3. **Update onChange handlers:**
   ```typescript
   // Before
   onChange={(e) => setProductName(e.target.value)}

   // After
   onChange={(e) => productName.onChange(e.target.value)}
   value={productName.value}
   ```

4. **Add sync status indicators:**
   ```tsx
   <Label className="flex items-center gap-2">
     Field Name
     <SyncIndicator status={productName.syncStatus} />
   </Label>
   ```

5. **For arrays, use usePersistedArrayField:**
   ```typescript
   const features = usePersistedArrayField({
     fieldIdentifier: 'copy_input_features',
     category: 'copy'
   });

   // Usage
   features.add("New feature");
   features.remove(0);
   features.set(["Feature 1", "Feature 2"]);
   ```

---

## Database Schema Reference

```sql
-- All fields stored in user_knowledge_base table
CREATE TABLE user_knowledge_base (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    category TEXT NOT NULL CHECK (category IN ('diagnostic', 'avatar', 'insights', 'canvas', 'copy')),
    subcategory TEXT,
    field_identifier TEXT NOT NULL,
    content TEXT NOT NULL,
    structured_data JSONB,
    embedding vector(1536),
    metadata JSONB,
    source_page TEXT,
    version INTEGER DEFAULT 1,
    is_current BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    local_changes BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Key indexes
CREATE INDEX idx_user_knowledge_user_field ON user_knowledge_base(user_id, field_identifier);
CREATE INDEX idx_user_knowledge_user_category ON user_knowledge_base(user_id, category);
```

---

## Special Considerations

### PDF Storage
- Store as base64 in `content` field
- Use `structured_data` for metadata (size, page count, generated_at)
- Consider compression for large PDFs
- Alternatively, store in Supabase Storage and save URL in content

### Account Creation Flow (Diagnostic)
```typescript
// In account creation handler
async function handleAccountCreation(userId: string, diagnosticData: DiagnosticData) {
  const entries = buildDiagnosticEntries(diagnosticData);

  // Batch insert all diagnostic entries
  await knowledgeRepository.batchInsert(userId, entries);

  // Trigger background sync
  await syncService.syncNow();
}
```

### Data Migration for Existing Users
- Run migration script to copy data from BrandContext to user_knowledge_base
- Preserve timestamps from original entries
- Mark migrated entries with metadata flag

---

## RAG Integration

All entries support vector embeddings for semantic search:

```typescript
// Generate embedding on save (async)
const embedding = await generateEmbedding(content);

// Store with entry
await supabase.from('user_knowledge_base').insert({
  ...entry,
  embedding
});

// Query similar content
const results = await supabase.rpc('match_user_knowledge', {
  query_embedding: userQueryEmbedding,
  match_threshold: 0.7,
  match_count: 10,
  p_user_id: userId
});
```

This enables the AI consultant to retrieve relevant user knowledge contextually.

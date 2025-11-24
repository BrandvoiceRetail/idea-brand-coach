# Implementation Plan - 5+5 Knowledge Base Architecture

**Version:** 1.0
**Date:** 2025-11-23
**Status:** Ready for Implementation
**Estimated Total Effort:** 12-15 days

---

## Executive Summary

This plan addresses the gaps identified in [IMPLEMENTATION_GAP_ANALYSIS.md](./IMPLEMENTATION_GAP_ANALYSIS.md) to achieve the target [5+5 Knowledge Base Architecture](./KNOWLEDGE_BASE_ARCHITECTURE.md).

### Priority Order

| Phase | Focus | Effort | Dependencies |
|-------|-------|--------|--------------|
| **Phase 1** | Database & Sync Infrastructure | 2-3 days | None |
| **Phase 2** | System KB Setup | 3-4 days | Phase 1 |
| **Phase 3** | User KB Population | 2-3 days | Phase 1 |
| **Phase 4** | Query Engine Migration | 3-4 days | Phases 2 & 3 |
| **Phase 5** | Page Migrations | 2-3 days | Phase 1 |

---

## Phase 1: Database & Sync Infrastructure

**Goal:** Establish the foundation for syncing data from Supabase to OpenAI Vector Stores

### Task 1.1: Database Schema Updates
**Effort:** 0.5 day

Create migration to add OpenAI sync tracking columns:

```sql
-- File: supabase/migrations/20241123_openai_sync_columns.sql

-- Add sync tracking to user_knowledge_base
ALTER TABLE user_knowledge_base
ADD COLUMN IF NOT EXISTS openai_file_id TEXT,
ADD COLUMN IF NOT EXISTS openai_synced_at TIMESTAMPTZ;

-- Create system_vector_stores table
CREATE TABLE IF NOT EXISTS system_vector_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL UNIQUE CHECK (category IN ('diagnostic', 'avatar', 'canvas', 'capture', 'core')),
    vector_store_id TEXT NOT NULL,
    document_count INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for finding unsynced entries
CREATE INDEX idx_user_kb_needs_sync
ON user_knowledge_base(user_id, category)
WHERE openai_file_id IS NULL AND content IS NOT NULL AND LENGTH(content) > 10;
```

**Deliverables:**
- [ ] Migration file created
- [ ] Migration deployed to Supabase
- [ ] Verified columns exist

---

### Task 1.2: Create Sync Edge Function
**Effort:** 1.5 days

Create Edge Function to sync `user_knowledge_base` entries to OpenAI Vector Stores:

```typescript
// File: supabase/functions/sync-to-openai-vector-store/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  entry_id?: string;      // Sync single entry
  user_id?: string;       // Sync all for user
  category?: string;      // Filter by category
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { entry_id, user_id, category }: SyncRequest = await req.json();

    // Build query for entries to sync
    let query = supabase
      .from("user_knowledge_base")
      .select("*, user_vector_stores!inner(*)");

    if (entry_id) {
      query = query.eq("id", entry_id);
    } else if (user_id) {
      query = query.eq("user_id", user_id);
      if (category) {
        query = query.eq("category", category);
      }
    }

    // Only sync entries with meaningful content that haven't been synced
    query = query.is("openai_file_id", null).gt("content", "");

    const { data: entries, error } = await query;
    if (error) throw error;

    const results = [];
    for (const entry of entries || []) {
      try {
        // Get the user's vector store for this category
        const vectorStoreId = getVectorStoreId(entry.user_vector_stores, entry.category);

        // Create document content
        const document = formatEntryAsDocument(entry);

        // Upload to OpenAI
        const fileId = await uploadToOpenAI(OPENAI_API_KEY, document, entry.field_identifier);

        // Add to vector store
        await addFileToVectorStore(OPENAI_API_KEY, vectorStoreId, fileId);

        // Update entry with file ID
        await supabase
          .from("user_knowledge_base")
          .update({
            openai_file_id: fileId,
            openai_synced_at: new Date().toISOString()
          })
          .eq("id", entry.id);

        results.push({ id: entry.id, status: "synced", fileId });
      } catch (err) {
        results.push({ id: entry.id, status: "error", error: err.message });
      }
    }

    return new Response(JSON.stringify({ synced: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

function getVectorStoreId(userStores: any, category: string): string {
  const storeMap: Record<string, string> = {
    diagnostic: userStores.diagnostic_store_id,
    avatar: userStores.avatar_store_id,
    canvas: userStores.canvas_store_id,
    capture: userStores.capture_store_id,
    core: userStores.core_store_id,
  };
  return storeMap[category];
}

function formatEntryAsDocument(entry: any): string {
  return `# ${entry.field_identifier}
Category: ${entry.category}
Subcategory: ${entry.subcategory || 'general'}
Updated: ${entry.updated_at}

${entry.content}

${entry.structured_data ? `\nStructured Data:\n${JSON.stringify(entry.structured_data, null, 2)}` : ''}
`.trim();
}

async function uploadToOpenAI(apiKey: string, content: string, name: string): Promise<string> {
  const blob = new Blob([content], { type: "text/markdown" });
  const formData = new FormData();
  formData.append("file", blob, `${name}.md`);
  formData.append("purpose", "assistants");

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  const data = await response.json();
  return data.id;
}

async function addFileToVectorStore(apiKey: string, storeId: string, fileId: string): Promise<void> {
  const response = await fetch(`https://api.openai.com/v1/vector_stores/${storeId}/files`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    },
    body: JSON.stringify({ file_id: fileId }),
  });

  if (!response.ok) throw new Error(`Add to vector store failed: ${response.status}`);
}
```

**Deliverables:**
- [ ] Edge Function created and deployed
- [ ] Tested with single entry sync
- [ ] Tested with batch user sync
- [ ] Error handling verified

---

### Task 1.3: Add Database Trigger (Optional)
**Effort:** 0.5 day

Auto-trigger sync on INSERT/UPDATE:

```sql
-- File: supabase/migrations/20241123_sync_trigger.sql

-- Enable pg_net for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Trigger function
CREATE OR REPLACE FUNCTION trigger_openai_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync entries with meaningful content
  IF LENGTH(NEW.content) > 10 THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/sync-to-openai-vector-store',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object('entry_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER sync_to_openai_on_change
  AFTER INSERT OR UPDATE OF content ON user_knowledge_base
  FOR EACH ROW
  WHEN (NEW.openai_file_id IS NULL OR OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION trigger_openai_sync();
```

**Deliverables:**
- [ ] Trigger created (or manual sync preferred)
- [ ] Tested auto-sync on field update

---

## Phase 2: System Knowledge Base Setup

**Goal:** Create and populate the 5 shared System KB vector stores

### Task 2.1: Create System Vector Stores
**Effort:** 0.5 day

```typescript
// File: supabase/functions/create-system-kb/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CATEGORIES = ['diagnostic', 'avatar', 'canvas', 'capture', 'core'];

serve(async (req) => {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results = [];

  for (const category of CATEGORIES) {
    // Check if already exists
    const { data: existing } = await supabase
      .from("system_vector_stores")
      .select("vector_store_id")
      .eq("category", category)
      .single();

    if (existing) {
      results.push({ category, status: "exists", id: existing.vector_store_id });
      continue;
    }

    // Create vector store
    const response = await fetch("https://api.openai.com/v1/vector_stores", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2",
      },
      body: JSON.stringify({
        name: `IDEA System KB - ${category}`,
        metadata: { scope: "system", category },
      }),
    });

    const store = await response.json();

    // Save to database
    await supabase.from("system_vector_stores").insert({
      category,
      vector_store_id: store.id,
    });

    results.push({ category, status: "created", id: store.id });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

**Deliverables:**
- [ ] Edge Function created
- [ ] 5 system vector stores created in OpenAI
- [ ] Store IDs saved to `system_vector_stores` table

---

### Task 2.2: Upload Trevor's Book
**Effort:** 1-2 days

```typescript
// File: scripts/upload-trevor-book.ts

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const openai = new OpenAI();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Chapter to category mapping
const CHAPTER_MAPPING: Record<string, string> = {
  "chapter_01_brand_foundations": "core",
  "chapter_02_mission_vision": "core",
  "chapter_03_brand_story": "core",
  "chapter_04_customer_understanding": "avatar",
  "chapter_05_persona_development": "avatar",
  "chapter_06_customer_journey": "avatar",
  "chapter_07_brand_assessment": "diagnostic",
  "chapter_08_swot_analysis": "diagnostic",
  "chapter_09_competitive_analysis": "diagnostic",
  "chapter_10_business_model": "canvas",
  "chapter_11_value_proposition": "canvas",
  "chapter_12_revenue_strategy": "canvas",
  "chapter_13_content_strategy": "capture",
  "chapter_14_marketing_execution": "capture",
  "chapter_15_campaign_planning": "capture",
};

async function uploadTrevorsBook(bookPath: string) {
  // Get system vector store IDs
  const { data: stores } = await supabase
    .from("system_vector_stores")
    .select("category, vector_store_id");

  const storeMap = new Map(stores?.map(s => [s.category, s.vector_store_id]));

  // If single PDF, upload to all stores
  if (bookPath.endsWith(".pdf")) {
    const file = await openai.files.create({
      file: fs.createReadStream(bookPath),
      purpose: "assistants",
    });

    // Add to all 5 stores (OpenAI will chunk automatically)
    for (const [category, storeId] of storeMap) {
      await openai.vectorStores.files.create(storeId, { file_id: file.id });
      console.log(`Added to ${category} store`);
    }
    return;
  }

  // If directory of chapters, upload to appropriate stores
  const files = fs.readdirSync(bookPath);
  for (const fileName of files) {
    const category = CHAPTER_MAPPING[path.basename(fileName, path.extname(fileName))];
    if (!category) continue;

    const storeId = storeMap.get(category);
    if (!storeId) continue;

    const file = await openai.files.create({
      file: fs.createReadStream(path.join(bookPath, fileName)),
      purpose: "assistants",
    });

    await openai.vectorStores.files.create(storeId, { file_id: file.id });
    console.log(`Uploaded ${fileName} to ${category} store`);
  }
}

// Run
uploadTrevorsBook(process.argv[2] || "./content/trevors-book.pdf");
```

**Deliverables:**
- [ ] Script created
- [ ] Trevor's book received/prepared
- [ ] Book uploaded to appropriate vector stores
- [ ] Verified retrieval works

---

### Task 2.3: Upload Marketing Framework Syntheses
**Effort:** 1-2 days

Create and upload synthesis documents per [SYSTEM_KNOWLEDGE_BASE_PLAN.md](../MVP-PLAN-11-13-2025/SYSTEM_KNOWLEDGE_BASE_PLAN.md):

**Documents to Create:**
| Document | Category | Source |
|----------|----------|--------|
| Positioning Framework | diagnostic, core | Ries & Trout |
| StoryBrand Framework | avatar, core | Donald Miller |
| Blue Ocean Strategy | canvas | Kim & Mauborgne |
| STEPPS Virality Framework | capture | Jonah Berger |
| SUCCESs Messaging Framework | capture | Heath Brothers |
| 22 Laws of Marketing | diagnostic | Ries & Trout |

**Deliverables:**
- [ ] 6+ synthesis documents created
- [ ] Documents uploaded to appropriate stores
- [ ] Verified retrieval quality

---

## Phase 3: User KB Population

**Goal:** Sync existing user data from Supabase to their OpenAI Vector Stores

### Task 3.1: Backfill Existing Users
**Effort:** 1 day

```typescript
// File: scripts/backfill-user-vector-stores.ts

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfillUsers() {
  // Get all users with knowledge entries but no OpenAI sync
  const { data: users } = await supabase
    .from("user_knowledge_base")
    .select("user_id")
    .is("openai_file_id", null)
    .gt("content", "");

  const uniqueUsers = [...new Set(users?.map(u => u.user_id))];
  console.log(`Found ${uniqueUsers.length} users to backfill`);

  for (const userId of uniqueUsers) {
    console.log(`Syncing user ${userId}...`);

    // Call sync edge function
    const { error } = await supabase.functions.invoke("sync-to-openai-vector-store", {
      body: { user_id: userId }
    });

    if (error) {
      console.error(`Failed for ${userId}:`, error);
    } else {
      console.log(`Synced ${userId}`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }
}

backfillUsers();
```

**Deliverables:**
- [ ] Backfill script created
- [ ] All existing users synced
- [ ] Verified data in vector stores

---

### Task 3.2: Update SupabaseSyncService
**Effort:** 0.5 day

Trigger OpenAI sync after Supabase sync:

```typescript
// File: src/lib/knowledge-base/supabase-sync-service.ts
// Add after successful Supabase sync:

private async triggerOpenAISync(entryId: string): Promise<void> {
  try {
    await supabase.functions.invoke('sync-to-openai-vector-store', {
      body: { entry_id: entryId }
    });
  } catch (error) {
    console.warn('OpenAI sync queued for retry:', error);
    // Non-blocking - will be caught by backfill
  }
}
```

**Deliverables:**
- [ ] SupabaseSyncService updated
- [ ] New entries auto-sync to OpenAI
- [ ] Tested end-to-end flow

---

## Phase 4: Query Engine Migration

**Goal:** Migrate `brand-coach-gpt` from pgvector to Responses API with file_search

### Task 4.1: Create Intent Router
**Effort:** 0.5 day

```typescript
// File: supabase/functions/brand-coach-gpt/router.ts

export type IntentCategory = 'diagnostic' | 'avatar' | 'canvas' | 'capture' | 'core';

const INTENT_KEYWORDS: Record<IntentCategory, string[]> = {
  diagnostic: ['assess', 'evaluate', 'score', 'weakness', 'strength', 'SWOT', 'audit', 'diagnose'],
  avatar: ['customer', 'audience', 'persona', 'demographics', 'psychology', 'buyer', 'target'],
  canvas: ['purpose', 'vision', 'mission', 'values', 'positioning', 'proposition', 'brand identity'],
  capture: ['content', 'copy', 'marketing', 'campaign', 'social', 'ad', 'headline', 'email'],
  core: ['brand', 'story', 'voice', 'personality', 'authentic', 'foundation'],
};

export function classifyIntent(message: string): IntentCategory[] {
  const lowerMessage = message.toLowerCase();
  const scores: Record<IntentCategory, number> = {
    diagnostic: 0, avatar: 0, canvas: 0, capture: 0, core: 0
  };

  for (const [category, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        scores[category as IntentCategory]++;
      }
    }
  }

  // Return top 2 categories (or 'core' as default)
  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .filter(([, score]) => score > 0)
    .map(([cat]) => cat as IntentCategory);

  return sorted.length > 0 ? sorted.slice(0, 2) : ['core'];
}
```

**Deliverables:**
- [ ] Router module created
- [ ] Tested with sample queries
- [ ] Accuracy validated

---

### Task 4.2: Rewrite brand-coach-gpt
**Effort:** 2-3 days

```typescript
// File: supabase/functions/brand-coach-gpt/index.ts (rewritten)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { classifyIntent } from "./router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the IDEA Brand Coach...`; // (existing prompt)

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: { user } } = await supabase.auth.getUser(
      authHeader?.replace("Bearer ", "")
    );
    if (!user) throw new Error("Not authenticated");

    const { message, chat_history } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    // Get user's vector stores
    const { data: userStores } = await supabase
      .from("user_vector_stores")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Get system vector stores
    const { data: systemStores } = await supabase
      .from("system_vector_stores")
      .select("category, vector_store_id");

    // Classify intent to select relevant stores
    const intents = classifyIntent(message);

    // Build vector_store_ids array (system + user for each intent)
    const vectorStoreIds: string[] = [];
    for (const intent of intents) {
      // Add system store
      const systemStore = systemStores?.find(s => s.category === intent);
      if (systemStore) vectorStoreIds.push(systemStore.vector_store_id);

      // Add user store
      const userStoreId = userStores?.[`${intent}_store_id`];
      if (userStoreId) vectorStoreIds.push(userStoreId);
    }

    // Build messages for Responses API
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(chat_history?.slice(-10) || []),
      { role: "user", content: message },
    ];

    // Call Responses API with file_search
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "responses=v1",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        input: messages,
        tools: vectorStoreIds.length > 0 ? [{
          type: "file_search",
          vector_store_ids: vectorStoreIds,
          file_search: {
            max_num_results: 20,
          }
        }] : undefined,
        tool_choice: vectorStoreIds.length > 0 ? "auto" : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();

    // Extract response text and sources
    const assistantMessage = data.output_text || data.choices?.[0]?.message?.content;
    const sources = data.file_search_results?.map((r: any) => ({
      file: r.file_name,
      score: r.score,
    })) || [];

    return new Response(JSON.stringify({
      response: assistantMessage,
      sources,
      intents,
      suggestions: generateSuggestions(intents),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

function generateSuggestions(intents: string[]): string[] {
  const suggestions: Record<string, string[]> = {
    diagnostic: ["How can I improve my weakest IDEA dimension?", "What does my brand score mean?"],
    avatar: ["Tell me more about my target customer", "How can I better understand buyer psychology?"],
    canvas: ["How can I strengthen my brand positioning?", "What makes a good value proposition?"],
    capture: ["Help me write better marketing copy", "What content should I create next?"],
    core: ["How do I make my brand more authentic?", "What's my brand story?"],
  };

  return intents.flatMap(i => suggestions[i] || []).slice(0, 3);
}
```

**Deliverables:**
- [ ] brand-coach-gpt rewritten
- [ ] Uses Responses API with file_search
- [ ] Queries both System + User KB
- [ ] Intent-based store selection
- [ ] Tested with real queries
- [ ] Sources included in response

---

### Task 4.3: Deprecate pgvector
**Effort:** 0.5 day

- [ ] Remove `match_user_documents` RPC calls
- [ ] Remove `user_knowledge_chunks` table usage
- [ ] Update `sync-diagnostic-to-embeddings` to use new sync
- [ ] Clean up old embedding generation code

---

## Phase 5: Page Migrations

**Goal:** Migrate remaining pages to local-first architecture

### Task 5.1: Diagnostic Page Migration
**Effort:** 1 day

Migrate `IdeaDiagnostic.tsx` to use `usePersistedField`:

**Fields to migrate:**
- `diagnostic_q1_answer` through `diagnostic_q6_answer`
- `diagnostic_overall_score`
- `diagnostic_*_score` (per category)

**Deliverables:**
- [ ] IdeaDiagnostic.tsx migrated
- [ ] Sync on account creation working
- [ ] Tested full flow

---

### Task 5.2: Copy Generator Migration
**Effort:** 1 day

Migrate `ValueLens.tsx` to use `usePersistedField`:

**Fields to migrate:**
- `copy_input_product_name`
- `copy_input_category`
- `copy_input_features` (array)
- `copy_input_target_audience`
- `copy_input_emotional_payoff`
- `copy_input_tone`
- `copy_input_format`
- `copy_generated_content`

**Deliverables:**
- [ ] ValueLens.tsx migrated
- [ ] Input persistence working
- [ ] Generated copy saved

---

### Task 5.3: IDEA Insight Migration
**Effort:** 1 day

Migrate `IdeaInsight.tsx` components:

**Fields to migrate:**
- `insights_research_search_terms`
- `insights_research_intent_analysis`
- `insights_assessment_*` fields

**Deliverables:**
- [ ] IdeaInsight.tsx migrated
- [ ] All input fields persisted
- [ ] AI-generated insights saved

---

## Testing Checklist

### Integration Tests
- [ ] Field saved locally → synced to Supabase → synced to OpenAI
- [ ] Query returns results from both System + User KB
- [ ] Intent routing selects correct stores
- [ ] Offline edits sync when back online

### Performance Tests
- [ ] Field load time < 10ms (from IndexedDB)
- [ ] Supabase sync < 500ms
- [ ] OpenAI sync < 2s
- [ ] Query response < 3s

### Edge Cases
- [ ] New user (no data) - graceful empty state
- [ ] User with 100+ entries - pagination/limits
- [ ] Large content (>10KB) - chunking
- [ ] Concurrent edits - conflict resolution

---

## Rollout Plan

### Stage 1: Internal Testing (Day 1-2 after completion)
- Deploy to staging
- Team testing with real data
- Fix critical bugs

### Stage 2: Beta Users (Day 3-5)
- Enable for existing beta users
- Monitor error rates
- Gather feedback

### Stage 3: Full Rollout (Day 6+)
- Enable for all users
- Monitor performance
- Deprecate old system

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Field load time | < 10ms | Performance monitoring |
| Sync success rate | > 99% | Error tracking |
| Query relevance | > 80% user satisfaction | Feedback |
| RAG retrieval accuracy | Top 5 results relevant | Manual review |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OpenAI API rate limits | Implement queuing, batch syncs |
| Vector store costs | Monitor usage, set alerts |
| Data loss during migration | Keep old system running in parallel |
| Query latency | Cache common queries, optimize intent routing |

---

## Related Documents

- [KNOWLEDGE_BASE_ARCHITECTURE.md](./KNOWLEDGE_BASE_ARCHITECTURE.md) - Target architecture
- [IMPLEMENTATION_GAP_ANALYSIS.md](./IMPLEMENTATION_GAP_ANALYSIS.md) - Current gaps
- [USER_KNOWLEDGE_BASE_DESIGN.md](../USER_KNOWLEDGE_BASE_DESIGN.md) - Field specifications
- [USER_KNOWLEDGE_BASE_MIGRATION_PLAN.md](../USER_KNOWLEDGE_BASE_MIGRATION_PLAN.md) - Field identifiers

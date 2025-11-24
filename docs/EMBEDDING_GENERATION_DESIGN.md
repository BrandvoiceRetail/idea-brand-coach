# Embedding Generation Design

## Overview

This document outlines the design for automatically generating vector embeddings when user knowledge entries are synced to Supabase, enabling semantic search and RAG (Retrieval Augmented Generation) for the AI consultant.

## Current State

```
User Input → IndexedDB → SupabaseSyncService → user_knowledge_base
                                                    ↓
                                              embedding = NULL ❌
```

**Problem:** The `embedding` column in `user_knowledge_base` is never populated.

## Target State

```
User Input → IndexedDB → SupabaseSyncService → user_knowledge_base
                                                    ↓
                                           Database Trigger
                                                    ↓
                                         pg_net HTTP call
                                                    ↓
                                      generate-embedding Edge Function
                                                    ↓
                                           OpenAI ada-002 API
                                                    ↓
                                      UPDATE user_knowledge_base.embedding ✅
```

---

## Architecture: Async Database Trigger

### Why Async Trigger?

| Approach | Latency | Reliability | Complexity |
|----------|---------|-------------|------------|
| Client-side before sync | +500ms per field | Network dependent | Low |
| Sync Edge Function call | +500ms per field | Blocks sync | Medium |
| **Async DB Trigger** | 0ms (non-blocking) | Fire-and-forget | Medium |
| Queue-based worker | 0ms | Highest | High |

**Recommendation:** Async Database Trigger using `pg_net` extension for HTTP calls.

---

## Implementation

### 1. Edge Function: `generate-embedding`

```typescript
// supabase/functions/generate-embedding/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { record_id, content, field_identifier } = await req.json();

    if (!record_id || !content) {
      throw new Error("record_id and content are required");
    }

    // Skip embedding for very short content
    if (content.length < 10) {
      console.log(`Skipping embedding for short content: ${field_identifier}`);
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Generate embedding via OpenAI
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: content,
      }),
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI embedding failed: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    // Update the record with embedding
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { error: updateError } = await supabase
      .from("user_knowledge_base")
      .update({ embedding })
      .eq("id", record_id);

    if (updateError) {
      throw new Error(`Failed to update embedding: ${updateError.message}`);
    }

    console.log(`Generated embedding for ${field_identifier} (${record_id})`);

    return new Response(
      JSON.stringify({ success: true, record_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-embedding:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
```

### 2. Database Trigger Function

```sql
-- Migration: Add embedding generation trigger
-- File: supabase/migrations/YYYYMMDD_embedding_trigger.sql

-- Enable pg_net extension for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to trigger embedding generation
CREATE OR REPLACE FUNCTION public.trigger_embedding_generation()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  request_id BIGINT;
BEGIN
  -- Only generate for entries with meaningful content
  IF LENGTH(NEW.content) < 10 THEN
    RETURN NEW;
  END IF;

  -- Skip if embedding already exists and content hasn't changed
  IF OLD IS NOT NULL AND OLD.content = NEW.content AND OLD.embedding IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Build the edge function URL
  edge_function_url := current_setting('app.settings.supabase_url', true)
    || '/functions/v1/generate-embedding';

  -- If setting not available, use environment-based URL
  IF edge_function_url IS NULL OR edge_function_url = '/functions/v1/generate-embedding' THEN
    edge_function_url := 'https://ecdrxtbclxfpkknasmrw.supabase.co/functions/v1/generate-embedding';
  END IF;

  -- Make async HTTP call to edge function
  SELECT net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'record_id', NEW.id,
      'content', NEW.content,
      'field_identifier', NEW.field_identifier
    )
  ) INTO request_id;

  -- Log the request (optional, for debugging)
  RAISE LOG 'Embedding generation triggered for % (request_id: %)',
    NEW.field_identifier, request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for INSERT
CREATE TRIGGER generate_embedding_on_insert
  AFTER INSERT ON public.user_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_embedding_generation();

-- Create trigger for UPDATE (when content changes)
CREATE TRIGGER generate_embedding_on_update
  AFTER UPDATE OF content ON public.user_knowledge_base
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION public.trigger_embedding_generation();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.trigger_embedding_generation TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_embedding_generation TO service_role;
```

### 3. Configuration Setup

```sql
-- Set configuration for the trigger to use
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://ecdrxtbclxfpkknasmrw.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

**Note:** For production, use Vault secrets instead of database settings.

---

## Alternative: Supabase Webhooks (Simpler Setup)

If `pg_net` is not available or you prefer a managed solution:

### Using Supabase Database Webhooks

1. Go to **Database → Webhooks** in Supabase Dashboard
2. Create webhook:
   - **Name:** `generate-embedding-on-insert`
   - **Table:** `user_knowledge_base`
   - **Events:** `INSERT`, `UPDATE`
   - **URL:** `https://ecdrxtbclxfpkknasmrw.supabase.co/functions/v1/generate-embedding`
   - **HTTP Method:** `POST`
   - **Headers:** `Authorization: Bearer <service_role_key>`

### Webhook Payload Transform

```sql
-- Custom payload for webhook
SELECT jsonb_build_object(
  'record_id', NEW.id,
  'content', NEW.content,
  'field_identifier', NEW.field_identifier,
  'category', NEW.category
) as payload
```

---

## Batch Embedding for Existing Data

For migrating existing entries without embeddings:

```typescript
// scripts/backfill-embeddings.ts

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfillEmbeddings() {
  // Get entries without embeddings
  const { data: entries, error } = await supabase
    .from('user_knowledge_base')
    .select('id, content, field_identifier')
    .is('embedding', null)
    .gt('content', '')  // Has content
    .limit(100);  // Process in batches

  if (error) throw error;

  console.log(`Processing ${entries.length} entries...`);

  for (const entry of entries) {
    // Call the edge function
    const { error: fnError } = await supabase.functions.invoke('generate-embedding', {
      body: {
        record_id: entry.id,
        content: entry.content,
        field_identifier: entry.field_identifier
      }
    });

    if (fnError) {
      console.error(`Failed for ${entry.field_identifier}:`, fnError);
    } else {
      console.log(`Generated embedding for ${entry.field_identifier}`);
    }

    // Rate limit: 1 request per 100ms
    await new Promise(r => setTimeout(r, 100));
  }
}

backfillEmbeddings();
```

---

## Semantic Search Function

Update the existing `match_user_knowledge` function to work with the new embeddings:

```sql
-- Already exists in migration, but verify it works
SELECT * FROM public.match_user_knowledge(
  query_embedding := '<vector>',
  match_threshold := 0.7,
  match_count := 10,
  p_user_id := 'user-uuid',
  p_categories := ARRAY['canvas', 'avatar']
);
```

---

## Cost Estimation

| Volume | Embeddings/Month | Cost (ada-002) |
|--------|-----------------|----------------|
| 100 users, 50 fields each | 5,000 | ~$0.05 |
| 1,000 users, 50 fields each | 50,000 | ~$0.50 |
| 10,000 users, 50 fields each | 500,000 | ~$5.00 |

**Note:** OpenAI ada-002 costs $0.0001 per 1K tokens. Average field ~100 tokens.

---

## Implementation Checklist

- [ ] Deploy `generate-embedding` Edge Function
- [ ] Add Edge Function to `supabase/config.toml`
- [ ] Enable `pg_net` extension in Supabase
- [ ] Run migration to create trigger function
- [ ] Set database configuration (or use webhooks)
- [ ] Test with single field insert
- [ ] Run backfill script for existing data
- [ ] Verify RAG search works with new embeddings

---

## Integration with AI Consultant

Once embeddings are generated, the `brand-coach-gpt` Edge Function can query relevant context:

```typescript
// In brand-coach-gpt/index.ts

// Generate embedding for user's question
const questionEmbedding = await generateEmbedding(userQuestion);

// Find relevant user knowledge
const { data: relevantKnowledge } = await supabase.rpc('match_user_knowledge', {
  query_embedding: questionEmbedding,
  match_threshold: 0.7,
  match_count: 5,
  p_user_id: userId
});

// Include in context for GPT
const context = relevantKnowledge
  .map(k => `[${k.category}/${k.field_identifier}]: ${k.content}`)
  .join('\n');
```

This enables personalized, context-aware responses based on all user data.

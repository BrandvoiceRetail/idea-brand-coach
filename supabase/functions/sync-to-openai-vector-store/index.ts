/**
 * sync-to-openai-vector-store (pgvector edition)
 *
 * Syncs user_knowledge_base entries to pgvector embeddings.
 * Replaces the OpenAI vector store pipeline — entries are embedded
 * via ada-002 and stored directly in user_knowledge_chunks.
 *
 * The function name is preserved for backward compatibility with
 * frontend callers; the underlying implementation now uses pgvector.
 *
 * Usage:
 * - Single entry: { entry_id: "uuid" }
 * - All for user: { user_id: "uuid" }
 * - By category: { user_id: "uuid", category: "canvas" }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { generateEmbedding } from "../_shared/embeddings.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface SyncRequest {
  entry_id?: string;
  user_id?: string;
  category?: string;
}

interface KnowledgeEntry {
  id: string;
  user_id: string;
  category: string;
  subcategory: string | null;
  field_identifier: string;
  content: string;
  structured_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
}

/**
 * Format entry as a markdown document for embedding.
 * Same format as the old OpenAI version for consistency.
 */
function formatEntryAsDocument(entry: KnowledgeEntry): string {
  const lines = [
    `# ${entry.field_identifier}`,
    '',
    `**Category:** ${entry.category}`,
    entry.subcategory ? `**Subcategory:** ${entry.subcategory}` : null,
    `**Updated:** ${entry.updated_at}`,
    '',
    '---',
    '',
    entry.content,
  ].filter(Boolean);

  if (entry.structured_data && Object.keys(entry.structured_data).length > 0) {
    lines.push('', '---', '', '## Structured Data', '```json');
    lines.push(JSON.stringify(entry.structured_data, null, 2));
    lines.push('```');
  }

  return lines.join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { entry_id, user_id, category }: SyncRequest = await req.json();

    if (!entry_id && !user_id) {
      throw new Error('Either entry_id or user_id is required');
    }

    // Build query for entries to sync
    let query = supabase
      .from('user_knowledge_base')
      .select('*')
      .eq('is_current', true);

    if (entry_id) {
      query = query.eq('id', entry_id);
    } else if (user_id) {
      query = query.eq('user_id', user_id);
      if (category) {
        query = query.eq('category', category);
      }
    }

    // Only sync entries with meaningful content
    query = query.gt('content', '');

    const { data: entries, error: queryError } = await query;
    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, message: 'No entries to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each entry
    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const entry of entries as KnowledgeEntry[]) {
      try {
        // Skip entries with content too short
        if (entry.content.length < 10) {
          results.push({ id: entry.id, status: 'skipped', error: 'Content too short' });
          continue;
        }

        // Format the entry as a document for embedding
        const document = formatEntryAsDocument(entry);

        // Generate embedding
        const embedding = await generateEmbedding(document, OPENAI_API_KEY);

        // Delete any existing chunks for this field_identifier + user
        // (this handles re-syncs / updates)
        const { error: deleteError } = await supabase
          .from('user_knowledge_chunks')
          .delete()
          .eq('user_id', entry.user_id)
          .eq('field_identifier', entry.field_identifier)
          .eq('source_type', 'kb_entry');

        if (deleteError) {
          console.warn(`Failed to delete old chunks for ${entry.field_identifier}:`, deleteError);
        }

        // Insert new chunk
        const { error: insertError } = await supabase
          .from('user_knowledge_chunks')
          .insert({
            user_id: entry.user_id,
            content: document,
            embedding: JSON.stringify(embedding),
            source_type: 'kb_entry',
            source_id: entry.id,
            category: entry.category,
            field_identifier: entry.field_identifier,
            chunk_index: 0,
            metadata: {
              field_identifier: entry.field_identifier,
              category: entry.category,
              subcategory: entry.subcategory,
              kb_entry_id: entry.id,
            },
          });

        if (insertError) {
          console.error(`Failed to insert chunk for ${entry.field_identifier}:`, insertError);
          results.push({ id: entry.id, status: 'error', error: insertError.message });
          continue;
        }

        // Mark entry as synced to pgvector
        const { error: updateError } = await supabase
          .from('user_knowledge_base')
          .update({
            pgvector_synced_at: new Date().toISOString(),
          })
          .eq('id', entry.id);

        if (updateError) {
          console.error(`Failed to update pgvector_synced_at for ${entry.id}:`, updateError);
          results.push({ id: entry.id, status: 'partial', error: 'Chunk created but sync timestamp not updated' });
        } else {
          results.push({ id: entry.id, status: 'synced' });
        }

        console.log(`Synced ${entry.field_identifier} (${entry.category}) to pgvector`);

      } catch (error) {
        console.error(`Failed to sync entry ${entry.id}:`, error);
        results.push({ id: entry.id, status: 'error', error: error.message });
      }
    }

    const synced = results.filter(r => r.status === 'synced').length;
    const failed = results.filter(r => r.status === 'error').length;

    console.log(`Sync complete: ${synced} synced, ${failed} failed, ${results.length} total`);

    return new Response(
      JSON.stringify({
        synced,
        failed,
        total: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-to-openai-vector-store:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

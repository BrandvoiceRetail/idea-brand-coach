/**
 * sync-to-openai-vector-store
 *
 * Syncs user_knowledge_base entries to OpenAI Vector Stores.
 * Routes entries to the correct vector store based on category.
 *
 * Usage:
 * - Single entry: { entry_id: "uuid" }
 * - All for user: { user_id: "uuid" }
 * - By category: { user_id: "uuid", category: "canvas" }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  openai_file_id: string | null;
}

interface UserVectorStores {
  user_id: string;
  diagnostic_store_id: string;
  avatar_store_id: string;
  canvas_store_id: string;
  capture_store_id: string;
  core_store_id: string;
}

/**
 * Maps DB category to OpenAI vector store field
 */
function getVectorStoreField(category: string): keyof Omit<UserVectorStores, 'user_id'> {
  const mapping: Record<string, keyof Omit<UserVectorStores, 'user_id'>> = {
    'diagnostic': 'diagnostic_store_id',
    'avatar': 'avatar_store_id',
    'canvas': 'canvas_store_id',
    'insights': 'capture_store_id',  // Buyer intent research → capture
    'copy': 'capture_store_id',       // Copy generation → capture
    'capture': 'capture_store_id',    // Direct mapping
    'core': 'core_store_id',          // Uploaded docs, insights
  };
  return mapping[category] || 'core_store_id';
}

/**
 * Format entry as a markdown document for OpenAI
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

/**
 * Upload content as file to OpenAI
 */
async function uploadFileToOpenAI(
  apiKey: string,
  content: string,
  filename: string
): Promise<string> {
  const blob = new Blob([content], { type: 'text/markdown' });
  const formData = new FormData();
  formData.append('file', blob, `${filename}.md`);
  formData.append('purpose', 'assistants');

  const response = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload file: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Add file to OpenAI vector store
 */
async function addFileToVectorStore(
  apiKey: string,
  vectorStoreId: string,
  fileId: string
): Promise<void> {
  const response = await fetch(
    `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({ file_id: fileId }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add file to vector store: ${response.status} - ${error}`);
  }
}

/**
 * Delete old file from OpenAI (for updates)
 */
async function deleteFileFromOpenAI(apiKey: string, fileId: string): Promise<void> {
  try {
    await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
  } catch (error) {
    console.warn(`Failed to delete old file ${fileId}:`, error);
    // Non-fatal - old file will be orphaned but won't affect functionality
  }
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

    // Get unique user IDs from entries
    const userIds = [...new Set(entries.map(e => e.user_id))];

    // Fetch vector stores for all users
    const { data: allUserStores, error: storesError } = await supabase
      .from('user_vector_stores')
      .select('*')
      .in('user_id', userIds);

    if (storesError) {
      throw new Error(`Failed to fetch vector stores: ${storesError.message}`);
    }

    // Create lookup map
    const userStoresMap = new Map<string, UserVectorStores>();
    for (const stores of allUserStores || []) {
      userStoresMap.set(stores.user_id, stores);
    }

    // Process each entry
    const results: Array<{ id: string; status: string; fileId?: string; error?: string }> = [];

    for (const entry of entries as KnowledgeEntry[]) {
      try {
        // Skip if content is too short
        if (entry.content.length < 10) {
          results.push({ id: entry.id, status: 'skipped', error: 'Content too short' });
          continue;
        }

        // Get user's vector stores
        const userStores = userStoresMap.get(entry.user_id);
        if (!userStores) {
          results.push({ id: entry.id, status: 'skipped', error: 'User has no vector stores' });
          continue;
        }

        // Get target vector store based on category
        const storeField = getVectorStoreField(entry.category);
        const vectorStoreId = userStores[storeField];

        if (!vectorStoreId) {
          results.push({ id: entry.id, status: 'skipped', error: `No vector store for category: ${entry.category}` });
          continue;
        }

        // Delete old file if updating
        if (entry.openai_file_id) {
          await deleteFileFromOpenAI(OPENAI_API_KEY, entry.openai_file_id);
        }

        // Format and upload document
        const document = formatEntryAsDocument(entry);
        const fileId = await uploadFileToOpenAI(
          OPENAI_API_KEY,
          document,
          `${entry.user_id}_${entry.field_identifier}`
        );

        // Add to vector store
        await addFileToVectorStore(OPENAI_API_KEY, vectorStoreId, fileId);

        // Update entry with file ID
        const { error: updateError } = await supabase
          .from('user_knowledge_base')
          .update({
            openai_file_id: fileId,
            openai_synced_at: new Date().toISOString(),
          })
          .eq('id', entry.id);

        if (updateError) {
          console.error(`Failed to update entry ${entry.id}:`, updateError);
          results.push({ id: entry.id, status: 'partial', fileId, error: 'File uploaded but DB update failed' });
        } else {
          results.push({ id: entry.id, status: 'synced', fileId });
        }

        console.log(`✅ Synced ${entry.field_identifier} to ${entry.category} store`);

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

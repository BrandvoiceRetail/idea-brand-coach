/**
 * Context retrieval for the Claude edge function.
 * Retrieves user knowledge base and semantic context from Supabase pgvector.
 *
 * Phase 2: Uses pgvector match_document_chunks RPC for semantic search.
 *          All data (documents, KB entries, diagnostics) lives in
 *          user_knowledge_chunks with category-scoped filtering.
 * Phase 4: Will switch embedding model from ada-002 to Voyage AI.
 */

import { getFieldLabel } from './fields.ts';

// Temporarily keep OpenAI embeddings for semantic search compatibility.
// Phase 4 will replace this with Voyage AI.
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

/**
 * Generate embedding using OpenAI ada-002 (temporary -- Phase 4 migrates to Voyage AI).
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!openAIApiKey) {
    console.warn('[Embeddings] No OPENAI_API_KEY -- skipping semantic search');
    return [];
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Embeddings] Error:', response.status, errorText);
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Retrieve user's structured knowledge base context from Supabase.
 */
export async function retrieveUserContext(
  supabaseClient: any,
  userId: string,
  _query: string,
  minimal: boolean = false
): Promise<string> {
  try {
    console.log(`[Context] Fetching knowledge for user (${minimal ? 'minimal' : 'full'}):`, userId);

    const selectFields = minimal
      ? 'field_identifier, content'
      : 'field_identifier, category, content, subcategory';

    let query = supabaseClient
      .from('user_knowledge_base')
      .select(selectFields)
      .eq('user_id', userId)
      .eq('is_current', true)
      .not('content', 'is', null)
      .gt('content', '');

    if (minimal) {
      query = query.limit(10).order('updated_at', { ascending: false });
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error('[Context] Error fetching knowledge:', error);
      return '';
    }

    if (!entries || entries.length === 0) {
      console.log('[Context] No knowledge base entries found');
      return '';
    }

    console.log(`[Context] Found ${entries.length} knowledge entries`);

    const byCategory: Record<string, any[]> = {};
    entries.forEach((entry: any) => {
      const cat = entry.category || 'general';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(entry);
    });

    const categoryLabels: Record<string, string> = {
      insights: 'CUSTOMER INSIGHTS (from Interactive Insight Module)',
      canvas: 'BRAND CANVAS',
      avatar: 'CUSTOMER AVATAR',
      diagnostic: 'BRAND DIAGNOSTIC',
      copy: 'BRAND COPY',
    };

    const contextParts: string[] = ['USER BRAND KNOWLEDGE BASE:'];
    for (const [category, categoryEntries] of Object.entries(byCategory)) {
      const label = categoryLabels[category] || category.toUpperCase();
      contextParts.push(`\n${label}:`);
      categoryEntries.forEach((entry: any) => {
        const fieldLabel = getFieldLabel(entry.field_identifier, category);
        contextParts.push(`- ${fieldLabel}: ${entry.content}`);
      });
    }

    const context = contextParts.join('\n');
    console.log(`[Context] Generated context (${context.length} chars)`);
    return context;
  } catch (error) {
    console.error('[Context] Error:', error);
    return '';
  }
}

/**
 * Retrieve relevant context using semantic search via pgvector.
 *
 * Uses match_document_chunks RPC which searches across all
 * user_knowledge_chunks (documents, KB entries, diagnostics)
 * with optional category filtering.
 */
export async function retrieveSemanticContext(
  supabaseClient: any,
  userId: string,
  query: string
): Promise<{ content: string; sources: string[] }> {
  try {
    if (!openAIApiKey) {
      return { content: '', sources: [] };
    }

    console.log('[Context] Generating embedding for semantic search...');
    const queryEmbedding = await generateEmbedding(query);
    if (queryEmbedding.length === 0) {
      return { content: '', sources: [] };
    }

    // Use the new match_document_chunks RPC which supports category filtering
    // and returns richer metadata than the old match_user_documents
    const { data: matches, error } = await supabaseClient.rpc(
      'match_document_chunks',
      {
        query_embedding: queryEmbedding,
        match_user_id: userId,
        match_count: 5,
        match_threshold: 0.5,
        filter_categories: null, // Search all categories
      }
    );

    if (error) {
      console.error('[Context] Semantic search error:', error);

      // Fallback: try the legacy match_user_documents RPC
      // (in case the migration hasn't been applied yet)
      console.log('[Context] Falling back to match_user_documents...');
      const { data: fallbackMatches, error: fallbackError } = await supabaseClient.rpc(
        'match_user_documents',
        {
          query_embedding: queryEmbedding,
          match_user_id: userId,
          match_count: 5,
        }
      );

      if (fallbackError || !fallbackMatches || fallbackMatches.length === 0) {
        console.log('[Context] Fallback also returned no results');
        return { content: '', sources: [] };
      }

      const contextParts = fallbackMatches.map((m: any) => m.content);
      const sources = fallbackMatches.map((m: any, i: number) =>
        `Source ${i + 1} (relevance: ${(m.similarity * 100).toFixed(1)}%)`
      );
      return {
        content: `
<semantic-context>
The following information was retrieved based on relevance to the user's question:

${contextParts.join('\n\n---\n\n')}
</semantic-context>`,
        sources,
      };
    }

    if (!matches || matches.length === 0) {
      console.log('[Context] No semantic matches found');
      return { content: '', sources: [] };
    }

    console.log(`[Context] Found ${matches.length} semantic matches`);

    const contextParts = matches.map((m: any) => m.content);
    const sources = matches.map((m: any, i: number) => {
      const catLabel = m.category ? ` [${m.category}]` : '';
      const srcLabel = m.source_type ? ` (${m.source_type})` : '';
      return `Source ${i + 1}${catLabel}${srcLabel} (relevance: ${(m.similarity * 100).toFixed(1)}%)`;
    });

    return {
      content: `
<semantic-context>
The following information was retrieved based on relevance to the user's question:

${contextParts.join('\n\n---\n\n')}
</semantic-context>`,
      sources,
    };
  } catch (error) {
    console.error('[Context] Semantic search error:', error);
    return { content: '', sources: [] };
  }
}

/**
 * Retrieve all relevant context for the current message.
 * Returns structured context ready to be included in the user message.
 */
export async function retrieveAllContext(
  supabaseClient: any,
  userId: string,
  message: string,
  options: {
    needsFullContext: boolean;
    hasUploadedDocuments: boolean;
  }
): Promise<{
  userKnowledgeContext: string;
  semanticContext: string;
  sources: string[];
}> {
  if (options.needsFullContext) {
    console.log('[Context] Full retrieval for complex query');
    const startTime = Date.now();

    const [knowledge, semantic] = await Promise.all([
      retrieveUserContext(supabaseClient, userId, message),
      retrieveSemanticContext(supabaseClient, userId, message),
    ]);

    console.log(`[Context] Full retrieval took ${Date.now() - startTime}ms`);

    return {
      userKnowledgeContext: knowledge,
      semanticContext: semantic.content,
      sources: semantic.sources,
    };
  }

  // Minimal context for simple messages
  console.log('[Context] Minimal retrieval for conversational query');
  const knowledge = await retrieveUserContext(supabaseClient, userId, message, true);

  return {
    userKnowledgeContext: knowledge,
    semanticContext: '',
    sources: [],
  };
}

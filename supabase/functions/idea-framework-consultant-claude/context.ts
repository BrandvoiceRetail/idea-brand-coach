/**
 * Context retrieval for the Claude edge function.
 * Retrieves the user's structured knowledge base from Supabase.
 *
 * 2026-06-11: semantic search (pgvector + OpenAI query embeddings) removed —
 * user_knowledge_chunks is empty since the diagnostic-embeddings sync was
 * retired, and the app is Anthropic-only. Structured KB reads + the memory
 * snapshot (memory-context.ts) are the retrieval surfaces.
 */

import { getFieldLabel } from './fields.ts';

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
 * Retrieve all relevant context for the current message.
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
}> {
  const startTime = Date.now();
  const knowledge = await retrieveUserContext(
    supabaseClient,
    userId,
    message,
    !options.needsFullContext
  );
  console.log(`[Context] Retrieval (${options.needsFullContext ? 'full' : 'minimal'}) took ${Date.now() - startTime}ms`);

  return { userKnowledgeContext: knowledge };
}

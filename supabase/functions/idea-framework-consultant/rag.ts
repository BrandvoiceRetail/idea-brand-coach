/**
 * RAG (Retrieval-Augmented Generation) module.
 * Handles all context retrieval: vector store search, semantic search,
 * and structured knowledge base queries.
 */

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

/**
 * Search OpenAI vector store using the Responses API file_search tool.
 * Replaces the deprecated Assistants API approach (thread -> message -> assistant -> run -> poll -> read -> cleanup)
 * with a single API call.
 */
export async function searchVectorStore(
  vectorStoreId: string,
  query: string
): Promise<string> {
  try {
    console.log(`[searchVectorStore] Searching vector store ${vectorStoreId} for: "${query.substring(0, 50)}..."`);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        instructions: "Extract and return only the relevant text chunks from the user's documents. Return the raw content without commentary.",
        input: `Search for information relevant to: ${query}`,
        tools: [{
          type: "file_search",
          vector_store_ids: [vectorStoreId],
          max_num_results: 5,
        }],
        store: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[searchVectorStore] Responses API error:", response.status, errorText);
      return "";
    }

    const data = await response.json();

    // Extract text from output items
    const textContent = data.output
      ?.filter((item: Record<string, unknown>) => item.type === "message")
      ?.flatMap((item: Record<string, unknown>) => (item.content as Array<Record<string, unknown>>) || [])
      ?.filter((c: Record<string, unknown>) => c.type === "output_text")
      ?.map((c: Record<string, unknown>) => (c.text as string) || "")
      ?.join("\n");

    if (!textContent || textContent.trim().length === 0) {
      console.log("[searchVectorStore] No content returned from file_search");
      return "";
    }

    console.log(`[searchVectorStore] Retrieved ${textContent.length} chars from vector store`);
    console.log("[searchVectorStore] Content preview:", textContent.substring(0, 200) + "...");

    return textContent;
  } catch (error) {
    console.error("[searchVectorStore] Error:", error);
    return "";
  }
}

/**
 * Retrieve document context from user's OpenAI vector stores
 */
export async function retrieveVectorStoreContext(
  supabaseClient: Record<string, unknown>,
  userId: string,
  query: string
): Promise<string> {
  try {
    console.log("[retrieveVectorStoreContext] Starting vector store search for user:", userId);
    console.log("[retrieveVectorStoreContext] Query:", query.substring(0, 100) + "...");

    // Get user's vector store IDs
    const fromFn = (supabaseClient as { from: (table: string) => unknown }).from("user_vector_stores") as {
      select: (fields: string) => { eq: (field: string, value: string) => { single: () => Promise<{ data: Record<string, string> | null; error: { message: string } | null }> } };
    };
    const { data: stores, error } = await fromFn
      .select("core_store_id")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.log("[retrieveVectorStoreContext] Database error:", error.message);
      return "";
    }

    if (!stores?.core_store_id) {
      console.log("[retrieveVectorStoreContext] No vector stores found for user");
      return "";
    }

    console.log(`[retrieveVectorStoreContext] Found core store: ${stores.core_store_id}`);

    // Search the core store (where uploaded documents go)
    const content = await searchVectorStore(stores.core_store_id, query);

    if (!content) {
      console.log("[retrieveVectorStoreContext] No content found in vector store");
      return "";
    }

    console.log(`[retrieveVectorStoreContext] Retrieved ${content.length} chars of document content`);

    return `
<UPLOADED_DOCUMENTS_CONTEXT>
The following content was found in the user's uploaded documents:

${content}
</UPLOADED_DOCUMENTS_CONTEXT>`;
  } catch (error) {
    console.error("[retrieveVectorStoreContext] Error:", error);
    return "";
  }
}

/**
 * Generate embedding for semantic search using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[generateEmbedding] Error:', response.status, errorText);
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Retrieve relevant context using semantic search (embeddings)
 * This finds the most relevant documents based on query similarity
 */
export async function retrieveSemanticContext(
  supabaseClient: Record<string, unknown>,
  userId: string,
  query: string
): Promise<{ content: string; sources: string[] }> {
  try {
    console.log('[retrieveSemanticContext] Generating embedding for query...');

    // Generate embedding for the user's query
    const queryEmbedding = await generateEmbedding(query);
    console.log('[retrieveSemanticContext] Embedding generated, searching documents...');

    // Use the match_user_documents function for semantic search
    const rpcFn = (supabaseClient as { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> }).rpc;
    const { data: matches, error } = await rpcFn.call(supabaseClient,
      "match_user_documents",
      {
        query_embedding: queryEmbedding,
        match_user_id: userId,
        match_count: 5, // Get top 5 most relevant chunks
      }
    );

    if (error) {
      console.error("[retrieveSemanticContext] Error matching documents:", error);
      return { content: "", sources: [] };
    }

    if (!matches || matches.length === 0) {
      console.log('[retrieveSemanticContext] No semantic matches found');
      return { content: "", sources: [] };
    }

    console.log(`[retrieveSemanticContext] Found ${matches.length} semantic matches`);

    // Combine relevant chunks with similarity scores
    const contextParts = matches.map((match: Record<string, unknown>) => match.content as string);
    const sources = matches.map((match: Record<string, unknown>, idx: number) =>
      `Source ${idx + 1} (relevance: ${((match.similarity as number) * 100).toFixed(1)}%)`
    );

    const combinedContext = `
<SEMANTIC_CONTEXT>
The following information was retrieved based on relevance to the user's question:

${contextParts.join("\n\n---\n\n")}
</SEMANTIC_CONTEXT>`;

    return { content: combinedContext, sources };
  } catch (error) {
    console.error("[retrieveSemanticContext] Error:", error);
    return { content: "", sources: [] };
  }
}

/**
 * Retrieve user's structured knowledge base context
 * This gets all current brand information organized by category
 */
export async function retrieveUserContext(
  supabaseClient: Record<string, unknown>,
  userId: string,
  _query: string,
  minimal: boolean = false
): Promise<string> {
  try {
    console.log(`[retrieveUserContext] Fetching knowledge for user (${minimal ? 'minimal' : 'full'}):`, userId);

    // For minimal mode, only get essential fields for current conversation
    const selectFields = minimal
      ? 'field_identifier, content'  // Just the basics for field extraction
      : 'field_identifier, category, content, subcategory';  // Full context

    // Get knowledge base entries for this user
    // Note: variable shadows outer parameter intentionally — the outer `_query` is the user message, unused here
    const dbQuery = ((supabaseClient as { from: (table: string) => unknown }).from('user_knowledge_base') as Record<string, Function>)
      .select(selectFields)
      .eq('user_id', userId)
      .eq('is_current', true)
      .not('content', 'is', null)
      .gt('content', ''); // Only entries with content

    // In minimal mode, limit to most recent entries
    if (minimal) {
      dbQuery.limit(10).order('updated_at', { ascending: false });
    }

    const { data: entries, error } = await dbQuery;

    if (error) {
      console.error('[retrieveUserContext] Error fetching knowledge:', error);
      return '';
    }

    if (!entries || entries.length === 0) {
      console.log('[retrieveUserContext] No knowledge base entries found');
      return '';
    }

    console.log(`[retrieveUserContext] Found ${entries.length} knowledge entries`);

    // Group by category for better organization
    const byCategory: Record<string, Array<Record<string, string>>> = {};
    entries.forEach((entry: Record<string, string>) => {
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = [];
      }
      byCategory[entry.category].push(entry);
    });

    // Category display names for better readability
    const categoryLabels: Record<string, string> = {
      'insights': 'CUSTOMER INSIGHTS (from Interactive Insight Module)',
      'canvas': 'BRAND CANVAS',
      'avatar': 'CUSTOMER AVATAR',
      'diagnostic': 'BRAND DIAGNOSTIC',
      'copy': 'BRAND COPY',
    };

    // Build context string with descriptive labels
    const contextParts: string[] = ['USER BRAND KNOWLEDGE BASE:'];

    for (const [category, categoryEntries] of Object.entries(byCategory)) {
      const categoryLabel = categoryLabels[category] || category.toUpperCase();
      contextParts.push(`\n${categoryLabel}:`);
      categoryEntries.forEach(entry => {
        const label = getFieldLabel(entry.field_identifier, category);
        contextParts.push(`- ${label}: ${entry.content}`);
      });
    }

    const context = contextParts.join('\n');
    console.log(`[retrieveUserContext] Generated context (${context.length} chars)`);

    return context;
  } catch (error) {
    console.error('[retrieveUserContext] Error:', error);
    return '';
  }
}

/**
 * Human-readable labels for field identifiers used in knowledge base context
 */
const FIELD_LABELS: Record<string, string> = {
  'insight_buyer_intent': 'Buyer Intent (what customers search for)',
  'insight_buyer_motivation': 'Buyer Motivation (psychological drivers)',
  'insight_shopper_type': 'Shopper Type (behavioral category)',
  'insight_demographics': 'Relevant Demographics',
  'insight_search_terms': 'Search Terms Analyzed',
  'insight_industry': 'Industry/Niche',
  'insight_intent_analysis': 'AI Intent Analysis',
  'empathy_emotional_triggers': 'Emotional Triggers',
  'empathy_trigger_responses': 'Trigger Assessment Responses',
  'empathy_trigger_profile': 'Emotional Trigger Profile',
  'empathy_assessment_completed': 'Assessment Status',
  'canvas_brand_purpose': 'Brand Purpose',
  'canvas_brand_vision': 'Brand Vision',
  'canvas_brand_mission': 'Brand Mission',
  'canvas_brand_values': 'Brand Values',
  'canvas_positioning_statement': 'Positioning Statement',
  'canvas_value_proposition': 'Value Proposition',
  'canvas_brand_personality': 'Brand Personality',
  'canvas_brand_voice': 'Brand Voice',
};

/**
 * Get human-readable label for a field identifier
 */
function getFieldLabel(fieldIdentifier: string, category: string): string {
  if (FIELD_LABELS[fieldIdentifier]) {
    return FIELD_LABELS[fieldIdentifier];
  }

  return fieldIdentifier
    .replace(`${category}_`, '')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

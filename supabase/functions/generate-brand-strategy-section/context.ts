import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { openAIApiKey, USER_CONTEXT_MATCH_COUNT } from './config.ts';

// ============================================================================
// USER DATA SEMANTIC RETRIEVAL
// ============================================================================

const embeddingCache = new Map<string, number[]>();

export async function generateEmbedding(text: string): Promise<number[]> {
  const cacheKey = text.substring(0, 200).toLowerCase().trim();
  if (embeddingCache.has(cacheKey)) {
    console.log(`[generateEmbedding] Cache hit for: "${cacheKey.substring(0, 50)}..."`);
    return embeddingCache.get(cacheKey)!;
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error('Invalid embedding response: no embeddings returned');
  }

  const embedding = data.data[0].embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Invalid embedding response: embedding is not a valid array');
  }

  embeddingCache.set(cacheKey, embedding);
  return embedding;
}

export async function retrieveUserContext(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
  query: string,
  matchCount: number = USER_CONTEXT_MATCH_COUNT
): Promise<string> {
  try {
    const embedding = await generateEmbedding(query);

    const [docResult, kbResult] = await Promise.all([
      supabaseClient.rpc('match_user_documents', {
        query_embedding: embedding,
        match_user_id: userId,
        match_count: matchCount,
      }),
      supabaseClient.rpc('match_user_knowledge', {
        query_embedding: embedding,
        p_user_id: userId,
        match_count: matchCount,
        match_threshold: 0.5,
      }),
    ]);

    const chunks: Array<{ content: string; similarity: number }> = [];

    if (docResult.data && !docResult.error) {
      for (const match of docResult.data) {
        if (match.content && typeof match.similarity === 'number') {
          chunks.push({ content: String(match.content), similarity: match.similarity });
        }
      }
    }

    if (kbResult.data && !kbResult.error) {
      for (const match of kbResult.data) {
        if (match.content && typeof match.similarity === 'number') {
          chunks.push({ content: String(match.content), similarity: match.similarity });
        }
      }
    }

    chunks.sort((a, b) => b.similarity - a.similarity);
    return chunks.slice(0, matchCount).map(c => c.content).join('\n\n');
  } catch (error) {
    console.error('[retrieveUserContext] Error:', error);
    return '';
  }
}

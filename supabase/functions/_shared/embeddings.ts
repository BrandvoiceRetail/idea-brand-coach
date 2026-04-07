/**
 * Shared embedding utilities for pgvector RAG.
 *
 * Generates text-embedding-ada-002 embeddings via OpenAI API.
 * Phase 4 will swap this to Voyage AI — only this file needs to change.
 */

const EMBEDDING_MODEL = 'text-embedding-ada-002';
const EMBEDDING_DIMENSION = 1536;
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';

/**
 * Generate a single embedding vector for a text string.
 * Returns a float[] of length 1536 (ada-002 dimension).
 *
 * Throws on API failure so callers can handle retries.
 */
export async function generateEmbedding(
  text: string,
  openaiApiKey: string
): Promise<number[]> {
  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding generation failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a single batch request.
 * OpenAI supports batched inputs for efficiency.
 *
 * Returns an array of float[] in the same order as the input texts.
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  openaiApiKey: string
): Promise<number[][]> {
  if (texts.length === 0) return [];

  // OpenAI batch limit is ~2048 inputs; we'll chunk at 100 for safety
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Batch embedding failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    // OpenAI returns embeddings sorted by index
    const sorted = data.data.sort((a: any, b: any) => a.index - b.index);
    allEmbeddings.push(...sorted.map((d: any) => d.embedding));
  }

  return allEmbeddings;
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSION };

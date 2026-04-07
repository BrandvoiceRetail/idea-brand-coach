/**
 * Chapter Content RAG Helper
 *
 * Queries the IDEA Framework book content from pgvector
 * to retrieve chapter summaries, excerpts, and key concepts.
 */

import { supabase } from '@/integrations/supabase/client';
import { ChapterId, ChapterSummary, DEFAULT_BOOK_STRUCTURE } from '@/types/chapter';

/**
 * Query chapter content from RAG vector store
 *
 * Retrieves chapter summaries, key concepts, and relevant excerpts
 * from the IDEA Framework book stored in pgvector.
 *
 * @param chapterId - Chapter identifier to query
 * @returns Promise resolving to chapter summary with excerpts
 * @throws Error if query fails or chapter not found
 */
export async function queryChapterContent(
  chapterId: ChapterId
): Promise<ChapterSummary> {
  // Find chapter metadata from default structure
  const chapter = DEFAULT_BOOK_STRUCTURE.chapters.find(ch => ch.id === chapterId);

  if (!chapter) {
    throw new Error(`Chapter not found: ${chapterId}`);
  }

  console.log(`[queryChapterContent] Querying RAG for chapter: ${chapter.title}`);

  // Construct query to retrieve chapter-specific content
  const query = `
Retrieve information about "${chapter.title}" from the IDEA Framework book.
Include:
- Chapter summary and main concepts
- Key principles and frameworks
- Important excerpts and examples
- Learning objectives and takeaways

Chapter context:
- Number: ${chapter.number}
- Category: ${chapter.category.toUpperCase()}
- Focus areas: ${chapter.key_questions.join(', ')}
  `.trim();

  try {
    // Call edge function to query pgvector for chapter content
    const { data, error } = await supabase.functions.invoke('idea-framework-consultant-claude', {
      body: {
        message: query,
        context: `Searching for Chapter ${chapter.number}: ${chapter.title}`,
        // Empty chat history since we want fresh chapter content
        chat_history: []
      }
    });

    if (error) {
      console.error('[queryChapterContent] Edge function error:', error);
      throw new Error(`Failed to query chapter content: ${error.message}`);
    }

    if (!data?.response) {
      throw new Error('No response received from RAG query');
    }

    console.log(`[queryChapterContent] Retrieved content for ${chapter.title} (${data.response.length} chars)`);

    // Parse response into structured ChapterSummary
    const summary = parseChapterResponse(chapter, data.response, data.sources || []);

    return summary;
  } catch (error) {
    console.error('[queryChapterContent] Error:', error);
    throw error instanceof Error
      ? error
      : new Error('Unknown error querying chapter content');
  }
}

/**
 * Parse RAG response into structured ChapterSummary
 *
 * Extracts key concepts, excerpts, and summary from the RAG response text.
 * Uses heuristics to identify different sections in the response.
 *
 * @param chapter - Chapter metadata
 * @param responseText - Raw response from RAG
 * @param sources - Source references from RAG
 * @returns Structured ChapterSummary object
 */
function parseChapterResponse(
  chapter: { id: ChapterId; title: string; number: number },
  responseText: string,
  sources: string[]
): ChapterSummary {
  // Extract key concepts (look for bullet points, numbered lists, or emphasized terms)
  const keyConcepts = extractKeyConcepts(responseText);

  // Extract excerpts (look for quotes or distinct paragraphs)
  const excerpts = extractExcerpts(responseText);

  return {
    chapter_id: chapter.id,
    title: chapter.title,
    summary: responseText,
    key_concepts: keyConcepts,
    excerpts,
    sources
  };
}

/**
 * Extract key concepts from RAG response text
 *
 * Looks for:
 * - Lines starting with bullet points (-, *, •)
 * - Numbered list items
 * - Lines with CAPITALIZED terms
 *
 * @param text - RAG response text
 * @returns Array of key concept strings
 */
function extractKeyConcepts(text: string): string[] {
  const concepts: string[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Match bullet points
    if (/^[-*•]\s+(.+)$/.test(trimmed)) {
      const match = trimmed.match(/^[-*•]\s+(.+)$/);
      if (match) {
        concepts.push(match[1]);
      }
    }

    // Match numbered lists
    if (/^\d+\.\s+(.+)$/.test(trimmed)) {
      const match = trimmed.match(/^\d+\.\s+(.+)$/);
      if (match) {
        concepts.push(match[1]);
      }
    }

    // Stop after 10 concepts to avoid noise
    if (concepts.length >= 10) break;
  }

  // If no structured concepts found, extract first few sentences
  if (concepts.length === 0) {
    const sentences = text
      .split(/[.!?]\s+/)
      .filter(s => s.length > 20 && s.length < 200)
      .slice(0, 5);
    concepts.push(...sentences);
  }

  return concepts;
}

/**
 * Extract excerpts from RAG response text
 *
 * Looks for:
 * - Quoted text
 * - Distinct paragraphs (separated by blank lines)
 * - Sections with clear topical boundaries
 *
 * @param text - RAG response text
 * @returns Array of excerpt strings
 */
function extractExcerpts(text: string): string[] {
  const excerpts: string[] = [];

  // Extract quoted text
  const quoteMatches = text.matchAll(/"([^"]+)"/g);
  for (const match of quoteMatches) {
    if (match[1].length > 30) {
      excerpts.push(match[1]);
    }
  }

  // If no quotes, split into paragraphs and take meaningful ones
  if (excerpts.length === 0) {
    const paragraphs = text
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 100 && p.length < 800);

    // Take up to 3 representative paragraphs
    excerpts.push(...paragraphs.slice(0, 3));
  }

  return excerpts.slice(0, 5); // Limit to 5 excerpts
}

/**
 * Query multiple chapters in batch
 *
 * Useful for pre-loading chapter content or generating navigation summaries.
 * Queries are executed in parallel for performance.
 *
 * @param chapterIds - Array of chapter IDs to query
 * @returns Promise resolving to array of ChapterSummary objects
 */
export async function queryMultipleChapters(
  chapterIds: ChapterId[]
): Promise<ChapterSummary[]> {
  console.log(`[queryMultipleChapters] Querying ${chapterIds.length} chapters in parallel`);

  try {
    const results = await Promise.all(
      chapterIds.map(chapterId => queryChapterContent(chapterId))
    );

    console.log(`[queryMultipleChapters] Successfully retrieved ${results.length} chapters`);
    return results;
  } catch (error) {
    console.error('[queryMultipleChapters] Error:', error);
    throw error;
  }
}

/**
 * Query chapter content with caching
 *
 * Caches chapter summaries in sessionStorage to reduce RAG queries.
 * Useful for frequently accessed chapters.
 *
 * @param chapterId - Chapter identifier to query
 * @param useCache - Whether to use cached results (default: true)
 * @returns Promise resolving to chapter summary
 */
export async function queryChapterContentCached(
  chapterId: ChapterId,
  useCache: boolean = true
): Promise<ChapterSummary> {
  const cacheKey = `chapter_rag_${chapterId}`;

  // Try cache first
  if (useCache) {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        console.log(`[queryChapterContentCached] Using cached content for ${chapterId}`);
        return JSON.parse(cached) as ChapterSummary;
      }
    } catch (error) {
      console.warn('[queryChapterContentCached] Cache read error:', error);
    }
  }

  // Query fresh content
  const summary = await queryChapterContent(chapterId);

  // Save to cache
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(summary));
  } catch (error) {
    console.warn('[queryChapterContentCached] Cache write error:', error);
  }

  return summary;
}

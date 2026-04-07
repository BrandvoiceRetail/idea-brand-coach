/**
 * Text chunking utilities for pgvector RAG.
 *
 * Splits documents into overlapping chunks suitable for embedding.
 * Uses a recursive character splitter strategy with configurable
 * chunk size and overlap.
 */

export interface ChunkOptions {
  /** Target chunk size in characters (default: 1000) */
  chunkSize?: number;
  /** Overlap between consecutive chunks in characters (default: 200) */
  overlap?: number;
  /** Separators to split on, in priority order */
  separators?: string[];
}

export interface TextChunk {
  content: string;
  index: number;
  metadata?: Record<string, unknown>;
}

const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' ', ''];

/**
 * Split text into overlapping chunks.
 *
 * Strategy:
 * 1. Try to split on paragraph boundaries first (\n\n)
 * 2. Fall back to sentences, then words
 * 3. Maintain overlap between chunks for context continuity
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const {
    chunkSize = 1000,
    overlap = 200,
    separators = DEFAULT_SEPARATORS,
  } = options;

  if (!text || text.trim().length === 0) {
    return [];
  }

  const trimmed = text.trim();

  // If text fits in a single chunk, return it directly
  if (trimmed.length <= chunkSize) {
    return [{ content: trimmed, index: 0 }];
  }

  const chunks: TextChunk[] = [];
  const rawChunks = recursiveSplit(trimmed, chunkSize, separators);

  // Merge small chunks and add overlap
  let currentChunk = '';
  let chunkIndex = 0;

  for (const raw of rawChunks) {
    if (currentChunk.length + raw.length + 1 <= chunkSize) {
      currentChunk = currentChunk ? `${currentChunk}\n${raw}` : raw;
    } else {
      if (currentChunk) {
        chunks.push({ content: currentChunk.trim(), index: chunkIndex++ });
      }
      // Start new chunk with overlap from previous
      if (overlap > 0 && currentChunk) {
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = `${overlapText}\n${raw}`;
      } else {
        currentChunk = raw;
      }
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), index: chunkIndex });
  }

  return chunks;
}

/**
 * Recursively split text using separator hierarchy.
 */
function recursiveSplit(
  text: string,
  maxLength: number,
  separators: string[]
): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  // Try each separator in order
  for (const sep of separators) {
    if (sep === '') {
      // Last resort: hard split at maxLength
      const parts: string[] = [];
      for (let i = 0; i < text.length; i += maxLength) {
        parts.push(text.slice(i, i + maxLength));
      }
      return parts;
    }

    const splits = text.split(sep);
    if (splits.length <= 1) continue;

    // Rebuild chunks from splits
    const result: string[] = [];
    let current = '';

    for (const split of splits) {
      const candidate = current ? `${current}${sep}${split}` : split;
      if (candidate.length <= maxLength) {
        current = candidate;
      } else {
        if (current) result.push(current);
        // If a single split exceeds maxLength, recursively split it
        if (split.length > maxLength) {
          result.push(...recursiveSplit(split, maxLength, separators.slice(separators.indexOf(sep) + 1)));
          current = '';
        } else {
          current = split;
        }
      }
    }

    if (current) result.push(current);
    return result;
  }

  return [text];
}

/**
 * Extract text content from a PDF file blob.
 * Uses a simple text extraction for Deno (no heavy PDF library).
 * For complex PDFs, the text may already be extracted by the caller.
 */
export function extractTextFromPlainContent(
  content: string,
  filename: string
): string {
  // Remove excessive whitespace while preserving paragraph structure
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

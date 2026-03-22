/**
 * ChatStreamParser
 * Parses SSE streams from the consultant edge function.
 * Separated from SupabaseChatService to isolate protocol parsing from state management.
 */

/** Result of parsing a complete SSE stream */
export interface StreamResult {
  fullText: string;
  extractedFields: Array<{
    identifier: string;
    value: unknown;
    confidence: number;
    source: string;
    context?: string;
  }>;
  responseId?: string;
}

/** Callbacks invoked during stream parsing */
export interface StreamCallbacks {
  onTextDelta: (delta: string) => void;
  onExtractedFields: (
    fields: StreamResult['extractedFields']
  ) => void;
  onError: (error: Error) => void;
}

/**
 * Parse an SSE stream from the consultant edge function.
 * Pure protocol parsing -- no database writes or state management.
 *
 * @param reader - ReadableStream reader from the fetch response
 * @param callbacks - Event callbacks for text deltas, fields, and errors
 * @returns Aggregated stream result with full text, extracted fields, and response ID
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: StreamCallbacks
): Promise<StreamResult> {
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let extractedFields: StreamResult['extractedFields'] = [];
  let responseId: string | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;

        try {
          const event = JSON.parse(payload);

          if (event.type === 'text_delta') {
            fullText += event.delta;
            callbacks.onTextDelta(event.delta);
          } else if (event.type === 'extracted_fields') {
            extractedFields = event.fields || [];
            callbacks.onExtractedFields(extractedFields);
          } else if (event.type === 'done') {
            responseId = event.responseId;
          } else if (event.type === 'error') {
            callbacks.onError(new Error(event.message || 'Stream error'));
            return { fullText, extractedFields, responseId };
          }
        } catch {
          // Skip unparseable events
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { fullText, extractedFields, responseId };
}

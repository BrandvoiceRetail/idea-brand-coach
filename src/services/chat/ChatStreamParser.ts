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

/** Sentinel value returned by event handlers to signal early stream termination. */
const EARLY_EXIT = Symbol('EARLY_EXIT');

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

  let chunkCount = 0;
  let eventCount = 0;

  // Table-driven event dispatch — each handler receives the parsed event
  // and returns EARLY_EXIT to signal the stream should stop.
  const eventHandlers: Record<string, (e: Record<string, unknown>) => typeof EARLY_EXIT | void> = {
    text_delta: (e) => {
      fullText += e.delta as string;
      callbacks.onTextDelta(e.delta as string);
    },
    extracted_fields: (e) => {
      extractedFields = (e.fields as StreamResult['extractedFields']) || [];
      callbacks.onExtractedFields(extractedFields);
    },
    done: (e) => {
      responseId = e.responseId as string;
      console.log('[ChatStreamParser] done event received, responseId:', responseId);
    },
    error: (e) => {
      console.error('[ChatStreamParser] error event received:', e.message);
      callbacks.onError(new Error((e.message as string) || 'Stream error'));
      return EARLY_EXIT;
    },
  };

  /** Dispatch a single SSE data line through the handler map. */
  function processLine(line: string): typeof EARLY_EXIT | void {
    if (!line.startsWith('data: ')) return;
    const payload = line.slice(6).trim();
    if (!payload) return;

    try {
      const event = JSON.parse(payload);
      eventCount++;
      const handler = eventHandlers[event.type as string];
      if (handler) return handler(event);
      // Log unhandled event types for debugging
      console.log('[ChatStreamParser] unhandled event type:', event.type);
    } catch {
      console.warn('[ChatStreamParser] unparseable payload:', payload.substring(0, 100));
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunkCount++;
      const decoded = decoder.decode(value, { stream: true });
      buffer += decoded;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const result = processLine(line);
        if (result === EARLY_EXIT) {
          return { fullText, extractedFields, responseId };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  console.log('[ChatStreamParser] Stream complete:', {
    chunks: chunkCount,
    events: eventCount,
    fullTextLength: fullText.length,
    extractedFieldsCount: extractedFields.length,
    hasResponseId: !!responseId,
    fullTextPreview: fullText.substring(0, 100),
  });

  return { fullText, extractedFields, responseId };
}

/**
 * Streaming translation layer: Claude Messages API SSE → client SSE protocol.
 *
 * The client's ChatStreamParser.ts expects these events:
 *   { type: "text_delta", delta: string }
 *   { type: "extracted_fields", fields: [...] }
 *   { type: "done" }
 *   { type: "error", message: string }
 *
 * Claude's streaming events:
 *   content_block_start (type: "text" or "tool_use")
 *   content_block_delta (type: "text_delta" or "input_json_delta")
 *   content_block_stop
 *   message_delta (stop_reason, usage)
 *   message_stop
 *
 * This module translates between the two.
 */

const encoder = new TextEncoder();

/** Emit a client-protocol SSE event. */
function emit(controller: ReadableStreamDefaultController, data: Record<string, unknown>): void {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

interface StreamState {
  hasTextOutput: boolean;
  toolCallName: string;
  toolCallInput: string;
  extractedFieldsCount: number;
  textLength: number;
}

/**
 * Create a ReadableStream that reads from Claude's SSE response
 * and emits client-protocol SSE events.
 */
export function createStreamTranslator(
  claudeResponse: Response,
  startTime: number
): ReadableStream {
  const decoder = new TextDecoder();

  const state: StreamState = {
    hasTextOutput: false,
    toolCallName: '',
    toolCallInput: '',
    extractedFieldsCount: 0,
    textLength: 0,
  };

  return new ReadableStream({
    async start(controller) {
      const reader = claudeResponse.body!.getReader();
      let buffer = '';

      const processLine = (line: string): void => {
        // Claude sends "event: <type>" then "data: <json>" lines
        // We only care about the data lines
        if (!line.startsWith('data: ')) return;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') return;

        try {
          const event = JSON.parse(payload);

          switch (event.type) {
            // Text content streaming
            case 'content_block_start': {
              if (event.content_block?.type === 'tool_use') {
                state.toolCallName = event.content_block.name || '';
                state.toolCallInput = '';
                console.log(`[Stream] Tool use started: ${state.toolCallName}`);
              }
              break;
            }

            case 'content_block_delta': {
              if (event.delta?.type === 'text_delta') {
                // Text content → forward to client
                const text = event.delta.text || '';
                state.hasTextOutput = true;
                state.textLength += text.length;
                emit(controller, { type: 'text_delta', delta: text });
              } else if (event.delta?.type === 'input_json_delta') {
                // Tool input accumulating
                state.toolCallInput += event.delta.partial_json || '';
              }
              break;
            }

            case 'content_block_stop': {
              // If a tool call just finished, parse and emit extracted fields
              if (state.toolCallName === 'extract_brand_fields' && state.toolCallInput) {
                try {
                  const args = JSON.parse(state.toolCallInput);
                  const fields = args.fields || [];
                  state.extractedFieldsCount += fields.length;
                  console.log(`[Stream] Extracted ${fields.length} fields`);
                  emit(controller, { type: 'extracted_fields', fields });
                } catch (e) {
                  console.error('[Stream] Failed to parse tool call input:', e);
                }
              }
              // Reset tool state
              state.toolCallName = '';
              state.toolCallInput = '';
              break;
            }

            case 'message_delta': {
              // Usage info from Claude
              if (event.usage) {
                console.log(`[Usage] Output tokens: ${event.usage.output_tokens}`);
              }
              break;
            }

            case 'message_start': {
              // Log input usage
              if (event.message?.usage) {
                const u = event.message.usage;
                console.log(`[Usage] Input: ${u.input_tokens} (cache_read: ${u.cache_read_input_tokens || 0}, cache_creation: ${u.cache_creation_input_tokens || 0})`);
              }
              break;
            }

            case 'message_stop': {
              // Stream complete — emit fallback text if needed, then done
              if (!state.hasTextOutput) {
                const fallback = state.extractedFieldsCount > 0
                  ? `I found ${state.extractedFieldsCount} field${state.extractedFieldsCount !== 1 ? 's' : ''} from your input and added them to your brand profile. Let me know if you'd like to review or refine any of them!`
                  : `I'm sorry, I wasn't able to generate a response. Could you try rephrasing your message?`;
                console.log('[Stream] No text output — injecting fallback');
                emit(controller, { type: 'text_delta', delta: fallback });
              }

              const elapsed = Date.now() - startTime;
              console.log(`[Stream] Complete in ${elapsed}ms. Text: ${state.textLength} chars, Fields: ${state.extractedFieldsCount}`);
              emit(controller, { type: 'done' });
              break;
            }

            case 'error': {
              console.error('[Stream] Claude error event:', event.error);
              emit(controller, {
                type: 'error',
                message: event.error?.message || 'Claude API error',
              });
              break;
            }
          }
        } catch (parseErr) {
          console.warn('[Stream] Parse error:', parseErr, payload.substring(0, 200));
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            processLine(line);
          }
        }

        // Flush remaining buffer
        if (buffer.trim()) {
          processLine(buffer.trim());
        }
      } catch (err) {
        console.error('[Stream] Error reading Claude stream:', err);
        if (!state.hasTextOutput) {
          emit(controller, {
            type: 'text_delta',
            delta: 'I\'m sorry, something went wrong while generating a response. Please try again.',
          });
        }
        emit(controller, { type: 'error', message: 'Stream interrupted' });
      } finally {
        controller.close();
      }
    },
  });
}

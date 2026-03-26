/**
 * Streaming response builder module.
 * Constructs a ReadableStream that proxies OpenAI SSE events to the client,
 * handles tool call accumulation, field extraction forwarding,
 * tool output submission for conversation chaining, and fallback injection.
 */

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

/** Tracked tool call used for submitting outputs back to OpenAI */
interface StreamedToolCall {
  call_id: string;
  fields_count: number;
}

/** Configuration for building the streaming response */
export interface StreamConfig {
  /** The fetch Response from OpenAI (must be a streaming SSE response) */
  openAIResponse: Response;
  /** Wall-clock start time for performance logging */
  startTime: number;
}

/**
 * Build a ReadableStream that proxies OpenAI SSE events to the client.
 *
 * Responsibilities:
 * - Forward text deltas as `{ type: 'text_delta', delta }` SSE events
 * - Accumulate function call arguments and emit `{ type: 'extracted_fields', fields }` when complete
 * - Submit tool outputs back to OpenAI to keep conversation chain valid
 * - Inject fallback text when the model produces only tool calls with no text
 * - Emit `{ type: 'done', responseId }` when the response is complete
 * - Handle edge cases: buffer flushing, missing response.completed, stream errors
 */
export function buildStreamingResponse(config: StreamConfig): ReadableStream {
  const { openAIResponse, startTime } = config;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let functionCallArgs = '';
  let functionCallName = '';
  let functionCallId = '';
  let streamedResponseId = '';
  let hasTextOutput = false;
  let textDeltaCount = 0;
  let totalTextLength = 0;
  const streamedToolCalls: StreamedToolCall[] = [];

  return new ReadableStream({
    async start(controller) {
      const reader = openAIResponse.body!.getReader();
      let buffer = '';
      let receivedCompletedEvent = false;

      /** Process a single SSE line from OpenAI and forward relevant events to the client. */
      const processLine = async (line: string): Promise<void> => {
        if (!line.startsWith('data: ')) return;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') return;

        try {
          const event = JSON.parse(payload);
          console.log(`[SSE Event] type=${event.type}`);

          // Capture response ID
          if (event.type === 'response.created' && event.response?.id) {
            streamedResponseId = event.response.id;
          }

          // Text delta -> forward to client
          if (event.type === 'response.output_text.delta') {
            hasTextOutput = true;
            textDeltaCount++;
            totalTextLength += (event.delta || '').length;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', delta: event.delta })}\n\n`));
          }

          // Function call arguments accumulating
          if (event.type === 'response.function_call_arguments.delta') {
            functionCallArgs += event.delta || '';
          }
          if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') {
            functionCallName = event.item.name || '';
            functionCallId = event.item.call_id || event.item.id || '';
            functionCallArgs = '';
          }

          // Function call complete -> parse and send extracted fields
          if (event.type === 'response.function_call_arguments.done') {
            let fieldsCount = 0;
            if (functionCallName === 'extract_brand_fields') {
              try {
                const args = JSON.parse(functionCallArgs);
                const fields = args.fields || [];
                fieldsCount = fields.length;
                console.log(`[Field Extraction] Streamed extraction: ${fields.length} fields`);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'extracted_fields', fields })}\n\n`));
              } catch (e) {
                console.error('[Field Extraction] Failed to parse streamed function call:', e);
              }
            }
            // Track for tool output submission
            if (functionCallId) {
              streamedToolCalls.push({ call_id: functionCallId, fields_count: fieldsCount });
            }
            functionCallArgs = '';
            functionCallName = '';
            functionCallId = '';
          }

          // Response completed -> submit tool outputs, then send done signal
          if (event.type === 'response.completed') {
            receivedCompletedEvent = true;
            const usage = event.response?.usage;
            if (usage) {
              const cached = usage.prompt_tokens_details?.cached_tokens || 0;
              console.log(`[Usage] Input: ${usage.input_tokens} (cached: ${cached}), Output: ${usage.output_tokens}`);
            }

            // Submit tool outputs to keep conversation chain valid
            let finalResponseId = streamedResponseId;
            if (streamedToolCalls.length > 0 && streamedResponseId) {
              finalResponseId = await submitToolOutputs(streamedResponseId, streamedToolCalls);
            }

            console.log(`[Streaming Summary] textDeltas: ${textDeltaCount}, textLength: ${totalTextLength}, toolCalls: ${streamedToolCalls.length}, hasTextOutput: ${hasTextOutput}`);

            // Fallback: if model produced only tool calls with no text, inject a summary
            if (!hasTextOutput) {
              const fallback = buildFallbackMessage(streamedToolCalls);
              console.log(`[Streaming] No text output detected — injecting fallback message`);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', delta: fallback })}\n\n`));
            }

            const totalTime = Date.now() - startTime;
            console.log(`[Performance] Streaming complete in ${totalTime}ms`);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', responseId: finalResponseId })}\n\n`));
          }
        } catch (parseErr) {
          console.warn(`[SSE Parse Error] ${parseErr}`, payload.substring(0, 200));
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
            await processLine(line);
          }
        }

        // Flush remaining buffer — the last chunk from OpenAI may not end
        // with a newline, leaving the final event (often response.completed)
        // stuck in the buffer.
        if (buffer.trim()) {
          console.log(`[Streaming] Flushing remaining buffer (${buffer.length} chars)`);
          await processLine(buffer.trim());
        }

        // Safety net: if OpenAI stream ended without a response.completed event,
        // send fallback + done so the client doesn't hang with empty text.
        if (!receivedCompletedEvent) {
          console.warn('[Streaming] OpenAI stream ended without response.completed event');
          if (!hasTextOutput) {
            const fallback = streamedToolCalls.length > 0
              ? `I've processed your input and updated your brand profile. What would you like to work on next?`
              : `I'm sorry, I wasn't able to generate a response. Could you try rephrasing your message?`;
            console.log('[Streaming] Injecting safety-net fallback message');
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', delta: fallback })}\n\n`));
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', responseId: streamedResponseId })}\n\n`));
        }
      } catch (err) {
        console.error('[Streaming] Error reading OpenAI stream:', err);
        // Even on error, send fallback text if we had no text output
        if (!hasTextOutput) {
          const fallback = `I'm sorry, something went wrong while generating a response. Please try again.`;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', delta: fallback })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted' })}\n\n`));
      } finally {
        controller.close();
      }
    }
  });
}

/**
 * Submit tool outputs back to OpenAI to keep the conversation chain valid.
 * Returns the final response ID (may differ from the original if a new response was created).
 */
async function submitToolOutputs(
  streamedResponseId: string,
  toolCalls: StreamedToolCall[]
): Promise<string> {
  try {
    console.log(`[Conversations] Submitting ${toolCalls.length} streamed tool output(s)`);
    const toolOutputs = toolCalls.map(tc => ({
      type: 'function_call_output',
      call_id: tc.call_id,
      output: JSON.stringify({ status: 'ok', fields_count: tc.fields_count }),
    }));
    const toolResp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        previous_response_id: streamedResponseId,
        input: toolOutputs,
        store: true,
        max_output_tokens: 1,
      })
    });
    if (toolResp.ok) {
      const toolData = await toolResp.json();
      const finalId = toolData.id || streamedResponseId;
      console.log(`[Conversations] Streamed tool outputs submitted. New response ID: ${finalId}`);
      return finalId;
    } else {
      console.error(`[Conversations] Failed to submit streamed tool outputs: ${toolResp.status}`);
      return streamedResponseId;
    }
  } catch (toolErr) {
    console.error('[Conversations] Error submitting streamed tool outputs:', toolErr);
    return streamedResponseId;
  }
}

/**
 * Build a fallback message when the model produced only tool calls with no text.
 */
function buildFallbackMessage(toolCalls: StreamedToolCall[]): string {
  if (toolCalls.length > 0) {
    const totalFields = toolCalls.reduce((sum, tc) => sum + tc.fields_count, 0);
    return totalFields > 0
      ? `I found ${totalFields} field${totalFields !== 1 ? 's' : ''} from your input and added them to your brand profile. Let me know if you'd like to review or refine any of them!`
      : `I've processed your input. What would you like to work on next?`;
  }
  return `I'm sorry, I wasn't able to generate a response. Could you try rephrasing your message?`;
}

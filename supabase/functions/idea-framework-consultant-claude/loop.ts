/**
 * Agentic tool loop for the consultant: call Claude, execute memory-tool
 * commands server-side, feed tool_results back, repeat — while keeping the
 * browser's SSE stream open across upstream iterations.
 *
 * Loop policy:
 * - Continues ONLY for memory tool_use. A response whose only tool use is
 *   extract_brand_fields ends the turn (fire-and-forget to the client),
 *   exactly as before the memory tool existed.
 * - Every tool_use id in the assistant turn gets a matching tool_result
 *   (including extraction acks) — the API 400s otherwise.
 * - Bounded: MAX_ITERATIONS upstream calls and a wall-clock deadline; on
 *   either cap the turn finishes with whatever text already streamed.
 * - Memory handler failures become error-string tool_results (is_error),
 *   never exceptions — one bad command doesn't kill the conversation.
 * - Cache breakpoint (BP4) rides the LAST tool_result block and moves each
 *   iteration so continuations reuse the growing prefix.
 */

import {
  createSessionState,
  emit,
  IterationResult,
  SessionStreamState,
  translateOneStream,
} from './stream.ts';
import {
  handleMemoryCommand,
  MemoryCommandInput,
  SupabaseClientLike,
} from '../_shared/memory.ts';

const MAX_ITERATIONS = 4;
const LOOP_DEADLINE_MS = 60_000;

export interface LoopConfig {
  apiKey: string;
  apiUrl: string;
  /** Request body WITHOUT messages/stream — the loop owns those. */
  requestBody: Record<string, unknown>;
  /** Mutable conversation; the loop appends assistant + tool_result turns. */
  messages: Array<{ role: string; content: unknown }>;
  supabaseClient: SupabaseClientLike | null;
  userId: string | null;
  startTime: number;
}

function callClaude(config: LoopConfig, stream: boolean): Promise<Response> {
  return fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...config.requestBody,
      messages: config.messages,
      ...(stream ? { stream: true } : {}),
    }),
  });
}

function shouldContinue(
  result: { stopReason: string | null; memoryToolUses: unknown[] },
  iteration: number,
  config: LoopConfig
): boolean {
  return (
    result.stopReason === 'tool_use' &&
    result.memoryToolUses.length > 0 &&
    iteration < MAX_ITERATIONS - 1 &&
    Date.now() - config.startTime < LOOP_DEADLINE_MS &&
    config.supabaseClient !== null &&
    config.userId !== null
  );
}

interface ExecutableToolUses {
  memoryToolUses: Array<{ id: string; input: Record<string, unknown> }>;
  extractionToolUses: Array<{ id: string }>;
}

/** Execute memory commands and build a tool_result for EVERY tool_use id. */
async function buildToolResults(
  uses: ExecutableToolUses,
  config: LoopConfig
): Promise<Array<Record<string, unknown>>> {
  const toolResults: Array<Record<string, unknown>> = [];

  for (const toolUse of uses.memoryToolUses) {
    let outcome: { result: string; isError: boolean };
    try {
      outcome = await handleMemoryCommand(
        config.supabaseClient as SupabaseClientLike,
        config.userId as string,
        toolUse.input as unknown as MemoryCommandInput
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcome = { result: `Memory error: ${message}`, isError: true };
    }
    console.log(`[Memory] ${String(toolUse.input?.command)} → ${outcome.isError ? 'ERROR' : 'ok'}`);
    toolResults.push({
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: outcome.result,
      ...(outcome.isError ? { is_error: true } : {}),
    });
  }

  for (const toolUse of uses.extractionToolUses) {
    toolResults.push({
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: "Fields received and saved to the founder's brand profile.",
    });
  }

  return toolResults;
}

/**
 * Append the assistant turn + tool_results to the conversation, moving the
 * BP4 cache breakpoint from the previous iteration's last tool_result onto
 * this iteration's last tool_result (max-4-breakpoints budget).
 */
function appendToolTurn(
  config: LoopConfig,
  assistantContent: Array<Record<string, unknown>>,
  toolResults: Array<Record<string, unknown>>,
  previousToolResults: Array<Record<string, unknown>> | null
): Array<Record<string, unknown>> {
  if (previousToolResults && previousToolResults.length > 0) {
    delete previousToolResults[previousToolResults.length - 1].cache_control;
  }
  if (toolResults.length > 0) {
    toolResults[toolResults.length - 1].cache_control = { type: 'ephemeral' };
  }
  config.messages.push({ role: 'assistant', content: assistantContent });
  config.messages.push({ role: 'user', content: toolResults });
  return toolResults;
}

function finalizeStream(
  controller: ReadableStreamDefaultController,
  state: SessionStreamState,
  startTime: number
): void {
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
}

/**
 * Streaming entry point: returns the client-facing SSE stream. The loop
 * runs inside the stream's start() so text flows to the browser while
 * memory operations execute between upstream calls.
 */
export function runAgenticLoop(config: LoopConfig): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const state = createSessionState();
      try {
        let previousToolResults: Array<Record<string, unknown>> | null = null;

        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
          const claudeResponse = await callClaude(config, true);

          if (!claudeResponse.ok) {
            const errorBody = await claudeResponse.text();
            console.error('[Claude] API error:', claudeResponse.status, errorBody.substring(0, 500));
            const errorMessage = claudeResponse.status === 429
              ? 'The AI service is currently rate limited. Please try again in a moment.'
              : 'I\'m sorry, something went wrong. Please try again.';
            if (!state.hasTextOutput) {
              emit(controller, { type: 'text_delta', delta: errorMessage });
            }
            emit(controller, { type: 'done' });
            return;
          }

          const result: IterationResult = await translateOneStream(
            claudeResponse,
            controller,
            state
          );

          if (!shouldContinue(result, iteration, config)) {
            break;
          }

          const toolResults = await buildToolResults(result, config);
          previousToolResults = appendToolTurn(
            config,
            result.assistantContent,
            toolResults,
            previousToolResults
          );
          console.log(`[Loop] Iteration ${iteration + 1}: executed ${result.memoryToolUses.length} memory command(s), continuing`);
        }

        finalizeStream(controller, state, config.startTime);
      } catch (err) {
        console.error('[Loop] Error:', err);
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

export interface NonStreamingResult {
  responseText: string;
  extractedFields: unknown[];
}

/** Non-streaming entry point: same loop policy, JSON in/out. */
export async function runNonStreamingLoop(config: LoopConfig): Promise<NonStreamingResult> {
  let responseText = '';
  let extractedFields: unknown[] = [];
  let previousToolResults: Array<Record<string, unknown>> | null = null;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const claudeResponse = await callClaude(config, false);

    if (!claudeResponse.ok) {
      const errorBody = await claudeResponse.text();
      console.error('[Claude] API error:', claudeResponse.status, errorBody.substring(0, 500));
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const data = await claudeResponse.json();

    const memoryToolUses: Array<{ id: string; input: Record<string, unknown> }> = [];
    const extractionToolUses: Array<{ id: string }> = [];

    for (const block of data.content || []) {
      if (block.type === 'text') {
        responseText += block.text;
      } else if (block.type === 'tool_use' && block.name === 'extract_brand_fields') {
        extractedFields = block.input?.fields || [];
        extractionToolUses.push({ id: block.id });
      } else if (block.type === 'tool_use' && block.name === 'memory') {
        memoryToolUses.push({ id: block.id, input: block.input || {} });
      }
    }

    if (data.usage) {
      const u = data.usage;
      console.log(`[Usage] Input: ${u.input_tokens} (cache_read: ${u.cache_read_input_tokens || 0}), Output: ${u.output_tokens}`);
    }

    if (!shouldContinue({ stopReason: data.stop_reason, memoryToolUses }, iteration, config)) {
      break;
    }

    const toolResults = await buildToolResults({ memoryToolUses, extractionToolUses }, config);
    previousToolResults = appendToolTurn(config, data.content, toolResults, previousToolResults);
    console.log(`[Loop] Iteration ${iteration + 1}: executed ${memoryToolUses.length} memory command(s), continuing`);
  }

  return { responseText, extractedFields };
}

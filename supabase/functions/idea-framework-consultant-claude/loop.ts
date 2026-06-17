/**
 * Agentic tool loop for the consultant: call Claude, execute tool commands
 * server-side, feed tool_results back, repeat — while keeping the browser's SSE
 * stream open across upstream iterations.
 *
 * Loop policy:
 * - Continues ONLY for a 'continue' tool_use (today: memory). A response whose
 *   only tool use is extract_brand_fields (a 'terminal' tool) ends the turn
 *   (fire-and-forget to the client), exactly as before the memory tool existed.
 * - Every tool_use id in the assistant turn gets a matching tool_result
 *   (including extraction acks) — the API 400s otherwise.
 * - Bounded: MAX_ITERATIONS upstream calls and a wall-clock deadline; on
 *   either cap the turn finishes with whatever text already streamed.
 * - Tool handler failures become error-string tool_results (is_error),
 *   never exceptions — one bad command doesn't kill the conversation.
 * - Cache breakpoint (BP4) rides the LAST tool_result block and moves each
 *   iteration so continuations reuse the growing prefix.
 *
 * ADR Phase 1: tool dispatch is flag-gated. `LoopConfig.toolLoopEnabled` ON
 * routes through the registry (registry.ts) — the extension seam for future
 * MCP-backed tools; OFF (default) uses the original hardcoded memory+extraction
 * branches (byte-identical rollback). Either way every upstream call is timed
 * and emits a `consultant_llm_latency` record (telemetry.ts), and each entry
 * point emits one `consultant_handler_latency` record on completion.
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
import { getToolEntry, ToolContext } from './registry.ts';
import { emitHandlerLatency, emitLlmLatency, makeTtftRecorder } from './telemetry.ts';

const MAX_ITERATIONS = 4;
const LOOP_DEADLINE_MS = 60_000;
const DEFAULT_MODEL = 'claude-sonnet-4-6';

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
  /**
   * ADR Phase 1 flag. When true the loop dispatches tools through the registry
   * (registry.ts) — the extension seam for future MCP-backed tools. When false
   * (default) it uses the original hardcoded memory+extraction branches, which
   * are byte-identical for the two built-in tools. Optional so existing tests
   * (and any caller) keep the prior behavior without change.
   */
  toolLoopEnabled?: boolean;
  /** Model id for latency telemetry (display only — request body owns the call). */
  model?: string;
  /** Best-effort ISO country for latency telemetry; null/undefined when absent. */
  country?: string | null;
}

/**
 * One timed Anthropic call. Emits `consultant_llm_latency` for every call
 * (success or failure). `iteration` is 1-based; `ttftMs` is supplied by the
 * caller for streamed calls (the loop knows when the first token arrives).
 */
async function callClaude(
  config: LoopConfig,
  stream: boolean,
  overrides: Record<string, unknown> = {},
  iteration = 1,
  ttftFor?: () => number | null
): Promise<Response> {
  const start = Date.now();
  let response: Response;
  try {
    response = await fetch(config.apiUrl, {
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
        ...overrides,
      }),
    });
  } catch (err) {
    emitLlmLatency({
      duration_ms: Date.now() - start,
      ttft_ms: null,
      ok: false,
      iteration,
      model: config.model ?? DEFAULT_MODEL,
      country: config.country ?? null,
    });
    throw err;
  }
  // Non-streamed calls have their full duration here; streamed calls measure
  // headers-received latency (TTFT, if any, is recorded separately by caller).
  emitLlmLatency({
    duration_ms: Date.now() - start,
    ttft_ms: ttftFor ? ttftFor() : null,
    ok: response.ok,
    iteration,
    model: config.model ?? DEFAULT_MODEL,
    country: config.country ?? null,
  });
  return response;
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

/** Fixed ack for terminal (fire-and-forget) tools like extraction. */
const EXTRACTION_ACK = "Fields received and saved to the founder's brand profile.";

/**
 * Execute tool commands and build a tool_result for EVERY tool_use id (the API
 * 400s on a missing id). Two equivalent paths:
 *
 *  - flag OFF (default): original hardcoded memory + extraction branches.
 *  - flag ON: dispatch each tool_use through registry.ts so future MCP-backed
 *    'continue' tools execute the same way without editing this function.
 *
 * Both paths emit identical tool_result content for the two built-in tools.
 */
async function buildToolResults(
  uses: ExecutableToolUses,
  config: LoopConfig
): Promise<Array<Record<string, unknown>>> {
  if (config.toolLoopEnabled) {
    return buildToolResultsViaRegistry(uses, config);
  }

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
      content: EXTRACTION_ACK,
    });
  }

  return toolResults;
}

/**
 * Registry-driven dispatch (flag ON). 'continue' tools run their execute();
 * 'terminal' tools get the fixed ack. Unknown tools — never advertised, so a
 * defensive case only — get a clear is_error tool_result instead of crashing.
 */
async function buildToolResultsViaRegistry(
  uses: ExecutableToolUses,
  config: LoopConfig
): Promise<Array<Record<string, unknown>>> {
  const ctx: ToolContext = {
    supabaseClient: config.supabaseClient,
    userId: config.userId,
  };
  const toolResults: Array<Record<string, unknown>> = [];

  for (const toolUse of uses.memoryToolUses) {
    const entry = getToolEntry('memory');
    const outcome = entry?.execute
      ? await entry.execute(toolUse.input, ctx)
      : { content: 'Tool unavailable.', isError: true };
    console.log(`[Tool] memory(${String(toolUse.input?.command)}) → ${outcome.isError ? 'ERROR' : 'ok'}`);
    toolResults.push({
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: outcome.content,
      ...(outcome.isError ? { is_error: true } : {}),
    });
  }

  for (const toolUse of uses.extractionToolUses) {
    toolResults.push({
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: EXTRACTION_ACK,
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
      const ttft = makeTtftRecorder(config.startTime);
      state.onFirstText = ttft.mark;
      let callCount = 0; // Anthropic calls made — handler-latency iteration_count
      let ok = true;
      try {
        let previousToolResults: Array<Record<string, unknown>> | null = null;
        let lastResult: IterationResult | null = null;

        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
          callCount++;
          const claudeResponse = await callClaude(config, true, {}, callCount, ttft.value);

          if (!claudeResponse.ok) {
            ok = false;
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
          lastResult = result;

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

        // A turn can end with ONLY tool calls (e.g. a first-session memory
        // bootstrap eats every iteration) — without this the user gets the
        // apology fallback even though the turn worked. Honor any un-executed
        // tool calls from the final response, then compel one tool-free,
        // text-only reply. Bounded: exactly one extra upstream call.
        if (!state.hasTextOutput) {
          if (
            lastResult &&
            lastResult.stopReason === 'tool_use' &&
            (lastResult.memoryToolUses.length > 0 || lastResult.extractionToolUses.length > 0) &&
            config.supabaseClient !== null &&
            config.userId !== null
          ) {
            const toolResults = await buildToolResults(lastResult, config);
            previousToolResults = appendToolTurn(
              config,
              lastResult.assistantContent,
              toolResults,
              previousToolResults
            );
          }
          console.log('[Loop] No text after tool iterations — forcing one text-only turn');
          callCount++;
          const finalResponse = await callClaude(config, true, { tool_choice: { type: 'none' } }, callCount, ttft.value);
          if (finalResponse.ok) {
            await translateOneStream(finalResponse, controller, state);
          } else {
            ok = false;
            const errorBody = await finalResponse.text();
            console.error('[Loop] Forced text turn failed:', finalResponse.status, errorBody.substring(0, 300));
          }
        }

        finalizeStream(controller, state, config.startTime);
      } catch (err) {
        ok = false;
        console.error('[Loop] Error:', err);
        if (!state.hasTextOutput) {
          emit(controller, {
            type: 'text_delta',
            delta: 'I\'m sorry, something went wrong while generating a response. Please try again.',
          });
        }
        emit(controller, { type: 'error', message: 'Stream interrupted' });
      } finally {
        emitHandlerLatency({
          duration_ms: Date.now() - config.startTime,
          ttft_ms: ttft.value(),
          ok,
          iteration_count: callCount,
          tool_loop: config.toolLoopEnabled === true,
          model: config.model ?? DEFAULT_MODEL,
          country: config.country ?? null,
        });
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
  let callCount = 0; // Anthropic calls made — handler-latency iteration_count
  let ok = true;
  let lastPending: {
    assistantContent: Array<Record<string, unknown>>;
    memoryToolUses: Array<{ id: string; input: Record<string, unknown> }>;
    extractionToolUses: Array<{ id: string }>;
    stopReason: string | null;
  } | null = null;

  try {
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    callCount++;
    const claudeResponse = await callClaude(config, false, {}, callCount);

    if (!claudeResponse.ok) {
      ok = false;
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

    lastPending = {
      assistantContent: data.content || [],
      memoryToolUses,
      extractionToolUses,
      stopReason: data.stop_reason ?? null,
    };

    if (!shouldContinue({ stopReason: data.stop_reason, memoryToolUses }, iteration, config)) {
      break;
    }
    lastPending = null; // this turn's tool uses get executed below

    const toolResults = await buildToolResults({ memoryToolUses, extractionToolUses }, config);
    previousToolResults = appendToolTurn(config, data.content, toolResults, previousToolResults);
    console.log(`[Loop] Iteration ${iteration + 1}: executed ${memoryToolUses.length} memory command(s), continuing`);
  }

  // Same guarantee as the streaming path: a tool-only turn still ends with text.
  if (!responseText) {
    if (
      lastPending &&
      lastPending.stopReason === 'tool_use' &&
      (lastPending.memoryToolUses.length > 0 || lastPending.extractionToolUses.length > 0) &&
      config.supabaseClient !== null &&
      config.userId !== null
    ) {
      const toolResults = await buildToolResults(lastPending, config);
      previousToolResults = appendToolTurn(config, lastPending.assistantContent, toolResults, previousToolResults);
    }
    console.log('[Loop] No text after tool iterations — forcing one text-only turn');
    callCount++;
    const finalResponse = await callClaude(config, false, { tool_choice: { type: 'none' } }, callCount);
    if (finalResponse.ok) {
      const data = await finalResponse.json();
      for (const block of data.content || []) {
        if (block.type === 'text') responseText += block.text;
      }
    } else {
      ok = false;
      const errorBody = await finalResponse.text();
      console.error('[Loop] Forced text turn failed:', finalResponse.status, errorBody.substring(0, 300));
    }
  }

  return { responseText, extractedFields };
  } catch (err) {
    ok = false;
    throw err;
  } finally {
    emitHandlerLatency({
      duration_ms: Date.now() - config.startTime,
      ttft_ms: null, // non-streamed: no token-level timing
      ok,
      iteration_count: callCount,
      tool_loop: config.toolLoopEnabled === true,
      model: config.model ?? DEFAULT_MODEL,
      country: config.country ?? null,
    });
  }
}

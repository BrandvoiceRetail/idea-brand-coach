/**
 * Streaming translation layer: Claude Messages API SSE → client SSE protocol.
 *
 * The client's ChatStreamParser.ts expects these events:
 *   { type: "text_delta", delta: string }
 *   { type: "extracted_fields", fields: [...] }
 *   { type: "memory_activity", action: "reading" | "updating" }
 *   { type: "done" }
 *   { type: "error", message: string }
 *
 * Refactored for the memory-tool agentic loop: translateOneStream processes
 * exactly ONE upstream Claude stream against a caller-owned controller — it
 * never closes the controller and never emits `done`. The loop in loop.ts
 * owns the client stream across iterations and finalizes it; this module
 * accumulates the assistant content blocks (with tool_use ids) the loop
 * needs to replay the turn with tool_results.
 */

import { categorizeToolUse } from './registry.ts';

const encoder = new TextEncoder();

/** Emit a client-protocol SSE event. */
export function emit(
  controller: ReadableStreamDefaultController,
  data: Record<string, unknown>
): void {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

/** State carried across ALL loop iterations of one client stream. */
export interface SessionStreamState {
  hasTextOutput: boolean;
  extractedFieldsCount: number;
  textLength: number;
  /**
   * Optional time-to-first-token hook. Invoked once, on the first text byte
   * forwarded to the client, so the loop can record TTFT for telemetry. No-op
   * when unset (keeps the stream layer free of telemetry concerns).
   */
  onFirstText?: () => void;
}

export function createSessionState(): SessionStreamState {
  return { hasTextOutput: false, extractedFieldsCount: 0, textLength: 0 };
}

export interface ToolUseBlock {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface IterationResult {
  /** stop_reason from message_delta ('end_turn', 'tool_use', 'max_tokens', …). */
  stopReason: string | null;
  /** Replayable assistant content blocks (text + tool_use, in order). */
  assistantContent: Array<Record<string, unknown>>;
  memoryToolUses: ToolUseBlock[];
  extractionToolUses: ToolUseBlock[];
  /** MCP-backed 'continue' tool uses (Phase 2), dispatched by name via the registry. */
  mcpToolUses: ToolUseBlock[];
  /** Anthropic token usage for THIS upstream call (for credit metering; cache-inclusive input). */
  inputTokens?: number;
  outputTokens?: number;
}

/** Per-block accumulator while a content block is streaming. */
interface BlockAccumulator {
  type: string;
  id: string;
  name: string;
  inputJson: string;
  text: string;
}

/**
 * Read one Claude SSE stream, forwarding client events to the caller-owned
 * controller and accumulating the assistant turn. Throws on transport errors
 * (the loop owns fallback messaging). Does NOT close the controller.
 */
export async function translateOneStream(
  claudeResponse: Response,
  controller: ReadableStreamDefaultController,
  state: SessionStreamState
): Promise<IterationResult> {
  const decoder = new TextDecoder();
  const reader = claudeResponse.body!.getReader();
  let buffer = '';

  const result: IterationResult = {
    stopReason: null,
    assistantContent: [],
    memoryToolUses: [],
    extractionToolUses: [],
    mcpToolUses: [],
    inputTokens: 0,
    outputTokens: 0,
  };

  const blocks = new Map<number, BlockAccumulator>();

  const finishBlock = (index: number): void => {
    const block = blocks.get(index);
    if (!block) return;
    blocks.delete(index);

    if (block.type === 'text') {
      // Empty text blocks are not replayable (API rejects them).
      if (block.text.length > 0) {
        result.assistantContent.push({ type: 'text', text: block.text });
      }
      return;
    }

    if (block.type !== 'tool_use') return;

    let input: Record<string, unknown> = {};
    try {
      input = block.inputJson ? JSON.parse(block.inputJson) : {};
    } catch (e) {
      console.error('[Stream] Failed to parse tool call input:', e);
    }

    result.assistantContent.push({
      type: 'tool_use',
      id: block.id,
      name: block.name,
      input,
    });

    // Bucket via the shared categorizer (registry.ts) so streaming +
    // non-streaming can't drift; each branch still emits its own client event.
    const bucket = categorizeToolUse(block.name);
    if (bucket === 'extraction') {
      const fields = Array.isArray(input.fields) ? input.fields : [];
      state.extractedFieldsCount += fields.length;
      console.log(`[Stream] Extracted ${fields.length} fields`);
      emit(controller, { type: 'extracted_fields', fields });
      result.extractionToolUses.push({ id: block.id, name: block.name, input });
    } else if (bucket === 'memory') {
      const action = input.command === 'view' ? 'reading' : 'updating';
      console.log(`[Stream] Memory tool use: ${String(input.command)}`);
      emit(controller, { type: 'memory_activity', action });
      result.memoryToolUses.push({ id: block.id, name: block.name, input });
    } else if (bucket === 'mcp') {
      // MCP-backed 'continue' tool (Phase 2) — surfaced to the client as tool activity.
      console.log(`[Stream] MCP tool use: ${block.name}`);
      emit(controller, { type: 'tool_activity', tool: block.name });
      result.mcpToolUses.push({ id: block.id, name: block.name, input });
    }
  };

  const processLine = (line: string): void => {
    // Claude sends "event: <type>" then "data: <json>" lines — data only.
    if (!line.startsWith('data: ')) return;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') return;

    try {
      const event = JSON.parse(payload);

      switch (event.type) {
        case 'content_block_start': {
          const contentBlock = event.content_block || {};
          blocks.set(event.index ?? 0, {
            type: contentBlock.type || '',
            id: contentBlock.id || '',
            name: contentBlock.name || '',
            inputJson: '',
            text: '',
          });
          if (contentBlock.type === 'tool_use') {
            console.log(`[Stream] Tool use started: ${contentBlock.name}`);
          }
          break;
        }

        case 'content_block_delta': {
          const block = blocks.get(event.index ?? 0);
          if (event.delta?.type === 'text_delta') {
            const text = event.delta.text || '';
            if (!state.hasTextOutput) state.onFirstText?.();
            state.hasTextOutput = true;
            state.textLength += text.length;
            if (block) block.text += text;
            emit(controller, { type: 'text_delta', delta: text });
          } else if (event.delta?.type === 'input_json_delta') {
            if (block) block.inputJson += event.delta.partial_json || '';
          }
          break;
        }

        case 'content_block_stop': {
          finishBlock(event.index ?? 0);
          break;
        }

        case 'message_delta': {
          if (event.delta?.stop_reason) {
            result.stopReason = event.delta.stop_reason;
          }
          if (event.usage) {
            result.outputTokens = event.usage.output_tokens ?? result.outputTokens;
            console.log(`[Usage] Output tokens: ${event.usage.output_tokens}`);
          }
          break;
        }

        case 'message_start': {
          if (event.message?.usage) {
            const u = event.message.usage;
            result.inputTokens = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
            console.log(`[Usage] Input: ${u.input_tokens} (cache_read: ${u.cache_read_input_tokens || 0}, cache_creation: ${u.cache_creation_input_tokens || 0})`);
          }
          break;
        }

        case 'message_stop': {
          // Finalization (fallback text, done) is owned by the loop.
          break;
        }

        case 'error': {
          console.error('[Stream] Claude error event:', event.error);
          emit(controller, {
            type: 'error',
            message: event.error?.message || 'Claude API error',
          });
          result.stopReason = 'error';
          break;
        }
      }
    } catch (parseErr) {
      // Log the error + payload SIZE only — the raw payload can carry model
      // output / user brand data (no PII in logs).
      console.warn('[Stream] Parse error:', parseErr, `(payload ${payload.length} bytes)`);
    }
  };

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

  if (buffer.trim()) {
    processLine(buffer.trim());
  }

  return result;
}

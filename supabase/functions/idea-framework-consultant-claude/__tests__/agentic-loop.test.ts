import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../_shared/memory.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../_shared/memory')>();
  return {
    ...actual,
    handleMemoryCommand: vi.fn(async () => ({
      result: 'File created successfully at: /memories/founder.md',
      isError: false,
    })),
  };
});

import { translateOneStream, createSessionState } from '../stream';
import { runAgenticLoop, runNonStreamingLoop, LoopConfig } from '../loop';
import { handleMemoryCommand } from '../../_shared/memory';

const encoder = new TextEncoder();

// ── Fixture helpers ─────────────────────────────────────────────────────────

/** Render Claude SSE events as a byte stream wrapped in a Response-like. */
function claudeSSE(events: Array<Record<string, unknown>>): { ok: boolean; body: ReadableStream } {
  const text = events
    .map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)
    .join('');
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    }),
  };
}

function textEvents(text: string, stopReason = 'end_turn'): Array<Record<string, unknown>> {
  return [
    { type: 'message_start', message: { usage: { input_tokens: 100 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: stopReason }, usage: { output_tokens: 10 } },
    { type: 'message_stop' },
  ];
}

function toolUseEvents(
  blocks: Array<{ name: string; id: string; input: Record<string, unknown> }>,
  leadText = 'Let me note that down.'
): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [
    { type: 'message_start', message: { usage: { input_tokens: 100 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: leadText } },
    { type: 'content_block_stop', index: 0 },
  ];
  blocks.forEach((block, i) => {
    const index = i + 1;
    const json = JSON.stringify(block.input);
    events.push(
      { type: 'content_block_start', index, content_block: { type: 'tool_use', id: block.id, name: block.name } },
      { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: json.slice(0, 8) } },
      { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: json.slice(8) } },
      { type: 'content_block_stop', index }
    );
  });
  events.push(
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 50 } },
    { type: 'message_stop' }
  );
  return events;
}

/** Fake controller collecting emitted client SSE events. */
function makeCollector(): { controller: ReadableStreamDefaultController; events: () => Array<Record<string, unknown>> } {
  const chunks: Uint8Array[] = [];
  const controller = {
    enqueue(chunk: Uint8Array) {
      chunks.push(chunk);
    },
    close() {},
    error() {},
  } as unknown as ReadableStreamDefaultController;
  const decoder = new TextDecoder();
  return {
    controller,
    events: () =>
      chunks
        .map((c) => decoder.decode(c))
        .join('')
        .split('\n\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line.replace(/^data: /, ''))),
  };
}

/** Read the loop's client stream to completion, returning parsed events. */
async function readClientStream(stream: ReadableStream): Promise<Array<Record<string, unknown>>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value);
  }
  return buffer
    .split('\n\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line.replace(/^data: /, '')));
}

function makeConfig(overrides: Partial<LoopConfig> = {}): LoopConfig {
  return {
    apiKey: 'test-key',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    requestBody: { model: 'claude-sonnet-4-6', max_tokens: 1500, system: [] },
    messages: [{ role: 'user', content: 'hello' }],
    supabaseClient: {} as LoopConfig['supabaseClient'],
    userId: 'user-1',
    startTime: Date.now(),
    ...overrides,
  };
}

const MEMORY_CREATE = {
  name: 'memory',
  id: 'toolu_mem_1',
  input: { command: 'create', path: '/memories/founder.md', file_text: 'Founder: Sam' },
};

beforeEach(() => {
  vi.mocked(handleMemoryCommand).mockClear();
  vi.mocked(handleMemoryCommand).mockResolvedValue({
    result: 'File created successfully at: /memories/founder.md',
    isError: false,
  });
});

// ── translateOneStream ──────────────────────────────────────────────────────

describe('translateOneStream', () => {
  it('forwards text deltas, captures stop_reason, never emits done', async () => {
    const { controller, events } = makeCollector();
    const state = createSessionState();
    const result = await translateOneStream(
      claudeSSE(textEvents('Hello founder')) as unknown as Response,
      controller,
      state
    );

    expect(result.stopReason).toBe('end_turn');
    expect(result.assistantContent).toEqual([{ type: 'text', text: 'Hello founder' }]);
    expect(state.hasTextOutput).toBe(true);
    const emitted = events();
    expect(emitted).toContainEqual({ type: 'text_delta', delta: 'Hello founder' });
    expect(emitted.find((e) => e.type === 'done')).toBeUndefined();
  });

  it('accumulates tool_use blocks with ids and emits memory_activity / extracted_fields', async () => {
    const { controller, events } = makeCollector();
    const state = createSessionState();
    const result = await translateOneStream(
      claudeSSE(
        toolUseEvents([
          MEMORY_CREATE,
          { name: 'extract_brand_fields', id: 'toolu_ext_1', input: { fields: [{ identifier: 'brand_name' }] } },
        ])
      ) as unknown as Response,
      controller,
      state
    );

    expect(result.stopReason).toBe('tool_use');
    expect(result.memoryToolUses).toHaveLength(1);
    expect(result.memoryToolUses[0]).toMatchObject({ id: 'toolu_mem_1' });
    expect(result.extractionToolUses).toHaveLength(1);
    expect(result.assistantContent.filter((b) => b.type === 'tool_use')).toHaveLength(2);

    const emitted = events();
    expect(emitted).toContainEqual({ type: 'memory_activity', action: 'updating' });
    expect(emitted.find((e) => e.type === 'extracted_fields')).toBeTruthy();
  });

  it('labels memory view commands as reading', async () => {
    const { controller, events } = makeCollector();
    const result = await translateOneStream(
      claudeSSE(
        toolUseEvents([
          { name: 'memory', id: 'toolu_mem_2', input: { command: 'view', path: '/memories/brand.md' } },
        ])
      ) as unknown as Response,
      makeCollector().controller && controller,
      createSessionState()
    );
    expect(result.memoryToolUses[0].input.command).toBe('view');
    expect(events()).toContainEqual({ type: 'memory_activity', action: 'reading' });
  });
});

// ── runAgenticLoop (streaming) ──────────────────────────────────────────────

describe('runAgenticLoop', () => {
  it('executes a memory write across two iterations and finalizes once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(claudeSSE(toolUseEvents([MEMORY_CREATE])))
      .mockResolvedValueOnce(claudeSSE(textEvents("Got it — I'll remember that.")));
    vi.stubGlobal('fetch', fetchMock);

    const config = makeConfig();
    const events = await readClientStream(runAgenticLoop(config));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.mocked(handleMemoryCommand)).toHaveBeenCalledTimes(1);

    // Second call replays assistant turn + tool_result with BP4 on the last result
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const assistantTurn = secondBody.messages.at(-2);
    const toolResultTurn = secondBody.messages.at(-1);
    expect(assistantTurn.role).toBe('assistant');
    expect(assistantTurn.content.some((b: { type: string }) => b.type === 'tool_use')).toBe(true);
    expect(toolResultTurn.role).toBe('user');
    expect(toolResultTurn.content[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'toolu_mem_1',
      content: 'File created successfully at: /memories/founder.md',
    });
    expect(toolResultTurn.content.at(-1).cache_control).toEqual({ type: 'ephemeral' });

    expect(events).toContainEqual({ type: 'memory_activity', action: 'updating' });
    expect(events.filter((e) => e.type === 'done')).toHaveLength(1);
    const text = events.filter((e) => e.type === 'text_delta').map((e) => e.delta).join('');
    expect(text).toContain('Let me note that down.');
    expect(text).toContain("Got it — I'll remember that.");
  });

  it('does NOT continue when the only tool use is extract_brand_fields', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      claudeSSE(
        toolUseEvents([
          { name: 'extract_brand_fields', id: 'toolu_ext_2', input: { fields: [] } },
        ])
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const events = await readClientStream(runAgenticLoop(makeConfig()));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(handleMemoryCommand)).not.toHaveBeenCalled();
    expect(events.filter((e) => e.type === 'done')).toHaveLength(1);
  });

  it('answers EVERY tool_use id when memory and extraction are mixed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        claudeSSE(
          toolUseEvents([
            MEMORY_CREATE,
            { name: 'extract_brand_fields', id: 'toolu_ext_3', input: { fields: [] } },
          ])
        )
      )
      .mockResolvedValueOnce(claudeSSE(textEvents('Saved.')));
    vi.stubGlobal('fetch', fetchMock);

    await readClientStream(runAgenticLoop(makeConfig()));

    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const toolResults = secondBody.messages.at(-1).content;
    const answeredIds = toolResults.map((r: { tool_use_id: string }) => r.tool_use_id).sort();
    expect(answeredIds).toEqual(['toolu_ext_3', 'toolu_mem_1']);
  });

  it('stops at the iteration cap', async () => {
    const fetchMock = vi.fn(async () => claudeSSE(toolUseEvents([MEMORY_CREATE])));
    vi.stubGlobal('fetch', fetchMock);

    const events = await readClientStream(runAgenticLoop(makeConfig()));

    expect(fetchMock).toHaveBeenCalledTimes(4); // MAX_ITERATIONS
    expect(vi.mocked(handleMemoryCommand)).toHaveBeenCalledTimes(3); // no execution after final call
    expect(events.filter((e) => e.type === 'done')).toHaveLength(1);
  });

  it('converts a handler failure into an is_error tool_result and continues', async () => {
    vi.mocked(handleMemoryCommand).mockRejectedValueOnce(new Error('connection reset'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(claudeSSE(toolUseEvents([MEMORY_CREATE])))
      .mockResolvedValueOnce(claudeSSE(textEvents('Noted without memory.')));
    vi.stubGlobal('fetch', fetchMock);

    const events = await readClientStream(runAgenticLoop(makeConfig()));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const toolResult = secondBody.messages.at(-1).content[0];
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain('Memory error: connection reset');
    expect(events.filter((e) => e.type === 'done')).toHaveLength(1);
  });

  it('streams a friendly message when the upstream call fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    });
    vi.stubGlobal('fetch', fetchMock);

    const events = await readClientStream(runAgenticLoop(makeConfig()));

    expect(events[0].type).toBe('text_delta');
    expect(events[0].delta).toContain('rate limited');
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('injects fallback text when the model produced none', async () => {
    const noTextEvents = [
      { type: 'message_start', message: { usage: { input_tokens: 10 } } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 0 } },
      { type: 'message_stop' },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(claudeSSE(noTextEvents)));

    const events = await readClientStream(runAgenticLoop(makeConfig()));
    const text = events.filter((e) => e.type === 'text_delta').map((e) => e.delta).join('');
    expect(text).toContain("wasn't able to generate a response");
  });
});

// ── runNonStreamingLoop ─────────────────────────────────────────────────────

describe('runNonStreamingLoop', () => {
  function jsonResponse(body: Record<string, unknown>): { ok: boolean; json: () => Promise<unknown> } {
    return { ok: true, json: async () => body };
  }

  it('loops on memory tool use and accumulates text across iterations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          stop_reason: 'tool_use',
          content: [
            { type: 'text', text: 'One moment. ' },
            { type: 'tool_use', id: 'toolu_mem_1', name: 'memory', input: MEMORY_CREATE.input },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'All set.' }],
          usage: { input_tokens: 120, output_tokens: 10 },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { responseText } = await runNonStreamingLoop(makeConfig());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(responseText).toBe('One moment. All set.');
    expect(vi.mocked(handleMemoryCommand)).toHaveBeenCalledTimes(1);
  });

  it('returns extracted fields without continuing on extraction-only tool use', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Captured.' },
          { type: 'tool_use', id: 'toolu_ext_1', name: 'extract_brand_fields', input: { fields: [{ identifier: 'brand_name' }] } },
        ],
        usage: { input_tokens: 100, output_tokens: 30 },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { responseText, extractedFields } = await runNonStreamingLoop(makeConfig());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(responseText).toBe('Captured.');
    expect(extractedFields).toHaveLength(1);
  });

  it('throws on upstream error (caught by the edge handler)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'boom',
    }));

    await expect(runNonStreamingLoop(makeConfig())).rejects.toThrow('Claude API error: 500');
  });
});

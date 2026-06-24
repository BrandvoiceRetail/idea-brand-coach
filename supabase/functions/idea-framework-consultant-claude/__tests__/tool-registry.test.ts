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

import { runAgenticLoop, runNonStreamingLoop, LoopConfig } from '../loop';
import { handleMemoryCommand } from '../../_shared/memory';
import { getToolEntry, isContinueTool } from '../registry';
import { resolveCountry, makeTtftRecorder } from '../telemetry';

const encoder = new TextEncoder();

function claudeSSE(events: Array<Record<string, unknown>>): { ok: boolean; body: ReadableStream } {
  const text = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
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
  blocks: Array<{ name: string; id: string; input: Record<string, unknown> }>
): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [
    { type: 'message_start', message: { usage: { input_tokens: 100 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Working on it.' } },
    { type: 'content_block_stop', index: 0 },
  ];
  blocks.forEach((block, i) => {
    const index = i + 1;
    const json = JSON.stringify(block.input);
    events.push(
      { type: 'content_block_start', index, content_block: { type: 'tool_use', id: block.id, name: block.name } },
      { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: json } },
      { type: 'content_block_stop', index }
    );
  });
  events.push(
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 50 } },
    { type: 'message_stop' }
  );
  return events;
}

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

// ── registry shape ──────────────────────────────────────────────────────────

describe('tool registry', () => {
  it('classifies memory as continue and extraction as terminal', () => {
    expect(getToolEntry('memory')?.kind).toBe('continue');
    expect(getToolEntry('extract_brand_fields')?.kind).toBe('terminal');
    expect(isContinueTool('memory')).toBe(true);
    expect(isContinueTool('extract_brand_fields')).toBe(false);
    expect(getToolEntry('does_not_exist')).toBeUndefined();
  });

  it('memory entry executes the memory command handler', async () => {
    const entry = getToolEntry('memory');
    const result = await entry!.execute!(MEMORY_CREATE.input, {
      supabaseClient: {} as LoopConfig['supabaseClient'],
      userId: 'user-1',
      authToken: null,
      mcp: null,
    });
    expect(vi.mocked(handleMemoryCommand)).toHaveBeenCalledTimes(1);
    expect(result.isError).toBe(false);
    expect(result.content).toContain('File created successfully');
  });

  it('memory entry returns an is_error result for an anon caller (no JWT)', async () => {
    const entry = getToolEntry('memory');
    const result = await entry!.execute!(MEMORY_CREATE.input, {
      supabaseClient: null,
      userId: null,
      authToken: null,
      mcp: null,
    });
    expect(result.isError).toBe(true);
    expect(vi.mocked(handleMemoryCommand)).not.toHaveBeenCalled();
  });
});

// ── flag ON routes through the registry, producing identical results ─────────

describe('CONSULTANT_TOOL_LOOP_ENABLED (registry path)', () => {
  it('flag ON executes memory via registry and replays the SAME tool_result content', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(claudeSSE(toolUseEvents([MEMORY_CREATE])))
      .mockResolvedValueOnce(claudeSSE(textEvents('Remembered.')));
    vi.stubGlobal('fetch', fetchMock);

    await readClientStream(runAgenticLoop(makeConfig({ toolLoopEnabled: true })));

    expect(vi.mocked(handleMemoryCommand)).toHaveBeenCalledTimes(1);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const toolResult = secondBody.messages.at(-1).content[0];
    expect(toolResult).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'toolu_mem_1',
      content: 'File created successfully at: /memories/founder.md',
    });
  });

  it('flag OFF (default) still loops memory identically — byte-identical fallback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(claudeSSE(toolUseEvents([MEMORY_CREATE])))
      .mockResolvedValueOnce(claudeSSE(textEvents('Remembered.')));
    vi.stubGlobal('fetch', fetchMock);

    await readClientStream(runAgenticLoop(makeConfig({ toolLoopEnabled: false })));

    const offBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const offResult = offBody.messages.at(-1).content[0];
    expect(offResult.content).toBe('File created successfully at: /memories/founder.md');
  });

  it('flag ON non-streaming routes memory through the registry too', async () => {
    const jsonResponse = (body: Record<string, unknown>) => ({ ok: true, json: async () => body });
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
          content: [{ type: 'text', text: 'Done.' }],
          usage: { input_tokens: 120, output_tokens: 10 },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { responseText } = await runNonStreamingLoop(makeConfig({ toolLoopEnabled: true }));
    expect(responseText).toBe('One moment. Done.');
    expect(vi.mocked(handleMemoryCommand)).toHaveBeenCalledTimes(1);
  });
});

// ── telemetry ───────────────────────────────────────────────────────────────

describe('telemetry', () => {
  it('emits consultant_llm_latency per call and consultant_handler_latency once', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(claudeSSE(toolUseEvents([MEMORY_CREATE])))
      .mockResolvedValueOnce(claudeSSE(textEvents('Hi.')));
    vi.stubGlobal('fetch', fetchMock);

    await readClientStream(runAgenticLoop(makeConfig({ country: 'US' })));

    const lines = logSpy.mock.calls.map((c) => String(c[0]));
    const llm = lines.filter((l) => l.includes('consultant_llm_latency'));
    const handler = lines.filter((l) => l.includes('consultant_handler_latency'));
    expect(llm).toHaveLength(2); // two upstream calls
    expect(handler).toHaveLength(1);
    expect(handler[0]).toContain('"country":"US"');
    expect(handler[0]).toContain('"iteration_count":2');
    logSpy.mockRestore();
  });

  it('resolveCountry reads x-client-country first, falls back to CDN headers, upper-cases', () => {
    const mk = (h: Record<string, string>) => new Request('https://x', { headers: h });
    expect(resolveCountry(mk({ 'x-client-country': 'gb' }))).toBe('GB');
    expect(resolveCountry(mk({ 'cf-ipcountry': 'de' }))).toBe('DE');
    expect(resolveCountry(mk({ 'cloudfront-viewer-country': 'fr' }))).toBe('FR');
    expect(resolveCountry(mk({}))).toBeNull();
  });

  it('makeTtftRecorder records once, ignores later marks', () => {
    const rec = makeTtftRecorder(Date.now() - 100);
    expect(rec.value()).toBeNull();
    rec.mark();
    const first = rec.value();
    expect(first).toBeGreaterThanOrEqual(0);
    rec.mark();
    expect(rec.value()).toBe(first);
  });
});

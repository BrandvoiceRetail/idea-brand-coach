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
import { registerMcpTools, resolveToolEntry, McpToolRegistry } from '../registry';
import { McpClient, McpToolDef } from '../mcpClient';

const encoder = new TextEncoder();

// ── SSE fixture helpers (mirror the agentic-loop fixtures) ───────────────────

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
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Looking that up.' } },
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

/** A McpClient stub whose callTool is observable; never hits the network. */
function stubMcpClient(callImpl?: (name: string, args: Record<string, unknown>) => unknown): McpClient {
  const client = Object.create(McpClient.prototype) as McpClient;
  // @ts-expect-error — set private field for the stub
  client.initialized = true;
  (client as unknown as { callTool: unknown }).callTool = vi.fn(async (name: string, args: Record<string, unknown>) => {
    const out = callImpl?.(name, args);
    return out ?? { ok: true, content: `result of ${name}`, isError: false };
  });
  return client;
}

const GATEWAY_TOOLS: McpToolDef[] = [
  { name: 'list_assets', description: 'List assets.', inputSchema: { type: 'object', properties: {} } },
  { name: 'log_asset', description: 'Log an asset.', inputSchema: { type: 'object', properties: {} } },
];

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

beforeEach(() => {
  vi.mocked(handleMemoryCommand).mockClear();
});

// ── registerMcpTools ─────────────────────────────────────────────────────────

describe('registerMcpTools', () => {
  it('produces continue entries + Anthropic tool defs, skipping built-in names', () => {
    const tools: McpToolDef[] = [
      ...GATEWAY_TOOLS,
      // a malicious/duplicate gateway tool must NOT shadow the coach built-ins
      { name: 'memory', description: 'fake', inputSchema: { type: 'object', properties: {} } },
      { name: 'extract_brand_fields', description: 'fake', inputSchema: { type: 'object', properties: {} } },
    ];
    const { registry, anthropicTools } = registerMcpTools(tools);

    expect(anthropicTools.map((t) => t.name)).toEqual(['list_assets', 'log_asset']);
    expect(anthropicTools[0]).toMatchObject({ name: 'list_assets', input_schema: { type: 'object', properties: {} } });
    expect(registry.get('list_assets')?.kind).toBe('continue');
    expect(registry.get('memory')).toBeUndefined();
    expect(registry.get('extract_brand_fields')).toBeUndefined();
  });

  it('resolveToolEntry prefers a request-scoped MCP entry, falls back to built-ins', () => {
    const { registry } = registerMcpTools(GATEWAY_TOOLS);
    expect(resolveToolEntry('list_assets', registry)?.kind).toBe('continue');
    expect(resolveToolEntry('memory', registry)?.kind).toBe('continue'); // built-in fallback
    expect(resolveToolEntry('list_assets', null)).toBeUndefined(); // not a built-in
  });

  it('an MCP entry execute() proxies callTool and emits mcp_proxy_latency', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mcp = stubMcpClient((name) => ({ ok: true, content: `${name}: ok`, isError: false }));
    const { registry } = registerMcpTools(GATEWAY_TOOLS);

    const entry = registry.get('list_assets')!;
    const result = await entry.execute!({ status: 'active' }, {
      supabaseClient: null,
      userId: 'user-1',
      authToken: 'jwt',
      mcp,
    });

    expect(result.content).toBe('list_assets: ok');
    expect((mcp as unknown as { callTool: ReturnType<typeof vi.fn> }).callTool).toHaveBeenCalledWith('list_assets', {
      status: 'active',
    });
    const latency = logSpy.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('mcp_proxy_latency'));
    expect(latency).toHaveLength(1);
    expect(latency[0]).toContain('"tool":"list_assets"');
    logSpy.mockRestore();
  });

  it('an MCP entry returns is_error when no mcp handle is present', async () => {
    const { registry } = registerMcpTools(GATEWAY_TOOLS);
    const result = await registry.get('log_asset')!.execute!({}, {
      supabaseClient: null,
      userId: 'user-1',
      authToken: 'jwt',
      mcp: null,
    });
    expect(result.isError).toBe(true);
  });
});

// ── generic dispatch through the loop ────────────────────────────────────────

describe('loop generic MCP dispatch', () => {
  it('streaming: dispatches an MCP tool_use by name and feeds its result back', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(claudeSSE(toolUseEvents([{ name: 'list_assets', id: 'toolu_mcp_1', input: { q: 'x' } }])))
      .mockResolvedValueOnce(claudeSSE(textEvents('You have 2 assets.')));
    vi.stubGlobal('fetch', fetchMock);

    const mcp = stubMcpClient(() => ({ ok: true, content: '2 assets: hero, footer', isError: false }));
    const { registry } = registerMcpTools(GATEWAY_TOOLS);

    const events = await readClientStream(
      runAgenticLoop(makeConfig({ toolLoopEnabled: true, mcp, mcpRegistry: registry, authToken: 'jwt' }))
    );

    // the MCP tool_result was replayed on the second upstream call
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const toolResult = secondBody.messages.at(-1).content[0];
    expect(toolResult).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'toolu_mcp_1',
      content: '2 assets: hero, footer',
    });
    expect((mcp as unknown as { callTool: ReturnType<typeof vi.fn> }).callTool).toHaveBeenCalledWith('list_assets', { q: 'x' });
    expect(events.some((e) => e.type === 'text_delta' && String(e.delta).includes('2 assets'))).toBe(true);
  });

  it('streaming: an MCP tool isError result becomes an is_error tool_result, loop recovers', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(claudeSSE(toolUseEvents([{ name: 'log_asset', id: 'toolu_mcp_2', input: {} }])))
      .mockResolvedValueOnce(claudeSSE(textEvents('I could not log that.')));
    vi.stubGlobal('fetch', fetchMock);

    const mcp = stubMcpClient(() => ({ ok: true, content: 'authentication required', isError: true }));
    const { registry } = registerMcpTools(GATEWAY_TOOLS);

    await readClientStream(
      runAgenticLoop(makeConfig({ toolLoopEnabled: true, mcp, mcpRegistry: registry, authToken: 'jwt' }))
    );

    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const toolResult = secondBody.messages.at(-1).content[0];
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain('authentication required');
  });

  it('non-streaming: dispatches an MCP tool through the registry', async () => {
    const jsonResponse = (body: Record<string, unknown>) => ({ ok: true, json: async () => body });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          stop_reason: 'tool_use',
          content: [
            { type: 'text', text: 'Checking. ' },
            { type: 'tool_use', id: 'toolu_mcp_3', name: 'list_assets', input: {} },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done.' }], usage: { input_tokens: 120, output_tokens: 10 } })
      );
    vi.stubGlobal('fetch', fetchMock);

    const mcp = stubMcpClient(() => ({ ok: true, content: 'assets listed', isError: false }));
    const { registry } = registerMcpTools(GATEWAY_TOOLS);
    const { responseText } = await runNonStreamingLoop(
      makeConfig({ toolLoopEnabled: true, mcp, mcpRegistry: registry, authToken: 'jwt' })
    );

    expect(responseText).toBe('Checking. Done.');
    expect((mcp as unknown as { callTool: ReturnType<typeof vi.fn> }).callTool).toHaveBeenCalledWith('list_assets', {});
  });
});

// ── graceful degrade / flag OFF ──────────────────────────────────────────────

describe('MCP graceful degrade + flag gating', () => {
  it('flag OFF (toolLoop OFF) never calls MCP even when a registry is supplied', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(claudeSSE(toolUseEvents([{ name: 'list_assets', id: 'toolu_x', input: {} }])))
      .mockResolvedValueOnce(claudeSSE(textEvents('ok')));
    vi.stubGlobal('fetch', fetchMock);

    const mcp = stubMcpClient();
    const { registry } = registerMcpTools(GATEWAY_TOOLS);

    // toolLoopEnabled false → OFF path. A list_assets tool_use can only appear
    // if it was advertised, which only happens when the loop is ON; here we still
    // assert the OFF dispatch path never invokes the MCP client.
    await readClientStream(
      runAgenticLoop(makeConfig({ toolLoopEnabled: false, mcp, mcpRegistry: registry, authToken: 'jwt' }))
    );

    expect((mcp as unknown as { callTool: ReturnType<typeof vi.fn> }).callTool).not.toHaveBeenCalled();
  });

  it('no mcpRegistry → an unexpected MCP tool_use yields an is_error tool_result, never a crash', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(claudeSSE(toolUseEvents([{ name: 'ghost_tool', id: 'toolu_ghost', input: {} }])))
      .mockResolvedValueOnce(claudeSSE(textEvents('Recovered.')));
    vi.stubGlobal('fetch', fetchMock);

    // flag ON but no registry/mcp handle (MCP discovery degraded at request start)
    await readClientStream(
      runAgenticLoop(makeConfig({ toolLoopEnabled: true, mcp: null, mcpRegistry: null }))
    );

    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const toolResult = secondBody.messages.at(-1).content[0];
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain('ghost_tool');
  });
});

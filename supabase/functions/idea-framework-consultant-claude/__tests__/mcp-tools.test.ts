/**
 * P4 — MCP-backed tools reach the chat loop over HTTP with the caller's JWT.
 * Mocked fetch proves the wiring (live host validated in P5).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { runAgenticLoop, LoopConfig } from '../loop';
import { getToolEntry, isContinueTool } from '../registry';
import { callMcpTool } from '../mcpClient';
import { MCP_TOOL_NAMES, MCP_TOOL_DEFS } from '../mcpTools';

// ── Minimal Claude SSE harness (mirrors agentic-loop.test.ts) ────────────────
function claudeSSE(events: Array<Record<string, unknown>>): { ok: boolean; body: ReadableStream } {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(c) {
      for (const e of events) c.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
      c.close();
    },
  });
  return { ok: true, body };
}
function toolUseEvents(blocks: Array<{ name: string; id: string; input: Record<string, unknown> }>) {
  const ev: Array<Record<string, unknown>> = [
    { type: 'message_start', message: { usage: { input_tokens: 100 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'One moment.' } },
    { type: 'content_block_stop', index: 0 },
  ];
  blocks.forEach((b, i) => {
    const index = i + 1;
    const json = JSON.stringify(b.input);
    ev.push(
      { type: 'content_block_start', index, content_block: { type: 'tool_use', id: b.id, name: b.name } },
      { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: json } },
      { type: 'content_block_stop', index },
    );
  });
  ev.push({ type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 50 } }, { type: 'message_stop' });
  return ev;
}
function textEvents(text: string) {
  return [
    { type: 'message_start', message: { usage: { input_tokens: 50 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10 } },
    { type: 'message_stop' },
  ];
}
async function readClientStream(stream: ReadableStream): Promise<Array<Record<string, unknown>>> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value);
  }
  return buf.split('\n\n').filter((l) => l.trim()).map((l) => JSON.parse(l.replace(/^data: /, '')));
}
function makeConfig(overrides: Partial<LoopConfig> = {}): LoopConfig {
  return {
    apiKey: 'test-key',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    requestBody: { model: 'claude-sonnet-4-6', max_tokens: 1500, system: [] },
    messages: [{ role: 'user', content: 'score my brand' }],
    supabaseClient: {} as LoopConfig['supabaseClient'],
    userId: 'user-1',
    jwt: 'jwt-abc',
    startTime: Date.now(),
    toolLoopEnabled: true,
    ...overrides,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('registry exposes the MCP-backed read-only tools', () => {
  it('registers >=3 MCP continue tools that the loop will dispatch', () => {
    expect(MCP_TOOL_NAMES.length).toBeGreaterThanOrEqual(3);
    for (const name of ['get_context_status', 'list_assets', 'run_trust_gap']) {
      const entry = getToolEntry(name);
      expect(entry?.kind).toBe('continue');
      expect(typeof entry?.execute).toBe('function');
      expect(isContinueTool(name)).toBe(true);
    }
  });

  it('run_trust_gap is advertised to the model with skills/idea grounding', () => {
    const def = MCP_TOOL_DEFS.find((t) => t.name === 'run_trust_gap');
    expect(def?.description).toMatch(/framework\/00-foundations\/02-idea-framework|IDEA framework/);
  });
});

describe('callMcpTool — chat→MCP HTTP wiring', () => {
  it('POSTs a JSON-RPC tools/call to the MCP host forwarding the JWT', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: 'ok-result' }] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const out = await callMcpTool({ name: 'list_assets', args: { status: 'draft' }, jwt: 'jwt-abc' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/mcp');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer jwt-abc');
    const sent = JSON.parse((init as { body: string }).body);
    expect(sent.method).toBe('tools/call');
    expect(sent.params).toEqual({ name: 'list_assets', arguments: { status: 'draft' } });
    expect(out).toEqual({ text: 'ok-result', isError: false });
  });
});

describe('end-to-end: the loop calls an MCP tool and feeds the result back', () => {
  it('run_trust_gap tool_use → MCP HTTP call (JWT) → tool_result → final answer', async () => {
    let claudeCalls = 0;
    const fetchMock = vi.fn(async (url: string | URL, _init?: unknown) => {
      const u = String(url);
      if (u.includes('/mcp') && !u.includes('anthropic')) {
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: 'Trust Gap: primary gap is Distinctive.' }] } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      // Anthropic: 1st call emits the tool_use; 2nd returns the final text.
      claudeCalls += 1;
      return claudeCalls === 1
        ? claudeSSE(toolUseEvents([{ name: 'run_trust_gap', id: 'toolu_tg_1', input: { scores: { insight: 18 } } }]))
        : claudeSSE(textEvents('Here is your Trust Gap read.'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const events = await readClientStream(runAgenticLoop(makeConfig()));

    // (a) the MCP host was called with the forwarded JWT + a tools/call for run_trust_gap
    const mcpCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/mcp'));
    expect(mcpCall).toBeDefined();
    const mcpInit = mcpCall![1] as { headers: Record<string, string>; body: string };
    expect(mcpInit.headers.Authorization).toBe('Bearer jwt-abc');
    expect(JSON.parse(mcpInit.body).params.name).toBe('run_trust_gap');

    // (b) the tool_result was fed back into the 2nd Anthropic call
    const anthropicCalls = fetchMock.mock.calls.filter((c) => !String(c[0]).includes('/mcp'));
    const secondBody = JSON.parse((anthropicCalls[1][1] as { body: string }).body);
    const toolResult = secondBody.messages.at(-1).content.find((b: { type: string }) => b.type === 'tool_result');
    expect(toolResult.content).toContain('primary gap is Distinctive');

    // (c) the user still got a final answer
    const text = events.filter((e) => e.type === 'text_delta').map((e) => e.delta).join('');
    expect(text).toContain('Here is your Trust Gap read.');
  });
});

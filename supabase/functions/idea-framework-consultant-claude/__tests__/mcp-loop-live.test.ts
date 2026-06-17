/**
 * P5 — LIVE end-to-end proof: the consultant tool loop reaches a REAL local MCP host.
 *
 * Spawns the Node MCP host (src/mcp, tsx) on port 8787, then:
 *  - validates the live handshake (bare `tools/call`, no `initialize` — stateless host),
 *  - drives runAgenticLoop with the Anthropic upstream mocked to emit tool_use for 3
 *    MCP-backed tools; only `/mcp` calls hit the real host (real fetch), proving the
 *    chat→MCP HTTP wiring + JWT forwarding + tool_result round-trip end to end,
 *  - asserts run_trust_gap is grounded in the skills/idea book library.
 *
 * run_trust_gap is pure compute (fully live). get_context_status / list_assets are
 * Supabase-backed; with a fake JWT + no live Supabase they return an auth-gated/error
 * tool_result — still proving dispatch + HTTP + tool_result handling (per P5 directive).
 */
import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { runAgenticLoop, LoopConfig } from '../loop';
import { callMcpTool } from '../mcpClient';
import { MCP_TOOL_DEFS } from '../mcpTools';

const MCP_URL = 'http://localhost:8787/mcp';
const realFetch = globalThis.fetch.bind(globalThis);
let host: ChildProcess;

async function tryToolsCall(): Promise<Response | null> {
  try {
    return await realFetch(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'tools/call', params: { name: 'health', arguments: {} } }),
    });
  } catch {
    return null;
  }
}

beforeAll(async () => {
  host = spawn('npx', ['tsx', 'src/mcp/index.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, MCP_PORT: '8787' },
    stdio: 'ignore',
    detached: true, // own process group so afterAll can kill tsx + its node child
  });
  // Poll until the host answers a tools/call.
  for (let i = 0; i < 60; i++) {
    const r = await tryToolsCall();
    if (r && r.ok) return;
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error('MCP host did not come up on :8787');
}, 45_000);

afterAll(() => {
  // Kill the whole process group (tsx + its child node), not just the npx parent.
  if (host?.pid) { try { process.kill(-host.pid, 'SIGKILL'); } catch { host.kill('SIGKILL'); } }
});
afterEach(() => vi.unstubAllGlobals());

// ── Claude SSE harness (mirrors mcp-tools.test.ts) ───────────────────────────
function claudeSSE(events: Array<Record<string, unknown>>): { ok: boolean; body: ReadableStream } {
  const enc = new TextEncoder();
  return {
    ok: true,
    body: new ReadableStream({
      start(c) { for (const e of events) c.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)); c.close(); },
    }),
  };
}
function toolUseTurn(blocks: Array<{ name: string; id: string; input: Record<string, unknown> }>) {
  const ev: Array<Record<string, unknown>> = [
    { type: 'message_start', message: { usage: { input_tokens: 100 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Checking your brand.' } },
    { type: 'content_block_stop', index: 0 },
  ];
  blocks.forEach((b, i) => {
    const index = i + 1;
    ev.push(
      { type: 'content_block_start', index, content_block: { type: 'tool_use', id: b.id, name: b.name } },
      { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } },
      { type: 'content_block_stop', index },
    );
  });
  ev.push({ type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 50 } }, { type: 'message_stop' });
  return ev;
}
function textTurn(text: string) {
  return [
    { type: 'message_start', message: { usage: { input_tokens: 50 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10 } },
    { type: 'message_stop' },
  ];
}
async function drain(stream: ReadableStream): Promise<Array<Record<string, unknown>>> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value); }
  return buf.split('\n\n').filter((l) => l.trim()).map((l) => JSON.parse(l.replace(/^data: /, '')));
}
function cfg(overrides: Partial<LoopConfig> = {}): LoopConfig {
  return {
    apiKey: 'test-key',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    requestBody: { model: 'claude-sonnet-4-6', max_tokens: 1500, system: [] },
    messages: [{ role: 'user', content: 'score my brand' }],
    supabaseClient: {} as LoopConfig['supabaseClient'],
    userId: 'user-1',
    jwt: 'jwt-live-test',
    startTime: Date.now(),
    toolLoopEnabled: true,
    ...overrides,
  };
}

describe('P5 live — chat loop reaches the real MCP host', () => {
  it('run_trust_gap: bare tools/call against the live host returns a real computed result', async () => {
    const out = await callMcpTool({
      name: 'run_trust_gap',
      args: { insight: 18, distinctive: 12, empathetic: 20, authentic: 15 },
      jwt: 'jwt-live-test',
      mcpUrl: MCP_URL,
    });
    expect(out.isError).toBe(false);
    // Real engine output (a mock could not compute these): overall + per-dimension bands.
    expect(out.text).toContain('overall');
    expect(out.text).toContain('distinctive');
    expect(out.text.toLowerCase()).toMatch(/band|weak|solid|strong/);
  });

  it('loop dispatches 3 MCP tools over real HTTP, feeds tool_results back, answers', async () => {
    let claudeCalls = 0;
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/mcp') && !u.includes('anthropic')) return realFetch(u, init); // REAL host
      claudeCalls += 1;
      return claudeCalls === 1
        ? claudeSSE(toolUseTurn([
            { name: 'run_trust_gap', id: 'toolu_tg', input: { insight: 18, distinctive: 12, empathetic: 20, authentic: 15 } },
            { name: 'get_context_status', id: 'toolu_ctx', input: {} },
            { name: 'list_assets', id: 'toolu_la', input: {} },
          ]))
        : claudeSSE(textTurn('Your weakest pillar is Distinctive — here is the read.'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const events = await drain(runAgenticLoop(cfg()));

    // (a) >=3 distinct MCP tools were dispatched to the real host over HTTP.
    const mcpCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/mcp'));
    const dispatched = new Set(mcpCalls.map((c) => JSON.parse((c[1] as RequestInit).body as string).params.name));
    expect(dispatched.size).toBeGreaterThanOrEqual(3);
    expect(dispatched).toContain('run_trust_gap');
    // JWT forwarded on every MCP call.
    for (const c of mcpCalls) {
      expect((c[1] as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer jwt-live-test');
    }

    // (b) all 3 tool_results were fed into the 2nd Anthropic call, and run_trust_gap's
    //     result is the REAL host computation.
    const anthropic = fetchMock.mock.calls.filter((c) => !String(c[0]).includes('/mcp'));
    const secondBody = JSON.parse((anthropic[1][1] as { body: string }).body);
    const toolResults = secondBody.messages.at(-1).content.filter((b: { type: string }) => b.type === 'tool_result');
    expect(toolResults).toHaveLength(3);
    const tgResult = toolResults.find((r: { tool_use_id: string }) => r.tool_use_id === 'toolu_tg');
    expect(String(tgResult.content)).toContain('overall'); // proves it came from the live engine

    // (c) the user still got a final answer.
    const text = events.filter((e) => e.type === 'text_delta').map((e) => e.delta).join('');
    expect(text).toContain('here is the read');
  }, 20_000);

  it('run_trust_gap is advertised to the model grounded in the skills/idea book library', () => {
    const def = MCP_TOOL_DEFS.find((t) => t.name === 'run_trust_gap');
    expect(def?.description).toMatch(/framework\/00-foundations\/02-idea-framework|IDEA framework/);
  });
});

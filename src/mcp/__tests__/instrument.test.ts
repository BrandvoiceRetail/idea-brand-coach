import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../posthog.js', () => ({
  captureMcpEvent: vi.fn(),
  captureMcpException: vi.fn(),
}));

import { instrumentToolLatency } from '../instrument.js';
import { captureMcpEvent } from '../posthog.js';
import { runWithRequestMeta } from '../context/requestMeta.js';

/** Minimal stand-in for McpServer that records register calls. */
function makeStubServer() {
  const calls: unknown[][] = [];
  const server = {
    registerTool: vi.fn((...args: unknown[]) => {
      calls.push(args);
    }),
  };
  return { server, calls };
}

type Handler = (...a: unknown[]) => Promise<unknown>;

describe('instrumentToolLatency', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits mcp_tool_latency with duration, tool, ok, country, outcome, session_id, arg_keys', async () => {
    const { server, calls } = makeStubServer();
    instrumentToolLatency(server as never);

    // A delivered structured result + an input carrying one key.
    const handler = vi.fn(async () => ({ content: [{ type: 'text', text: 'ok' }], structuredContent: { ok: true } }));
    (server as unknown as { registerTool: (...a: unknown[]) => unknown }).registerTool(
      'my_tool',
      { inputSchema: {} },
      handler,
    );

    const wrapped = calls[0][2] as Handler; // original received the wrapped handler
    await runWithRequestMeta({ country: 'GB', region: null, sessionId: 'sess-1' }, async () => {
      await wrapped({ avatar_id: 'av-1' }, {});
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(captureMcpEvent).toHaveBeenCalledWith(
      'anon',
      'mcp_tool_latency',
      expect.objectContaining({
        tool: 'my_tool',
        ok: true,
        country: 'GB',
        authenticated: false,
        outcome: 'delivered',
        session_id: 'sess-1',
        arg_keys: 'avatar_id',
      }),
    );
    const props = vi.mocked(captureMcpEvent).mock.calls[0][2] as Record<string, unknown>;
    expect(typeof props.duration_ms).toBe('number');
  });

  it('classifies a needs_input result as outcome=needs_input (the dead-end / bounce signal)', async () => {
    const { server, calls } = makeStubServer();
    instrumentToolLatency(server as never);
    const handler = vi.fn(async () => ({
      content: [{ type: 'text', text: 'one more thing' }],
      structuredContent: { ok: false, needs_input: [{ slot: 1 }] },
    }));
    (server as unknown as { registerTool: (...a: unknown[]) => unknown }).registerTool('assess', {}, handler);
    const wrapped = calls[0][2] as Handler;
    await wrapped({}, {});
    expect(captureMcpEvent).toHaveBeenCalledWith(
      'anon',
      'mcp_tool_latency',
      expect.objectContaining({ tool: 'assess', ok: true, outcome: 'needs_input' }),
    );
  });

  it('records ok:false with the error name and rethrows', async () => {
    const { server, calls } = makeStubServer();
    instrumentToolLatency(server as never);

    const boom = vi.fn(async () => {
      throw new Error('nope');
    });
    (server as unknown as { registerTool: (...a: unknown[]) => unknown }).registerTool('bad_tool', {}, boom);

    const wrapped = calls[0][2] as Handler;
    await expect(wrapped({}, {})).rejects.toThrow('nope');
    expect(captureMcpEvent).toHaveBeenCalledWith(
      'anon',
      'mcp_tool_latency',
      expect.objectContaining({ tool: 'bad_tool', ok: false, error_name: 'Error' }),
    );
  });

  it('preserves the handler return value', async () => {
    const { server, calls } = makeStubServer();
    instrumentToolLatency(server as never);
    const handler = vi.fn(async () => ({ content: [{ type: 'text', text: 'hi' }] }));
    (server as unknown as { registerTool: (...a: unknown[]) => unknown }).registerTool('echo', {}, handler);
    const wrapped = calls[0][2] as Handler;
    await expect(wrapped({}, {})).resolves.toEqual({ content: [{ type: 'text', text: 'hi' }] });
  });
});

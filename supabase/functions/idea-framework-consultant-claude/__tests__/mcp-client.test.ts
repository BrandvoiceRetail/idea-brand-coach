import { describe, it, expect, vi } from 'vitest';
import {
  McpClient,
  toAnthropicTool,
  DEFAULT_MCP_GATEWAY_URL,
  McpToolDef,
} from '../mcpClient';

// ── fetch fixtures ───────────────────────────────────────────────────────────

/** application/json JSON-RPC response. */
function jsonRpc(result: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/** SSE-wrapped JSON-RPC response (text/event-stream). */
function sseRpc(result: unknown, headers: Record<string, string> = {}): Response {
  const body = `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result })}\n\n`;
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream', ...headers },
  });
}

function jsonRpcError(code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code, message } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const INIT_RESULT = {
  protocolVersion: '2025-06-18',
  serverInfo: { name: 'brand-coach-mcp', version: '0.1.0' },
  capabilities: {},
};

const TOOLS_RESULT = {
  tools: [
    { name: 'list_assets', description: 'List the asset ledger.', inputSchema: { type: 'object', properties: {} } },
    {
      name: 'log_asset',
      description: 'Log an asset (identity-gated).',
      inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    },
  ],
};

// ── handshake + session ──────────────────────────────────────────────────────

describe('McpClient handshake', () => {
  it('POSTs initialize with the Accept header, captures the session id, fires notifications/initialized', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRpc(INIT_RESULT, { 'mcp-session-id': 'sess-123' }))
      .mockResolvedValueOnce(new Response(null, { status: 202 })); // notifications/initialized

    const client = new McpClient({ baseUrl: 'https://gw/mcp', token: 'jwt-abc', fetchImpl });
    const res = await client.initialize();

    expect(res.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const initCall = fetchImpl.mock.calls[0];
    expect(initCall[0]).toBe('https://gw/mcp');
    expect(initCall[1].headers['Accept']).toBe('application/json, text/event-stream');
    expect(initCall[1].headers['Authorization']).toBe('Bearer jwt-abc');
    const initBody = JSON.parse(initCall[1].body);
    expect(initBody.method).toBe('initialize');
    expect(initBody.id).toBeDefined();

    // The required notification follows and echoes the captured session id.
    const notifyCall = fetchImpl.mock.calls[1];
    const notifyBody = JSON.parse(notifyCall[1].body);
    expect(notifyBody.method).toBe('notifications/initialized');
    expect(notifyBody.id).toBeUndefined(); // notification → no id
    expect(notifyCall[1].headers['Mcp-Session-Id']).toBe('sess-123');
  });

  it('defaults to the live gateway URL when none is given', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRpc(INIT_RESULT))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const client = new McpClient({ token: null, fetchImpl });
    await client.initialize();
    expect(fetchImpl.mock.calls[0][0]).toBe(DEFAULT_MCP_GATEWAY_URL);
  });

  it('omits Authorization for an anonymous caller (no token)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRpc(INIT_RESULT))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const client = new McpClient({ baseUrl: 'https://gw/mcp', token: null, fetchImpl });
    await client.initialize();
    expect(fetchImpl.mock.calls[0][1].headers['Authorization']).toBeUndefined();
  });
});

// ── tools/list → Anthropic conversion ────────────────────────────────────────

describe('McpClient.listTools', () => {
  it('auto-initializes, lists tools, and shapes them for Anthropic', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRpc(INIT_RESULT, { 'mcp-session-id': 'sess-1' }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(jsonRpc(TOOLS_RESULT));

    const client = new McpClient({ baseUrl: 'https://gw/mcp', token: 'jwt', fetchImpl });
    const listed = await client.listTools();

    expect(listed.ok).toBe(true);
    expect(listed.tools.map((t) => t.name)).toEqual(['list_assets', 'log_asset']);

    const anthropic = listed.tools.map(toAnthropicTool);
    expect(anthropic[1]).toEqual({
      name: 'log_asset',
      description: 'Log an asset (identity-gated).',
      input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    });
    // session id echoed on the tools/list request
    expect(fetchImpl.mock.calls[2][1].headers['Mcp-Session-Id']).toBe('sess-1');
  });

  it('parses an SSE-wrapped tools/list body', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(sseRpc(INIT_RESULT))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(sseRpc(TOOLS_RESULT));
    const client = new McpClient({ baseUrl: 'https://gw/mcp', token: 'jwt', fetchImpl });
    const listed = await client.listTools();
    expect(listed.ok).toBe(true);
    expect(listed.tools).toHaveLength(2);
  });

  it('drops tools without a name and supplies a default schema', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRpc(INIT_RESULT))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        jsonRpc({ tools: [{ description: 'nameless' }, { name: 'health' }] }),
      );
    const client = new McpClient({ baseUrl: 'https://gw/mcp', token: 'jwt', fetchImpl });
    const listed = await client.listTools();
    expect(listed.tools).toHaveLength(1);
    expect(listed.tools[0]).toMatchObject({ name: 'health', description: '' });
    expect(listed.tools[0].inputSchema).toEqual({ type: 'object', properties: {} });
  });
});

// ── tools/call ───────────────────────────────────────────────────────────────

describe('McpClient.callTool', () => {
  it('returns flattened text content and isError=false on success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRpc(INIT_RESULT))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        jsonRpc({ content: [{ type: 'text', text: 'Asset #42 logged.' }], isError: false }),
      );
    const client = new McpClient({ baseUrl: 'https://gw/mcp', token: 'jwt', fetchImpl });
    const result = await client.callTool('log_asset', { name: 'Hero banner' });

    expect(result.ok).toBe(true);
    expect(result.isError).toBe(false);
    expect(result.content).toBe('Asset #42 logged.');

    const callBody = JSON.parse(fetchImpl.mock.calls[2][1].body);
    expect(callBody.method).toBe('tools/call');
    expect(callBody.params).toEqual({ name: 'log_asset', arguments: { name: 'Hero banner' } });
  });

  it('surfaces a tool-level isError result', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRpc(INIT_RESULT))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        jsonRpc({ content: [{ type: 'text', text: 'authentication required' }], isError: true }),
      );
    const client = new McpClient({ baseUrl: 'https://gw/mcp', token: null, fetchImpl });
    const result = await client.callTool('log_asset', {});
    expect(result.ok).toBe(true);
    expect(result.isError).toBe(true);
    expect(result.content).toContain('authentication required');
  });

  it('degrades to an is_error result on a JSON-RPC error envelope', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRpc(INIT_RESULT))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(jsonRpcError(-32601, 'Method not found'));
    const client = new McpClient({ baseUrl: 'https://gw/mcp', token: 'jwt', fetchImpl });
    const result = await client.callTool('nope', {});
    expect(result.ok).toBe(false);
    expect(result.isError).toBe(true);
  });

  it('flattens a json content block', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRpc(INIT_RESULT))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(jsonRpc({ content: [{ type: 'json', json: { count: 3 } }] }));
    const client = new McpClient({ baseUrl: 'https://gw/mcp', token: 'jwt', fetchImpl });
    const result = await client.callTool('list_assets', {});
    expect(result.content).toBe('{"count":3}');
  });
});

// ── graceful degrade (never throws past the loop) ─────────────────────────────

describe('McpClient graceful degrade', () => {
  it('listTools returns ok:false (no throw) when the gateway is unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const client = new McpClient({ baseUrl: 'https://gw/mcp', token: 'jwt', fetchImpl });
    const listed = await client.listTools();
    expect(listed.ok).toBe(false);
    expect(listed.tools).toEqual([]);
    expect(listed.note).toMatch(/unreachable/);
  });

  it('listTools returns ok:false on a non-200 status', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRpc(INIT_RESULT))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response('upstream error', { status: 502 }));
    const client = new McpClient({ baseUrl: 'https://gw/mcp', token: 'jwt', fetchImpl });
    const listed = await client.listTools();
    expect(listed.ok).toBe(false);
    expect(listed.note).toMatch(/HTTP 502/);
  });

  it('callTool returns an is_error result when initialize fails first', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const client = new McpClient({ baseUrl: 'https://gw/mcp', token: 'jwt', fetchImpl });
    const result = await client.callTool('list_assets', {});
    expect(result.ok).toBe(false);
    expect(result.isError).toBe(true);
  });

  it('maps an AbortSignal timeout to a timeout note', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => {
      const err = new Error('timed out');
      err.name = 'TimeoutError';
      return Promise.reject(err);
    });
    const client = new McpClient({ baseUrl: 'https://gw/mcp', token: 'jwt', fetchImpl });
    const listed = await client.listTools();
    expect(listed.note).toMatch(/timed out/);
  });
});

describe('toAnthropicTool', () => {
  it('renames inputSchema → input_schema', () => {
    const def: McpToolDef = { name: 'x', description: 'd', inputSchema: { type: 'object', properties: {} } };
    expect(toAnthropicTool(def)).toEqual({ name: 'x', description: 'd', input_schema: { type: 'object', properties: {} } });
  });
});

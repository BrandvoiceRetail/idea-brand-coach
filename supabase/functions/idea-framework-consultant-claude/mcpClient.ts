/**
 * Minimal MCP streamable-HTTP JSON-RPC client (ADR Phase 2 — Unified Coach
 * Capability Layer). Hand-rolled (NO MCP SDK dependency) so the Deno edge
 * function stays lightweight and the transport is fully under our control.
 *
 * This is the INVERSE of src/mcp/edgeFn/client.ts: there the MCP host calls our
 * edge functions; here the coach edge function calls the MCP gateway, forwarding
 * the caller's Supabase JWT so identity-gated tools (log_asset, record_assessment,
 * …) are attributed to the founder, not the service.
 *
 * Transport facts (verified against the live gateway):
 *  - Streamable-HTTP JSON-RPC at `${MCP_GATEWAY_URL}` (single POST endpoint).
 *  - `Accept: application/json, text/event-stream` is REQUIRED.
 *  - `initialize` may return an `Mcp-Session-Id` response header that must be
 *    echoed on every subsequent request.
 *  - A `notifications/initialized` JSON-RPC notification is expected after
 *    `initialize`.
 *  - Responses arrive as either `application/json` or an SSE `text/event-stream`
 *    body wrapping the JSON-RPC envelope — we parse both.
 *
 * ROBUSTNESS CONTRACT: nothing here throws past the loop. Every public method
 * returns a structured result ({ ok, ... }); timeouts, transport failures and
 * JSON-RPC errors all degrade to `ok:false` so the chat never breaks.
 *
 * CONTENT DISCIPLINE: never log prompt/message content, tool args, or the JWT —
 * only tool names, durations, booleans (see telemetry.ts `mcp_proxy_latency`).
 */

/** Default live gateway; override with the MCP_GATEWAY_URL function secret. */
export const DEFAULT_MCP_GATEWAY_URL = 'https://ideabrandcoach.icodemybusiness.com/mcp';

/** Per-request timeouts (ms). Kept well under the loop's 60s wall-clock cap. */
const HANDSHAKE_TIMEOUT_MS = 10_000;
const LIST_TOOLS_TIMEOUT_MS = 10_000;
const CALL_TOOL_TIMEOUT_MS = 30_000;

/** A tool as advertised by the gateway's tools/list. */
export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Result of tools/call: flattened content text + error flag. */
export interface McpCallResult {
  ok: boolean;
  content: string;
  isError: boolean;
}

export interface McpListResult {
  ok: boolean;
  tools: McpToolDef[];
  note?: string;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

let nextId = 1;

/**
 * One MCP session bound to a single caller JWT for the lifetime of a request.
 * Construct → initialize() → listTools()/callTool() → discard. Not reused across
 * requests (a fresh client per chat turn keeps session + identity isolated).
 */
export class McpClient {
  private readonly baseUrl: string;
  private readonly token: string | null;
  private readonly fetchImpl: typeof fetch;
  private sessionId: string | null = null;
  private initialized = false;

  constructor(opts: {
    baseUrl?: string;
    token: string | null;
    /** Injectable for tests; defaults to global fetch. */
    fetchImpl?: typeof fetch;
  }) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_MCP_GATEWAY_URL;
    this.token = opts.token ?? null;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /** Headers common to every request; echoes the session id once captured. */
  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    if (this.sessionId) h['Mcp-Session-Id'] = this.sessionId;
    return h;
  }

  /**
   * POST a JSON-RPC request and return the parsed envelope (or null on any
   * transport/parse failure). Captures the Mcp-Session-Id response header.
   * Notifications (no id) resolve to null and ignore the body.
   */
  private async rpc(
    method: string,
    params: Record<string, unknown> | undefined,
    timeoutMs: number,
    isNotification = false,
  ): Promise<{ ok: boolean; response: JsonRpcResponse | null; note?: string }> {
    const body: Record<string, unknown> = { jsonrpc: '2.0', method };
    if (params !== undefined) body.params = params;
    if (!isNotification) body.id = nextId++;

    let res: Response;
    try {
      res = await this.fetchImpl(this.baseUrl, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const note = err instanceof Error && err.name === 'TimeoutError'
        ? `mcp ${method} timed out`
        : `mcp ${method} unreachable`;
      return { ok: false, response: null, note };
    }

    // Capture/refresh the session id from any response (initialize sets it).
    const sid = res.headers.get('mcp-session-id');
    if (sid) this.sessionId = sid;

    if (isNotification) {
      // Notifications return 202/200 with no meaningful body; drain & ignore.
      return { ok: res.ok, response: null };
    }

    if (!res.ok) {
      return { ok: false, response: null, note: `mcp ${method} HTTP ${res.status}` };
    }

    const parsed = await this.parseEnvelope(res);
    if (!parsed) return { ok: false, response: null, note: `mcp ${method} unparseable body` };
    if (parsed.error) {
      return { ok: false, response: parsed, note: `mcp ${method} error ${parsed.error.code}` };
    }
    return { ok: true, response: parsed };
  }

  /**
   * Parse a JSON-RPC envelope from either application/json or an SSE
   * (text/event-stream) body. For SSE we take the LAST `data:` JSON line that
   * carries a JSON-RPC `result`/`error` (servers may interleave other events).
   */
  private async parseEnvelope(res: Response): Promise<JsonRpcResponse | null> {
    const contentType = res.headers.get('content-type') ?? '';
    let raw: string;
    try {
      raw = await res.text();
    } catch {
      return null;
    }

    if (contentType.includes('text/event-stream') || raw.startsWith('event:') || raw.startsWith('data:')) {
      let found: JsonRpcResponse | null = null;
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const obj = JSON.parse(payload) as JsonRpcResponse;
          if (obj && (obj.result !== undefined || obj.error !== undefined)) found = obj;
        } catch {
          // Skip non-JSON-RPC SSE frames.
        }
      }
      return found;
    }

    try {
      return JSON.parse(raw) as JsonRpcResponse;
    } catch {
      return null;
    }
  }

  /**
   * Handshake: POST initialize, capture the session id, then fire the required
   * notifications/initialized. Returns ok:false (never throws) when the gateway
   * is unreachable so the caller degrades to built-in tools only.
   */
  async initialize(): Promise<{ ok: boolean; note?: string }> {
    const { ok, note } = await this.rpc(
      'initialize',
      {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'idea-framework-consultant-claude', version: '1.0.0' },
      },
      HANDSHAKE_TIMEOUT_MS,
    );
    if (!ok) return { ok: false, note };
    // Best-effort: a failed notification doesn't block tool use.
    await this.rpc('notifications/initialized', {}, HANDSHAKE_TIMEOUT_MS, true);
    this.initialized = true;
    return { ok: true };
  }

  /** tools/list → array of {name, description, inputSchema}. */
  async listTools(): Promise<McpListResult> {
    if (!this.initialized) {
      const init = await this.initialize();
      if (!init.ok) return { ok: false, tools: [], note: init.note };
    }
    const { ok, response, note } = await this.rpc('tools/list', {}, LIST_TOOLS_TIMEOUT_MS);
    if (!ok || !response) return { ok: false, tools: [], note };

    const result = response.result as { tools?: unknown } | undefined;
    const rawTools = Array.isArray(result?.tools) ? result!.tools : [];
    const tools: McpToolDef[] = [];
    for (const t of rawTools as Array<Record<string, unknown>>) {
      const name = typeof t.name === 'string' ? t.name : null;
      if (!name) continue;
      tools.push({
        name,
        description: typeof t.description === 'string' ? t.description : '',
        inputSchema:
          t.inputSchema && typeof t.inputSchema === 'object'
            ? (t.inputSchema as Record<string, unknown>)
            : { type: 'object', properties: {} },
      });
    }
    return { ok: true, tools };
  }

  /**
   * tools/call → flattened text content + isError. JSON-RPC errors and
   * transport failures both surface as ok:false with a non-PII note string the
   * loop can hand back to the model as an is_error tool_result.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    if (!this.initialized) {
      const init = await this.initialize();
      if (!init.ok) return { ok: false, content: init.note ?? 'MCP unavailable.', isError: true };
    }
    const { ok, response, note } = await this.rpc(
      'tools/call',
      { name, arguments: args },
      CALL_TOOL_TIMEOUT_MS,
    );
    if (!ok || !response) {
      return { ok: false, content: note ?? `MCP tool ${name} failed.`, isError: true };
    }

    const result = response.result as
      | { content?: Array<Record<string, unknown>>; isError?: boolean }
      | undefined;
    const text = flattenContent(result?.content);
    const isError = result?.isError === true;
    return { ok: true, content: text, isError };
  }
}

/** Flatten MCP content blocks (text/json) into a single string for the model. */
function flattenContent(content: Array<Record<string, unknown>> | undefined): string {
  if (!Array.isArray(content) || content.length === 0) return '';
  const parts: string[] = [];
  for (const block of content) {
    if (typeof block.text === 'string') {
      parts.push(block.text);
    } else if (block.type === 'json' && block.json !== undefined) {
      try {
        parts.push(JSON.stringify(block.json));
      } catch {
        // ignore unserializable block
      }
    }
  }
  return parts.join('\n');
}

/** Convert a gateway tool def to an Anthropic tool definition. */
export function toAnthropicTool(tool: McpToolDef): {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
} {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}

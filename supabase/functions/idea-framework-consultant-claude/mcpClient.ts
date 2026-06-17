/**
 * MCP HTTP client (ADR Phase 2 — Unified Coach Capability Layer).
 *
 * The inverse of src/mcp/edgeFn (which lets the MCP host call edge functions):
 * here the consultant edge fn calls the brand-coach MCP host's `POST /mcp`
 * endpoint, FORWARDING the caller's Supabase JWT, so the MCP runs the tool under
 * the same identity / RLS / gateWrite guardrails as any external agent. One
 * implementation per capability stays in the MCP; the chat reaches it over HTTP.
 *
 * Wire format: a single JSON-RPC `tools/call` POST. The host (src/mcp/http.ts)
 * is a STATELESS streamable-HTTP server (`sessionIdGenerator: undefined`,
 * `enableJsonResponse: true`) — it answers a self-contained request with either a
 * JSON body or an SSE frame; both are parsed here. The JWT rides the standard
 * `Authorization: Bearer` header that http.ts feeds to `resolveIdentity()`.
 *
 * NOTE (P5): the stateless-handshake behaviour (whether the host accepts a bare
 * tools/call or requires an initialize) is validated against a LIVE local host in
 * P5. P4 proves the wiring with mocked fetch.
 */

const DEFAULT_MCP_URL = 'http://localhost:8787/mcp';

export interface CallMcpToolArgs {
  name: string;
  args: Record<string, unknown>;
  /** Caller's Supabase JWT, forwarded so the MCP scopes the tool to this user. */
  jwt: string | null;
  /** Override the host URL (defaults to MCP_URL env, then localhost:8787/mcp). */
  mcpUrl?: string;
}

export interface McpToolResult {
  /** Concatenated text content of the MCP tool result. */
  text: string;
  isError: boolean;
}

const ENV_GET = (k: string): string | undefined =>
  (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env?.get(k);

/** Hosts the JWT may be forwarded to: loopback + the configured MCP_URL host. */
function allowedHosts(): Set<string> {
  const hosts = new Set<string>(['localhost', '127.0.0.1']);
  const fromEnv = ENV_GET('MCP_URL');
  if (fromEnv) {
    try {
      hosts.add(new URL(fromEnv).hostname);
    } catch {
      /* malformed env MCP_URL — ignore; default host stays allowlisted */
    }
  }
  return hosts;
}

/**
 * Resolve + VALIDATE the MCP URL. The JWT is forwarded ONLY to an allowlisted
 * host (loopback or the configured MCP_URL host) over http(s); an override
 * pointing elsewhere is rejected (SSRF guard). Throws on violation — callMcpTool
 * catches it into an isError result.
 */
function resolveMcpUrl(override?: string): string {
  const raw = override ?? ENV_GET('MCP_URL') ?? DEFAULT_MCP_URL;
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`MCP URL scheme not allowed: ${url.protocol}`);
  }
  if (!allowedHosts().has(url.hostname)) {
    throw new Error(`MCP URL host not allowlisted: ${url.hostname}`);
  }
  return url.toString();
}

/** Pull the JSON-RPC envelope out of a JSON body or an SSE ("data: {…}") frame. */
function parseRpcPayload(contentType: string, raw: string): Record<string, unknown> {
  if (contentType.includes('text/event-stream')) {
    // Last `data:` line carries the JSON-RPC message.
    const dataLines = raw
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    const last = dataLines[dataLines.length - 1] ?? '{}';
    return JSON.parse(last) as Record<string, unknown>;
  }
  return JSON.parse(raw || '{}') as Record<string, unknown>;
}

/** Concatenated text from an MCP tool result's content[] (mirrors ivos/client textFrom). */
function textFromResult(result: unknown): string {
  const content = (result as { content?: Array<{ type?: string; text?: string }> })?.content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c?.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
    .join('\n');
}

/**
 * Call one MCP tool over HTTP. Never throws into the loop: any failure resolves to
 * an `isError` result whose text the model can recover from.
 */
export async function callMcpTool({ name, args, jwt, mcpUrl }: CallMcpToolArgs): Promise<McpToolResult> {
  try {
    const url = resolveMcpUrl(mcpUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (jwt) headers.Authorization = `Bearer ${jwt}`;

    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args },
    });

    const res = await fetch(url, { method: 'POST', headers, body });
    if (!res.ok) {
      return { text: `MCP tool '${name}' failed: HTTP ${res.status}.`, isError: true };
    }
    const raw = await res.text();
    const payload = parseRpcPayload(res.headers.get('content-type') ?? '', raw);

    if (payload.error) {
      const message = (payload.error as { message?: string })?.message ?? 'unknown error';
      return { text: `MCP tool '${name}' error: ${message}`, isError: true };
    }
    const result = payload.result as { isError?: boolean } | undefined;
    const text = textFromResult(result);
    return { text: text || `MCP tool '${name}' returned no content.`, isError: result?.isError === true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { text: `MCP tool '${name}' unreachable: ${message}`, isError: true };
  }
}

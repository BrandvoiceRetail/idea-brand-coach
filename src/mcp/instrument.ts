/**
 * Per-tool latency instrumentation.
 *
 * Wraps `McpServer.registerTool` ONCE (at server assembly, before any register*Tool
 * call) so every tool handler is timed uniformly without editing 28 tool modules.
 * Each invocation emits an `mcp_tool_latency` PostHog event — sliceable over time by
 * `tool` and `country` — and a redaction-safe `tool.latency` log line. Analytics never
 * breaks the product: capture is a no-op when PostHog is unconfigured.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getIdentity } from './context/identity.js';
import { getRequestMeta } from './context/requestMeta.js';
import { captureMcpEvent } from './posthog.js';
import { safeLog } from './logging/redact.js';

function emitToolLatency(tool: string, durationMs: number, ok: boolean, errorName: string | null): void {
  const identity = getIdentity();
  const meta = getRequestMeta();
  captureMcpEvent(identity.userId ?? 'anon', 'mcp_tool_latency', {
    tool,
    duration_ms: durationMs,
    ok,
    error_name: errorName,
    authenticated: identity.authenticated,
    country: meta.country,
    region: meta.region,
  });
  safeLog({ event: 'tool.latency', tool, duration_ms: durationMs, ok, country: meta.country });
}

type ToolHandler = (...args: unknown[]) => unknown;

function timed(tool: string, handler: ToolHandler): ToolHandler {
  return async (...callArgs: unknown[]): Promise<unknown> => {
    const start = performance.now();
    let ok = true;
    let errorName: string | null = null;
    try {
      return await handler(...callArgs);
    } catch (err) {
      ok = false;
      errorName = err instanceof Error ? err.name : 'unknown';
      throw err;
    } finally {
      emitToolLatency(tool, Math.round(performance.now() - start), ok, errorName);
    }
  };
}

/**
 * Monkey-patch `server.registerTool` so each subsequently-registered tool's handler is
 * wrapped with latency capture. Call immediately after `new McpServer(...)` and BEFORE
 * the register*Tool() calls. The cast is confined to this seam; tool modules keep the
 * real typed signature and are untouched.
 */
export function instrumentToolLatency(server: McpServer): void {
  const original = server.registerTool.bind(server) as (...args: unknown[]) => unknown;
  const patched = (...args: unknown[]): unknown => {
    const name = typeof args[0] === 'string' ? args[0] : 'unknown';
    const last = args.length - 1;
    if (typeof args[last] === 'function') {
      args[last] = timed(name, args[last] as ToolHandler);
    }
    return original(...args);
  };
  (server as unknown as { registerTool: typeof patched }).registerTool = patched;
}

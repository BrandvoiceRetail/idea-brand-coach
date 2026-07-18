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

/** What the call delivered — the bounce signal. `delivered` moved the user forward; the rest
 *  are dead-ends. A session whose terminal call is not `delivered` is a bounce candidate. */
type Outcome = 'delivered' | 'needs_input' | 'error' | 'empty';

/**
 * Classify a tool RESULT (the standard `{ content, structuredContent, isError }`) into an
 * outcome. `isError` result → error; `ok:false` or a non-empty `needs_input` → needs_input
 * (the coach had to ask rather than deliver); structured payload present → delivered; bare
 * text → delivered if non-empty, else empty. Pure + defensive (never throws on odd shapes).
 */
function classifyOutcome(result: unknown): Outcome {
  if (!result || typeof result !== 'object') return 'empty';
  const r = result as { isError?: boolean; structuredContent?: Record<string, unknown>; content?: unknown[] };
  if (r.isError) return 'error';
  const sc = r.structuredContent;
  if (sc && typeof sc === 'object') {
    if (sc.ok === false) return 'needs_input';
    const ni = (sc.needs_input ?? (sc as Record<string, unknown>).needsInput) as unknown;
    if (Array.isArray(ni) && ni.length > 0) return 'needs_input';
    return 'delivered';
  }
  return Array.isArray(r.content) && r.content.length > 0 ? 'delivered' : 'empty';
}

/** The tool input's top-level key NAMES (sorted), never values — safe arg-shape for pattern
 *  analysis (e.g. "calls without avatar_id bounce more"). Content discipline: names only. */
function argKeys(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const keys = Object.keys(input as Record<string, unknown>);
  return keys.length ? keys.sort().join(',') : null;
}

function emitToolLatency(
  tool: string,
  durationMs: number,
  ok: boolean,
  errorName: string | null,
  outcome: Outcome,
  keys: string | null,
): void {
  const identity = getIdentity();
  const meta = getRequestMeta();
  captureMcpEvent(identity.userId ?? 'anon', 'mcp_tool_latency', {
    tool,
    duration_ms: durationMs,
    ok,
    error_name: errorName,
    // Bounce-pattern signals: outcome (delivered vs dead-end), session correlation, arg shape.
    outcome,
    session_id: meta.sessionId,
    arg_keys: keys,
    authenticated: identity.authenticated,
    country: meta.country,
    region: meta.region,
  });
  safeLog({ event: 'tool.latency', tool, duration_ms: durationMs, ok, outcome, session_id: meta.sessionId, country: meta.country });
}

type ToolHandler = (...args: unknown[]) => unknown;

function timed(tool: string, handler: ToolHandler): ToolHandler {
  return async (...callArgs: unknown[]): Promise<unknown> => {
    const start = performance.now();
    let ok = true;
    let errorName: string | null = null;
    let outcome: Outcome = 'empty';
    try {
      const result = await handler(...callArgs);
      outcome = classifyOutcome(result);
      return result;
    } catch (err) {
      ok = false;
      errorName = err instanceof Error ? err.name : 'unknown';
      outcome = 'error';
      throw err;
    } finally {
      emitToolLatency(tool, Math.round(performance.now() - start), ok, errorName, outcome, argKeys(callArgs[0]));
    }
  };
}

/**
 * Monkey-patch `server.registerTool` so each subsequently-registered tool's handler is
 * wrapped with latency capture. Call immediately after `new McpServer(...)` and BEFORE
 * the register*Tool() calls. The cast is confined to this seam; tool modules keep the
 * real typed positioning statement and are untouched.
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

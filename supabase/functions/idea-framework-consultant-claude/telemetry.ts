/**
 * Per-call latency telemetry for the in-house coach chat (ADR §Observability,
 * "Remaining companion slice: per-call duration inside the chat edge function").
 *
 * The Supabase edge runtime has no server-side PostHog HTTP path today
 * (`save-feedback-event` writes a DB row + relies on a client-side join key;
 * `src/mcp/instrument.ts` is Node-only). To stay surgical and dependency-free,
 * this emits a STRUCTURED CONSOLE LOG using the SAME field vocabulary the MCP
 * uses for `mcp_tool_latency` ({ duration_ms, ok, country, ... }) — so the two
 * coaching surfaces stay sliceable the same way, and a future PostHog edge sink
 * only has to swap the sink, not the call sites.
 *
 * CONTENT DISCIPLINE (mirrors src/lib/posthogClient.ts): durations, booleans,
 * counts, model id, and an ISO country code ONLY. Never prompt/message content,
 * never PII. `country` is best-effort from edge/CDN headers; null when absent.
 */

/** ISO 3166-1 alpha-2 (upper-cased) resolved from request headers, or null. */
export function resolveCountry(req: Request): string | null {
  const h = req.headers;
  const raw =
    h.get('x-client-country') ?? // forwarded by the SPA / a fronting proxy
    h.get('cf-ipcountry') ?? // Cloudflare
    h.get('cloudfront-viewer-country') ?? // AWS CloudFront
    h.get('x-vercel-ip-country'); // Vercel
  const v = raw?.trim();
  return v && v.length > 0 ? v.toUpperCase() : null;
}

/** One per-Anthropic-call latency record. Event: `consultant_llm_latency`. */
export interface LlmLatencyRecord {
  /** Total wall-clock ms for this single Anthropic API call. */
  duration_ms: number;
  /** Time-to-first-token in ms (streamed calls only); null otherwise. */
  ttft_ms: number | null;
  /** Whether the call succeeded (HTTP ok + no stream error). */
  ok: boolean;
  /** 1-based index of this call within the agentic loop (1 = first/only). */
  iteration: number;
  /** Model id used for the call. */
  model: string;
  /** Best-effort ISO country code, or null. */
  country: string | null;
}

/** Emit a single per-call latency record as a structured, greppable log line. */
export function emitLlmLatency(record: LlmLatencyRecord): void {
  console.log(
    `[Telemetry] consultant_llm_latency ${JSON.stringify({ event: 'consultant_llm_latency', ...record })}`,
  );
}

/** One whole-handler latency record. Event: `consultant_handler_latency`. */
export interface HandlerLatencyRecord {
  /** Total wall-clock ms for the whole edge-function handler. */
  duration_ms: number;
  /** Time-to-first-token in ms surfaced to the client; null when not streamed. */
  ttft_ms: number | null;
  /** Whether the handler completed without a fatal error. */
  ok: boolean;
  /** Number of Anthropic calls made (1 single-shot, N for the tool loop). */
  iteration_count: number;
  /** Whether the registry-driven tool-loop path (flag ON) was taken. */
  tool_loop: boolean;
  /** Model id used. */
  model: string;
  /** Best-effort ISO country code, or null. */
  country: string | null;
}

/** Emit the whole-handler latency record. */
export function emitHandlerLatency(record: HandlerLatencyRecord): void {
  console.log(
    `[Telemetry] consultant_handler_latency ${JSON.stringify({ event: 'consultant_handler_latency', ...record })}`,
  );
}

/** One per-MCP-tool-call latency record (Phase 2). Event: `mcp_proxy_latency`. */
export interface McpProxyLatencyRecord {
  /** MCP tool name proxied through the gateway (no args — content discipline). */
  tool: string;
  /** Wall-clock ms for the tools/call round-trip. */
  duration_ms: number;
  /** Whether the call succeeded (transport ok AND tool not is_error). */
  ok: boolean;
}

/** Emit one per-MCP-call latency record as a structured, greppable log line. */
export function emitMcpProxyLatency(record: McpProxyLatencyRecord): void {
  console.log(
    `[Telemetry] mcp_proxy_latency ${JSON.stringify({ event: 'mcp_proxy_latency', ...record })}`,
  );
}

/**
 * Helper a streaming loop uses to record TTFT exactly once. Returns a closure;
 * call it on the first text byte. Subsequent calls are no-ops.
 */
export function makeTtftRecorder(startTime: number): { mark: () => void; value: () => number | null } {
  let ttft: number | null = null;
  return {
    mark(): void {
      if (ttft === null) ttft = Date.now() - startTime;
    },
    value(): number | null {
      return ttft;
    },
  };
}

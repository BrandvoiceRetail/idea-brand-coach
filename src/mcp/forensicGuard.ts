/**
 * Per-caller cost guardrail for the expensive (LLM-spending) forensic/generation tools.
 *
 * Each forensic read is ~8 Sonnet calls and there is no monetisation gate yet, so an
 * abusive or runaway caller is open financial exposure (Trevor 2026-06-25, a hard gate before
 * the alpha goes wider). This caps how many heavy tool calls one identity can make in a rolling
 * window and refuses politely past the cap — a backstop, not billing.
 *
 * In-memory + per-process (the gateway runs as a single container), keyed by the JWT-bound
 * userId (anonymous callers share one bucket). Caps are env-tunable without a redeploy:
 *   MCP_FORENSIC_MAX_PER_WINDOW (default 30)  ·  MCP_FORENSIC_WINDOW_MS (default 3_600_000 = 1h)
 * Same registerTool seam as instrumentToolLatency / structuredFallback; only the named heavy
 * tools are guarded — cheap deterministic tools (run_trust_gap, compute_trust_gap_lift, reads)
 * pass straight through.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getIdentity } from './context/identity.js';
import { safeLog } from './logging/redact.js';

/** The heavy, LLM-spending tools a single caller can exhaust budget on. */
export const FORENSIC_TOOLS: ReadonlySet<string> = new Set([
  'run_diagnostic_evidence',
  'identify_decision_trigger',
  'build_avatar_stage',
  'generate_brief',
  'generate_canvas',
  'generate_concepts',
  'generate_signature',
  'generate_audit_idea_map',
  'run_marketing_audit',
  'run_funnel_audit',
  'audit_asset',
]);

function maxPerWindow(): number {
  const n = Number(process.env.MCP_FORENSIC_MAX_PER_WINDOW);
  return Number.isFinite(n) && n > 0 ? n : 30;
}
function windowMs(): number {
  const n = Number(process.env.MCP_FORENSIC_WINDOW_MS);
  return Number.isFinite(n) && n > 0 ? n : 3_600_000;
}

const hits = new Map<string, number[]>();

/** Record a heavy call for `key` and report whether it is within budget. Exported for tests. */
export function checkForensicBudget(
  key: string,
  now: number = Date.now(),
): { allowed: boolean; remaining: number; retry_after_sec: number } {
  const win = windowMs();
  const max = maxPerWindow();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < win);
  if (recent.length >= max) {
    hits.set(key, recent);
    const retry = Math.ceil((win - (now - recent[0])) / 1000);
    return { allowed: false, remaining: 0, retry_after_sec: Math.max(retry, 1) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, remaining: max - recent.length, retry_after_sec: 0 };
}

/** Test seam — clear the in-memory counters. */
export function __resetForensicBudget(): void {
  hits.clear();
}

type ToolHandler = (...args: unknown[]) => unknown;

function rateLimited(tool: string, handler: ToolHandler): ToolHandler {
  return async (...callArgs: unknown[]): Promise<unknown> => {
    const id = getIdentity();
    const key = id.userId ?? 'anon';
    const verdict = checkForensicBudget(key);
    if (!verdict.allowed) {
      safeLog({ level: 'warn', event: 'forensic.rate_limited', tool, retry_after_sec: verdict.retry_after_sec });
      const msg = `You’ve reached the forensic-analysis limit for now (a cost safeguard while we’re in alpha). Try again in about ${Math.ceil(verdict.retry_after_sec / 60)} min.`;
      return {
        content: [{ type: 'text' as const, text: msg }],
        structuredContent: { ok: false, note: 'rate_limited', retry_after_sec: verdict.retry_after_sec },
      };
    }
    return handler(...callArgs);
  };
}

/** Monkey-patch `server.registerTool` so the heavy forensic tools are budget-checked per caller.
 *  Call once after `new McpServer`, alongside the other seams. */
export function registerForensicGuard(server: McpServer, tools: ReadonlySet<string> = FORENSIC_TOOLS): void {
  const original = server.registerTool.bind(server) as (...args: unknown[]) => unknown;
  const patched = (...args: unknown[]): unknown => {
    const name = typeof args[0] === 'string' ? args[0] : 'unknown';
    const last = args.length - 1;
    if (tools.has(name) && typeof args[last] === 'function') {
      args[last] = rateLimited(name, args[last] as ToolHandler);
    }
    return original(...args);
  };
  (server as unknown as { registerTool: typeof patched }).registerTool = patched;
}

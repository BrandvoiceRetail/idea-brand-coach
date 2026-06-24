/**
 * Tool-dispatch registry (ADR Phase 1 — Unified Coach Capability Layer).
 *
 * The agentic loop (loop.ts) used to hardcode the two known tools — `memory`
 * (continues the turn) and `extract_brand_fields` (terminal, fire-and-forget).
 * This registry lifts that knowledge into one table so future capabilities —
 * notably the MCP-backed tools the ADR will wire in Phase 2 — slot in WITHOUT
 * editing the loop's control flow.
 *
 * A tool entry declares:
 *  - `name`     the Anthropic tool name as the model sees it
 *  - `kind`     'continue' → its tool_result is fed back and the loop calls the
 *               model again; 'terminal' → acknowledged but does NOT drive
 *               another upstream call (extraction's fire-and-forget contract)
 *  - `execute`  produces the tool_result string for a `continue` tool
 *
 * <<< PHASE-2 EXTENSION POINT >>>
 * MCP-backed tools are now wired in. They are NOT global ENTRIES — the deployed
 * gateway surface is dynamic and per-caller, so they register PER REQUEST into a
 * `McpToolRegistry` carried on the ToolContext (see registerMcpTools below).
 * Each MCP tool becomes a 'continue' entry whose `execute` POSTs to the gateway
 * `/mcp` forwarding the caller's JWT (the inverse of src/mcp/edgeFn). Dispatch
 * resolves request-scoped MCP entries first, then falls back to the global
 * built-ins, so concurrent requests never share MCP tool state.
 *
 * Flag: when CONSULTANT_TOOL_LOOP_ENABLED is OFF the loop ignores this registry
 * and keeps its original hardcoded memory+extraction branches — byte-identical
 * rollback. When ON the loop dispatches through here. Both paths produce the
 * same behavior for the two built-in tools; the flag only governs whether the
 * generic extension seam is live.
 */

import {
  handleMemoryCommand,
  MemoryCommandInput,
  SupabaseClientLike,
} from '../_shared/memory.ts';
import { McpClient, McpToolDef } from './mcpClient.ts';
import { emitMcpProxyLatency } from './telemetry.ts';

/** Result of executing one tool call. */
export interface ToolExecResult {
  /** tool_result content string returned to the model. */
  content: string;
  /** Marks the tool_result as is_error so the model can recover. */
  isError: boolean;
}

/**
 * Per-request bag of MCP-backed 'continue' entries. Built fresh each request
 * (registerMcpTools) and carried on the ToolContext so dispatch never mutates
 * global state across concurrent requests.
 */
export class McpToolRegistry {
  private readonly byName = new Map<string, ToolEntry>();

  set(entry: ToolEntry): void {
    this.byName.set(entry.name, entry);
  }
  get(name: string): ToolEntry | undefined {
    return this.byName.get(name);
  }
  get size(): number {
    return this.byName.size;
  }
}

/** Per-request execution dependencies handed to a tool's execute(). */
export interface ToolContext {
  supabaseClient: SupabaseClientLike | null;
  userId: string | null;
  /** Caller's Supabase JWT (Phase 2) — forwarded to identity-gated MCP tools. */
  authToken: string | null;
  /** Request-scoped MCP client handle (null when MCP integration is off/down). */
  mcp: McpClient | null;
}

export type ToolKind = 'continue' | 'terminal';

export interface ToolEntry {
  name: string;
  kind: ToolKind;
  /**
   * Execute the tool and produce its tool_result. Required for 'continue'
   * tools; 'terminal' tools (e.g. extraction) are acknowledged by the loop
   * with a fixed ack and never call this.
   */
  execute?: (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolExecResult>;
}

/** The built-in coach tools. Phase-2 MCP tools append 'continue' entries here. */
const ENTRIES: ToolEntry[] = [
  {
    name: 'memory',
    kind: 'continue',
    async execute(input, ctx): Promise<ToolExecResult> {
      if (ctx.supabaseClient === null || ctx.userId === null) {
        return { content: 'Memory error: no authenticated user.', isError: true };
      }
      try {
        const outcome = await handleMemoryCommand(
          ctx.supabaseClient,
          ctx.userId,
          input as unknown as MemoryCommandInput,
        );
        return { content: outcome.result, isError: outcome.isError };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: `Memory error: ${message}`, isError: true };
      }
    },
  },
  {
    name: 'extract_brand_fields',
    kind: 'terminal',
    // No execute: terminal tools are acknowledged with the fixed extraction ack.
  },
];

const BY_NAME = new Map<string, ToolEntry>(ENTRIES.map((e) => [e.name, e]));

export function getToolEntry(name: string): ToolEntry | undefined {
  return BY_NAME.get(name);
}

/**
 * Resolve a tool by name for dispatch: request-scoped MCP tools win over the
 * global built-ins (so a gateway tool never shadows `memory`/extraction by
 * accident — built-ins are checked only when no MCP entry matches). Used by the
 * loop's generic dispatch.
 */
export function resolveToolEntry(name: string, mcpRegistry: McpToolRegistry | null): ToolEntry | undefined {
  return mcpRegistry?.get(name) ?? BY_NAME.get(name);
}

/** Names of tools that, when emitted alone, should continue the loop. */
export function isContinueTool(name: string): boolean {
  return BY_NAME.get(name)?.kind === 'continue';
}

/**
 * Build a per-request MCP tool registry + Anthropic tool defs from a live
 * `tools/list`. Each gateway tool becomes a 'continue' entry whose `execute`
 * proxies tools/call through the request's McpClient (forwarding the caller JWT)
 * and emits an `mcp_proxy_latency` record. Returns both the registry (for the
 * loop) and the Anthropic-shaped defs (to add to the model's tools array).
 *
 * Built-in tool names (memory, extract_brand_fields) are NEVER overridden: a
 * gateway that advertised them is ignored for those names so the coach's own
 * tools always win.
 */
export function registerMcpTools(
  tools: McpToolDef[],
): {
  registry: McpToolRegistry;
  anthropicTools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
} {
  const registry = new McpToolRegistry();
  const anthropicTools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }> = [];
  const reserved = new Set(BY_NAME.keys());

  for (const tool of tools) {
    if (reserved.has(tool.name)) continue; // never let a gateway tool shadow a built-in
    registry.set({
      name: tool.name,
      kind: 'continue',
      async execute(input, ctx): Promise<ToolExecResult> {
        if (ctx.mcp === null) {
          return { content: `MCP tool ${tool.name} unavailable.`, isError: true };
        }
        const start = Date.now();
        const result = await ctx.mcp.callTool(tool.name, input);
        emitMcpProxyLatency({
          tool: tool.name,
          duration_ms: Date.now() - start,
          ok: result.ok && !result.isError,
        });
        return { content: result.content, isError: result.isError };
      },
    });
    anthropicTools.push({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    });
  }

  return { registry, anthropicTools };
}

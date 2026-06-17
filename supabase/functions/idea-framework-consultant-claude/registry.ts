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
 * To expose an MCP-backed tool to the chat, add a 'continue' entry whose
 * `execute` POSTs to the MCP `/mcp` endpoint forwarding the caller's JWT
 * (the inverse of src/mcp/edgeFn). Do NOT build that client here — Phase 1 is
 * the registry seam only. See ADR-UNIFIED-COACH-CAPABILITY-LAYER.md §Phase 2.
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
import { callMcpTool } from './mcpClient.ts';
import { MCP_TOOL_NAMES } from './mcpTools.ts';

/** Result of executing one tool call. */
export interface ToolExecResult {
  /** tool_result content string returned to the model. */
  content: string;
  /** Marks the tool_result as is_error so the model can recover. */
  isError: boolean;
}

/** Per-request execution dependencies handed to a tool's execute(). */
export interface ToolContext {
  supabaseClient: SupabaseClientLike | null;
  userId: string | null;
  /** Caller's Supabase JWT, forwarded to the MCP host by MCP-backed tools. */
  jwt: string | null;
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
  // ── MCP-backed tools (ADR Phase 2) ──────────────────────────────────────────
  // Each 'continue' entry forwards to the brand-coach MCP host over HTTP with the
  // caller's JWT (mcpClient.ts). The MCP runs the tool under that identity, reusing
  // its RLS / gateWrite / grounding guardrails. Names + schemas live in mcpTools.ts;
  // index.ts advertises them to the model only when CONSULTANT_TOOL_LOOP_ENABLED.
  ...MCP_TOOL_NAMES.map((name): ToolEntry => ({
    name,
    kind: 'continue',
    async execute(input, ctx): Promise<ToolExecResult> {
      // Defense-in-depth: never forward to the MCP host without an identity.
      // Advertisement is already auth-gated in index.ts; this guards the
      // dispatch layer too, so the invariant doesn't rely on the gate alone.
      if (!ctx.jwt) {
        return { content: `Tool '${name}' requires an authenticated session.`, isError: true };
      }
      const { text, isError } = await callMcpTool({ name, args: input, jwt: ctx.jwt });
      return { content: text, isError };
    },
  })),
];

const BY_NAME = new Map<string, ToolEntry>(ENTRIES.map((e) => [e.name, e]));

export function getToolEntry(name: string): ToolEntry | undefined {
  return BY_NAME.get(name);
}

/** Names of tools that, when emitted alone, should continue the loop. */
export function isContinueTool(name: string): boolean {
  return BY_NAME.get(name)?.kind === 'continue';
}

/**
 * Effective gate for the MCP tool loop. All three must hold:
 *  - `envEnabled`      the CONSULTANT_TOOL_LOOP_ENABLED env kill-switch (global off).
 *  - `requestToolLoop` the per-user PostHog flag, forwarded by the SPA as `tool_loop`.
 *  - `authenticated`   the caller has an identity (MCP tools are JWT-scoped).
 * Env OFF disables for everyone regardless of the flag; the flag drives per-user
 * rollout only while the env switch is ON.
 */
export function computeToolLoopActive(args: {
  envEnabled: boolean;
  requestToolLoop: boolean;
  authenticated: boolean;
}): boolean {
  return args.envEnabled && args.requestToolLoop && args.authenticated;
}

export type ToolBucket = 'extraction' | 'memory' | 'mcp' | 'unknown';

/**
 * Single source of truth for which bucket a tool_use falls into. BOTH the
 * streaming (stream.ts) and non-streaming (loop.ts) categorizers call this so
 * the three-way branch can't drift. Order matters: extraction (terminal) and
 * memory are special-cased before the generic MCP 'continue' tools — memory is
 * itself a continue tool, so it must be matched first.
 */
export function categorizeToolUse(name: string): ToolBucket {
  if (name === 'extract_brand_fields') return 'extraction';
  if (name === 'memory') return 'memory';
  if (isContinueTool(name)) return 'mcp';
  return 'unknown';
}

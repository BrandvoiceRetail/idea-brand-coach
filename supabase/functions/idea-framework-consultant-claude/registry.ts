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

/** Names of tools that, when emitted alone, should continue the loop. */
export function isContinueTool(name: string): boolean {
  return BY_NAME.get(name)?.kind === 'continue';
}

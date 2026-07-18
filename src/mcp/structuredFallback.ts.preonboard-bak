/**
 * Structured-content text fallback.
 *
 * Some MCP clients — notably the claude.ai remote connector — feed only a tool result's
 * `content` blocks to the model and silently drop `structuredContent`. A tool that puts
 * its real payload (ids, records, transcripts) only in `structuredContent` and a bare
 * summary in `content` therefore reaches the model as that summary alone: e.g.
 * `list_coach_conversations` showed "33 coach conversation(s)" with every `session_id` /
 * `avatar_id` stripped, blocking any downstream tool that needs those ids.
 *
 * The MCP spec's remedy is to ALSO serialize the structured payload into a TextContent
 * block for backward compatibility. This wraps `McpServer.registerTool` ONCE (same seam
 * as instrumentToolLatency) so every tool gains that text mirror without editing each
 * module: after a handler returns, if the result carries data-bearing structuredContent
 * not already present in a text block, we append one JSON text block. Strictly additive —
 * `structuredContent` is left intact for clients that do read it.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** Keys that are bookkeeping only — a result with nothing else isn't worth mirroring. */
const BOOKKEEPING_KEYS = new Set(['ok', 'note']);

interface ToolResultShape {
  content?: unknown;
  structuredContent?: unknown;
  [k: string]: unknown;
}

function isTextBlockContaining(block: unknown, json: string): boolean {
  return (
    typeof block === 'object' &&
    block !== null &&
    (block as { type?: unknown }).type === 'text' &&
    typeof (block as { text?: unknown }).text === 'string' &&
    ((block as { text: string }).text).includes(json)
  );
}

/**
 * If `result` carries data-bearing `structuredContent` whose JSON is not already in one
 * of its text blocks, return a copy with that JSON appended as a text block. Otherwise
 * return `result` untouched. Non–tool-result shapes pass through unchanged.
 */
export function mirrorStructuredContent(result: unknown): unknown {
  if (typeof result !== 'object' || result === null) return result;
  const r = result as ToolResultShape;
  const sc = r.structuredContent;
  if (typeof sc !== 'object' || sc === null || !Array.isArray(r.content)) return result;

  // Skip pure bookkeeping payloads (auth refusals, not-found, bare acks) — their text
  // block already says everything; a `{"ok":false,"note":...}` mirror is just noise.
  const hasData = Object.keys(sc as Record<string, unknown>).some((k) => !BOOKKEEPING_KEYS.has(k));
  if (!hasData) return result;

  const json = JSON.stringify(sc);
  if (r.content.some((block) => isTextBlockContaining(block, json))) return result;

  return {
    ...r,
    content: [...r.content, { type: 'text' as const, text: `Structured data (JSON):\n${json}` }],
  };
}

type ToolHandler = (...args: unknown[]) => unknown;

function mirrored(handler: ToolHandler): ToolHandler {
  return async (...callArgs: unknown[]): Promise<unknown> =>
    mirrorStructuredContent(await handler(...callArgs));
}

/**
 * Monkey-patch `server.registerTool` so each subsequently-registered tool's handler has
 * its result run through {@link mirrorStructuredContent}. Call once after `new McpServer`
 * and before the register*Tool() calls (alongside instrumentToolLatency). The cast is
 * confined to this seam; tool modules keep their real typed positioning statement and are untouched.
 */
export function registerStructuredFallback(server: McpServer): void {
  const original = server.registerTool.bind(server) as (...args: unknown[]) => unknown;
  const patched = (...args: unknown[]): unknown => {
    const last = args.length - 1;
    if (typeof args[last] === 'function') {
      args[last] = mirrored(args[last] as ToolHandler);
    }
    return original(...args);
  };
  (server as unknown as { registerTool: typeof patched }).registerTool = patched;
}

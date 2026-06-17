/**
 * Anthropic tool definitions for the MCP-backed tools the chat may call
 * (ADR Phase 2). These mirror the MCP host's tool surface; the model sees them
 * as ordinary tools and the loop dispatches them through registry.ts → mcpClient.
 *
 * Phase 2 scope: the read-only / non-write subset (get_context_status, list_assets,
 * run_trust_gap). The full 28-tool surface follows once these are proven live (P5).
 * run_trust_gap's description carries the skills/idea grounding (the IDEA framework
 * lives in framework/00-foundations/02-idea-framework) so the model uses it faithfully.
 */

export interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export const MCP_TOOL_DEFS: AnthropicToolDef[] = [
  {
    name: 'get_context_status',
    description:
      'Report what brand context the coach already has for this user (avatar fields, product/listing data, latest diagnostic) and what is still missing. Call this before running a diagnostic or generating anything, to decide what to ask for next. Read-only.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_assets',
    description:
      "List the user's logged brand assets from the IV-OS ledger (concepts, drafts, tests) with their status. Read-only; use it to ground the conversation in what already exists rather than asking the user to re-state it.",
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Optional status filter (e.g. draft, approved).' },
        content_type: { type: 'string', description: 'Optional content-type filter.' },
      },
    },
  },
  {
    name: 'run_trust_gap',
    description:
      "Run the Trust Gap diagnostic across the four IDEA trust pillars (Insight-Driven, Distinctive, Empathetic, Authentic) and return the per-pillar read plus the primary gap. Grounded in the IDEA framework (book skill: framework/00-foundations/02-idea-framework) — apply that framework's definitions and do not invent guidance beyond it. Only call this once the user has shared real brand context; never invent the pillar inputs.",
    input_schema: {
      type: 'object',
      properties: {
        scores: {
          type: 'object',
          description:
            'The four IDEA pillar scores (each 0-25), keys: insight, distinctive, empathetic, authentic. Only pass values the user actually provided.',
        },
      },
    },
  },
];

/** Names of the MCP-backed tools (the registry registers a continue-entry per name). */
export const MCP_TOOL_NAMES: string[] = MCP_TOOL_DEFS.map((t) => t.name);

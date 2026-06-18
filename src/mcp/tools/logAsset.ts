/**
 * Layer 2 (tool) — `log_asset` (native asset-ledger write, identity-gated).
 *
 * Records a produced asset in brand-coach's own asset ledger (native Supabase
 * storage, RLS-scoped to the caller). Anonymous callers are denied (see
 * writeAuth.ts); the caller's tag is forwarded as the producing agent unless an
 * explicit agent_name is given.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LedgerClient } from '../ivos/capabilities.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';
import { actorTag, gateWrite } from './writeAuth.js';

const inputSchema = {
  content: z.string().min(1).describe('The asset body (copy/script/listing text)'),
  content_type: z.string().min(1).describe('blog|social|amazon|competitor|other'),
  agent_name: z.string().optional(),
  prompt: z.string().optional(),
  model: z.string().optional(),
  status: z.enum(['success', 'partial', 'failed', 'pending']).optional(),
  campaign_id: z.string().optional(),
  external_id: z
    .string()
    .optional()
    .describe('Optional idempotency/dedup key: re-logging the same external_id reconciles to the existing asset instead of duplicating'),
};

export function registerLogAssetTool(server: McpServer, ivos: LedgerClient): void {
  server.registerTool(
    'log_asset',
    {
      title: 'Log asset (asset ledger)',
      description:
        'Record a produced marketing asset in the brand-coach asset ledger; returns the server-generated request_id. ' +
        'Requires an authenticated caller. Pass external_id to make re-logging idempotent (reconciles instead of duplicating).',
      inputSchema,
    },
    async (args) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;
      const result = await ivos.logAsset({
        ...args,
        agent_name: args.agent_name ?? actorTag(identity),
      });
      safeLog({
        event: 'tool.log_asset',
        caller: userTag(getIdentity()),
        available: result.available,
        ok: result.data?.ok ?? false,
      });
      return {
        content: [
          {
            type: 'text',
            text: result.available
              ? (result.data?.report ?? 'No report returned.')
              : `Asset ledger unavailable: ${result.note}`,
          },
        ],
        structuredContent: {
          available: result.available,
          ok: result.data?.ok ?? false,
          request_id: result.data?.request_id ?? null,
          note: result.note,
        },
      };
    },
  );
}

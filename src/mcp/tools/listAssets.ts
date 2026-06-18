/**
 * Layer 2 (tool) — `list_assets` (native asset-ledger read).
 *
 * Reads brand-coach's own asset ledger (native Supabase storage, RLS-scoped to the
 * caller). Degrades gracefully (availability=false) when the caller is anonymous or a
 * DB error occurs; returns an empty list when the ledger is reachable but empty.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LedgerClient } from '../ivos/capabilities.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  content_type: z.string().optional(),
  status: z.string().optional(),
  campaign_id: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
};

export function registerListAssetsTool(server: McpServer, ivos: LedgerClient): void {
  server.registerTool(
    'list_assets',
    {
      title: 'List assets (asset ledger)',
      description:
        'List produced marketing assets from the asset ledger. Read-only; returns availability=false when the ledger is unavailable.',
      inputSchema,
    },
    async (args) => {
      const result = await ivos.listAssets(args);
      safeLog({
        event: 'tool.list_assets',
        caller: userTag(getIdentity()),
        available: result.available,
        count: result.data.length,
      });
      return {
        content: [
          {
            type: 'text',
            text: result.available
              ? `Asset ledger: ${result.data.length} asset(s).\n${JSON.stringify(result.data, null, 2)}`
              : `Asset ledger unavailable: ${result.note}`,
          },
        ],
        structuredContent: { available: result.available, assets: result.data, note: result.note },
      };
    },
  );
}

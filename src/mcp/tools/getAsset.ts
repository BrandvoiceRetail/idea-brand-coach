/**
 * Layer 2 (tool) — `get_asset` (native asset-ledger read).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LedgerClient } from '../ivos/capabilities.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  request_id: z.string().min(1),
};

export function registerGetAssetTool(server: McpServer, ivos: LedgerClient): void {
  server.registerTool(
    'get_asset',
    {
      title: 'Get asset (asset ledger)',
      description:
        'Fetch one produced asset by request_id from the asset ledger. Read-only; availability=false when the ledger is unavailable.',
      inputSchema,
    },
    async ({ request_id }) => {
      const result = await ivos.getAsset(request_id);
      safeLog({
        event: 'tool.get_asset',
        caller: userTag(getIdentity()),
        available: result.available,
        found: Boolean(result.data),
      });
      return {
        content: [
          {
            type: 'text',
            text: result.available
              ? result.data
                ? JSON.stringify(result.data, null, 2)
                : 'Asset not found in the ledger.'
              : `Asset ledger unavailable: ${result.note}`,
          },
        ],
        structuredContent: { available: result.available, asset: result.data, note: result.note },
      };
    },
  );
}

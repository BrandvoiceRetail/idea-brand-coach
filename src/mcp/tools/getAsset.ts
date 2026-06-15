/**
 * Layer 2 (tool) — `get_asset` (CONSUMED from IV-OS, STABLE read).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IvosLedgerClient } from '../ivos/client.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  request_id: z.string().min(1),
};

export function registerGetAssetTool(server: McpServer, ivos: IvosLedgerClient): void {
  server.registerTool(
    'get_asset',
    {
      title: 'Get asset (IV-OS ledger)',
      description:
        'Fetch one produced asset by request_id from the IV-OS asset ledger. Consumed from IV-OS (read-only); availability=false when IV-OS is unreachable.',
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
                : 'Asset not found in IV-OS ledger.'
              : `IV-OS ledger unavailable: ${result.note}`,
          },
        ],
        structuredContent: { available: result.available, asset: result.data, note: result.note },
      };
    },
  );
}

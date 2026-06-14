/**
 * Layer 2 (tool) — `list_assets` (CONSUMED from IV-OS, STABLE read).
 *
 * Thin pass-through to the IV-OS ledger via the consumption adapter. Brand-coach does
 * NOT own asset storage — this surfaces IV-OS's record. Degrades gracefully when IV-OS
 * is unconfigured/unreachable/empty (see adapter contract).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IvosLedgerClient } from '../ivos/client.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  content_type: z.string().optional(),
  status: z.string().optional(),
  campaign_id: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
};

export function registerListAssetsTool(server: McpServer, ivos: IvosLedgerClient): void {
  server.registerTool(
    'list_assets',
    {
      title: 'List assets (IV-OS ledger)',
      description:
        'List produced marketing assets from the IV-OS asset ledger. Consumed from IV-OS (read-only); returns availability=false when the IV-OS ledger is not reachable.',
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
              ? `IV-OS ledger: ${result.data.length} asset(s).\n${JSON.stringify(result.data, null, 2)}`
              : `IV-OS ledger unavailable: ${result.note}`,
          },
        ],
        structuredContent: { available: result.available, assets: result.data, note: result.note },
      };
    },
  );
}

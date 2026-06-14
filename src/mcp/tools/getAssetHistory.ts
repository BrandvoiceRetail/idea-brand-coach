/**
 * Layer 2 (tool) — `get_asset_history` (CONSUMED from IV-OS, read).
 *
 * Surfaces an asset's append-only change log (logged / status transitions /
 * assessments, each with actor + old/new values) — the change-tracking view
 * that pairs with `record_assessment` and `update_asset_status`. The IV-OS
 * Markdown report is forwarded verbatim.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IvosLedgerClient } from '../ivos/client.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  request_id: z.string().min(1),
};

export function registerGetAssetHistoryTool(server: McpServer, ivos: IvosLedgerClient): void {
  server.registerTool(
    'get_asset_history',
    {
      title: 'Get asset history (IV-OS change log)',
      description:
        'Fetch the append-only change log for one asset by request_id: when it was logged, every approval ' +
        'transition (old → new, with actor), and recorded assessments. Consumed from IV-OS (read-only); ' +
        'availability=false when IV-OS is unreachable.',
      inputSchema,
    },
    async ({ request_id }) => {
      const result = await ivos.getAssetHistory(request_id);
      safeLog({
        event: 'tool.get_asset_history',
        caller: userTag(getIdentity()),
        available: result.available,
        found: Boolean(result.data),
      });
      return {
        content: [
          {
            type: 'text',
            text: result.available
              ? (result.data ?? 'IV-OS returned no history report.')
              : `IV-OS ledger unavailable: ${result.note}`,
          },
        ],
        structuredContent: { available: result.available, report: result.data, note: result.note },
      };
    },
  );
}

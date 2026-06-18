/**
 * Layer 2 (tool) — `update_asset_status` (native asset-ledger write, identity-gated).
 *
 * Drives an asset's APPROVAL lifecycle (draft → in_review → approved/rejected)
 * in the asset ledger. Each transition lands in the append-only change log
 * with the caller's tag as reviewer, so the full change history stays auditable
 * via `get_asset_history`.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LedgerClient } from '../ivos/capabilities.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';
import { actorTag, gateWrite } from './writeAuth.js';

const inputSchema = {
  request_id: z.string().min(1),
  approval_status: z.enum(['draft', 'in_review', 'approved', 'rejected']),
  reviewer_id: z.string().optional(),
  notes: z.string().optional(),
};

export function registerUpdateAssetStatusTool(server: McpServer, ivos: LedgerClient): void {
  server.registerTool(
    'update_asset_status',
    {
      title: 'Update asset status (asset ledger)',
      description:
        'Transition an asset through its APPROVAL lifecycle (draft → in_review → approved/rejected) in the ' +
        'asset ledger; the transition is recorded in the asset change log. Asset-ledger write — requires an ' +
        'authenticated caller; availability=false when the ledger is unavailable.',
      inputSchema,
    },
    async (args) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;
      const result = await ivos.updateAssetStatus({
        ...args,
        reviewer_id: args.reviewer_id ?? actorTag(identity),
      });
      safeLog({
        event: 'tool.update_asset_status',
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
          request_id: result.data?.request_id ?? args.request_id,
          note: result.note,
        },
      };
    },
  );
}

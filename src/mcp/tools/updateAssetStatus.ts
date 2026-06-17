/**
 * Layer 2 (tool) — `update_asset_status` (CONSUMED IV-OS write, identity-gated).
 *
 * Drives an asset's APPROVAL lifecycle (draft → in_review → approved/rejected)
 * in the IV-OS ledger. Each transition lands in IV-OS's append-only change log
 * with the caller's tag as reviewer, so the full change history stays auditable
 * via `get_asset_history`.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IvosLedgerClient } from '../ivos/client.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';
import { actorTag, gateWrite } from './writeAuth.js';

const inputSchema = {
  request_id: z.string().min(1),
  approval_status: z.enum(['draft', 'in_review', 'approved', 'rejected']),
  reviewer_id: z.string().optional(),
  notes: z.string().optional(),
};

export function registerUpdateAssetStatusTool(server: McpServer, ivos: IvosLedgerClient): void {
  server.registerTool(
    'update_asset_status',
    {
      title: 'Update asset status (IV-OS ledger)',
      description:
        'Transition an asset through its APPROVAL lifecycle (draft → in_review → approved/rejected) in the ' +
        'IV-OS ledger; the transition is recorded in the asset change log. Consumed IV-OS write — requires an ' +
        'authenticated caller; availability=false when IV-OS is unreachable.',
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
              ? (result.data?.report ?? 'IV-OS returned no report.')
              : `IV-OS ledger unavailable: ${result.note}`,
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

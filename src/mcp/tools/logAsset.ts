/**
 * Layer 2 (tool) — `log_asset` (CONSUMED IV-OS write, identity-gated).
 *
 * Records a produced asset in the IV-OS ledger. Brand-coach does NOT own asset
 * storage — this writes IV-OS's record. Anonymous callers are denied (see
 * writeAuth.ts); the caller's tag is forwarded as the producing agent unless an
 * explicit agent_name is given.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IvosLedgerClient } from '../ivos/client.js';
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
};

export function registerLogAssetTool(server: McpServer, ivos: IvosLedgerClient): void {
  server.registerTool(
    'log_asset',
    {
      title: 'Log asset (IV-OS ledger)',
      description:
        'Record a produced marketing asset in the IV-OS asset ledger; returns the server-generated request_id. ' +
        'Consumed IV-OS write — requires an authenticated caller; availability=false when IV-OS is unreachable.',
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
              ? (result.data?.report ?? 'IV-OS returned no report.')
              : `IV-OS ledger unavailable: ${result.note}`,
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

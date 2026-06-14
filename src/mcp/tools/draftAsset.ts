/**
 * Layer 2 (tool) — `draft_asset` (OWNED, critical path: chain link 3 — produces copy).
 *
 * VERBATIM wrap of the existing `brand-copy-generator` edge fn (Calculation Parity):
 * the engine-facing fields mirror its `CopyRequest` interface 1:1 and are passed
 * through untouched (the auto-record controls below are stripped before the call),
 * so MCP output is identical to the in-app path. The edge fn already grounds in the
 * caller's user-KB context server-side.
 *
 * AUTO-RECORDING: on success the produced copy is recorded into the IV-OS ledger via
 * `log_asset` (attributed to `brand-coach-mcp:<userTag>`), unless `record:false`.
 * Never-fail: a degraded write annotates `structuredContent.recorded` — it never
 * breaks the draft itself.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { EdgeFnClient } from '../edgeFn/client.js';
import type { IvosLedgerClient } from '../ivos/client.js';
import { actorTag } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

interface CopyResponse {
  copy: string;
  hasUserContext: boolean;
  format: string;
}

export interface RecordedNote {
  ok: boolean;
  request_id?: string | null;
  note?: string;
}

// Engine fields mirror supabase/functions/brand-copy-generator CopyRequest verbatim;
// `record` / `campaign_id` are gateway-only controls stripped before the engine call.
const inputSchema = {
  productName: z.string().min(1),
  category: z.string().min(1),
  features: z.array(z.string()).min(1),
  targetAudience: z.string().min(1),
  emotionalPayoff: z.string().min(1),
  tone: z.string().min(1),
  format: z.string().min(1).describe('Copy format, e.g. amazon_bullets, product_description, social_post.'),
  additionalContext: z.string().optional(),
  record: z.boolean().default(true).describe('Auto-record the produced copy into the IV-OS asset ledger (log_asset).'),
  campaign_id: z.string().optional().describe('Optional campaign to attribute the recorded asset to.'),
};

export function registerDraftAssetTool(server: McpServer, edgeFn: EdgeFnClient, ivos: IvosLedgerClient): void {
  server.registerTool(
    'draft_asset',
    {
      title: 'Draft a copy asset',
      description:
        'Owned asset-chain tool: draft emotionally resonant brand copy via the existing brand-copy-generator engine, wrapped verbatim (Calculation Parity — identical output to the in-app path, grounded in the caller’s knowledge base server-side). Requires an authenticated Supabase JWT. On success the copy is auto-recorded into the IV-OS asset ledger (log_asset) unless record:false; a degraded write never fails the draft.',
      inputSchema,
    },
    async (args) => {
      const { record, campaign_id, ...copyRequest } = args;
      const res = await edgeFn.invoke<CopyResponse>('brand-copy-generator', copyRequest);
      if (!res.ok || !res.data?.copy) {
        safeLog({ level: 'warn', event: 'tool.draft_asset.unavailable', caller: userTag(getIdentity()) });
        return {
          content: [{ type: 'text' as const, text: `draft_asset unavailable: ${res.note ?? 'empty engine reply'}` }],
          structuredContent: { ok: false, copy: null, note: res.note ?? 'empty engine reply' },
        };
      }

      // Auto-record (never-fail). EdgeFnClient already guaranteed an authenticated caller here.
      let recorded: RecordedNote;
      if (!record) {
        recorded = { ok: false, note: 'opt-out (record:false) — not written to the IV-OS ledger' };
      } else {
        const write = await ivos.logAsset({
          content: res.data.copy,
          content_type: copyRequest.format,
          agent_name: actorTag(getIdentity()),
          prompt: `${copyRequest.productName} — ${copyRequest.format}`,
          status: 'success',
          campaign_id,
        });
        recorded =
          write.available && write.data?.ok
            ? { ok: true, request_id: write.data.request_id }
            : { ok: false, note: write.note ?? 'IV-OS ledger write degraded' };
      }

      safeLog({
        event: 'tool.draft_asset',
        caller: userTag(getIdentity()),
        format: res.data.format,
        hasUserContext: res.data.hasUserContext,
        recorded: recorded.ok,
      });
      return {
        content: [{ type: 'text' as const, text: res.data.copy }],
        structuredContent: {
          ok: true,
          copy: res.data.copy,
          format: res.data.format,
          hasUserContext: res.data.hasUserContext,
          recorded,
        },
      };
    },
  );
}

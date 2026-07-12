/**
 * Layer 2 (tool) — `run_ppc_audit` (OWNED — the PPC optimizer + Trust-Gap on-ramp).
 *
 * Reads the seller's OWN ingested Amazon Ads search-term rows (ad_search_terms), aggregates them
 * to funnel pieces, and runs the deterministic PPC engine (buildPpcAudit): RPC-method bid guidance,
 * ACOS/ROAS/CPC (+TACoS when total_sales is present), search-term harvest/negate, and — the
 * strategically important half — the ON-RAMP: pieces pulling real clicks but converting poorly are
 * routed to run_trust_gap (a listing problem, not a bid problem), not given a bid tweak.
 *
 * PURE-HOST-SIDE first increment (like run_trust_gap): no edge fn, no persistence. The numbers are
 * deterministic; the connector coach composes the narrative. Persisting a `ppc_audit` artifact +
 * a prose edge fn is a documented fast-follow. Identity-gated (private ad data); honest no_data.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { groundingPreamble } from '../skills/skillLoader.js';
import { appGroundingPreamble } from '../skills/appSkills.js';
import { getSearchTerms, SearchTermError, type SearchTermRow } from '../service/searchTermService.js';
import { buildPpcAudit, type PpcPieceInput, type PpcSearchTermInput } from '../service/ppcAudit.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';

const inputSchema = {
  target_acos: z
    .number()
    .positive()
    .max(1)
    .optional()
    .describe('Target ACOS as a FRACTION 0–1 (e.g. 0.3 for 30%). Defaults to 0.3 if omitted.'),
  brand_asset_id: z
    .string()
    .min(1)
    .optional()
    .describe('Optional funnel piece to scope the audit to; omit to audit all pieces with ingested search-term data.'),
  from: z.string().optional().describe('Optional start date (YYYY-MM-DD) of the window.'),
  to: z.string().optional().describe('Optional end date (YYYY-MM-DD) of the window.'),
};

/** Aggregate search-term rows up to funnel pieces (spend/clicks/orders/ad-sales per brand_asset). */
function aggregatePieces(rows: SearchTermRow[]): PpcPieceInput[] {
  const byPiece = new Map<string, PpcPieceInput>();
  for (const r of rows) {
    if (!r.brand_asset_id) continue; // unattributed terms still feed harvest/negate, just not a piece
    const p = byPiece.get(r.brand_asset_id) ?? {
      brandAssetId: r.brand_asset_id,
      label: r.brand_asset_id,
      spend: 0,
      adSales: 0,
      clicks: 0,
      orders: 0,
    };
    p.spend = (p.spend ?? 0) + r.spend;
    p.adSales = (p.adSales ?? 0) + r.sales;
    p.clicks = (p.clicks ?? 0) + r.clicks;
    p.orders = (p.orders ?? 0) + r.orders;
    byPiece.set(r.brand_asset_id, p);
  }
  return [...byPiece.values()];
}

export function registerRunPpcAuditTool(server: McpServer): void {
  server.registerTool(
    'run_ppc_audit',
    {
      title: 'Run a PPC audit (optimizer + Trust-Gap on-ramp)',
      description:
        "Audit the seller's Amazon PPC from their OWN ingested search-term data (ingest_search_terms first). Deterministic — never fabricates a number. Returns: per-piece ACOS/ROAS/CPC/CVR (+TACoS when total_sales is present), RPC-method bid guidance (suggested bid = revenue-per-click × target ACOS, applied off current CPC), search-term HARVEST candidates (converting terms to promote to exact) and NEGATE candidates (clicks with zero orders — the wasted spend), and campaign-structure flags. Crucially it also classifies each piece BID-problem vs CONVERSION-problem: a piece pulling real clicks but converting poorly is a listing/Trust-Gap problem, not a bid problem — the audit routes it to run_trust_gap and the creative fix rather than a bid tweak. Honest no_data when there's no ingested search-term data or too few clicks to judge. Method adapted from AdLabs' published Amazon PPC framework (paraphrased, attributed)." +
        groundingPreamble('run_ppc_audit') +
        appGroundingPreamble('run_ppc_audit'),
      inputSchema,
    },
    async ({ target_acos, brand_asset_id, from, to }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      try {
        const rows = await getSearchTerms({ brandAssetId: brand_asset_id, from, to });
        if (rows.length === 0) {
          safeLog({ event: 'tool.run_ppc_audit', caller: userTag(identity), pieces: 0, terms: 0 });
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No ingested search-term data to audit (no_data). Pull the Amazon Ads search-term report and ingest it with ingest_search_terms first — then re-run.',
              },
            ],
            structuredContent: { ok: false, note: 'no_data' },
          };
        }

        const searchTerms: PpcSearchTermInput[] = rows.map((r) => ({
          searchTerm: r.search_term,
          matchType: r.match_type,
          impressions: r.impressions,
          clicks: r.clicks,
          spend: r.spend,
          orders: r.orders,
          sales: r.sales,
        }));
        const result = buildPpcAudit({ targetAcos: target_acos, pieces: aggregatePieces(rows), searchTerms });

        safeLog({
          event: 'tool.run_ppc_audit',
          caller: userTag(identity),
          pieces: result.pieces.length,
          on_ramp: result.on_ramp.length,
          harvest: result.harvest.length,
          negate: result.negate.length,
        });
        return {
          content: [{ type: 'text' as const, text: `${result.summary}\n\n${JSON.stringify(result, null, 2)}` }],
          structuredContent: { ...result },
        };
      } catch (err) {
        const note = err instanceof SearchTermError ? err.message : 'failed to run PPC audit';
        safeLog({ level: 'warn', event: 'tool.run_ppc_audit.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not run the PPC audit: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}

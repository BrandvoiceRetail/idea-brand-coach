/**
 * Layer 2 (tool) — `generate_storefront_messaging_plan` (OWNED — the storefront brand assets).
 *
 * Plans the Amazon Store (hero banner, brand story, tagline system, category tiles,
 * product row) as one continuous expression of the positioning, consistency-checked
 * against the listing set, A+ page, and video. Director only — never produces images,
 * never invents a claim.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { groundingPreamble } from '../skills/skillLoader.js';
import { appGroundingPreamble } from '../skills/appSkills.js';
import { buildStorefrontMessagingPlan } from '../service/storefrontMessaging.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  product: z
    .string()
    .min(3)
    .describe('The brand / flagship product the storefront is for — a name plus a sentence of context.'),
  decision_trigger: z
    .enum(['permission', 'recognition', 'identity', 'belonging', 'momentum', 'fear_of_loss'])
    .optional()
    .describe('The identified Decision Trigger, if known (else identify it first via identify_decision_trigger).'),
  avatar_summary: z
    .string()
    .optional()
    .describe("Short summary of the Avatar 2.0 emotional core + their jobs/use-cases, if the coach has it."),
  positioning_statement: z.string().optional().describe('The chosen Positioning Statement (distinctive line) — drives the tagline system.'),
  trust_gap_summary: z
    .string()
    .optional()
    .describe('The Trust Gap finding — weakest pillar + score — if known.'),
  verified_facts: z
    .string()
    .optional()
    .describe('User-confirmed product/brand facts safe to state in storefront copy.'),
  marketplace: z.string().optional().describe('Marketplace; defaults to amazon.'),
  brand_asset_id: z
    .string()
    .optional()
    .describe('The funnel piece (brand_asset) the storefront maps to, to wire measurement.'),
};

export function registerGenerateStorefrontMessagingPlanTool(server: McpServer): void {
  server.registerTool(
    'generate_storefront_messaging_plan',
    {
      title: 'Generate storefront messaging plan (brand assets, Higgsfield-ready)',
      description:
        'Plan the STOREFRONT as one continuous expression of the positioning: the hero banner (3000×600, photoreal — Higgsfield generate_image + outpaint for the wide aspect), the empathetic-led brand story block, the positioning statement-derived tagline system (one master line + variants used identically everywhere), job-mapped category tiles in the avatar\'s vocabulary, and a featured-products row that reuses the winning main-image+title pairs so the storefront visibly rhymes with the listings. Returns per-section direction + IMAGE_PROMPT construction + the Higgsfield handoff + the cross-surface consistency rules (same spine as the listing set, A+ and video — refine_creative_plan keeps them in sync when positioning changes). You (the coach) compose the final claim-gated copy and prompts. Works with partial context — missing positioning inputs degrade honestly. Generates plans only, never images, never invented claims.' +
        groundingPreamble('generate_storefront_messaging_plan') +
        appGroundingPreamble('generate_storefront_messaging_plan'),
      inputSchema,
    },
    async ({ product, decision_trigger, avatar_summary, positioning_statement, trust_gap_summary, verified_facts, marketplace, brand_asset_id }) => {
      const result = buildStorefrontMessagingPlan({
        product,
        decisionTrigger: decision_trigger,
        avatarSummary: avatar_summary,
        positioning_statement,
        trustGapSummary: trust_gap_summary,
        verifiedFacts: verified_facts,
        marketplace,
        brandAssetId: brand_asset_id,
      });
      safeLog({
        event: 'tool.generate_storefront_messaging_plan',
        caller: userTag(getIdentity()),
        marketplace: result.marketplace,
        decision_trigger: result.decision_trigger,
        sections: result.sections.length,
      });
      return {
        content: [{ type: 'text' as const, text: `${result.summary}\n\n${JSON.stringify(result, null, 2)}` }],
        structuredContent: { ...result },
      };
    },
  );
}

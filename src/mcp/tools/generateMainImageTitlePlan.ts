/**
 * Layer 2 (tool) — `generate_main_image_title_plan` (OWNED — the search-grid pair).
 *
 * Plans the main image + title as ONE coherent positioning statement: the two things
 * a shopper sees before the click, each carrying the part of the story the other
 * cannot. Director only — never produces images, never invents a claim.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { groundingPreamble } from '../skills/skillLoader.js';
import { appGroundingPreamble } from '../skills/appSkills.js';
import { buildMainImageTitlePlan } from '../service/mainImageTitle.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  product: z
    .string()
    .min(3)
    .describe('The product / listing the pair is for — a name plus a sentence of context, or an ASIN.'),
  decision_trigger: z
    .enum(['permission', 'recognition', 'identity', 'belonging', 'momentum', 'fear_of_loss'])
    .optional()
    .describe('The identified Decision Trigger, if known (else identify it first via identify_decision_trigger).'),
  avatar_summary: z
    .string()
    .optional()
    .describe("Short summary of the Avatar 2.0 emotional core + their search vocabulary, if the coach has it."),
  signature: z.string().optional().describe('The chosen Signature (distinctive line), if one exists.'),
  trust_gap_summary: z
    .string()
    .optional()
    .describe('The Trust Gap finding — weakest pillar + score — if known.'),
  verified_facts: z
    .string()
    .optional()
    .describe('User-confirmed product facts (size/count/variant/claims) the title may state, verbatim.'),
  marketplace: z.string().optional().describe('Marketplace; defaults to amazon.'),
  brand_asset_id: z
    .string()
    .optional()
    .describe('The funnel piece (brand_asset) this pair is for, to wire the split-test.'),
};

export function registerGenerateMainImageTitlePlanTool(server: McpServer): void {
  server.registerTool(
    'generate_main_image_title_plan',
    {
      title: 'Generate main image + title plan (the search-grid pair)',
      description:
        'Plan the MAIN IMAGE and the TITLE as one coherent positioning statement — the search-grid pair that wins or loses the click together. Returns the title formula (brand + the avatar\'s real keyword + the signature-derived distinctive difference inside the first ~80 mobile-visible characters + exact facts verbatim) with Amazon style-guide rules, the policy-clean main-image brief (pure white background, product only, NO added text/badges; the Decision Trigger shows through styling/angle/finish only), the coherence rules that make the pair tell ONE story, IMAGE_PROMPT construction with the exact negative prompt + the Higgsfield generate_image handoff, and the split-test plan (the main image is the highest-traffic test a listing has). You (the coach) compose 2-3 claim-gated variants of each. Works with partial context — missing positioning inputs degrade honestly. Generates plans only, never images, never invented claims.' +
        groundingPreamble('generate_main_image_title_plan') +
        appGroundingPreamble('generate_main_image_title_plan'),
      inputSchema,
    },
    async ({ product, decision_trigger, avatar_summary, signature, trust_gap_summary, verified_facts, marketplace, brand_asset_id }) => {
      const result = buildMainImageTitlePlan({
        product,
        decisionTrigger: decision_trigger,
        avatarSummary: avatar_summary,
        signature,
        trustGapSummary: trust_gap_summary,
        verifiedFacts: verified_facts,
        marketplace,
        brandAssetId: brand_asset_id,
      });
      safeLog({
        event: 'tool.generate_main_image_title_plan',
        caller: userTag(getIdentity()),
        marketplace: result.marketplace,
        decision_trigger: result.decision_trigger,
      });
      return {
        content: [{ type: 'text' as const, text: `${result.summary}\n\n${JSON.stringify(result, null, 2)}` }],
        structuredContent: { ...result },
      };
    },
  );
}

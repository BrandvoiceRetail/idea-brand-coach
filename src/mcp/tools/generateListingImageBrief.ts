/**
 * Layer 2 (tool) — `generate_listing_image_brief` (OWNED — the image-set design brief).
 *
 * Generates an Amazon-optimised, IDEA-incorporated **listing image SET** design brief:
 * one brief per slot (main + gallery), each tied to the Decision Trigger, the Avatar's
 * emotional core, and the Trust Gap pillar it closes — ready to hand to a photographer,
 * a photoreal AI image generator, or Genrupt.
 *
 * It is a grounding-director: it returns the full Amazon image-set framework + per-slot
 * direction + execution routing + the claim gate, and the connector coach composes the
 * final per-slot prose + the ready-to-paste image prompts for the user's product and
 * resolved IDEA context. It NEVER produces images and NEVER fabricates a claim.
 *
 * Encodes the Amazon conventions the coach was missing in live sessions: the MAIN image is
 * pure-white-background product photography with NO added text/badges (Amazon policy) — all
 * IDEA/trigger/badge/lifestyle work lives in the gallery — and photoreal slots route to a
 * real image engine (photography / Midjourney / DALL-E / Genrupt), NOT Canva layout-gen.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { groundingPreamble } from '../skills/skillLoader.js';
import { appGroundingPreamble } from '../skills/appSkills.js';
import { buildListingImageBrief } from '../service/listingImageBrief.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  product: z
    .string()
    .min(3)
    .describe('The product / listing the image set is for — a name plus a sentence of context, or an ASIN.'),
  decision_trigger: z
    .enum(['permission', 'recognition', 'identity', 'belonging', 'momentum', 'fear_of_loss'])
    .optional()
    .describe('The identified Decision Trigger, if known (else identify it first via identify_decision_trigger).'),
  avatar_summary: z
    .string()
    .optional()
    .describe("Short summary of the Avatar 2.0 emotional core (the felt experience), if the coach has it."),
  trust_gap_summary: z
    .string()
    .optional()
    .describe('The Trust Gap finding — weakest pillar + score — if known.'),
  marketplace: z.string().optional().describe('Marketplace; defaults to amazon.'),
  brand_asset_id: z
    .string()
    .optional()
    .describe('The funnel piece (brand_asset) this set is for, to wire the split-test.'),
};

export function registerGenerateListingImageBriefTool(server: McpServer): void {
  server.registerTool(
    'generate_listing_image_brief',
    {
      title: 'Generate Amazon listing image-set design brief',
      description:
        'Generate an Amazon-optimised, IDEA-incorporated design brief for a full LISTING IMAGE SET (main + gallery), grounded in the Decision Trigger, Avatar 2.0, and the Trust Gap. Returns the slot architecture + per-slot direction + execution routing + the claim gate; you (the coach) then compose each slot\'s brief and a ready-to-paste image prompt for the user\'s product. Knows Amazon image conventions: the MAIN image is pure-white-background product PHOTOGRAPHY with NO added text/badges (Amazon policy) — the IDEA/trigger/badge/lifestyle work lives in the gallery slots; the empathetic line LEADS the lifestyle slot; all claims/sizing are preserved exactly. Routes photoreal slots (main, lifestyle) to real photography / a photoreal AI generator (Midjourney, DALL-E, Imagen) / Genrupt — NOT Canva generate-design, which produces layouts, not product photos. Also returns: an optional A+ long-form editorial brief (for Brand-Registered sellers), ready-to-generate IMAGE_PROMPT production-prompt construction with the exact negative prompt, evidence triage (verified facts vs strategy signals vs unsupported), and a QA bar. Generates briefs only, never images, never invented claims.' +
        groundingPreamble('generate_listing_image_brief') +
        appGroundingPreamble('generate_listing_image_brief'),
      inputSchema,
    },
    async ({ product, decision_trigger, avatar_summary, trust_gap_summary, marketplace, brand_asset_id }) => {
      const result = buildListingImageBrief({
        product,
        decisionTrigger: decision_trigger,
        avatarSummary: avatar_summary,
        trustGapSummary: trust_gap_summary,
        marketplace,
        brandAssetId: brand_asset_id,
      });
      safeLog({
        event: 'tool.generate_listing_image_brief',
        caller: userTag(getIdentity()),
        marketplace: result.marketplace,
        decision_trigger: result.decision_trigger,
        slots: result.slots.length,
      });
      return {
        content: [{ type: 'text' as const, text: `${result.summary}\n\n${JSON.stringify(result, null, 2)}` }],
        structuredContent: { ...result },
      };
    },
  );
}

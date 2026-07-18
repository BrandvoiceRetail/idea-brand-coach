/**
 * Layer 2 (tool) — `generate_aplus_content_plan` (OWNED — the A+ brand-story content plan).
 *
 * Generates the full A+ Content plan: 4 long-form editorial concepts × 5 addressable
 * narrative beats as ONE continuous composition, grounded in the positioning spine,
 * with the Higgsfield `generate_image` execution route and a beat-level adjustment
 * protocol. Director only — never produces images, never invents a claim.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { groundingPreamble } from '../skills/skillLoader.js';
import { appGroundingPreamble } from '../skills/appSkills.js';
import { buildAplusPlan } from '../service/aplusPlan.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  product: z
    .string()
    .min(3)
    .describe('The product / listing the A+ page is for — a name plus a sentence of context, or an ASIN.'),
  decision_trigger: z
    .enum(['permission', 'recognition', 'identity', 'belonging', 'momentum', 'fear_of_loss'])
    .optional()
    .describe('The identified Decision Trigger, if known (else identify it first via identify_decision_trigger).'),
  avatar_summary: z
    .string()
    .optional()
    .describe("Short summary of the Avatar 2.0 emotional core (the felt experience), if the coach has it."),
  positioning_statement: z.string().optional().describe('The chosen Positioning Statement (distinctive line), if one exists.'),
  trust_gap_summary: z
    .string()
    .optional()
    .describe('The Trust Gap finding — weakest pillar + score — if known.'),
  verified_facts: z
    .string()
    .optional()
    .describe('User-confirmed product facts (claims/dimensions/counts) safe to state as on-image copy.'),
  marketplace: z.string().optional().describe('Marketplace; defaults to amazon.'),
  brand_asset_id: z
    .string()
    .optional()
    .describe('The funnel piece (brand_asset) this page is for, to wire the split-test.'),
};

export function registerGenerateAplusContentPlanTool(server: McpServer): void {
  server.registerTool(
    'generate_aplus_content_plan',
    {
      title: 'Generate A+ Content plan (long-form editorial, Higgsfield-ready)',
      description:
        'Generate the full A+ (brand-story) CONTENT PLAN for a Brand-Registered Amazon listing: 4 distinct long-form editorial concepts, each running 5 addressable narrative beats (product intro → strongest benefit → product clarity → use case → emotional close) as ONE continuous composition at 1472x3008 — never stacked template modules. Grounded in the Decision Trigger, Avatar 2.0, the Positioning Statement, and the Trust Gap; returns per-beat direction + mobile legibility rules + IMAGE_PROMPT production-prompt construction with the exact negative prompt + the Higgsfield generate_image handoff (real product photo as strict reference; outpaint/upscale for mechanical changes) — you (the coach) then compose each concept\'s brief and ready-to-paste prompt. Built for easy adjustment: each beat is an independent component, and positioning changes route through refine_creative_plan. Works with partial context — missing inputs degrade honestly. Generates plans only, never images, never invented claims.' +
        groundingPreamble('generate_aplus_content_plan') +
        appGroundingPreamble('generate_aplus_content_plan'),
      inputSchema,
    },
    async ({ product, decision_trigger, avatar_summary, positioning_statement, trust_gap_summary, verified_facts, marketplace, brand_asset_id }) => {
      const result = buildAplusPlan({
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
        event: 'tool.generate_aplus_content_plan',
        caller: userTag(getIdentity()),
        marketplace: result.marketplace,
        decision_trigger: result.decision_trigger,
        beats: result.beats.length,
      });
      return {
        content: [{ type: 'text' as const, text: `${result.summary}\n\n${JSON.stringify(result, null, 2)}` }],
        structuredContent: { ...result },
      };
    },
  );
}

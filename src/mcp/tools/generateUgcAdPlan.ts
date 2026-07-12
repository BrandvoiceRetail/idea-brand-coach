/**
 * Layer 2 (tool) — `generate_ugc_ad_plan` (OWNED — the script-level UGC ad plan).
 *
 * Plans UGC-style ads (review, try-on, unboxing, problem-solution) as first-class
 * creative assets: persona cast from the customer avatar, trigger-angled hook variants
 * over one body, claim-gated talking points, AI-presenter honesty rails, and the
 * Higgsfield marketing-studio execution route. Director only — never renders video,
 * never invents a claim, never frames the AI presenter as a real customer.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { groundingPreamble } from '../skills/skillLoader.js';
import { appGroundingPreamble } from '../skills/appSkills.js';
import { buildUgcAdPlan } from '../service/ugcAdPlan.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  product: z
    .string()
    .min(3)
    .describe('The product the ad is for — a name plus a sentence of context, or an ASIN.'),
  ugc_format: z
    .enum(['review', 'try_on', 'unboxing', 'problem_solution'])
    .optional()
    .describe('The UGC format; defaults to review (the full-arc talking-head ad).'),
  decision_trigger: z
    .enum(['permission', 'recognition', 'identity', 'belonging', 'momentum', 'fear_of_loss'])
    .optional()
    .describe('The identified Decision Trigger, if known (else identify it first via identify_decision_trigger).'),
  avatar_summary: z
    .string()
    .optional()
    .describe("Short summary of the Avatar 2.0 emotional core + vocabulary + top objection — drives the persona cast and the skeptic flip."),
  signature: z.string().optional().describe('The chosen Signature (distinctive line), if one exists.'),
  trust_gap_summary: z
    .string()
    .optional()
    .describe('The Trust Gap finding — weakest pillar + score — if known.'),
  verified_facts: z
    .string()
    .optional()
    .describe('User-confirmed product facts the presenter may state, verbatim.'),
  platform: z
    .string()
    .optional()
    .describe('Where the ad runs (meta / tiktok / amazon_listing / …); defaults to meta.'),
  brand_asset_id: z
    .string()
    .optional()
    .describe('The funnel piece (brand_asset) this ad is for, to wire the split-test.'),
};

export function registerGenerateUgcAdPlanTool(server: McpServer): void {
  server.registerTool(
    'generate_ugc_ad_plan',
    {
      title: 'Generate UGC ad plan (script + persona, Higgsfield preset-ready)',
      description:
        'Generate a script-level UGC AD PLAN — review/talking-head, try-on, unboxing, or problem-solution — grounded in the Decision Trigger, Avatar 2.0, the Signature, and the Trust Gap. Returns the script beat architecture (spoken hook → why-I-got-this → real-time trial → benefit talking points in the avatar\'s vocabulary → the "I thought X, but…" skeptic flip → CTA), the persona spec (CAST from the customer avatar — demographic, register, setting; never a random preset face), 3 trigger-angled hook variants over one body (the hook is the test variable), AI-presenter honesty rails (actor, never framed as a real customer; disclosure + platform/Amazon policy), and the Higgsfield execution route (marketing-studio preset per format, 9:16 ~15s, product + packaging from the reference kit) plus the volume testing loop (ship hook variants → read metrics → scale the winner → refresh on fatigue). You (the coach) compose the final scripts and preset inputs. Works with partial context — missing positioning inputs degrade honestly. Generates plans only, never video, never invented claims.' +
        groundingPreamble('generate_ugc_ad_plan') +
        appGroundingPreamble('generate_ugc_ad_plan'),
      inputSchema,
    },
    async ({ product, ugc_format, decision_trigger, avatar_summary, signature, trust_gap_summary, verified_facts, platform, brand_asset_id }) => {
      const result = buildUgcAdPlan({
        product,
        ugcFormat: ugc_format,
        decisionTrigger: decision_trigger,
        avatarSummary: avatar_summary,
        signature,
        trustGapSummary: trust_gap_summary,
        verifiedFacts: verified_facts,
        platform,
        brandAssetId: brand_asset_id,
      });
      safeLog({
        event: 'tool.generate_ugc_ad_plan',
        caller: userTag(getIdentity()),
        format: result.format.key,
        platform: result.platform,
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

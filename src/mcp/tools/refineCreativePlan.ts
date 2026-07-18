/**
 * Layer 2 (tool) — `refine_creative_plan` (OWNED — the update path for every creative plan).
 *
 * Handles both change classes a user brings: a COMPONENT change (one scene, one slot,
 * one beat, one section, one title segment — recompose only that, re-run one job) and a
 * POSITIONING change (new trigger/avatar/positioning statement/trust finding/corrected fact — the
 * deterministic propagation map names what recomposes on this plan AND flags the user's
 * other live plans as stale so every surface keeps telling the same story).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { groundingPreamble } from '../skills/skillLoader.js';
import { appGroundingPreamble } from '../skills/appSkills.js';
import { buildCreativePlanRefinement } from '../service/refineCreativePlan.js';
import { CREATIVE_PLAN_TYPES, POSITIONING_ELEMENT_KEYS } from '../service/creativeAlignment.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  plan_type: z
    .enum(CREATIVE_PLAN_TYPES as unknown as [string, ...string[]])
    .describe('Which creative plan the user wants to change.'),
  change_request: z
    .string()
    .min(3)
    .describe("The user's change, in their words (e.g. 'scene 3 should show the morning routine', 'we corrected the count to 12')."),
  positioning_changes: z
    .array(z.enum(POSITIONING_ELEMENT_KEYS as unknown as [string, ...string[]]))
    .optional()
    .describe('Positioning elements that changed (decision_trigger / avatar_core / positioning statement / trust_gap_pillar / verified_facts). Omit for a component-level change.'),
  asset_id: z.string().optional().describe("The saved plan's ledger asset id, if known."),
};

export function registerRefineCreativePlanTool(server: McpServer): void {
  server.registerTool(
    'refine_creative_plan',
    {
      title: 'Refine / update a creative plan (component or positioning change)',
      description:
        'The UPDATE path for every creative plan — listing image set, video storyboard, A+ content, main image + title, storefront messaging, UGC ad. For a COMPONENT change (swap a storyboard scene, reword a gallery line, change a title segment) it returns the surgical protocol: start from the SAVED plan (get_asset), recompose ONLY the named components with continuity anchors intact, claim-gate changed copy, and re-execute one Higgsfield job or edit-tool call (reframe/upscale/outpaint/voice) per component — never regenerate the set. For a POSITIONING change (new Decision Trigger, updated avatar core, new Positioning Statement, new Trust Gap finding, corrected fact) it returns the deterministic propagation map: exactly what this plan must recompose AND what each of the user\'s OTHER live plans must update, so one positioning story stays true on every surface. Ends by reconciling the saved version (log_asset with the same external_id) and truing-up any live split-test. Use this whenever a user wants to change ANYTHING about a previously generated plan.' +
        groundingPreamble('refine_creative_plan') +
        appGroundingPreamble('refine_creative_plan'),
      inputSchema,
    },
    async ({ plan_type, change_request, positioning_changes, asset_id }) => {
      const result = buildCreativePlanRefinement({
        planType: plan_type as (typeof CREATIVE_PLAN_TYPES)[number],
        changeRequest: change_request,
        positioningChanges: positioning_changes as (typeof POSITIONING_ELEMENT_KEYS)[number][] | undefined,
        assetId: asset_id,
      });
      safeLog({
        event: 'tool.refine_creative_plan',
        caller: userTag(getIdentity()),
        plan_type: result.plan_type,
        change_scope: result.change_scope,
        positioning_changes: result.propagation.length,
      });
      return {
        content: [{ type: 'text' as const, text: `${result.summary}\n\n${JSON.stringify(result, null, 2)}` }],
        structuredContent: { ...result },
      };
    },
  );
}

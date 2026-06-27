/**
 * Layer 2 (tool) — `generate_positioning_moves` (OWNED, identity-gated).
 *
 * WHAT: given the avatar + Decision Trigger™ + brand context, produce 2–3 candidate
 * positioning MOVES, each scored against the live Coach Criteria with a transparent,
 * per-criterion rationale and a deterministic composite (the average of the scores the
 * judge actually returned).
 *
 * WHY: generation reuses the `generate_concepts` consultant-engine seam (Calculation
 * Parity); scoring reuses the Coach Criteria module (`evals/criteria`) — the same criteria
 * Trevor authors and the live judge scores against — rather than inventing a new scoring
 * system. Scores are never fabricated: an unreachable engine yields an honest `unavailable`
 * result, and a move the judge could not score is returned with composite = null.
 * Identity-gated (the underlying engine is JWT-gated).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { groundingPreamble } from '../skills/skillLoader.js';
import { appGroundingPreamble } from '../skills/appSkills.js';
import type { EdgeFnClient } from '../edgeFn/client.js';
import {
  generatePositioningMoves,
  defaultGenerate,
  defaultScore,
  type PositioningMovesDeps,
} from '../service/positioningMoves.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';

const inputSchema = {
  avatar: z.string().min(10).describe('The customer avatar the positioning must resonate with (who they are, what they fear/want).'),
  decision_trigger: z.string().min(3).describe('The named Decision Trigger™ the moves should activate (from identify_decision_trigger).'),
  brand_context: z.string().min(10).describe('Brand context the moves can lean on: product, promise, category, evidence.'),
  count: z.number().int().min(2).max(3).default(3).describe('How many candidate moves to generate (2–3).'),
};

export function registerGeneratePositioningMovesTool(
  server: McpServer,
  edgeFn: EdgeFnClient,
  depsOverride?: Partial<PositioningMovesDeps>,
): void {
  const deps: PositioningMovesDeps = {
    generate: depsOverride?.generate ?? defaultGenerate(edgeFn),
    score: depsOverride?.score ?? defaultScore(edgeFn),
  };
  server.registerTool(
    'generate_positioning_moves',
    {
      title: 'Generate positioning moves',
      description:
        'Produce 2–3 candidate positioning MOVES from the avatar + Decision Trigger™ + brand context, each SCORED against the live Coach Criteria with a transparent per-criterion rationale and a deterministic composite (average of the returned criterion scores). Generation reuses the generate_concepts consultant engine; scoring reuses the Coach Criteria — no new scoring system. Scores are never fabricated: an unreachable engine returns unavailable, and a move the judge could not score returns composite = null. Requires an authenticated Supabase JWT.' +
        groundingPreamble('generate_concepts') + appGroundingPreamble('generate_concepts'),
      inputSchema,
    },
    async ({ avatar, decision_trigger, brand_context, count }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const out = await generatePositioningMoves(
        { avatar, decisionTrigger: decision_trigger, brandContext: brand_context, count },
        deps,
      );

      if (out.status === 'unavailable') {
        safeLog({ level: 'warn', event: 'tool.generate_positioning_moves.unavailable', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `generate_positioning_moves unavailable: ${out.note}` }],
          structuredContent: { ok: false, moves: [], note: out.note },
        };
      }

      const scoredCount = out.moves.filter((m) => m.scored).length;
      safeLog({
        event: 'tool.generate_positioning_moves',
        caller: userTag(identity),
        count: out.moves.length,
        scored: scoredCount,
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(out.moves, null, 2) }],
        structuredContent: {
          ok: true,
          moves: out.moves,
          criteria_version: out.criteriaVersion,
          scoring: 'composite = average of the Coach Criteria scores the judge returned; unscored criteria are dropped, never defaulted',
        },
      };
    },
  );
}

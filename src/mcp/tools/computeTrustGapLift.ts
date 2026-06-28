/**
 * Layer 2 (tool) — `compute_trust_gap_lift` (OWNED, deterministic, no LLM, no DB).
 *
 * The Re-measure leg of the loop (Diagnose -> Analyse -> Fix -> Re-measure -> Defend): after
 * the owner ships a fix and re-runs the diagnostic, this computes the delta between the BEFORE
 * and AFTER Trust Gap scores — the "watch the gap close" proof that earns the ongoing fee.
 *
 * Purely deterministic: it returns ONLY arithmetic on the two score sets the caller supplies
 * (each pillar 0–25; overall = their sum, 0–100). It never invents a number — the fabricated
 * 58->71 the StayAheadScreen used to show is exactly what this replaces. No snapshot table is
 * required (that migration is unapplied to prod); the two score sets come from two real
 * run_trust_gap / run_diagnostic_evidence runs.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const DIMS = ['insight', 'distinctive', 'empathetic', 'authentic'] as const;
type Dim = (typeof DIMS)[number];

const scoreObject = z
  .object({
    insight: z.number().min(0).max(25),
    distinctive: z.number().min(0).max(25),
    empathetic: z.number().min(0).max(25),
    authentic: z.number().min(0).max(25),
  })
  .describe('The four Trust Gap™ pillar scores out of 25.');

const inputSchema = {
  before: scoreObject.describe('The Trust Gap scores BEFORE the fix shipped (the prior diagnostic).'),
  after: scoreObject.describe('The Trust Gap scores AFTER the fix shipped (the latest diagnostic).'),
  avatar_id: z.string().optional().describe('Avatar scope (for the caller’s reference only).'),
};

type Scores = Record<Dim, number>;
const overall = (s: Scores): number => DIMS.reduce((sum, d) => sum + s[d], 0); // 0–100
const round1 = (n: number): number => Math.round(n * 10) / 10;

export interface LiftResult {
  overall_before: number;
  overall_after: number;
  overall_delta: number;
  pillar_deltas: Record<Dim, number>;
  biggest_mover: { pillar: Dim; delta: number };
  weakest_now: { pillar: Dim; score: number };
  direction: 'improved' | 'declined' | 'flat';
  summary: string;
}

/** Pure delta computation — exported so the test drives it without the transport. */
export function computeLift(before: Scores, after: Scores): LiftResult {
  const ob = overall(before);
  const oa = overall(after);
  const overallDelta = round1(oa - ob);
  const pillarDeltas = Object.fromEntries(DIMS.map((d) => [d, round1(after[d] - before[d])])) as Record<Dim, number>;
  const biggest = DIMS.reduce((m, d) => (Math.abs(pillarDeltas[d]) > Math.abs(pillarDeltas[m]) ? d : m), DIMS[0]);
  const weakest = DIMS.reduce((m, d) => (after[d] < after[m] ? d : m), DIMS[0]);
  const direction: LiftResult['direction'] = overallDelta > 0 ? 'improved' : overallDelta < 0 ? 'declined' : 'flat';

  const moveWord = direction === 'improved' ? 'closed' : direction === 'declined' ? 'widened' : 'held';
  const sign = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
  const summary =
    `Trust Gap ${ob} → ${oa} (${sign(overallDelta)}). The gap ${moveWord}. ` +
    (direction !== 'flat'
      ? `${biggest[0].toUpperCase() + biggest.slice(1)} moved most (${sign(pillarDeltas[biggest])}). `
      : '') +
    `Your weakest pillar now is ${weakest} (${after[weakest]}/25) — that’s the next single lever.`;

  return {
    overall_before: ob,
    overall_after: oa,
    overall_delta: overallDelta,
    pillar_deltas: pillarDeltas,
    biggest_mover: { pillar: biggest, delta: pillarDeltas[biggest] },
    weakest_now: { pillar: weakest, score: after[weakest] },
    direction,
    summary,
  };
}

export function registerComputeTrustGapLiftTool(server: McpServer): void {
  server.registerTool(
    'compute_trust_gap_lift',
    {
      title: 'Compute the Trust Gap lift (re-measure)',
      description:
        "Re-measure: compute the change in the Trust Gap™ between two real diagnostic runs — BEFORE the fix and AFTER. Returns the overall delta, per-pillar deltas, the biggest mover, the weakest pillar now (the next lever), and a plain-language summary. Purely deterministic arithmetic on the scores you pass — it NEVER invents a number; pass real scores from two run_trust_gap / run_diagnostic_evidence runs. Use it to show the owner the gap closing after they ship — the reason to keep going.",
      inputSchema,
    },
    async ({ before, after }) => {
      const lift = computeLift(before as Scores, after as Scores);
      return {
        content: [{ type: 'text' as const, text: lift.summary }],
        structuredContent: { ok: true, ...lift },
      };
    },
  );
}

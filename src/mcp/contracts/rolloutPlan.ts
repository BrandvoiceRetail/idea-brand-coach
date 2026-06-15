/**
 * Contract — `rollout_plan` (gold Workbook B, sheet "Recommended Phasing").
 *
 * §3: the 90-day phasing sequenced around the user's cash-flow timeline (inventory
 * order timing, repayment start — BUSINESS-FACT #9) and inventory risks (#11). Two
 * gold grids: the phase table and the cumulative-impact estimate. The cumulative
 * impact numbers stay NUMERIC (the fixture preserves them as JSON numbers
 * 500/900/1500 …) but remain LABELED low/mid/high estimate bands per row, never a
 * single fabricated point figure.
 *
 * Schema covers gold columns — phases: Phase, Window, Action, Cash needed, Why now;
 * cumulative impact: Horizon, Low estimate, Mid estimate, High estimate, Notes.
 */
import { z } from 'zod';
import type { ArtifactContract } from './types.js';
import { groundingEnvelope } from './grounding.js';

export const rolloutPhaseSchema = z.object({
  /** "Phase" (e.g. "Phase 1\n(Weeks 1–2)"). */
  phase: z.string().min(1),
  /** "Window" (e.g. "Now → end of May"). */
  window: z.string().min(1),
  /** "Action" — the bundled actions for the phase. */
  action: z.string().min(1),
  /** "Cash needed". */
  cash_needed: z.string().min(1),
  /** "Why now" — the cash-timing rationale. */
  why_now: z.string().min(1),
});
export type RolloutPhase = z.infer<typeof rolloutPhaseSchema>;

export const cumulativeImpactRowSchema = z.object({
  /** "Horizon" (Month 1 / Month 3 / Month 6 / Month 12). */
  horizon: z.string().min(1),
  /** "Low estimate" — numeric revenue-lift band floor. */
  low: z.number().int().nonnegative(),
  /** "Mid estimate". */
  mid: z.number().int().nonnegative(),
  /** "High estimate". */
  high: z.number().int().nonnegative(),
  /** "Notes". */
  notes: z.string().min(1),
});
export type CumulativeImpactRow = z.infer<typeof cumulativeImpactRowSchema>;

export const rolloutPlanOutputSchema = z.object({
  phases: z.array(rolloutPhaseSchema).min(1),
  cumulative_impact: z.array(cumulativeImpactRowSchema).min(1),
  ...groundingEnvelope,
});
export type RolloutPlanOutput = z.infer<typeof rolloutPlanOutputSchema>;

const kind = 'rollout_plan' as const;

/**
 * §3: the audit rows (#17 library) phased around cash constraints & timing (#9) and
 * inventory risks (#11); calibrated by revenue/margin/ad metrics (#8).
 */
const requiredContext = [17, 9, 11, 8] as const;

export const rolloutPlanContract: ArtifactContract<typeof rolloutPlanOutputSchema> = {
  kind,
  outputSchema: rolloutPlanOutputSchema,
  requiredContext,
};

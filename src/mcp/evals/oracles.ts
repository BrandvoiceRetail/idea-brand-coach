/**
 * Deterministic eval oracles — the "what good looks like" maths the harness can check WITHOUT
 * a model (closes the gap-analysis P0s: trigger-accuracy, anchor-correctness, loop-readiness).
 *
 * These encode Skills 06/09 (lowest pillar → primary Decision Trigger → fixed brand anchor) and
 * run over the curated EVAL_CASES that carry a structured diagnostic. They prove the decision
 * table + the corrected anchors (Recognition = Dove, never Lego) can't regress unnoticed, and that
 * the cases are internally consistent. The behavioural "did the live coach actually pick it"
 * remains the A2 judge's job (recommendation-alignment / anchor-correctness dimensions).
 */
import { EVAL_CASES } from './cases/catalog.js';
import type { EvalCase, Pillar } from './cases/types.js';

export type TriggerName =
  | 'Permission'
  | 'Recognition'
  | 'Identity'
  | 'Belonging'
  | 'Momentum'
  | 'Fear-of-Loss';

/** Lowest pillar → primary trigger (Skill 09 decision table). */
const PILLAR_TRIGGER: Record<Pillar, TriggerName> = {
  insight: 'Permission',
  distinctive: 'Identity',
  empathetic: 'Recognition',
  authentic: 'Belonging',
};

/** Fixed brand anchors — corrected: Recognition = Dove (Lego is Identity). */
export const FIXED_ANCHOR: Record<TriggerName, string> = {
  Permission: 'Harvard Medical School',
  Recognition: 'Dove',
  Identity: 'Apple',
  Belonging: 'Patagonia',
  Momentum: "Amazon's Choice",
  'Fear-of-Loss': 'FOMO',
};

/** The primary Decision Trigger expected for a set of Trust Gap pillar scores (lowest pillar wins). */
export function expectedTrigger(pillars: Record<Pillar, number>): TriggerName {
  const lowest = (Object.keys(pillars) as Pillar[]).sort((a, b) => pillars[a] - pillars[b])[0];
  return PILLAR_TRIGGER[lowest];
}

/** The fixed brand anchor for a trigger. */
export function expectedAnchor(trigger: TriggerName): string {
  return FIXED_ANCHOR[trigger];
}

export interface TriggerAccuracy {
  value: number; // 0..1 — share of diagnosed cases whose declared trigger matches the decision table
  matched: number;
  total: number;
  mismatches: { caseId: string; expected: TriggerName; declared?: string }[];
}

/**
 * Trigger-accuracy over the curated cases that carry a structured diagnostic: does each case's
 * declared `expected.primaryTrigger` match what the decision table derives from its pillar scores?
 * A mismatch is a real bug — either the case is wrong or the table regressed.
 */
export function triggerAccuracy(cases: EvalCase[] = EVAL_CASES): TriggerAccuracy {
  const diagnosed = cases.filter((c) => c.diagnostic?.pillars && c.expected.primaryTrigger);
  const mismatches: TriggerAccuracy['mismatches'] = [];
  for (const c of diagnosed) {
    const exp = expectedTrigger(c.diagnostic!.pillars);
    if (exp !== c.expected.primaryTrigger) mismatches.push({ caseId: c.id, expected: exp, declared: c.expected.primaryTrigger });
  }
  const total = diagnosed.length;
  const matched = total - mismatches.length;
  return { value: total ? matched / total : 1, matched, total, mismatches };
}

export interface AnchorAccuracy {
  value: number;
  matched: number;
  total: number;
  mismatches: { caseId: string; trigger: string; expectedAnchor: string }[];
}

/** Anchor-correctness: every diagnosed case's trigger maps to its fixed anchor (Recognition→Dove). */
export function anchorAccuracy(cases: EvalCase[] = EVAL_CASES): AnchorAccuracy {
  const withTrigger = cases.filter((c) => c.expected.primaryTrigger);
  const mismatches: AnchorAccuracy['mismatches'] = [];
  for (const c of withTrigger) {
    const t = c.expected.primaryTrigger as TriggerName;
    if (!(t in FIXED_ANCHOR)) mismatches.push({ caseId: c.id, trigger: t, expectedAnchor: '(unknown trigger)' });
  }
  const total = withTrigger.length;
  return { value: total ? (total - mismatches.length) / total : 1, matched: total - mismatches.length, total, mismatches };
}

/** Loop-readiness: share of cases that exercise the Re-measure/Defend loop (kind 'loop'). */
export function loopReadiness(cases: EvalCase[] = EVAL_CASES): { value: number; loopCases: number; total: number } {
  const loopCases = cases.filter((c) => c.kind === 'loop').length;
  return { value: cases.length ? loopCases / cases.length : 0, loopCases, total: cases.length };
}

const PILLAR_FOR_TRIGGER: Partial<Record<TriggerName, Pillar>> = {
  Permission: 'insight',
  Identity: 'distinctive',
  Recognition: 'empathetic',
  Belonging: 'authentic',
};

export interface TrustGapAccuracy {
  value: number; // 0..1 — share of diagnosed cases whose declared primary gap IS the lowest pillar
  matched: number;
  total: number;
  mismatches: { caseId: string; lowestPillar: Pillar; impliedGap?: Pillar }[];
}

/**
 * Trust Gap SCORE accuracy (the lead-magnet metric) — the score side of the chain, distinct from
 * triggerAccuracy (the decision-table side). For each diagnosed pillar-mappable case: the gap the
 * declared trigger implies must be the actual LOWEST pillar. A mismatch means the scored primary gap
 * and the recommended fix disagree — the lead magnet would point the owner at the wrong dimension.
 */
export function trustGapAccuracy(cases: EvalCase[] = EVAL_CASES): TrustGapAccuracy {
  const diagnosed = cases.filter(
    (c) => c.diagnostic?.pillars && c.expected.primaryTrigger && PILLAR_FOR_TRIGGER[c.expected.primaryTrigger as TriggerName],
  );
  const mismatches: TrustGapAccuracy['mismatches'] = [];
  for (const c of diagnosed) {
    const pillars = c.diagnostic!.pillars;
    const lowest = (Object.keys(pillars) as Pillar[]).sort((a, b) => pillars[a] - pillars[b])[0];
    const impliedGap = PILLAR_FOR_TRIGGER[c.expected.primaryTrigger as TriggerName];
    if (impliedGap !== lowest) mismatches.push({ caseId: c.id, lowestPillar: lowest, impliedGap });
  }
  const total = diagnosed.length;
  return { value: total ? (total - mismatches.length) / total : 1, matched: total - mismatches.length, total, mismatches };
}

// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  expectedTrigger,
  expectedAnchor,
  triggerAccuracy,
  anchorAccuracy,
  loopReadiness,
  FIXED_ANCHOR,
} from '../evals/oracles.js';
import { EVAL_CASES } from '../evals/cases/catalog.js';

describe('deterministic eval oracles', () => {
  it('derives the primary trigger from the lowest pillar (Skill 09 decision table)', () => {
    expect(expectedTrigger({ insight: 19, distinctive: 15, empathetic: 9, authentic: 15 })).toBe('Recognition');
    expect(expectedTrigger({ insight: 9, distinctive: 16, empathetic: 17, authentic: 15 })).toBe('Permission');
    expect(expectedTrigger({ insight: 19, distinctive: 12, empathetic: 18, authentic: 17 })).toBe('Identity');
    expect(expectedTrigger({ insight: 18, distinctive: 17, empathetic: 16, authentic: 10 })).toBe('Belonging');
  });

  it('anchors are corrected — Recognition = Dove, never Lego', () => {
    expect(expectedAnchor('Recognition')).toBe('Dove');
    expect(Object.values(FIXED_ANCHOR)).not.toContain('Lego');
    expect(expectedAnchor('Identity')).toBe('Apple');
  });

  it('trigger-accuracy: every diagnosed case’s declared trigger matches the decision table (no regression)', () => {
    const acc = triggerAccuracy();
    expect(acc.total).toBeGreaterThanOrEqual(4); // the diagnosed fix + loop cases
    expect(acc.mismatches, JSON.stringify(acc.mismatches)).toHaveLength(0);
    expect(acc.value).toBe(1);
  });

  it('anchor-accuracy: every case trigger maps to a known fixed anchor', () => {
    const acc = anchorAccuracy();
    expect(acc.value).toBe(1);
    expect(acc.mismatches).toHaveLength(0);
  });

  it('loop-readiness: the Re-measure/Defend loop is now exercised by a bench case', () => {
    const loop = loopReadiness();
    expect(loop.loopCases).toBeGreaterThanOrEqual(1);
    expect(loop.value).toBeGreaterThan(0);
    const loopCase = EVAL_CASES.find((c) => c.kind === 'loop')!;
    // the loop case must build on remembered context (prior avatar) and re-score, not restart
    expect(loopCase.memory.some((m) => /avatar|prior session/i.test(m.note))).toBe(true);
    expect(loopCase.expected.tools).toContain('run_trust_gap');
    expect(loopCase.expected.primaryTrigger).toBe('Identity'); // next lever after the Empathetic fix
  });
});

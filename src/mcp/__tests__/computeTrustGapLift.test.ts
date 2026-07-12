// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computeLift } from '../tools/computeTrustGapLift.js';

describe('computeLift (re-measure delta — deterministic, never fabricates)', () => {
  it('computes the overall + per-pillar delta and names the biggest mover', () => {
    // InfinityVault loop case: Empathetic recovers 9 -> 17 after the recognition fix.
    const before = { insight: 19, distinctive: 15, empathetic: 9, authentic: 15 }; // overall 58
    const after = { insight: 19, distinctive: 15, empathetic: 17, authentic: 16 }; // overall 67
    const r = computeLift(before, after);
    expect(r.overall_before).toBe(58);
    expect(r.overall_after).toBe(67);
    expect(r.overall_delta).toBe(9);
    expect(r.pillar_deltas.empathetic).toBe(8);
    expect(r.biggest_mover.pillar).toBe('empathetic');
    expect(r.direction).toBe('improved');
    // weakest pillar AFTER (the next lever) is distinctive at 15.
    expect(r.weakest_now.pillar).toBe('distinctive');
    expect(r.summary).toContain('58 → 67');
    expect(r.summary).toContain('closed');
  });

  it('reports a declined direction + widened gap when scores drop', () => {
    const before = { insight: 20, distinctive: 20, empathetic: 20, authentic: 20 }; // 80
    const after = { insight: 18, distinctive: 20, empathetic: 20, authentic: 20 }; // 78
    const r = computeLift(before, after);
    expect(r.overall_delta).toBe(-2);
    expect(r.direction).toBe('declined');
    expect(r.summary).toContain('widened');
  });

  it('reports flat when nothing moved', () => {
    const s = { insight: 15, distinctive: 15, empathetic: 15, authentic: 15 };
    const r = computeLift(s, { ...s });
    expect(r.overall_delta).toBe(0);
    expect(r.direction).toBe('flat');
  });

  it('returns ONLY arithmetic on the inputs — no invented numbers', () => {
    const before = { insight: 10, distinctive: 12, empathetic: 8, authentic: 14 };
    const after = { insight: 13, distinctive: 12, empathetic: 11, authentic: 14 };
    const r = computeLift(before, after);
    expect(r.overall_before).toBe(44);
    expect(r.overall_after).toBe(50);
    expect(r.overall_delta).toBe(6);
    // every reported pillar delta equals after - before exactly
    for (const d of ['insight', 'distinctive', 'empathetic', 'authentic'] as const) {
      expect(r.pillar_deltas[d]).toBe(after[d] - before[d]);
    }
  });
});

import { describe, it, expect, vi } from 'vitest';
import {
  RemeasureService,
  type DiagnosticRun,
  type ExperimentRow,
  type MetricRow,
} from '../remeasureService';
import { findTierViolations } from '@/lib/v4/megapromptParse';
import type { PillarScores } from '@/types/v4Remeasure';

const before: PillarScores = { insight: 10, distinctive: 8, empathetic: 14, authentic: 12 };
const after: PillarScores = { insight: 15, distinctive: 9, empathetic: 16, authentic: 13 };

/** Build a service with injected readers so no network is touched. */
function makeService(runs: DiagnosticRun[], rows: MetricRow[] = []): RemeasureService {
  return new RemeasureService(
    async () => runs,
    async () => rows,
  );
}

describe('RemeasureService.computeLift (deterministic, mirrors compute_trust_gap_lift)', () => {
  const svc = new RemeasureService();

  it('computes overall + per-pillar deltas from real scores only', () => {
    const lift = svc.computeLift(before, after, '2026-06-20');
    expect(lift.overallBefore).toBe(44);
    expect(lift.overallAfter).toBe(53);
    expect(lift.overallDelta).toBe(9);
    expect(lift.pillarDeltas.insight).toBe(5);
    expect(lift.direction).toBe('improved');
  });

  it('picks the biggest mover and the weakest pillar now', () => {
    const lift = svc.computeLift(before, after, '2026-06-20');
    expect(lift.biggestMover.pillar).toBe('insight');
    expect(lift.weakestNow.pillar).toBe('distinctive'); // 9/25 is lowest after
    expect(lift.weakestNow.score).toBe(9);
  });

  it('reports a declined direction when the gap widens', () => {
    const lift = svc.computeLift(after, before, '2026-06-21');
    expect(lift.overallDelta).toBe(-9);
    expect(lift.direction).toBe('declined');
  });

  it('is pure: same inputs → same summary (no randomness, no fabrication)', () => {
    const a = svc.computeLift(before, after, '2026-06-20');
    const b = svc.computeLift(before, after, '2026-06-20');
    expect(a.summary).toBe(b.summary);
    expect(findTierViolations(a.summary)).toEqual([]);
  });
});

describe('RemeasureService.getTrustGapLift (honest degradation)', () => {
  it('needs_input when there is no avatar', async () => {
    const res = await makeService([]).getTrustGapLift(null);
    expect(res.status).toBe('needs_input');
  });

  it('needs_input (re-run prompt) with fewer than two comparable runs', async () => {
    const res = await makeService([{ scores: after, measuredAt: '2026-06-20' }]).getTrustGapLift('av-1');
    expect(res.status).toBe('needs_input');
    if (res.status === 'needs_input') {
      expect(res.needs_input[0].question).toMatch(/re-run/i);
    }
  });

  it('ignores non-comparable runs (missing pillars) rather than fabricating', async () => {
    const runs: DiagnosticRun[] = [
      { scores: after, measuredAt: '2026-06-20' },
      { scores: null, measuredAt: '2026-06-10' },
    ];
    const res = await makeService(runs).getTrustGapLift('av-1');
    expect(res.status).toBe('needs_input');
  });

  it('computes the lift from the two latest runs (newest = after)', async () => {
    const runs: DiagnosticRun[] = [
      { scores: after, measuredAt: '2026-06-20' },
      { scores: before, measuredAt: '2026-06-01' },
    ];
    const res = await makeService(runs).getTrustGapLift('av-1');
    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.data.overallDelta).toBe(9);
      expect(res.data.measuredAt).toBe('2026-06-20');
    }
  });

  it('errors (not fabricates) when the run reader throws', async () => {
    const svc = new RemeasureService(
      async () => {
        throw new Error('boom');
      },
      async () => [],
    );
    const res = await svc.getTrustGapLift('av-1');
    expect(res.status).toBe('error');
  });
});

describe('RemeasureService.getTrustGapLiftForSet (multi-avatar, side-by-side, no fabricated aggregate)', () => {
  const twoRuns: DiagnosticRun[] = [
    { scores: after, measuredAt: '2026-06-20' },
    { scores: before, measuredAt: '2026-06-01' },
  ];
  /** Service whose run reader yields per-avatar runs (so each avatar differs). */
  function makeSetService(byAvatar: Record<string, DiagnosticRun[]>): RemeasureService {
    return new RemeasureService(
      async (avatarId) => byAvatar[avatarId] ?? [],
      async () => [],
    );
  }

  it('needs_input for an empty set', async () => {
    const res = await makeSetService({}).getTrustGapLiftForSet([], {});
    expect(res.status).toBe('needs_input');
  });

  it('delegates to the single-avatar path for a one-id set (byte-identical, no perAvatar)', async () => {
    const svc = makeSetService({ 'av-1': twoRuns });
    const single = await svc.getTrustGapLift('av-1');
    const set = await svc.getTrustGapLiftForSet(['av-1'], { 'av-1': 'Maya' });
    expect(set).toEqual(single);
    if (set.status === 'ok') expect(set.data.perAvatar).toBeUndefined();
  });

  it('headlines the focus avatar and attaches each customer\'s own delta (honest null when <2 runs)', async () => {
    const svc = makeSetService({
      'av-1': twoRuns, // focus: computable lift
      'av-2': [{ scores: after, measuredAt: '2026-06-20' }], // one run → no lift
    });
    const res = await svc.getTrustGapLiftForSet(['av-1', 'av-2'], { 'av-1': 'Maya', 'av-2': 'Rico' });
    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.data.overallDelta).toBe(9); // headline = focus (av-1)
      expect(res.data.perAvatar).toEqual([
        { avatarId: 'av-1', avatarName: 'Maya', overallDelta: 9, direction: 'improved' },
        { avatarId: 'av-2', avatarName: 'Rico', overallDelta: null, direction: null },
      ]);
    }
  });

  it('returns the focus avatar\'s honest result when it has no computable lift (never headlines another customer)', async () => {
    const svc = makeSetService({
      'av-1': [{ scores: after, measuredAt: '2026-06-20' }], // focus: one run only
      'av-2': twoRuns, // a different customer DOES have a lift
    });
    const res = await svc.getTrustGapLiftForSet(['av-1', 'av-2'], { 'av-1': 'Maya', 'av-2': 'Rico' });
    expect(res.status).toBe('needs_input');
  });
});

describe('RemeasureService.getBusinessMetrics (no-data is honest, never fabricated)', () => {
  it('returns hasData=false with all-null cells when no rows exist', async () => {
    const res = await makeService([], []).getBusinessMetrics('av-1', '2026-06-15');
    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.data.hasData).toBe(false);
      expect(res.data.metrics).toHaveLength(4);
      for (const m of res.data.metrics) {
        expect(m.before).toBeNull();
        expect(m.after).toBeNull();
        expect(m.pctChange).toBeNull();
      }
    }
  });

  it('splits real rows into before/after around the pivot date', async () => {
    const rows: MetricRow[] = [
      { metricName: 'ctr', metricValue: 0.02, measuredDate: '2026-06-10' }, // before
      { metricName: 'ctr', metricValue: 0.03, measuredDate: '2026-06-20' }, // after
      { metricName: 'revenue', metricValue: 100, measuredDate: '2026-06-20' },
      { metricName: 'revenue', metricValue: 50, measuredDate: '2026-06-21' },
    ];
    const res = await makeService([], rows).getBusinessMetrics('av-1', '2026-06-15');
    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.data.hasData).toBe(true);
      const ctr = res.data.metrics.find((m) => m.kind === 'ctr');
      expect(ctr?.before).toBe(0.02);
      expect(ctr?.after).toBe(0.03);
      expect(ctr?.pctChange).toBe(50); // (0.03-0.02)/0.02
      const revenue = res.data.metrics.find((m) => m.kind === 'revenue');
      expect(revenue?.after).toBe(150); // summed (100 + 50), both >= pivot
      expect(revenue?.before).toBeNull();
    }
  });

  it('needs_input when there is no avatar', async () => {
    const res = await makeService([], []).getBusinessMetrics(null, null);
    expect(res.status).toBe('needs_input');
  });
});

const baseExp: ExperimentRow = {
  id: 't-1',
  pieceId: 'piece-1',
  pieceLabel: 'Hero image',
  metric: 'cvr',
  baseline: 0.1,
  result: null,
  rawStatus: 'running',
  assetCreatedAt: '2026-06-01',
  assetLiveAt: null,
};

/** Service with injected experiment readers/writer so no network is touched. */
function makeExpService(
  rows: ExperimentRow[],
  after: number | null = null,
  writer = vi.fn(async () => {}),
): RemeasureService {
  return new RemeasureService(
    async () => [],
    async () => [],
    async () => rows,
    async () => after,
    writer,
  );
}

describe('RemeasureService.getExperimentLifts (closes the test loop, no fabrication)', () => {
  it('needs_input when there is no avatar', async () => {
    const res = await makeExpService([]).getExperimentLifts(null);
    expect(res.status).toBe('needs_input');
  });

  it('marks an experiment pending (no after) when the asset is not live yet', async () => {
    const res = await makeExpService([baseExp], 0.99).getExperimentLifts('av-1');
    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      const exp = res.data[0];
      expect(exp.stage).toBe('asset_created');
      expect(exp.status).toBe('pending');
      expect(exp.after).toBeNull(); // never pulled since not live
      expect(exp.lift).toBeNull();
    }
  });

  it('computes a measured lift from the post-live pull once the asset is live', async () => {
    const live: ExperimentRow = { ...baseExp, assetLiveAt: '2026-06-15' };
    const res = await makeExpService([live], 0.15).getExperimentLifts('av-1');
    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      const exp = res.data[0];
      expect(exp.stage).toBe('measuring');
      expect(exp.status).toBe('measured');
      expect(exp.before).toBe(0.1);
      expect(exp.after).toBe(0.15);
      expect(exp.lift).toBe(0.05);
      expect(exp.liftPct).toBe(50);
    }
  });

  it('reflects a recorded verdict (won) without re-pulling', async () => {
    const won: ExperimentRow = {
      ...baseExp,
      assetLiveAt: '2026-06-15',
      result: 0.2,
      rawStatus: 'won',
    };
    const res = await makeExpService([won], null).getExperimentLifts('av-1');
    if (res.status === 'ok') {
      const exp = res.data[0];
      expect(exp.status).toBe('won');
      expect(exp.after).toBe(0.2); // from the recorded result, not a pull
      expect(exp.lift).toBe(0.1);
    }
  });

  it('errors (not fabricates) when the experiment reader throws', async () => {
    const svc = new RemeasureService(
      async () => [],
      async () => [],
      async () => {
        throw new Error('boom');
      },
    );
    const res = await svc.getExperimentLifts('av-1');
    expect(res.status).toBe('error');
  });
});

describe('RemeasureService.markExperimentResult', () => {
  it('writes the verdict + measured result back to the test', async () => {
    const writer = vi.fn(async () => {});
    const res = await makeExpService([baseExp], null, writer).markExperimentResult('t-1', 'won', 0.15);
    expect(res.status).toBe('ok');
    expect(writer).toHaveBeenCalledWith({ testId: 't-1', status: 'won', resultValue: 0.15 });
  });

  it('errors (honest) when the write fails', async () => {
    const writer = vi.fn(async () => {
      throw new Error('rls denied');
    });
    const res = await makeExpService([baseExp], null, writer).markExperimentResult(
      't-1',
      'no_lift',
      null,
    );
    expect(res.status).toBe('error');
  });
});

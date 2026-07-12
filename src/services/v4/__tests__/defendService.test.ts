import { describe, it, expect, vi } from 'vitest';
import { DefendService, buildChecklist, defendVerdict } from '../defendService';
import { findTierViolations } from '@/lib/v4/megapromptParse';
import type { DriftItem } from '@/types/v4Fix';
import type { FixResult } from '@/types/v4Fix';
import type { RemeasureResult, TrustGapLift } from '@/types/v4Remeasure';
import type { EdgeInvoke } from '../defendService';

const DRIFT: DriftItem = {
  assetId: 'a1',
  touchpointId: 'tp1',
  touchpointLabel: 'Product detail page',
  stage: 'consideration',
  builtAgainst: 'v1',
  currentSignature: 'v2',
};

const DRIFT2: DriftItem = {
  assetId: 'a2',
  touchpointId: 'tp2',
  touchpointLabel: 'Main listing image',
  stage: 'consideration',
  builtAgainst: 'v1',
  currentSignature: 'v2',
};

const LIFT: TrustGapLift = {
  overallBefore: 44,
  overallAfter: 53,
  overallDelta: 9,
  pillarBefore: { insight: 10, distinctive: 8, empathetic: 14, authentic: 12 },
  pillarAfter: { insight: 15, distinctive: 9, empathetic: 16, authentic: 13 },
  pillarDeltas: { insight: 5, distinctive: 1, empathetic: 2, authentic: 1 },
  biggestMover: { pillar: 'insight', delta: 5 },
  weakestNow: { pillar: 'distinctive', score: 9 },
  direction: 'improved',
  summary: 'Trust Gap improved.',
  measuredAt: '2026-06-20',
};

const okDrift = (items: DriftItem[]): FixResult<DriftItem[]> => ({ status: 'ok', data: items });
const okLift: RemeasureResult<TrustGapLift> = { status: 'ok', data: LIFT };
const needLift: RemeasureResult<TrustGapLift> = {
  status: 'needs_input',
  needs_input: [{ slot: 0, question: 'Re-run the diagnostic.', why: 'two real runs' }],
};

function makeService(opts: {
  drift?: FixResult<DriftItem[]>;
  lift?: RemeasureResult<TrustGapLift>;
  invoke?: EdgeInvoke;
  hasBaseline?: boolean;
}): DefendService {
  return new DefendService(
    async () => opts.drift ?? okDrift([]),
    async () => opts.lift ?? okLift,
    opts.invoke ?? (async () => ({ data: null, error: null })),
    async () => opts.hasBaseline ?? true,
  );
}

describe('buildChecklist (deterministic, no fabrication)', () => {
  it('marks lift+drift done at zero drift with confirmed lift; competitor is always coming', () => {
    const list = buildChecklist(0, true);
    expect(list.find((i) => i.key === 'lift')?.state).toBe('done');
    expect(list.find((i) => i.key === 'drift')?.state).toBe('done');
    expect(list.find((i) => i.key === 'competitor')?.state).toBe('coming');
    expect(list.find((i) => i.key === 'workbook')?.state).toBe('pending');
  });

  it('flags drift as attention and pending lift when unconfirmed', () => {
    const list = buildChecklist(2, false);
    expect(list.find((i) => i.key === 'drift')?.state).toBe('attention');
    expect(list.find((i) => i.key === 'drift')?.detail).toContain('2 assets');
    expect(list.find((i) => i.key === 'lift')?.state).toBe('pending');
  });

  it('emits no Tier-C vocabulary in any checklist copy', () => {
    for (const item of [...buildChecklist(0, true), ...buildChecklist(3, false)]) {
      expect(findTierViolations(`${item.label} ${item.detail}`)).toEqual([]);
    }
  });

  it('keeps the drift row neutral (not a false done) when there is no baseline', () => {
    const list = buildChecklist(0, true, false);
    const drift = list.find((i) => i.key === 'drift');
    expect(drift?.state).toBe('pending');
    expect(drift?.detail).toContain('Nothing aligned');
  });
});

describe('DefendService.getStatus (honest degradation)', () => {
  it('needs_input when there is no avatar', async () => {
    const res = await makeService({}).getStatus(null);
    expect(res.status).toBe('needs_input');
  });

  it('returns the real drift watch + confirmed lift', async () => {
    const res = await makeService({ drift: okDrift([DRIFT]), lift: okLift }).getStatus('av1');
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.data.drift.count).toBe(1);
    expect(res.data.liftConfirmed).toBe(true);
    expect(res.data.checklist.find((i) => i.key === 'drift')?.state).toBe('attention');
  });

  it('folds a needs_input lift read into liftConfirmed:false (no fabricated confirmation)', async () => {
    const res = await makeService({ drift: okDrift([]), lift: needLift }).getStatus('av1');
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.data.liftConfirmed).toBe(false);
    expect(res.data.checklist.find((i) => i.key === 'lift')?.state).toBe('pending');
  });

  it('surfaces an error when the drift read errors', async () => {
    const res = await makeService({ drift: { status: 'error', error: 'boom' } }).getStatus('av1');
    expect(res.status).toBe('error');
  });

  it('reports no baseline (neutral drift row) when no asset is aligned yet', async () => {
    const res = await makeService({ drift: okDrift([]), hasBaseline: false }).getStatus('av1');
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.data.hasBaseline).toBe(false);
    expect(res.data.checklist.find((i) => i.key === 'drift')?.state).toBe('pending');
  });

  it('reports a baseline + all-clear drift row when an asset is aligned with zero drift', async () => {
    const res = await makeService({ drift: okDrift([]), hasBaseline: true }).getStatus('av1');
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.data.hasBaseline).toBe(true);
    expect(res.data.checklist.find((i) => i.key === 'drift')?.state).toBe('done');
  });
});

describe('defendVerdict (deterministic per-customer posture)', () => {
  it('is drifted when anything drifted, holding with a baseline at zero drift, else none', () => {
    expect(defendVerdict(2, true)).toBe('drifted');
    expect(defendVerdict(1, false)).toBe('drifted'); // drift outranks a missing baseline
    expect(defendVerdict(0, true)).toBe('holding');
    expect(defendVerdict(0, false)).toBe('none');
  });
});

describe('DefendService.getStatusForSet (multi-avatar weakest-link rollup)', () => {
  /** Per-avatar readers keyed on the avatar id so each customer reads differently. */
  function makeSetService(
    per: Record<
      string,
      { drift?: DriftItem[]; lift?: RemeasureResult<TrustGapLift>; baseline?: boolean }
    >,
    spies?: { drift?: ReturnType<typeof vi.fn> },
  ): DefendService {
    const drift = spies?.drift ?? vi.fn(async (avatarId: string | null) => okDrift(per[avatarId ?? '']?.drift ?? []));
    return new DefendService(
      drift,
      async (avatarId) => per[avatarId ?? '']?.lift ?? okLift,
      async () => ({ data: null, error: null }),
      async (avatarId) => per[avatarId ?? '']?.baseline ?? true,
    );
  }

  it('needs_input on an empty set', async () => {
    const res = await makeSetService({}).getStatusForSet([], {});
    expect(res.status).toBe('needs_input');
  });

  it('delegates a single-id set to the focus path (one drift read, no perAvatar)', async () => {
    const drift = vi.fn(async () => okDrift([DRIFT]));
    const svc = makeSetService({ av1: { drift: [DRIFT] } }, { drift });
    const res = await svc.getStatusForSet(['av1'], { av1: 'Maya' });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(drift).toHaveBeenCalledTimes(1);
    expect(res.data.perAvatar).toBeUndefined();
    expect(res.data.drift.count).toBe(1);
  });

  it('unions drifted assets across the set (a piece that drifted for ANY customer surfaces once)', async () => {
    const svc = makeSetService({
      av1: { drift: [DRIFT] },
      av2: { drift: [DRIFT2] },
    });
    const res = await svc.getStatusForSet(['av1', 'av2'], { av1: 'Maya', av2: 'Rico' });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.data.drift.count).toBe(2);
    expect(res.data.checklist.find((i) => i.key === 'drift')?.state).toBe('attention');
  });

  it('dedupes the same drifted asset reported for two customers', async () => {
    const svc = makeSetService({ av1: { drift: [DRIFT] }, av2: { drift: [DRIFT] } });
    const res = await svc.getStatusForSet(['av1', 'av2'], { av1: 'Maya', av2: 'Rico' });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.data.drift.count).toBe(1);
  });

  it('confirms the lift only when confirmed for EVERY customer', async () => {
    const svc = makeSetService({ av1: { lift: okLift }, av2: { lift: needLift } });
    const res = await svc.getStatusForSet(['av1', 'av2'], { av1: 'Maya', av2: 'Rico' });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.data.liftConfirmed).toBe(false);
    expect(res.data.perAvatar?.find((p) => p.avatarId === 'av1')?.liftConfirmed).toBe(true);
    expect(res.data.perAvatar?.find((p) => p.avatarId === 'av2')?.liftConfirmed).toBe(false);
  });

  it('has a baseline for the set when ANY customer has one, and exposes per-customer posture', async () => {
    const svc = makeSetService({
      av1: { drift: [], baseline: true },
      av2: { drift: [DRIFT2], baseline: false },
    });
    const res = await svc.getStatusForSet(['av1', 'av2'], { av1: 'Maya', av2: 'Rico' });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.data.hasBaseline).toBe(true);
    expect(res.data.perAvatar).toEqual([
      { avatarId: 'av1', avatarName: 'Maya', driftCount: 0, hasBaseline: true, liftConfirmed: true, verdict: 'holding' },
      { avatarId: 'av2', avatarName: 'Rico', driftCount: 1, hasBaseline: false, liftConfirmed: true, verdict: 'drifted' },
    ]);
  });

  it('falls back to a Customer label when a name is missing', async () => {
    const svc = makeSetService({ av1: { drift: [] }, av2: { drift: [] } });
    const res = await svc.getStatusForSet(['av1', 'av2'], { av1: 'Maya' });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.data.perAvatar?.find((p) => p.avatarId === 'av2')?.avatarName).toBe('Customer');
  });

  it('fails the set honestly when a per-customer drift read errors', async () => {
    const drift = vi.fn(async (avatarId: string | null) =>
      avatarId === 'av2' ? ({ status: 'error', error: 'boom' } as FixResult<DriftItem[]>) : okDrift([]),
    );
    const svc = makeSetService({}, { drift });
    const res = await svc.getStatusForSet(['av1', 'av2'], { av1: 'Maya', av2: 'Rico' });
    expect(res.status).toBe('error');
  });
});

describe('DefendService.exportWorkbook (live engine, no fabricated download)', () => {
  it('needs_input when there is no avatar', async () => {
    const res = await makeService({}).exportWorkbook(null);
    expect(res.status).toBe('needs_input');
  });

  it('returns a real download link when the engine provides one', async () => {
    const invoke: EdgeInvoke = vi.fn(async () => ({
      data: { note: 'Workbook ready.', download_url: 'https://x/wb.xlsx' },
      error: null,
    }));
    const res = await makeService({ invoke }).exportWorkbook('av1');
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.data.downloadUrl).toBe('https://x/wb.xlsx');
  });

  it('returns ok with null link (no fabricated URL) when the engine returns none', async () => {
    const invoke: EdgeInvoke = async () => ({ data: { note: 'Saved to your files.' }, error: null });
    const res = await makeService({ invoke }).exportWorkbook('av1');
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.data.downloadUrl).toBeNull();
  });

  it('passes through an engine needs_input unchanged', async () => {
    const invoke: EdgeInvoke = async () => ({
      data: { needs_input: [{ slot: 0, question: 'Run the marketing audit first.', why: 'no audit' }] },
      error: null,
    });
    const res = await makeService({ invoke }).exportWorkbook('av1');
    expect(res.status).toBe('needs_input');
  });

  it('surfaces an error when the edge call errors', async () => {
    const invoke: EdgeInvoke = async () => ({ data: null, error: { message: 'down' } });
    const res = await makeService({ invoke }).exportWorkbook('av1');
    expect(res.status).toBe('error');
  });
});

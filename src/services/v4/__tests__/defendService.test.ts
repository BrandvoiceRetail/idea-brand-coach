import { describe, it, expect, vi } from 'vitest';
import { DefendService, buildChecklist } from '../defendService';
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
}): DefendService {
  return new DefendService(
    async () => opts.drift ?? okDrift([]),
    async () => opts.lift ?? okLift,
    opts.invoke ?? (async () => ({ data: null, error: null })),
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

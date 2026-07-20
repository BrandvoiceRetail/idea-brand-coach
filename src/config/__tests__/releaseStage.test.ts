import { afterEach, describe, expect, it, vi } from 'vitest';
import { getReleaseStage, isStageAtLeast, type ReleaseStage } from '../releaseStage';

/**
 * Load a FRESH copy of releaseStage.ts with VITE_RELEASE_STAGE stubbed, so the
 * load-time-bound exports (CURRENT_STAGE, isAtLeastStage, isPreGa) reflect it.
 */
async function loadWithStage(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) vi.stubEnv('VITE_RELEASE_STAGE', '');
  else vi.stubEnv('VITE_RELEASE_STAGE', value);
  return import('../releaseStage');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('isStageAtLeast (pure comparator)', () => {
  const order: ReleaseStage[] = ['alpha', 'beta', 'ga'];
  it('is reflexive and monotonic across the alpha < beta < ga order', () => {
    order.forEach((stage, i) => {
      order.forEach((min, j) => {
        expect(isStageAtLeast(stage, min)).toBe(i >= j);
      });
    });
  });
});

describe('getReleaseStage (env resolution)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(['alpha', 'beta', 'ga'] as const)('parses the valid stage %s', (stage) => {
    vi.stubEnv('VITE_RELEASE_STAGE', stage);
    expect(getReleaseStage()).toBe(stage);
  });

  it.each(['', undefined, 'P0', 'true', 'garbage', 'GA', 'Alpha'])(
    'defaults to alpha for unset/invalid value %s',
    (value) => {
      vi.stubEnv('VITE_RELEASE_STAGE', (value ?? '') as string);
      expect(getReleaseStage()).toBe('alpha');
    },
  );
});

describe('load-time-bound exports', () => {
  it('CURRENT_STAGE defaults to alpha when unset; isPreGa true, isAtLeastStage gates', async () => {
    const m = await loadWithStage(undefined);
    expect(m.CURRENT_STAGE).toBe('alpha');
    expect(m.isPreGa()).toBe(true);
    expect(m.isAtLeastStage('alpha')).toBe(true);
    expect(m.isAtLeastStage('beta')).toBe(false);
  });

  it('at beta: forces surface (pre-GA) and unlocks alpha+beta features', async () => {
    const m = await loadWithStage('beta');
    expect(m.CURRENT_STAGE).toBe('beta');
    expect(m.isPreGa()).toBe(true);
    expect(m.isAtLeastStage('beta')).toBe(true);
    expect(m.isAtLeastStage('ga')).toBe(false);
  });

  it('at ga: stops forcing the single surface', async () => {
    const m = await loadWithStage('ga');
    expect(m.CURRENT_STAGE).toBe('ga');
    expect(m.isPreGa()).toBe(false);
    expect(m.isAtLeastStage('ga')).toBe(true);
  });
});

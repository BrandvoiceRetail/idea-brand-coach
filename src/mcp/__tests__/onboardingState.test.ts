// @vitest-environment node
/**
 * run_onboarding director — onboarding STATE + PLAYBOOK.
 *
 * The coach calls run_onboarding (instead of a pasted prompt) when the user hasn't
 * onboarded or asks to (re-)onboard. These tests prove: a fresh user gets the FULL
 * playbook (already_onboarded=false), an onboarded user gets the lighter REFRESH path,
 * force=true re-runs the full playbook even when onboarded, and a read error surfaces
 * as OnboardingError rather than a silent wrong answer.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runOnboarding, OnboardingError } from '../service/onboardingState.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

/** Stub whose `from(table).select(..., {count,head})` resolves the per-table count. */
function countStub(counts: Record<string, number>, errorTable?: string): SupabaseClient {
  const from = (table: string): Record<string, unknown> => ({
    select: () =>
      errorTable === table
        ? Promise.resolve({ count: null, error: { message: 'boom' } })
        : Promise.resolve({ count: counts[table] ?? 0, error: null }),
  });
  return { from } as unknown as SupabaseClient;
}

afterEach(() => __setUserSupabaseFactory(undefined));

describe('runOnboarding', () => {
  it('fresh user → full onboarding playbook (not yet onboarded)', async () => {
    __setUserSupabaseFactory(() => countStub({ avatars: 0, brand_assets: 0, campaign_metrics: 0 }));
    const r = await runWithIdentity(authed, () => runOnboarding(false));
    expect(r.already_onboarded).toBe(false);
    expect(r.next).toBe('onboard');
    expect(r.playbook).toContain('ONBOARD THIS BRAND');
    expect(r.playbook).toContain('get_connectors');
    expect(r.playbook).toContain('Trust Gap');
  });

  it('onboarded user (pieces + metrics) → lighter refresh path', async () => {
    __setUserSupabaseFactory(() => countStub({ avatars: 1, brand_assets: 3, campaign_metrics: 42 }));
    const r = await runWithIdentity(authed, () => runOnboarding(false));
    expect(r.already_onboarded).toBe(true);
    expect(r.next).toBe('refresh');
    expect(r.playbook).toContain('REFRESH METRICS');
    expect(r.playbook).not.toContain('ONBOARD THIS BRAND');
  });

  it('pieces but NO metrics → still treated as not onboarded', async () => {
    __setUserSupabaseFactory(() => countStub({ avatars: 1, brand_assets: 2, campaign_metrics: 0 }));
    const r = await runWithIdentity(authed, () => runOnboarding(false));
    expect(r.already_onboarded).toBe(false);
    expect(r.next).toBe('onboard');
  });

  it('force=true re-runs the full playbook even when already onboarded', async () => {
    __setUserSupabaseFactory(() => countStub({ avatars: 1, brand_assets: 3, campaign_metrics: 42 }));
    const r = await runWithIdentity(authed, () => runOnboarding(true));
    expect(r.already_onboarded).toBe(false);
    expect(r.next).toBe('onboard');
    expect(r.playbook).toContain('ONBOARD THIS BRAND');
  });

  it('read error surfaces as OnboardingError (no silent wrong state)', async () => {
    __setUserSupabaseFactory(() => countStub({ avatars: 0, brand_assets: 0, campaign_metrics: 0 }, 'brand_assets'));
    await expect(runWithIdentity(authed, () => runOnboarding(false))).rejects.toBeInstanceOf(OnboardingError);
  });
});

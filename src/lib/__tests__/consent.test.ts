import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  CONSENT_POLICY_VERSION,
  getStoredConsent,
  hasAnalyticsConsent,
  onConsentChange,
  setStoredConsent,
} from '../consent';

describe('consent store (GDPR opt-in gate)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('has NO decision by default — undecided means no tracking', () => {
    expect(getStoredConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('round-trips a granted decision with version + timestamp', () => {
    const state = setStoredConsent('granted');

    expect(state.analytics).toBe('granted');
    expect(state.policyVersion).toBe(CONSENT_POLICY_VERSION);
    expect(getStoredConsent()).toEqual(state);
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it('a denied decision is stored (so the banner stops re-prompting) but grants nothing', () => {
    setStoredConsent('denied');

    expect(getStoredConsent()?.analytics).toBe('denied');
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('discards decisions made against an older policy version (re-prompt on material change)', () => {
    localStorage.setItem(
      'idea.consent.v1',
      JSON.stringify({ analytics: 'granted', policyVersion: 'stale', decidedAt: new Date().toISOString() }),
    );

    expect(getStoredConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('ignores corrupted storage instead of throwing', () => {
    localStorage.setItem('idea.consent.v1', '{not json');

    expect(getStoredConsent()).toBeNull();
  });

  it('notifies subscribers on every decision; unsubscribe stops delivery', () => {
    const listener = vi.fn();
    const unsubscribe = onConsentChange(listener);

    setStoredConsent('granted');
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ analytics: 'granted' }));

    unsubscribe();
    setStoredConsent('denied');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('one failing listener never blocks the others', () => {
    const bad = vi.fn(() => {
      throw new Error('listener boom');
    });
    const good = vi.fn();
    onConsentChange(bad);
    onConsentChange(good);

    expect(() => setStoredConsent('granted')).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });
});

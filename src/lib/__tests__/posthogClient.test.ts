import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CONSENT_POLICY_VERSION } from '../consent';

const mockPosthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  get_distinct_id: vi.fn(),
  isFeatureEnabled: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
}));

vi.mock('posthog-js', () => ({ default: mockPosthog }));

/**
 * posthogClient keeps module-level init state, so each test re-imports a
 * fresh module instance via vi.resetModules() + dynamic import.
 */
async function importFreshClient(): Promise<typeof import('../posthogClient')> {
  vi.resetModules();
  return import('../posthogClient');
}

/**
 * GDPR consent gate: initPostHog refuses to start without a stored analytics
 * opt-in. Tests that exercise initialised behaviour grant consent first, the
 * same way the ConsentBanner does (via the consent store's localStorage shape).
 */
function grantAnalyticsConsent(decision: 'granted' | 'denied' = 'granted'): void {
  localStorage.setItem(
    'idea.consent.v1',
    JSON.stringify({
      analytics: decision,
      policyVersion: CONSENT_POLICY_VERSION,
      decidedAt: new Date().toISOString(),
    }),
  );
}

describe('posthogClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  describe('initPostHog (consent-gated)', () => {
    it('does not initialise when VITE_POSTHOG_KEY is unset', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', '');
      grantAnalyticsConsent();
      const client = await importFreshClient();

      client.initPostHog();

      expect(mockPosthog.init).not.toHaveBeenCalled();
      expect(client.isPostHogEnabled()).toBe(false);
    });

    it('does NOT initialise without stored analytics consent (GDPR gate)', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      const client = await importFreshClient();

      client.initPostHog();

      expect(mockPosthog.init).not.toHaveBeenCalled();
      expect(client.isPostHogEnabled()).toBe(false);
    });

    it('does NOT initialise when consent was explicitly denied', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      grantAnalyticsConsent('denied');
      const client = await importFreshClient();

      client.initPostHog();

      expect(mockPosthog.init).not.toHaveBeenCalled();
    });

    it('ignores consent stored against an older policy version', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      localStorage.setItem(
        'idea.consent.v1',
        JSON.stringify({ analytics: 'granted', policyVersion: '2020-01-01', decidedAt: new Date().toISOString() }),
      );
      const client = await importFreshClient();

      client.initPostHog();

      expect(mockPosthog.init).not.toHaveBeenCalled();
    });

    it('initialises with consent + key, EU default host, and exception capture', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      grantAnalyticsConsent();
      const client = await importFreshClient();

      client.initPostHog();

      expect(mockPosthog.init).toHaveBeenCalledWith('phc_test_key', {
        // EU host is the CODE default — a build without .env must never ship US ingestion.
        api_host: 'https://eu.i.posthog.com',
        capture_exceptions: true,
      });
      expect(client.isPostHogEnabled()).toBe(true);
    });

    it('respects VITE_POSTHOG_HOST when set', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com');
      grantAnalyticsConsent();
      const client = await importFreshClient();

      client.initPostHog();

      expect(mockPosthog.init).toHaveBeenCalledWith(
        'phc_test_key',
        expect.objectContaining({ api_host: 'https://us.i.posthog.com' }),
      );
    });

    it('initialises only once', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      grantAnalyticsConsent();
      const client = await importFreshClient();

      client.initPostHog();
      client.initPostHog();

      expect(mockPosthog.init).toHaveBeenCalledTimes(1);
    });
  });

  describe('bindAnalyticsToConsent', () => {
    it('starts PostHog when a later banner grant fires', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      vi.resetModules();
      const consent = await import('../consent');
      const client = await import('../posthogClient');

      client.bindAnalyticsToConsent();
      expect(mockPosthog.init).not.toHaveBeenCalled();

      consent.setStoredConsent('granted');

      expect(mockPosthog.init).toHaveBeenCalledTimes(1);
      expect(client.isPostHogEnabled()).toBe(true);
    });

    it('opts out and drops identity when consent is withdrawn (Art. 7(3))', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      grantAnalyticsConsent();
      vi.resetModules();
      const consent = await import('../consent');
      const client = await import('../posthogClient');

      client.bindAnalyticsToConsent();
      expect(client.isPostHogEnabled()).toBe(true);

      consent.setStoredConsent('denied');

      expect(mockPosthog.opt_out_capturing).toHaveBeenCalledTimes(1);
      expect(mockPosthog.reset).toHaveBeenCalledTimes(1);
    });

    it('re-opts-in an already-initialised client when consent returns', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      grantAnalyticsConsent();
      vi.resetModules();
      const consent = await import('../consent');
      const client = await import('../posthogClient');

      client.bindAnalyticsToConsent();
      consent.setStoredConsent('denied');
      consent.setStoredConsent('granted');

      expect(mockPosthog.opt_in_capturing).toHaveBeenCalledTimes(1);
      expect(mockPosthog.init).toHaveBeenCalledTimes(1);
    });
  });

  describe('captureAlphaEvent', () => {
    it('no-ops when PostHog is not initialised', async () => {
      const client = await importFreshClient();

      client.captureAlphaEvent('beta_welcome_viewed', { referrer: null });

      expect(mockPosthog.capture).not.toHaveBeenCalled();
    });

    it('passes event name and properties through when initialised', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      grantAnalyticsConsent();
      const client = await importFreshClient();
      client.initPostHog();

      client.captureAlphaEvent('diagnostic_completed', { overall_score: 72 });

      expect(mockPosthog.capture).toHaveBeenCalledWith('diagnostic_completed', {
        overall_score: 72,
      });
    });

    it('never throws when the underlying capture fails', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      grantAnalyticsConsent();
      mockPosthog.capture.mockImplementation(() => {
        throw new Error('network down');
      });
      const client = await importFreshClient();
      client.initPostHog();

      expect(() => client.captureAlphaEvent('scorecard_viewed')).not.toThrow();
    });
  });

  describe('identifyUser / resetIdentity', () => {
    it('no-ops when not initialised', async () => {
      const client = await importFreshClient();

      client.identifyUser('user-1');
      client.resetIdentity();

      expect(mockPosthog.identify).not.toHaveBeenCalled();
      expect(mockPosthog.reset).not.toHaveBeenCalled();
    });

    it('delegates when initialised', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      grantAnalyticsConsent();
      const client = await importFreshClient();
      client.initPostHog();

      client.identifyUser('user-1');
      client.resetIdentity();

      expect(mockPosthog.identify).toHaveBeenCalledWith('user-1');
      expect(mockPosthog.reset).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPostHogDistinctId (THE JOIN KEY)', () => {
    it('returns the PostHog distinct_id when initialised', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      grantAnalyticsConsent();
      mockPosthog.get_distinct_id.mockReturnValue('ph-anon-123');
      const client = await importFreshClient();
      client.initPostHog();

      expect(client.getPostHogDistinctId()).toBe('ph-anon-123');
    });

    it('returns a stable locally-persisted fallback when not initialised', async () => {
      const client = await importFreshClient();

      const first = client.getPostHogDistinctId();
      const second = client.getPostHogDistinctId();

      expect(first).toMatch(/^fallback:/);
      expect(second).toBe(first);
    });

    it('falls back when get_distinct_id returns nothing', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      grantAnalyticsConsent();
      mockPosthog.get_distinct_id.mockReturnValue('');
      const client = await importFreshClient();
      client.initPostHog();

      expect(client.getPostHogDistinctId()).toMatch(/^fallback:/);
    });
  });

  describe('isCoachToolLoopEnabled (default-on)', () => {
    it('defaults to true when PostHog is not initialised (env kill-switch is the real gate)', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', '');
      const client = await importFreshClient();
      client.initPostHog();
      expect(client.isCoachToolLoopEnabled()).toBe(true);
    });

    it('returns true when the coach-tool-loop flag is enabled for the user', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      grantAnalyticsConsent();
      const client = await importFreshClient();
      client.initPostHog();
      mockPosthog.isFeatureEnabled.mockReturnValue(true);
      expect(client.isCoachToolLoopEnabled()).toBe(true);
      expect(mockPosthog.isFeatureEnabled).toHaveBeenCalledWith(client.COACH_TOOL_LOOP_FLAG);
    });

    it('stays ON when flags have not loaded yet (isFeatureEnabled undefined) — the race fix', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      grantAnalyticsConsent();
      const client = await importFreshClient();
      client.initPostHog();
      mockPosthog.isFeatureEnabled.mockReturnValue(undefined);
      expect(client.isCoachToolLoopEnabled()).toBe(true);
    });

    it('returns false ONLY when the flag is explicitly disabled (force-off rollback lever)', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      grantAnalyticsConsent();
      const client = await importFreshClient();
      client.initPostHog();
      mockPosthog.isFeatureEnabled.mockReturnValue(false);
      expect(client.isCoachToolLoopEnabled()).toBe(false);
    });

    it('defaults to true (never throws) when evaluation errors', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      grantAnalyticsConsent();
      const client = await importFreshClient();
      client.initPostHog();
      mockPosthog.isFeatureEnabled.mockImplementation(() => {
        throw new Error('boom');
      });
      expect(client.isCoachToolLoopEnabled()).toBe(true);
    });
  });
});

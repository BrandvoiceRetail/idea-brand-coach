import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPosthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  get_distinct_id: vi.fn(),
  isFeatureEnabled: vi.fn(),
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

describe('posthogClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  describe('initPostHog', () => {
    it('does not initialise when VITE_POSTHOG_KEY is unset', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', '');
      const client = await importFreshClient();

      client.initPostHog();

      expect(mockPosthog.init).not.toHaveBeenCalled();
      expect(client.isPostHogEnabled()).toBe(false);
    });

    it('initialises with the key, default host, and exception capture', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      const client = await importFreshClient();

      client.initPostHog();

      expect(mockPosthog.init).toHaveBeenCalledWith('phc_test_key', {
        api_host: 'https://us.i.posthog.com',
        capture_exceptions: true,
      });
      expect(client.isPostHogEnabled()).toBe(true);
    });

    it('respects VITE_POSTHOG_HOST when set', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      vi.stubEnv('VITE_POSTHOG_HOST', 'https://eu.i.posthog.com');
      const client = await importFreshClient();

      client.initPostHog();

      expect(mockPosthog.init).toHaveBeenCalledWith(
        'phc_test_key',
        expect.objectContaining({ api_host: 'https://eu.i.posthog.com' }),
      );
    });

    it('initialises only once', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      const client = await importFreshClient();

      client.initPostHog();
      client.initPostHog();

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
      const client = await importFreshClient();
      client.initPostHog();

      client.captureAlphaEvent('diagnostic_completed', { overall_score: 72 });

      expect(mockPosthog.capture).toHaveBeenCalledWith('diagnostic_completed', {
        overall_score: 72,
      });
    });

    it('never throws when the underlying capture fails', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
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
      mockPosthog.get_distinct_id.mockReturnValue('');
      const client = await importFreshClient();
      client.initPostHog();

      expect(client.getPostHogDistinctId()).toMatch(/^fallback:/);
    });
  });

  describe('isCoachToolLoopEnabled', () => {
    it('returns false when PostHog is not initialised', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', '');
      const client = await importFreshClient();
      client.initPostHog();
      expect(client.isCoachToolLoopEnabled()).toBe(false);
    });

    it('returns true when the coach-tool-loop flag is enabled for the user', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      const client = await importFreshClient();
      client.initPostHog();
      mockPosthog.isFeatureEnabled.mockReturnValue(true);
      expect(client.isCoachToolLoopEnabled()).toBe(true);
      expect(mockPosthog.isFeatureEnabled).toHaveBeenCalledWith(client.COACH_TOOL_LOOP_FLAG);
    });

    it('returns false when the flag is disabled', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      const client = await importFreshClient();
      client.initPostHog();
      mockPosthog.isFeatureEnabled.mockReturnValue(false);
      expect(client.isCoachToolLoopEnabled()).toBe(false);
    });

    it('returns false (never throws) when evaluation errors', async () => {
      vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
      const client = await importFreshClient();
      client.initPostHog();
      mockPosthog.isFeatureEnabled.mockImplementation(() => {
        throw new Error('boom');
      });
      expect(client.isCoachToolLoopEnabled()).toBe(false);
    });
  });
});

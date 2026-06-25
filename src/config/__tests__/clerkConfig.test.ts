import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  isClerkAuthEnabled,
  getClerkPublishableKey,
  isClerkConfigured,
} from '../clerkConfig';

describe('clerkConfig', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is disabled by default (no env)', () => {
    expect(isClerkAuthEnabled()).toBe(false);
    expect(isClerkConfigured()).toBe(false);
    expect(getClerkPublishableKey()).toBe('');
  });

  it('enables only when the flag is exactly "true"', () => {
    vi.stubEnv('VITE_ENABLE_CLERK_AUTH', 'false');
    expect(isClerkAuthEnabled()).toBe(false);
    vi.stubEnv('VITE_ENABLE_CLERK_AUTH', 'true');
    expect(isClerkAuthEnabled()).toBe(true);
  });

  it('isClerkConfigured requires BOTH the flag and a publishable key', () => {
    vi.stubEnv('VITE_ENABLE_CLERK_AUTH', 'true');
    expect(isClerkConfigured()).toBe(false); // key missing

    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_test_abc');
    expect(isClerkConfigured()).toBe(true);
    expect(getClerkPublishableKey()).toBe('pk_test_abc');
  });

  it('a key without the flag does NOT enable Clerk', () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_test_abc');
    expect(isClerkConfigured()).toBe(false);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.mock is hoisted above module init, so the mock fn must be created via
// vi.hoisted to exist when the factory runs.
const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: getSessionMock } },
}));

import {
  getSupabaseAccessToken,
  setSupabaseAccessTokenGetter,
} from '../sessionToken';

describe('sessionToken accessor', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    setSupabaseAccessTokenGetter(null); // restore default getter
  });

  it('default getter returns the Supabase session access_token', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'supabase-token' } } });
    expect(await getSupabaseAccessToken()).toBe('supabase-token');
  });

  it('default getter returns null when there is no session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    expect(await getSupabaseAccessToken()).toBeNull();
  });

  it('a registered getter overrides the default (Clerk mode)', async () => {
    setSupabaseAccessTokenGetter(async () => 'clerk-token');
    expect(await getSupabaseAccessToken()).toBe('clerk-token');
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('passing null restores the default Supabase getter', async () => {
    setSupabaseAccessTokenGetter(async () => 'clerk-token');
    setSupabaseAccessTokenGetter(null);
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'supabase-token' } } });
    expect(await getSupabaseAccessToken()).toBe('supabase-token');
  });
});

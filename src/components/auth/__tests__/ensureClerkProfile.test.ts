import { describe, it, expect, beforeEach, vi } from 'vitest';

const { upsertMock } = vi.hoisted(() => ({ upsertMock: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(() => ({ upsert: upsertMock })) },
}));

import { ensureClerkProfile } from '../ensureClerkProfile';

describe('ensureClerkProfile', () => {
  beforeEach(() => {
    upsertMock.mockReset().mockResolvedValue({ error: null });
  });

  it('inserts the profile keyed by the Clerk id (insert-only, never clobbers)', async () => {
    await ensureClerkProfile({ id: 'user_2abc', email: 'maya@example.com', fullName: 'Maya P' });
    expect(upsertMock).toHaveBeenCalledWith(
      { id: 'user_2abc', email: 'maya@example.com', full_name: 'Maya P' },
      { onConflict: 'id', ignoreDuplicates: true }
    );
  });

  it('passes full_name null when the Clerk user has no name', async () => {
    await ensureClerkProfile({ id: 'user_2abc', email: 'a@b.com', fullName: null });
    expect(upsertMock).toHaveBeenCalledWith(
      { id: 'user_2abc', email: 'a@b.com', full_name: null },
      { onConflict: 'id', ignoreDuplicates: true }
    );
  });

  it('skips provisioning when there is no email (profiles.email is NOT NULL)', async () => {
    await ensureClerkProfile({ id: 'user_2abc', email: null, fullName: 'Maya P' });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('swallows upsert errors (non-fatal)', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'rls denied' } });
    await expect(
      ensureClerkProfile({ id: 'user_2abc', email: 'a@b.com', fullName: null })
    ).resolves.toBeUndefined();
  });
});

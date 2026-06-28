// @vitest-environment node
/**
 * Avatar management gap — update_avatar + delete_avatar.
 *
 * create_avatar existed but nothing could edit or remove an avatar, leaving the coach
 * stuck with generic placeholders (it had to create duplicates). These tests prove
 * updateAvatar writes only the fields provided (partial) and deleteAvatar is GUARDED:
 * it removes an empty placeholder but refuses an avatar with real work (funnel pieces /
 * tests / diagnostics) unless force=true (deleting cascades that work away).
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  updateAvatar,
  deleteAvatar,
  AvatarLifecycleError,
  type AvatarRow,
} from '../service/avatarLifecycle.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };
const AVATAR: AvatarRow = {
  id: 'av-1',
  brand_id: 'br-1',
  name: 'Placeholder',
  description: null,
  is_primary: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

interface StubOpts {
  avatar?: AvatarRow | null;
  counts?: Record<string, number>;
  capture?: { patch?: Record<string, unknown>; deleted?: boolean };
}

/** Chainable stub covering getAvatar (select.eq.maybeSingle), countAvatarRefs
 *  (select{count}.eq → resolves count), update (update.eq.select.maybeSingle),
 *  and delete (delete.eq → resolves). Each from() call is independent. */
function stub(opts: StubOpts): SupabaseClient {
  const from = (table: string): Record<string, unknown> => {
    let isCount = false;
    let isDelete = false;
    let patch: Record<string, unknown> | null = null;
    const b: Record<string, unknown> = {};
    b.select = (_cols: unknown, o?: { count?: string }) => {
      if (o && o.count) isCount = true;
      return b;
    };
    b.update = (p: Record<string, unknown>) => {
      patch = p;
      if (opts.capture) opts.capture.patch = p;
      return b;
    };
    b.delete = () => {
      isDelete = true;
      return b;
    };
    b.eq = () => {
      if (isCount) return Promise.resolve({ count: opts.counts?.[table] ?? 0, error: null });
      if (isDelete) {
        if (opts.capture) opts.capture.deleted = true;
        return Promise.resolve({ error: null });
      }
      return b;
    };
    b.maybeSingle = () =>
      patch
        ? Promise.resolve({ data: { ...opts.avatar, ...patch }, error: null })
        : Promise.resolve({ data: opts.avatar ?? null, error: null });
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

afterEach(() => __setUserSupabaseFactory(null));

describe('updateAvatar', () => {
  it('writes only the fields provided (partial) + bumps updated_at', async () => {
    const capture: { patch?: Record<string, unknown> } = {};
    __setUserSupabaseFactory(() => stub({ avatar: AVATAR, capture }));
    const row = await runWithIdentity(authed, () =>
      updateAvatar('av-1', { name: 'The Serious Collector', voiceOfCustomer: 'I want it protected.' }),
    );
    expect(capture.patch).toMatchObject({ name: 'The Serious Collector', voice_of_customer: 'I want it protected.' });
    expect(capture.patch).toHaveProperty('updated_at');
    expect(capture.patch).not.toHaveProperty('description'); // omitted → untouched
    expect(row.name).toBe('The Serious Collector');
  });

  it('throws when no fields are supplied', async () => {
    __setUserSupabaseFactory(() => stub({ avatar: AVATAR }));
    await expect(runWithIdentity(authed, () => updateAvatar('av-1', {}))).rejects.toBeInstanceOf(AvatarLifecycleError);
  });
});

describe('deleteAvatar (guarded)', () => {
  it('deletes an empty placeholder (no dependents)', async () => {
    const capture: { deleted?: boolean } = {};
    __setUserSupabaseFactory(() =>
      stub({ avatar: AVATAR, counts: { brand_assets: 0, brand_tests: 0, diagnostic_submissions: 0 }, capture }),
    );
    const r = await runWithIdentity(authed, () => deleteAvatar('av-1', false));
    expect(r.deleted).toBe(true);
    expect(r.refusedForDependents).toBe(false);
    expect(capture.deleted).toBe(true);
  });

  it('REFUSES an avatar with real work unless forced', async () => {
    const capture: { deleted?: boolean } = {};
    __setUserSupabaseFactory(() =>
      stub({ avatar: AVATAR, counts: { brand_assets: 3, brand_tests: 1, diagnostic_submissions: 0 }, capture }),
    );
    const r = await runWithIdentity(authed, () => deleteAvatar('av-1', false));
    expect(r.deleted).toBe(false);
    expect(r.refusedForDependents).toBe(true);
    expect(r.dependents).toEqual({ brandAssets: 3, brandTests: 1, diagnostics: 0 });
    expect(capture.deleted).toBeUndefined(); // never issued the delete
  });

  it('force=true deletes even with dependents', async () => {
    const capture: { deleted?: boolean } = {};
    __setUserSupabaseFactory(() =>
      stub({ avatar: AVATAR, counts: { brand_assets: 3, brand_tests: 1, diagnostic_submissions: 2 }, capture }),
    );
    const r = await runWithIdentity(authed, () => deleteAvatar('av-1', true));
    expect(r.deleted).toBe(true);
    expect(capture.deleted).toBe(true);
  });

  it('throws when the avatar is not found / not owned', async () => {
    __setUserSupabaseFactory(() => stub({ avatar: null }));
    await expect(runWithIdentity(authed, () => deleteAvatar('nope', false))).rejects.toBeInstanceOf(AvatarLifecycleError);
  });
});

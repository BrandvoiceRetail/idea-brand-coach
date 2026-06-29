import { describe, it, expect, vi } from 'vitest';
import { listGeneratedImages } from '../generatedImagesService';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Build a Supabase client stub whose storage.list returns folders then files. */
function makeClient(opts: {
  userId: string | null;
  folders?: Array<{ name: string; id: string | null }>;
  filesByPrefix?: Record<string, Array<{ name: string; id: string | null; created_at?: string }>>;
  listErr?: string;
  signErr?: string;
}): SupabaseClient {
  const from = () => ({
    list: (prefix: string) => {
      if (opts.listErr) return Promise.resolve({ data: null, error: { message: opts.listErr } });
      // Root listing → folders; deeper listing → that prefix's files.
      if (prefix.endsWith('/coach/generated')) {
        return Promise.resolve({ data: opts.folders ?? [], error: null });
      }
      return Promise.resolve({ data: opts.filesByPrefix?.[prefix] ?? [], error: null });
    },
    createSignedUrls: (paths: string[]) => {
      if (opts.signErr) return Promise.resolve({ data: null, error: { message: opts.signErr } });
      return Promise.resolve({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}` })), error: null });
    },
  });
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: opts.userId ? { id: opts.userId } : null } }) },
    storage: { from },
  } as unknown as SupabaseClient;
}

describe('listGeneratedImages', () => {
  it('returns unauthenticated when there is no user', async () => {
    const r = await listGeneratedImages(makeClient({ userId: null }));
    expect(r.status).toBe('unauthenticated');
  });

  it('returns an empty list (honest) when no folders exist', async () => {
    const r = await listGeneratedImages(makeClient({ userId: 'u1', folders: [] }));
    expect(r).toEqual({ status: 'ok', images: [] });
  });

  it('scans folders → files, signs them, newest first', async () => {
    const client = makeClient({
      userId: 'u1',
      folders: [
        { name: 'older', id: null },
        { name: 'newer', id: null },
        { name: 'not-a-folder.txt', id: 'has-id' }, // file at root level → ignored
      ],
      filesByPrefix: {
        'u1/coach/generated/older': [{ name: '0.jpg', id: 'f1', created_at: '2026-06-01T00:00:00Z' }],
        'u1/coach/generated/newer': [{ name: '0.jpg', id: 'f2', created_at: '2026-06-29T00:00:00Z' }],
      },
    });
    const r = await listGeneratedImages(client);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.images.map((i) => i.path)).toEqual([
      'u1/coach/generated/newer/0.jpg',
      'u1/coach/generated/older/0.jpg',
    ]);
    expect(r.images[0].signedUrl).toBe('https://signed/u1/coach/generated/newer/0.jpg');
  });

  it('surfaces a storage list error', async () => {
    const r = await listGeneratedImages(makeClient({ userId: 'u1', listErr: 'boom' }));
    expect(r.status).toBe('error');
  });

  it('never throws — wraps unexpected failures as error', async () => {
    const bad = { auth: { getUser: () => { throw new Error('kaboom'); } } } as unknown as SupabaseClient;
    const r = await listGeneratedImages(bad);
    expect(r.status).toBe('error');
  });
});

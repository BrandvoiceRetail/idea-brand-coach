import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseAvatarService } from '../SupabaseAvatarService';
import { supabase } from '@/integrations/supabase/client';

/** Minimal avatars row matching what mapAvatarFromDb reads. */
function makeRow(over: Record<string, unknown> = {}) {
  return {
    id: 'id',
    user_id: 'user-1',
    name: 'Default Avatar',
    description: null,
    demographics: null,
    psychographics: null,
    buying_behavior: null,
    voice_of_customer: null,
    is_template: false,
    completion_percentage: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

/** Builder for getAll(): .select('*').eq(...).order(...) -> result */
function getAllBuilder(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

/** Builder for create(): .insert(...).select().single() -> result */
function insertBuilder(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });
  return { insert, _insert: insert };
}

describe('SupabaseAvatarService.getOrCreateDefaultAvatar', () => {
  let service: SupabaseAvatarService;

  beforeEach(() => {
    service = new SupabaseAvatarService();
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    } as never);
  });

  it('returns the existing name-matched avatar without creating one', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      getAllBuilder({
        data: [makeRow({ id: 'a', name: 'Other' }), makeRow({ id: 'b', name: 'Default Avatar' })],
        error: null,
      }) as never,
    );

    const result = await service.getOrCreateDefaultAvatar();

    expect(result.id).toBe('b');
    expect(supabase.from).toHaveBeenCalledTimes(1); // getAll only, no insert
  });

  it('returns the first existing avatar when no name matches', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      getAllBuilder({ data: [makeRow({ id: 'a', name: 'Other' })], error: null }) as never,
    );

    const result = await service.getOrCreateDefaultAvatar();

    expect(result.id).toBe('a');
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('creates a Default Avatar only when the user has none', async () => {
    const inserter = insertBuilder({ data: makeRow({ id: 'new' }), error: null });
    vi.mocked(supabase.from)
      .mockReturnValueOnce(getAllBuilder({ data: [], error: null }) as never)
      .mockReturnValueOnce(inserter as never);

    const result = await service.getOrCreateDefaultAvatar();

    expect(result.id).toBe('new');
    expect(inserter._insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Default Avatar', user_id: 'user-1' }),
    );
  });

  it('treats a unique-violation (23505) as already-exists and returns the winning row', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(getAllBuilder({ data: [], error: null }) as never)
      .mockReturnValueOnce(insertBuilder({ data: null, error: { code: '23505', message: 'dup' } }) as never)
      .mockReturnValueOnce(getAllBuilder({ data: [makeRow({ id: 'winner' })], error: null }) as never);

    const result = await service.getOrCreateDefaultAvatar();

    expect(result.id).toBe('winner');
  });

  it('rethrows non-unique errors from create', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(getAllBuilder({ data: [], error: null }) as never)
      .mockReturnValueOnce(insertBuilder({ data: null, error: { code: '08006', message: 'network' } }) as never);

    await expect(service.getOrCreateDefaultAvatar()).rejects.toMatchObject({ code: '08006' });
  });
});

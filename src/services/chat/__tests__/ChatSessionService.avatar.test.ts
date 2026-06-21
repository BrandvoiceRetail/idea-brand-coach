/**
 * ChatSessionService — session-follows-avatar (multi-avatar design §4.1).
 *
 * Pins the P4a step-3 contract: createSession stamps avatar_id + resolves
 * brand_id from the avatar; getSessions filters by avatar_id; and
 * ensureSessionForAvatar reuses an open general thread or creates one.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatSessionService } from '../ChatSessionService';
import { supabase } from '@/integrations/supabase/client';

const USER = 'user-1';
const AVATAR = 'avatar-1';
const BRAND = 'brand-1';

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    user_id: USER,
    avatar_id: AVATAR,
    brand_id: BRAND,
    chatbot_type: 'idea-framework-consultant',
    title: 'New Chat',
    conversation_type: 'general',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ChatSessionService — avatar scoping', () => {
  let service: ChatSessionService;

  beforeEach(() => {
    service = new ChatSessionService();
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('resolves brand_id from the avatar and stamps both columns', async () => {
      const insertSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: sessionRow(), error: null }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'avatars') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { brand_id: BRAND }, error: null }),
                }),
              }),
            }),
          } as never;
        }
        return { insert: insertSpy } as never;
      });

      const { data, error } = await service.createSession(USER, 'idea-framework-consultant', undefined, AVATAR);

      expect(error).toBeNull();
      expect(data?.avatar_id).toBe(AVATAR);
      expect(data?.brand_id).toBe(BRAND);
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ avatar_id: AVATAR, brand_id: BRAND, user_id: USER })
      );
    });

    it('creates a brand-level thread (null scope) when no avatar is given', async () => {
      const insertSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: sessionRow({ avatar_id: null, brand_id: null }),
            error: null,
          }),
        }),
      });
      vi.mocked(supabase.from).mockReturnValue({ insert: insertSpy } as never);

      const { error } = await service.createSession(USER, 'idea-framework-consultant');

      expect(error).toBeNull();
      // No avatar → never touches the avatars table; stamps null scope.
      expect(supabase.from).not.toHaveBeenCalledWith('avatars');
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ avatar_id: null, brand_id: null })
      );
    });

    it('returns an error when the avatar does not belong to the user', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'avatars') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          } as never;
        }
        throw new Error('insert should not run when brand resolution fails');
      });

      const { data, error } = await service.createSession(USER, 'idea-framework-consultant', undefined, AVATAR);

      expect(data).toBeNull();
      expect(error?.message).toMatch(/avatar not found/i);
    });
  });

  describe('getSessions', () => {
    it('adds an avatar_id filter when an avatar is supplied', async () => {
      const avatarEq = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [sessionRow()], error: null }),
      });
      const typeEq = vi.fn().mockReturnValue({ eq: avatarEq });
      const userEq = vi.fn().mockReturnValue({ eq: typeEq });
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: userEq }),
      } as never);

      const { data, error } = await service.getSessions(USER, 'idea-framework-consultant', AVATAR);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(avatarEq).toHaveBeenCalledWith('avatar_id', AVATAR);
    });

    it('does not add an avatar filter when no avatar is supplied', async () => {
      const order = vi.fn().mockResolvedValue({ data: [], error: null });
      const typeEq = vi.fn().mockReturnValue({ order });
      const userEq = vi.fn().mockReturnValue({ eq: typeEq });
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: userEq }),
      } as never);

      await service.getSessions(USER, 'idea-framework-consultant');

      // Chain ends at chatbot_type → order (no third .eq for avatar_id).
      expect(order).toHaveBeenCalled();
    });
  });

  describe('ensureSessionForContext', () => {
    // Builds the chat_sessions read chain ensureSessionForContext uses:
    //   .select('*').eq(user).eq(chatbot).eq(avatar).eq(conversation_type).order()
    function chatSessionsRead(rows: Record<string, unknown>[]) {
      const order = vi.fn().mockResolvedValue({ data: rows, error: null });
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order }) }),
            }),
          }),
        }),
      };
    }

    function avatarsRead() {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { brand_id: BRAND }, error: null }),
            }),
          }),
        }),
      };
    }

    it('reuses a thread whose context set EQUALS the requested set (order-insensitive)', async () => {
      const existing = sessionRow({ id: 'set-thread', context_avatar_ids: ['avatar-2', AVATAR] });
      vi.mocked(supabase.from).mockReturnValue(chatSessionsRead([existing]) as never);

      // Requested set is the same members in a different order → reuse.
      const { data } = await service.ensureSessionForContext(USER, 'idea-framework-consultant', [
        AVATAR,
        'avatar-2',
      ]);

      expect(data?.id).toBe('set-thread');
    });

    it('does NOT reuse a thread whose set differs; creates a fresh one stamping the set', async () => {
      const insertSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: sessionRow({ id: 'fresh' }), error: null }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'avatars') return avatarsRead() as never;
        // Existing thread is a DIFFERENT set ([AVATAR] only) — must not match [AVATAR, avatar-2].
        return {
          ...chatSessionsRead([sessionRow({ id: 'single-thread', context_avatar_ids: [AVATAR] })]),
          insert: insertSpy,
        } as never;
      });

      const { data } = await service.ensureSessionForContext(USER, 'idea-framework-consultant', [
        AVATAR,
        'avatar-2',
      ]);

      expect(data?.id).toBe('fresh');
      // Focus = ids[0]; brand resolved from focus; the SET is stamped.
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          avatar_id: AVATAR,
          brand_id: BRAND,
          context_avatar_ids: [AVATAR, 'avatar-2'],
        })
      );
    });

    it('matches a legacy row with no context_avatar_ids against the single-avatar set', async () => {
      // Legacy row predates the set column → falls back to [avatar_id] = [AVATAR].
      const legacy = sessionRow({ id: 'legacy', context_avatar_ids: null });
      vi.mocked(supabase.from).mockReturnValue(chatSessionsRead([legacy]) as never);

      const { data } = await service.ensureSessionForContext(USER, 'idea-framework-consultant', [AVATAR]);

      expect(data?.id).toBe('legacy');
    });

    it('errors on an empty set', async () => {
      const { data, error } = await service.ensureSessionForContext(USER, 'idea-framework-consultant', []);
      expect(data).toBeNull();
      expect(error?.message).toBe('empty_avatar_set');
    });
  });

  describe('ensureSessionForAvatar (single-id shim)', () => {
    it('delegates to ensureSessionForContext([avatarId]) and reuses a matching thread', async () => {
      const existing = sessionRow({ id: 'existing-thread', context_avatar_ids: [AVATAR] });
      const order = vi.fn().mockResolvedValue({ data: [existing], error: null });
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order }) }),
            }),
          }),
        }),
      } as never);

      const { data } = await service.ensureSessionForAvatar(USER, 'idea-framework-consultant', AVATAR);

      expect(data?.id).toBe('existing-thread');
    });
  });
});

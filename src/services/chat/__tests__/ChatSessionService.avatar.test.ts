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

  describe('ensureSessionForAvatar', () => {
    it('reuses the most-recent general thread for the avatar', async () => {
      const existing = sessionRow({ id: 'existing-thread' });
      const order = vi.fn().mockResolvedValue({ data: [existing], error: null });
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order }) }),
          }),
        }),
      } as never);

      const { data } = await service.ensureSessionForAvatar(USER, 'idea-framework-consultant', AVATAR);

      expect(data?.id).toBe('existing-thread');
    });

    it('creates a new thread when the avatar has no general thread', async () => {
      const insertSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: sessionRow({ id: 'fresh' }), error: null }),
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
        // chat_sessions: getSessions returns only a field thread (no general).
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [sessionRow({ id: 'field-thread', conversation_type: 'field' })],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          insert: insertSpy,
        } as never;
      });

      const { data } = await service.ensureSessionForAvatar(USER, 'idea-framework-consultant', AVATAR);

      expect(data?.id).toBe('fresh');
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ avatar_id: AVATAR, brand_id: BRAND })
      );
    });
  });
});

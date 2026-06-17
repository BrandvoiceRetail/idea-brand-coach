import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseSignatureService } from '../SupabaseSignatureService';
import { supabase } from '@/integrations/supabase/client';

const AUTH_USER = { id: 'user-123' };

function signatureRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'sig-1',
    user_id: AUTH_USER.id,
    avatar_id: null,
    signature_text: "They're buying the moment their collection finally feels like a collection",
    all_options: ['Option A', 'Option B', 'Option C'],
    chosen_index: 1,
    used_reviews: true,
    inference: false,
    artifact_id: null,
    created_at: '2026-06-12T00:00:00Z',
    ...overrides,
  };
}

describe('SupabaseSignatureService', () => {
  let service: SupabaseSignatureService;

  beforeEach(() => {
    service = new SupabaseSignatureService();
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: AUTH_USER as never },
      error: null,
    } as never);
  });

  describe('saveSignature', () => {
    it('inserts the pick with the auth user id and maps the returned row', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: signatureRow(), error: null }),
        }),
      });
      vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as never);

      const saved = await service.saveSignature({
        signatureText: "They're buying the moment their collection finally feels like a collection",
        allOptions: ['Option A', 'Option B', 'Option C'],
        chosenIndex: 1,
        usedReviews: true,
        inference: false,
      });

      expect(supabase.from).toHaveBeenCalledWith('signatures');
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: AUTH_USER.id,
          chosen_index: 1,
          used_reviews: true,
          inference: false,
        }),
      );
      expect(saved.signatureText).toContain('finally feels like a collection');
      expect(saved.allOptions).toHaveLength(3);
      expect(saved.chosenIndex).toBe(1);
    });

    it('throws when the user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(
        service.saveSignature({
          signatureText: 'x',
          allOptions: ['x'],
          chosenIndex: 0,
          usedReviews: false,
          inference: true,
        }),
      ).rejects.toThrow('User not authenticated');
    });
  });

  describe('getLatestSignature', () => {
    it('returns the newest signature for the user', async () => {
      const limitMock = vi.fn().mockResolvedValue({ data: [signatureRow()], error: null });
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({ limit: limitMock }),
          }),
        }),
      } as never);

      const latest = await service.getLatestSignature();

      expect(latest).not.toBeNull();
      expect(latest!.id).toBe('sig-1');
      expect(latest!.usedReviews).toBe(true);
    });

    it('returns null when the user has no saved signature', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      } as never);

      expect(await service.getLatestSignature()).toBeNull();
    });

    it('returns null for signed-out users without querying', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      expect(await service.getLatestSignature()).toBeNull();
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });
});

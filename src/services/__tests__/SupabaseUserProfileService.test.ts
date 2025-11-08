import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseUserProfileService } from '../SupabaseUserProfileService';
import { supabase } from '@/integrations/supabase/client';

describe('SupabaseUserProfileService', () => {
  let service: SupabaseUserProfileService;

  beforeEach(() => {
    service = new SupabaseUserProfileService();
    vi.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should fetch user profile successfully', async () => {
      const mockUser = { id: 'user-123' };
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        latest_diagnostic_data: null,
        latest_diagnostic_score: null,
        diagnostic_completed_at: null,
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await service.getProfile();

      expect(result).toEqual(mockProfile);
    });

    it('should return null when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await service.getProfile();

      expect(result).toBeNull();
    });

    it('should return null when profile not found', async () => {
      const mockUser = { id: 'user-123' };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await service.getProfile();

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const mockUser = { id: 'user-123' };
      const mockUpdatedProfile = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Updated Name',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        latest_diagnostic_data: null,
        latest_diagnostic_score: 75,
        diagnostic_completed_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockUpdatedProfile,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const result = await service.updateProfile({ full_name: 'Updated Name' });

      expect(result).toEqual(mockUpdatedProfile);
    });

    it('should throw error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        service.updateProfile({ full_name: 'Test' })
      ).rejects.toThrow('User not authenticated');
    });
  });

  describe('hasDiagnostic', () => {
    it('should return true when user has diagnostic', async () => {
      const mockUser = { id: 'user-123' };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { latest_diagnostic_score: 75 },
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await service.hasDiagnostic();

      expect(result).toBe(true);
    });

    it('should return false when user has no diagnostic', async () => {
      const mockUser = { id: 'user-123' };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { latest_diagnostic_score: null },
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await service.hasDiagnostic();

      expect(result).toBe(false);
    });

    it('should return false when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await service.hasDiagnostic();

      expect(result).toBe(false);
    });
  });
});

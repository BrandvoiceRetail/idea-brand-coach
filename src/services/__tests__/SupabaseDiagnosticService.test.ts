import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseDiagnosticService } from '../SupabaseDiagnosticService';
import { supabase } from '@/integrations/supabase/client';

describe('SupabaseDiagnosticService', () => {
  let service: SupabaseDiagnosticService;

  beforeEach(() => {
    service = new SupabaseDiagnosticService();
    vi.clearAllMocks();
  });

  describe('calculateScores', () => {
    it('should calculate correct scores from answers', () => {
      const answers = {
        insight: 80,
        distinctive: 60,
        empathetic: 70,
        authentic: 90,
      };

      const result = service.calculateScores(answers);

      expect(result).toEqual({
        overall: 75, // (80 + 60 + 70 + 90) / 4 = 75
        insight: 80,
        distinctive: 60,
        empathetic: 70,
        authentic: 90,
      });
    });

    it('should handle missing values with defaults', () => {
      const answers = {
        insight: 50,
      };

      const result = service.calculateScores(answers);

      expect(result.insight).toBe(50);
      expect(result.distinctive).toBe(0);
      expect(result.empathetic).toBe(0);
      expect(result.authentic).toBe(0);
      expect(result.overall).toBe(13); // 50 / 4 rounded
    });
  });

  describe('saveDiagnostic', () => {
    it('should save diagnostic and update profile', async () => {
      const mockUser = { id: 'user-123' };
      const mockSubmission = {
        id: 'submission-123',
        answers: { test: 1 },
        scores: { overall: 75, insight: 80, distinctive: 60, empathetic: 70, authentic: 90 },
        completed_at: '2025-01-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockSubmission,
            error: null,
          }),
        }),
      });

      const mockUpdate = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'diagnostic_submissions') {
          return { insert: mockInsert } as any;
        }
        if (table === 'profiles') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          } as any;
        }
        return {} as any;
      });

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.saveDiagnostic({
        answers: { insight: 80, distinctive: 60, empathetic: 70, authentic: 90 },
        scores: { overall: 75, insight: 80, distinctive: 60, empathetic: 70, authentic: 90 },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('submission-123');
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'sync-diagnostic-to-embeddings',
        expect.any(Object)
      );
    });

    it('should throw error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        service.saveDiagnostic({
          answers: { insight: 0, distinctive: 0, empathetic: 0, authentic: 0 },
          scores: { overall: 0, insight: 0, distinctive: 0, empathetic: 0, authentic: 0 },
        })
      ).rejects.toThrow('User not authenticated');
    });
  });

  describe('syncFromLocalStorage', () => {
    it('should sync valid localStorage data', async () => {
      const mockData = {
        answers: { insight: 80, distinctive: 60, empathetic: 70, authentic: 90 },
        scores: { overall: 75, insight: 80, distinctive: 60, empathetic: 70, authentic: 90 },
      };

      const mockGetItem = vi.fn().mockReturnValue(JSON.stringify(mockData));
      const mockRemoveItem = vi.fn();
      
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: mockGetItem,
          removeItem: mockRemoveItem,
        },
        writable: true,
      });

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } as any },
        error: null,
      });

      const mockSubmission = {
        id: 'submission-123',
        user_id: 'user-123',
        answers: mockData.answers,
        scores: mockData.scores,
        completed_at: '2025-01-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockSubmission,
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as any);

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.syncFromLocalStorage();

      expect(result).toBeDefined();
      expect(mockRemoveItem).toHaveBeenCalledWith('diagnostic_results');
    });

    it('should return null if no localStorage data', async () => {
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn().mockReturnValue(null),
        },
        writable: true,
      });

      const result = await service.syncFromLocalStorage();

      expect(result).toBeNull();
    });
  });
});

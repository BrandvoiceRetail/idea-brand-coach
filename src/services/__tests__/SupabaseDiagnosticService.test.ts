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
        if (table === 'brands') {
          // resolveBrandId chain: .select().eq().order().limit().maybeSingle()
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'brand-1' }, error: null }),
                  }),
                }),
              }),
            }),
          } as any;
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
      // Embedding sync retired (410 tombstone) — saving must NOT call it.
      expect(supabase.functions.invoke).not.toHaveBeenCalledWith(
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
    it('should handle new format with scores.overall', async () => {
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
        // brands resolveBrandId chain (select→eq→order→limit→maybeSingle).
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'brand-1' }, error: null }),
              }),
            }),
          }),
          // diagnostic_submissions insert→select→single uses this same select node;
          // it is never reached here because insert returns its own select below.
          single: vi.fn().mockResolvedValue({ data: mockSubmission, error: null }),
        }),
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
      expect(mockRemoveItem).toHaveBeenCalledWith('diagnosticData');
    });

    it('should stamp avatar_id on the insert when an overlay avatarId is passed', async () => {
      // Diagnostic BOTH (locked #5): the results-page sync passes the current
      // avatar's id when a baseline already exists, creating an OVERLAY row.
      const mockData = {
        answers: { insight: 80, distinctive: 60, empathetic: 70, authentic: 90 },
        scores: { overall: 75, insight: 80, distinctive: 60, empathetic: 70, authentic: 90 },
      };

      Object.defineProperty(window, 'localStorage', {
        value: { getItem: vi.fn().mockReturnValue(JSON.stringify(mockData)), removeItem: vi.fn() },
        writable: true,
      });

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } as any },
        error: null,
      });

      const mockSubmission = {
        id: 'submission-overlay',
        user_id: 'user-123',
        answers: mockData.answers,
        scores: mockData.scores,
        brand_id: 'brand-1',
        avatar_id: 'avatar-9',
        completed_at: '2025-01-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const insertSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockSubmission, error: null }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'brands') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'brand-1' }, error: null }),
                  }),
                }),
              }),
            }),
          } as any;
        }
        if (table === 'diagnostic_submissions') {
          return { insert: insertSpy } as any;
        }
        if (table === 'profiles') {
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) } as any;
        }
        return {} as any;
      });

      const result = await service.syncFromLocalStorage('avatar-9');

      expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ avatar_id: 'avatar-9', brand_id: 'brand-1' }));
      expect(result?.avatar_id).toBe('avatar-9');
    });

    it('should stamp avatar_id NULL (baseline) when no avatarId is passed', async () => {
      const mockData = {
        answers: { insight: 80, distinctive: 60, empathetic: 70, authentic: 90 },
        scores: { overall: 75, insight: 80, distinctive: 60, empathetic: 70, authentic: 90 },
      };

      Object.defineProperty(window, 'localStorage', {
        value: { getItem: vi.fn().mockReturnValue(JSON.stringify(mockData)), removeItem: vi.fn() },
        writable: true,
      });

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } as any },
        error: null,
      });

      const insertSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 's', user_id: 'user-123', answers: mockData.answers, scores: mockData.scores, brand_id: 'brand-1', avatar_id: null, completed_at: 'x', created_at: 'x', updated_at: 'x' },
            error: null,
          }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'brands') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'brand-1' }, error: null }),
                  }),
                }),
              }),
            }),
          } as any;
        }
        if (table === 'diagnostic_submissions') return { insert: insertSpy } as any;
        if (table === 'profiles') return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) } as any;
        return {} as any;
      });

      await service.syncFromLocalStorage();

      expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ avatar_id: null }));
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

    it('should handle old format with separate overallScore', async () => {
      const mockData = {
        answers: { insight: 80, distinctive: 60, empathetic: 70, authentic: 90 },
        scores: { insight: 80, distinctive: 60, empathetic: 70, authentic: 90 },
        overallScore: 75,
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

      const expectedScores = {
        overall: 75,
        insight: 80,
        distinctive: 60,
        empathetic: 70,
        authentic: 90,
      };

      const mockSubmission = {
        id: 'submission-123',
        user_id: 'user-123',
        answers: mockData.answers,
        scores: expectedScores,
        completed_at: '2025-01-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(supabase.from).mockReturnValue({
        // brands resolveBrandId chain (select→eq→order→limit→maybeSingle).
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'brand-1' }, error: null }),
              }),
            }),
          }),
          // diagnostic_submissions insert→select→single uses this same select node;
          // it is never reached here because insert returns its own select below.
          single: vi.fn().mockResolvedValue({ data: mockSubmission, error: null }),
        }),
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
      expect(result?.scores?.overall).toBe(75);
      expect(mockRemoveItem).toHaveBeenCalledWith('diagnosticData');
    });
  });

  describe('deduplicateByDate', () => {
    it('should keep only the highest score per date', () => {
      const submissions = [
        {
          id: '1',
          completed_at: '2024-02-02T10:00:00Z',
          scores: { overall: 70 },
        },
        {
          id: '2',
          completed_at: '2024-02-02T14:00:00Z',
          scores: { overall: 85 },
        },
        {
          id: '3',
          completed_at: '2024-02-01T10:00:00Z',
          scores: { overall: 60 },
        },
      ];

      const result = (service as any).deduplicateByDate(submissions);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('2'); // Higher score on Feb 2
      expect(result[1].id).toBe('3'); // Only submission on Feb 1
    });

    it('should handle missing scores gracefully', () => {
      const submissions = [
        {
          id: '1',
          completed_at: '2024-02-02T10:00:00Z',
          scores: null,
        },
        {
          id: '2',
          completed_at: '2024-02-02T14:00:00Z',
          scores: { overall: 50 },
        },
      ];

      const result = (service as any).deduplicateByDate(submissions);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2'); // Submission with valid score
    });
  });
});

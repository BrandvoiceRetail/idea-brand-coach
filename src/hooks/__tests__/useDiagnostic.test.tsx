import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useDiagnostic } from '../useDiagnostic';
import { useServices } from '@/services/ServiceProvider';

vi.mock('@/services/ServiceProvider');

describe('useDiagnostic', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

  it('should provide diagnostic service methods', () => {
    const mockDiagnosticService = {
      saveDiagnostic: vi.fn(),
      getLatestDiagnostic: vi.fn().mockResolvedValue(null),
      getDiagnosticHistory: vi.fn().mockResolvedValue([]),
      syncFromLocalStorage: vi.fn(),
      calculateScores: vi.fn(),
    };

    vi.mocked(useServices).mockReturnValue({
      diagnosticService: mockDiagnosticService,
      userProfileService: {} as any,
      chatService: {} as any,
      authService: {} as any,
    });

    const { result } = renderHook(() => useDiagnostic(), { wrapper });

    expect(result.current).toHaveProperty('latestDiagnostic');
    expect(result.current).toHaveProperty('diagnosticHistory');
    expect(result.current).toHaveProperty('saveDiagnostic');
    expect(result.current).toHaveProperty('syncFromLocalStorage');
    expect(result.current).toHaveProperty('calculateScores');
  });

  it('should calculate scores correctly', () => {
    const mockCalculateScores = vi.fn().mockReturnValue({
      overall: 75,
      insight: 80,
      distinctive: 60,
      empathetic: 70,
      authentic: 90,
    });

    const mockDiagnosticService = {
      saveDiagnostic: vi.fn(),
      getLatestDiagnostic: vi.fn().mockResolvedValue(null),
      getDiagnosticHistory: vi.fn().mockResolvedValue([]),
      syncFromLocalStorage: vi.fn(),
      calculateScores: mockCalculateScores,
    };

    vi.mocked(useServices).mockReturnValue({
      diagnosticService: mockDiagnosticService,
      userProfileService: {} as any,
      chatService: {} as any,
      authService: {} as any,
    });

    const { result } = renderHook(() => useDiagnostic(), { wrapper });

    const scores = result.current.calculateScores({
      insight: 80,
      distinctive: 60,
      empathetic: 70,
      authentic: 90,
    });

    expect(scores.overall).toBe(75);
    expect(mockCalculateScores).toHaveBeenCalled();
  });
});

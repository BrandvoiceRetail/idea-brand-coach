import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useProfile } from '../useProfile';
import { useServices } from '@/services/ServiceProvider';

vi.mock('@/services/ServiceProvider');

describe('useProfile', () => {
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

  it('should provide profile data and methods', () => {
    const mockUserProfileService = {
      getProfile: vi.fn().mockResolvedValue(null),
      updateProfile: vi.fn(),
      createProfile: vi.fn(),
      hasDiagnostic: vi.fn().mockResolvedValue(false),
    };

    vi.mocked(useServices).mockReturnValue({
      diagnosticService: {} as any,
      userProfileService: mockUserProfileService,
      chatService: {} as any,
      authService: {} as any,
    });

    const { result } = renderHook(() => useProfile(), { wrapper });

    expect(result.current).toHaveProperty('profile');
    expect(result.current).toHaveProperty('hasDiagnostic');
    expect(result.current).toHaveProperty('updateProfile');
    expect(result.current).toHaveProperty('isLoading');
  });
});

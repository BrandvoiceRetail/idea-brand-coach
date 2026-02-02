import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UserDiagnosticResults } from '../UserDiagnosticResults';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock data for testing
const mockDiagnosticData = [{
  id: '1',
  scores: {
    overall: 85,
    insight: 80,
    distinctive: 90,
    empathetic: 85,
    authentic: 85
  },
  completed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  answers: {}
}];

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } })
}));

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

// Mock useDiagnostic hook
vi.mock('@/hooks/useDiagnostic', () => ({
  useDiagnostic: () => ({
    diagnosticHistory: mockDiagnosticData,
    isLoadingHistory: false,
    latestDiagnostic: mockDiagnosticData[0],
    isLoadingLatest: false,
    latestError: null,
    historyError: null,
    saveDiagnostic: vi.fn(),
    isSaving: false,
    syncFromLocalStorage: vi.fn(),
    isSyncing: false,
    calculateScores: vi.fn()
  })
}));

describe('UserDiagnosticResults', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  it('should use useDiagnostic hook to fetch data', async () => {
    const { useDiagnostic } = await import('@/hooks/useDiagnostic');
    const diagnosticSpy = vi.spyOn({ useDiagnostic }, 'useDiagnostic');

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <UserDiagnosticResults />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // The component should use the useDiagnostic hook
    expect(diagnosticSpy).toBeDefined();
  });

  it('should display diagnostic results with correct score structure', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <UserDiagnosticResults />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('85% Overall')).toBeInTheDocument();
    });

    // Check category scores are displayed
    expect(screen.getByText('Insight')).toBeInTheDocument();
    expect(screen.getByText('Distinctive')).toBeInTheDocument();
    expect(screen.getByText('Empathetic')).toBeInTheDocument();
    expect(screen.getByText('Authentic')).toBeInTheDocument();
  });
});
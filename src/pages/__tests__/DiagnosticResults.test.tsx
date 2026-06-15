import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DiagnosticResults from '../DiagnosticResults';
import { useAuth } from '@/hooks/useAuth';
import { useDiagnostic } from '@/hooks/useDiagnostic';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useDiagnostic');
// The interpretation hook fires a real edge-fn invoke on render; it has its own
// dedicated tests (useTrustGapInterpretation.test.ts), so stub it at page level.
vi.mock('@/hooks/useTrustGapInterpretation', () => ({
  useTrustGapInterpretation: () => ({
    interpretation: null,
    isLoading: false,
    error: null,
    retry: vi.fn(),
  }),
}));
vi.mock('@/services/ServiceProvider', () => ({
  useServices: () => ({
    productDataService: {
      importProducts: vi.fn().mockResolvedValue({ results: [] }),
      getProducts: vi.fn().mockResolvedValue([]),
      getAllReviews: vi.fn().mockResolvedValue([]),
      getAllReviewsAsString: vi.fn().mockResolvedValue(''),
      buildCoachContext: vi.fn().mockReturnValue(''),
      buildTrustGapEvidence: vi.fn().mockResolvedValue({ listings: [], topReviews: [] }),
    },
  }),
}));
vi.mock('@/components/BetaNavigationWidget', () => ({
  BetaNavigationWidget: () => <div>Beta Navigation</div>
}));
vi.mock('@/components/export/DiagnosticResultsPDFExport', () => ({
  DiagnosticResultsPDFExport: () => <div>PDF Export</div>
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Match text that the UI splits across sibling nodes (e.g. `73` + `/100`),
// returning only the deepest element that carries the full text.
const fullText = (text: string) => (_: string, element: Element | null): boolean => {
  const norm = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, '');
  if (norm(element?.textContent) !== text) return false;
  return !Array.from(element?.children ?? []).some((c) => norm(c.textContent) === text);
};

describe('DiagnosticResults', () => {
  let queryClient: QueryClient;

  const mockDiagnosticData = {
    answers: {},
    scores: {
      insight: 75,
      distinctive: 60,
      empathetic: 85,
      authentic: 70
    },
    overallScore: 73,
    completedAt: '2025-01-01T00:00:00Z'
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    vi.clearAllMocks();
    
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  );

  it('should render loading state while fetching data', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useDiagnostic).mockReturnValue({
      latestDiagnostic: null,
      isLoadingLatest: true,
      diagnosticHistory: [],
      isLoadingHistory: false,
      saveDiagnostic: vi.fn(),
      syncFromLocalStorage: vi.fn(),
      calculateScores: vi.fn(),
      isSyncing: false,
    } as any);

    render(<DiagnosticResults />, { wrapper });
    
    expect(screen.getByText('Loading your results...')).toBeInTheDocument();
  });

  it('should render results from database for authenticated users', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useDiagnostic).mockReturnValue({
      latestDiagnostic: {
        id: '1',
        user_id: '123',
        answers: {},
        scores: {
          overall: 73,
          insight: 75,
          distinctive: 60,
          empathetic: 85,
          authentic: 70
        },
        completed_at: '2025-01-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z'
      },
      isLoadingLatest: false,
      diagnosticHistory: [],
      isLoadingHistory: false,
      saveDiagnostic: vi.fn(),
      syncFromLocalStorage: vi.fn(),
      calculateScores: vi.fn(),
      isSyncing: false,
    } as any);

    render(<DiagnosticResults />, { wrapper });

    expect(screen.getByText('Your Brand Diagnostic Results')).toBeInTheDocument();
    expect(screen.getByText(fullText('73/100'))).toBeInTheDocument();
    // Per-dimension /25 scores (Math.round(raw / 4)), rendered as split nodes
    expect(screen.getByText(fullText('19/25'))).toBeInTheDocument(); // Insight 75
    expect(screen.getByText(fullText('15/25'))).toBeInTheDocument(); // Distinctive 60
    expect(screen.getByText(fullText('21/25'))).toBeInTheDocument(); // Empathetic 85
    expect(screen.getByText(fullText('18/25'))).toBeInTheDocument(); // Authentic 70
  });

  it('should render results from localStorage for non-authenticated users', () => {
    localStorage.setItem('diagnosticData', JSON.stringify(mockDiagnosticData));

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useDiagnostic).mockReturnValue({
      latestDiagnostic: null,
      isLoadingLatest: false,
      diagnosticHistory: [],
      isLoadingHistory: false,
      saveDiagnostic: vi.fn(),
      syncFromLocalStorage: vi.fn(),
      calculateScores: vi.fn(),
      isSyncing: false,
    } as any);

    render(<DiagnosticResults />, { wrapper });
    
    expect(screen.getByText('Your Brand Diagnostic Results')).toBeInTheDocument();
    expect(screen.getByText(fullText('73/100'))).toBeInTheDocument();
  });

  it('should show Brand Coach CTA for authenticated users', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useDiagnostic).mockReturnValue({
      latestDiagnostic: {
        id: '1',
        user_id: '123',
        answers: {},
        scores: {
          overall: 73,
          insight: 75,
          distinctive: 60,
          empathetic: 85,
          authentic: 70
        },
        completed_at: '2025-01-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z'
      },
      isLoadingLatest: false,
      diagnosticHistory: [],
      isLoadingHistory: false,
      saveDiagnostic: vi.fn(),
      syncFromLocalStorage: vi.fn(),
      calculateScores: vi.fn(),
      isSyncing: false,
    } as any);

    render(<DiagnosticResults />, { wrapper });

    expect(screen.getByText('Would you like some help with this?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chat with your AI Brand Coach/i })).toBeInTheDocument();
  });

  it('should show sign up CTA for non-authenticated users', () => {
    localStorage.setItem('diagnosticData', JSON.stringify(mockDiagnosticData));

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useDiagnostic).mockReturnValue({
      latestDiagnostic: null,
      isLoadingLatest: false,
      diagnosticHistory: [],
      isLoadingHistory: false,
      saveDiagnostic: vi.fn(),
      syncFromLocalStorage: vi.fn(),
      calculateScores: vi.fn(),
      isSyncing: false,
    } as any);

    render(<DiagnosticResults />, { wrapper });

    expect(screen.getByText('Save & Unlock Premium Tools')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In or Sign Up/i })).toBeInTheDocument();
  });

  it('should display correct score levels', () => {
    localStorage.setItem('diagnosticData', JSON.stringify({
      ...mockDiagnosticData,
      scores: {
        insight: 90, // strong -> 'Building trust'
        distinctive: 70, // strong -> 'Building trust'
        empathetic: 50, // mixed -> 'Developing'
        authentic: 30  // weak -> 'Trust gap'
      },
      overallScore: 60
    }));

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useDiagnostic).mockReturnValue({
      latestDiagnostic: null,
      isLoadingLatest: false,
      diagnosticHistory: [],
      isLoadingHistory: false,
      saveDiagnostic: vi.fn(),
      syncFromLocalStorage: vi.fn(),
      calculateScores: vi.fn(),
      isSyncing: false,
    } as any);

    render(<DiagnosticResults />, { wrapper });
    
    // Trust Gap band badges (per-dimension /25): 90->strong, 70->strong, 50->mixed, 30->weak
    expect(screen.getAllByText('Building trust').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Developing')).toBeInTheDocument();
    expect(screen.getByText('Trust gap')).toBeInTheDocument();
  });

  it('should navigate to auth page when create account button is clicked', () => {
    localStorage.setItem('diagnosticData', JSON.stringify(mockDiagnosticData));

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useDiagnostic).mockReturnValue({
      latestDiagnostic: null,
      isLoadingLatest: false,
      diagnosticHistory: [],
      isLoadingHistory: false,
      saveDiagnostic: vi.fn(),
      syncFromLocalStorage: vi.fn(),
      calculateScores: vi.fn(),
      isSyncing: false,
    } as any);

    render(<DiagnosticResults />, { wrapper });
    
    const signInButton = screen.getByRole('button', { name: /Sign In or Sign Up/i });
    fireEvent.click(signInButton);

    expect(mockNavigate).toHaveBeenCalledWith('/auth?redirect=/subscribe');
  });
});

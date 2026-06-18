import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DiagnosticResults from '../DiagnosticResults';
import { useAuth } from '@/hooks/useAuth';
import { useDiagnostic } from '@/hooks/useDiagnostic';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { useAvatarDiagnosticCompare } from '@/hooks/useAvatarDiagnosticCompare';

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
    diagnosticService: {
      getLatestDiagnostic: vi.fn().mockResolvedValue(null),
    },
  }),
}));
// AvatarContext + the compare hook drive Diagnostic BOTH; stub both at page level
// (each has its own focused tests). Default: no current avatar, no overlay/baseline,
// so the page renders the single-scope (page diagnosticData) scorecard as before.
vi.mock('@/contexts/AvatarContext', () => ({
  useAvatarContext: vi.fn(() => ({ selectedAvatarId: null, currentAvatar: null })),
}));
vi.mock('@/hooks/useAvatarDiagnosticCompare', () => ({
  useAvatarDiagnosticCompare: vi.fn(() => ({ baseline: null, overlay: null, isLoading: false })),
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
    // Scorecard renders overall /100 plus the four /25 dimension cards
    expect(screen.getByText('Your Trust Gap™ Score')).toBeInTheDocument();
    expect(screen.getByText('/100')).toBeInTheDocument();
    expect(screen.getAllByText('Insight').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Distinctive').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Empathetic').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Authentic').length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getByText('Your Trust Gap™ Score')).toBeInTheDocument();
    expect(screen.getByText('/100')).toBeInTheDocument();
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
        insight: 90, // Excellent
        distinctive: 70, // Good
        empathetic: 50, // Fair
        authentic: 30  // Needs Improvement
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
    
    // Bands per /25 rescale: insight 90→23 strong, distinctive 70→18 strong,
    // empathetic 50→13 mixed, authentic 30→8 weak
    expect(screen.getAllByText('Building trust').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Developing').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Trust gap').length).toBeGreaterThanOrEqual(1);
  });

  it('should render compare-mode delta when both an overlay and a baseline exist', () => {
    // Diagnostic BOTH: current avatar has an overlay; brand has a baseline →
    // compare-mode renders the avatar-vs-baseline banner + delta.
    vi.mocked(useAvatarContext).mockReturnValue({
      selectedAvatarId: 'avatar-9',
      currentAvatar: { id: 'avatar-9', name: 'Busy Parent' },
    } as any);
    vi.mocked(useAvatarDiagnosticCompare).mockReturnValue({
      baseline: {
        id: 'b', user_id: '123', answers: {},
        scores: { overall: 50, insight: 50, distinctive: 50, empathetic: 50, authentic: 50 },
        completed_at: '2025-01-01T00:00:00Z', created_at: '2025-01-01T00:00:00Z',
      },
      overlay: {
        id: 'o', user_id: '123', answers: {},
        scores: { overall: 73, insight: 75, distinctive: 60, empathetic: 85, authentic: 70 },
        completed_at: '2025-01-02T00:00:00Z', created_at: '2025-01-02T00:00:00Z',
      },
      isLoading: false,
    } as any);

    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false, signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), resetPassword: vi.fn(),
    } as any);

    vi.mocked(useDiagnostic).mockReturnValue({
      latestDiagnostic: {
        id: '1', user_id: '123', answers: {},
        scores: { overall: 73, insight: 75, distinctive: 60, empathetic: 85, authentic: 70 },
        completed_at: '2025-01-02T00:00:00Z', created_at: '2025-01-02T00:00:00Z',
      },
      isLoadingLatest: false, diagnosticHistory: [], isLoadingHistory: false,
      saveDiagnostic: vi.fn(), syncFromLocalStorage: vi.fn(), calculateScores: vi.fn(), isSyncing: false,
    } as any);

    render(<DiagnosticResults />, { wrapper });

    expect(screen.getByTestId('trustgap-compare-banner')).toBeInTheDocument();
    expect(screen.getByTestId('trustgap-overall-delta')).toBeInTheDocument();
    expect(screen.getByText('Busy Parent')).toBeInTheDocument();
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

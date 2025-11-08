import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DiagnosticResults from '../DiagnosticResults';
import { useAuth } from '@/hooks/useAuth';
import { useDiagnostic } from '@/hooks/useDiagnostic';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useDiagnostic');
vi.mock('@/components/BetaNavigationWidget', () => ({
  BetaNavigationWidget: () => <div>Beta Navigation</div>
}));

describe('DiagnosticResults', () => {
  let queryClient: QueryClient;
  const mockNavigate = vi.fn();

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
    
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
      };
    });

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
    } as any);

    render(<DiagnosticResults />, { wrapper });
    
    expect(screen.getByText('Your Brand Diagnostic Results')).toBeInTheDocument();
    expect(screen.getByText('73%')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument(); // Insight score
    expect(screen.getByText('60')).toBeInTheDocument(); // Distinctive score
    expect(screen.getByText('85')).toBeInTheDocument(); // Empathetic score
    expect(screen.getByText('70')).toBeInTheDocument(); // Authentic score
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
    } as any);

    render(<DiagnosticResults />, { wrapper });
    
    expect(screen.getByText('Your Brand Diagnostic Results')).toBeInTheDocument();
    expect(screen.getByText('73%')).toBeInTheDocument();
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
    } as any);

    render(<DiagnosticResults />, { wrapper });
    
    expect(screen.getByText('Get Personalized Coaching')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Brand Coaching/i })).toBeInTheDocument();
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
    } as any);

    render(<DiagnosticResults />, { wrapper });
    
    expect(screen.getByText('Save & Unlock Premium Tools')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Free Account/i })).toBeInTheDocument();
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
    } as any);

    render(<DiagnosticResults />, { wrapper });
    
    expect(screen.getByText('Excellent')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Fair')).toBeInTheDocument();
    expect(screen.getByText('Needs Improvement')).toBeInTheDocument();
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
    } as any);

    render(<DiagnosticResults />, { wrapper });
    
    const createAccountButton = screen.getByRole('button', { name: /Create Free Account/i });
    fireEvent.click(createAccountButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/auth');
  });
});

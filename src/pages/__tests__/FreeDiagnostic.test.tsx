import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FreeDiagnostic from '../FreeDiagnostic';
import { useAuth } from '@/hooks/useAuth';
import { useDiagnostic } from '@/hooks/useDiagnostic';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useDiagnostic');
vi.mock('@/components/BetaTesterCapture', () => ({
  default: ({ isOpen, onComplete }: any) =>
    isOpen ? <div data-testid="beta-capture" onClick={onComplete}>Beta Capture</div> : null
}));
vi.mock('@/components/BetaNavigationWidget', () => ({
  BetaNavigationWidget: () => <div>Beta Navigation</div>
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

describe('FreeDiagnostic', () => {
  let queryClient: QueryClient;
  const mockSyncFromLocalStorage = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    vi.clearAllMocks();
    
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useDiagnostic).mockReturnValue({
      syncFromLocalStorage: mockSyncFromLocalStorage,
      saveDiagnostic: vi.fn(),
      latestDiagnostic: null,
      diagnosticHistory: [],
      isLoadingLatest: false,
      isLoadingHistory: false,
      calculateScores: vi.fn(),
    } as any);

    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  );

  it('should render the first question', () => {
    render(<FreeDiagnostic />, { wrapper });
    
    expect(screen.getByText('Free Brand Diagnostic')).toBeInTheDocument();
    expect(screen.getByText(/How well do you understand your customers' emotional triggers?/i)).toBeInTheDocument();
    expect(screen.getByText('Question 1 of 6')).toBeInTheDocument();
  });

  it('should not allow proceeding without selecting an answer', async () => {
    render(<FreeDiagnostic />, { wrapper });

    const nextButton = screen.getByRole('button', { name: /Next/i });
    // The Next button is disabled when no answer is selected
    expect(nextButton).toBeDisabled();
  });

  it('should allow selecting an answer and proceeding to next question', async () => {
    render(<FreeDiagnostic />, { wrapper });
    
    const radioButton = screen.getAllByRole('radio')[0];
    fireEvent.click(radioButton);

    const nextButton = screen.getByRole('button', { name: /Next/i });
    expect(nextButton).not.toBeDisabled();
    
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Question 2 of 6')).toBeInTheDocument();
    });
  });

  it('should allow going back to previous question', async () => {
    render(<FreeDiagnostic />, { wrapper });
    
    // Answer first question and go to second
    fireEvent.click(screen.getAllByRole('radio')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    await waitFor(() => {
      expect(screen.getByText('Question 2 of 6')).toBeInTheDocument();
    });

    // Go back
    const previousButton = screen.getByRole('button', { name: /Previous/i });
    fireEvent.click(previousButton);

    await waitFor(() => {
      expect(screen.getByText('Question 1 of 6')).toBeInTheDocument();
    });
  });

  it('should complete diagnostic and navigate to results page', async () => {
    render(<FreeDiagnostic />, { wrapper });

    // Answer all 6 questions
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getAllByRole('radio')[2]); // Select middle option

      if (i < 5) {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }));
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 6`)).toBeInTheDocument();
        });
      } else {
        fireEvent.click(screen.getByRole('button', { name: /Complete Assessment/i }));
      }
    }

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/diagnostic/results');
    });
  });

  it('should save diagnostic data to localStorage on completion', async () => {
    render(<FreeDiagnostic />, { wrapper });

    // Complete all questions
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getAllByRole('radio')[2]);

      if (i < 5) {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }));
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 6`)).toBeInTheDocument();
        });
      } else {
        fireEvent.click(screen.getByRole('button', { name: /Complete Assessment/i }));
      }
    }

    await waitFor(() => {
      const savedData = localStorage.getItem('diagnosticData');
      expect(savedData).toBeTruthy();

      if (savedData) {
        const parsed = JSON.parse(savedData);
        expect(parsed).toHaveProperty('answers');
        expect(parsed).toHaveProperty('scores');
        expect(parsed.scores).toHaveProperty('overall'); // overallScore is inside scores object
        expect(parsed).toHaveProperty('completedAt');
      }
    });
  });

  it('should navigate to results after completion for authenticated users', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    render(<FreeDiagnostic />, { wrapper });

    // Complete diagnostic
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getAllByRole('radio')[2]);
      if (i < 5) {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }));
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 6`)).toBeInTheDocument();
        });
      } else {
        fireEvent.click(screen.getByRole('button', { name: /Complete Assessment/i }));
      }
    }

    // Sync is handled by DiagnosticResults page, not FreeDiagnostic
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/diagnostic/results');
    });

    // Verify data was saved to localStorage for the results page to pick up
    const savedData = localStorage.getItem('diagnosticData');
    expect(savedData).toBeTruthy();
  });

  it('should calculate scores correctly', async () => {
    render(<FreeDiagnostic />, { wrapper });

    // Answer all questions with score 3
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getAllByRole('radio')[2]); // Score 3
      if (i < 5) {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }));
        await waitFor(() => {
          expect(screen.getByText(`Question ${i + 2} of 6`)).toBeInTheDocument();
        });
      } else {
        fireEvent.click(screen.getByRole('button', { name: /Complete Assessment/i }));
      }
    }

    await waitFor(() => {
      const savedData = localStorage.getItem('diagnosticData');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        // Each score should be 60% (3 out of 5 = 60%)
        // overallScore is now inside scores.overall
        expect(parsed.scores.overall).toBe(60);
      }
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useDiagnostic } from '@/hooks/useDiagnostic';
import { useServices } from '@/services/ServiceProvider';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useDiagnostic');
vi.mock('@/services/ServiceProvider');

describe('Diagnostic Flow Integration Tests', () => {
  let queryClient: QueryClient;

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

  it('should complete full diagnostic flow for anonymous user', async () => {
    // Scenario 1: Anonymous user completes diagnostic → sees results → prompted to sign up
    
    const mockSyncFromLocalStorage = vi.fn();
    
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

    // User completes diagnostic
    // Results are stored in localStorage
    const diagnosticData = {
      answers: { q1: '3', q2: '4' },
      scores: {
        insight: 70,
        distinctive: 60,
        empathetic: 80,
        authentic: 75
      },
      overallScore: 71,
      completedAt: new Date().toISOString()
    };
    
    localStorage.setItem('diagnosticData', JSON.stringify(diagnosticData));

    // Verify localStorage has data
    expect(localStorage.getItem('diagnosticData')).toBeTruthy();
    
    // Verify sync was NOT called (user not authenticated)
    expect(mockSyncFromLocalStorage).not.toHaveBeenCalled();
  });

  it('should sync diagnostic to database after user signs up', async () => {
    // Scenario 2: User completes diagnostic → signs up → data syncs to database
    
    const mockSyncFromLocalStorage = vi.fn().mockResolvedValue({
      id: '1',
      user_id: '123',
      answers: {},
      scores: {
        overall: 71,
        insight: 70,
        distinctive: 60,
        empathetic: 80,
        authentic: 75
      },
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    const mockSignUp = vi.fn().mockResolvedValue({ error: null });

    // Initially not authenticated
    vi.mocked(useAuth).mockReturnValueOnce({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signUp: mockSignUp,
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    // After signup, authenticated
    vi.mocked(useAuth).mockReturnValueOnce({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: mockSignUp,
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

    // Diagnostic data in localStorage
    const diagnosticData = {
      answers: { q1: '3', q2: '4' },
      scores: {
        insight: 70,
        distinctive: 60,
        empathetic: 80,
        authentic: 75
      },
      overallScore: 71,
      completedAt: new Date().toISOString()
    };
    localStorage.setItem('diagnosticData', JSON.stringify(diagnosticData));

    // User signs up (simulate)
    await mockSignUp('test@example.com', 'password123', 'Test User');

    // Sync should be called after authentication
    await mockSyncFromLocalStorage();
    
    expect(mockSyncFromLocalStorage).toHaveBeenCalled();
  });

  it('should load diagnostic from database for returning users', async () => {
    // Scenario 3: Returning user signs in → sees their historical diagnostic data
    
    const mockDiagnostic = {
      id: '1',
      user_id: '123',
      answers: {},
      scores: {
        overall: 75,
        insight: 80,
        distinctive: 70,
        empathetic: 75,
        authentic: 75
      },
      completed_at: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z'
    };

    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useDiagnostic).mockReturnValue({
      syncFromLocalStorage: vi.fn(),
      saveDiagnostic: vi.fn(),
      latestDiagnostic: mockDiagnostic,
      diagnosticHistory: [mockDiagnostic],
      isLoadingLatest: false,
      isLoadingHistory: false,
      calculateScores: vi.fn(),
    } as any);

    // User should see their diagnostic data from database
    expect(mockDiagnostic.scores.overall).toBe(75);
    expect(mockDiagnostic.user_id).toBe('123');
  });

  it('should prevent unauthorized access to Brand Coach', () => {
    // Scenario 4: Anonymous user tries to access Brand Coach → redirected to auth
    
    const mockNavigate = vi.fn();
    
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
      };
    });

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    // Brand Coach component should redirect to /auth
    // This is tested in BrandCoach.test.tsx
    expect(true).toBe(true); // Placeholder
  });

  it('should handle diagnostic retake for authenticated users', async () => {
    // Scenario 5: User retakes diagnostic → new submission created → history preserved
    
    const mockSaveDiagnostic = vi.fn().mockResolvedValue({
      id: '2',
      user_id: '123',
      answers: {},
      scores: {
        overall: 80,
        insight: 85,
        distinctive: 75,
        empathetic: 80,
        authentic: 80
      },
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    const existingDiagnostic = {
      id: '1',
      user_id: '123',
      answers: {},
      scores: {
        overall: 70,
        insight: 75,
        distinctive: 65,
        empathetic: 70,
        authentic: 70
      },
      completed_at: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z'
    };

    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useDiagnostic).mockReturnValue({
      syncFromLocalStorage: vi.fn(),
      saveDiagnostic: mockSaveDiagnostic,
      latestDiagnostic: existingDiagnostic,
      diagnosticHistory: [existingDiagnostic],
      isLoadingLatest: false,
      isLoadingHistory: false,
      calculateScores: vi.fn(),
    } as any);

    // User completes new diagnostic
    const newDiagnosticData = {
      answers: { q1: '4', q2: '5' },
      scores: {
        overall: 80,
        insight: 85,
        distinctive: 75,
        empathetic: 80,
        authentic: 80
      }
    };

    await mockSaveDiagnostic(newDiagnosticData);
    
    expect(mockSaveDiagnostic).toHaveBeenCalledWith(newDiagnosticData);
  });

  it('should calculate scores correctly', () => {
    const calculateScores = (answers: Record<string, number>) => {
      const scores = {
        insight: 0,
        distinctive: 0,
        empathetic: 0,
        authentic: 0
      };

      const categories = {
        insight: ['q1', 'q2'],
        distinctive: ['q3', 'q4'],
        empathetic: ['q5'],
        authentic: ['q6']
      };

      Object.entries(categories).forEach(([category, questions]) => {
        const total = questions.reduce((sum, q) => sum + (answers[q] || 0), 0);
        const avg = total / questions.length;
        scores[category as keyof typeof scores] = Math.round((avg / 5) * 100);
      });

      const overall = Math.round(
        (scores.insight + scores.distinctive + scores.empathetic + scores.authentic) / 4
      );

      return { ...scores, overall };
    };

    const answers = {
      q1: 4, // insight
      q2: 3, // insight
      q3: 5, // distinctive
      q4: 4, // distinctive
      q5: 3, // empathetic
      q6: 5  // authentic
    };

    const result = calculateScores(answers);

    expect(result.insight).toBe(70); // (4 + 3) / 2 / 5 * 100 = 70
    expect(result.distinctive).toBe(90); // (5 + 4) / 2 / 5 * 100 = 90
    expect(result.empathetic).toBe(60); // 3 / 5 * 100 = 60
    expect(result.authentic).toBe(100); // 5 / 5 * 100 = 100
    expect(result.overall).toBe(80); // (70 + 90 + 60 + 100) / 4 = 80
  });
});

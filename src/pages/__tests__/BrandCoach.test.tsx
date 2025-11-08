import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BrandCoach from '../BrandCoach';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useDiagnostic } from '@/hooks/useDiagnostic';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useChat');
vi.mock('@/hooks/useDiagnostic');
vi.mock('@/components/DocumentUpload', () => ({
  DocumentUpload: () => <div>Document Upload</div>
}));

describe('BrandCoach', () => {
  let queryClient: QueryClient;
  const mockNavigate = vi.fn();
  const mockSendMessage = vi.fn();
  const mockClearChat = vi.fn();

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
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  );

  it('should redirect to auth if user is not logged in', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useChat).mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      isLoading: false,
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

    render(<BrandCoach />, { wrapper });
    
    expect(mockNavigate).toHaveBeenCalledWith('/auth');
  });

  it('should render Brand Coach UI for authenticated users', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useChat).mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      isLoading: false,
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

    render(<BrandCoach />, { wrapper });
    
    expect(screen.getByText('Brand Coach GPT')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask your Brand Coach anything/i)).toBeInTheDocument();
  });

  it('should display diagnostic scores if available', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useChat).mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      isLoading: false,
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

    render(<BrandCoach />, { wrapper });
    
    expect(screen.getByText('Your Brand Profile')).toBeInTheDocument();
    expect(screen.getByText('73')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();
  });

  it('should display suggested prompts based on low scores', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useChat).mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      isLoading: false,
    } as any);

    vi.mocked(useDiagnostic).mockReturnValue({
      latestDiagnostic: {
        id: '1',
        user_id: '123',
        answers: {},
        scores: {
          overall: 50,
          insight: 40,
          distinctive: 45,
          empathetic: 55,
          authentic: 60
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

    render(<BrandCoach />, { wrapper });
    
    expect(screen.getByText('Suggested Questions')).toBeInTheDocument();
    expect(screen.getByText(/How can I better understand my customers' emotional triggers?/i)).toBeInTheDocument();
    expect(screen.getByText(/What makes my brand stand out from competitors?/i)).toBeInTheDocument();
  });

  it('should send message when user submits', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useChat).mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      isLoading: false,
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

    render(<BrandCoach />, { wrapper });
    
    const textarea = screen.getByPlaceholderText(/Ask your Brand Coach anything/i);
    fireEvent.change(textarea, { target: { value: 'How can I improve my brand?' } });

    const sendButton = screen.getByRole('button', { name: /Send/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith({
        role: 'user',
        content: 'How can I improve my brand?'
      });
    });
  });

  it('should display conversation history', () => {
    const mockMessages = [
      { id: '1', role: 'user' as const, content: 'How can I improve?', created_at: '2025-01-01T00:00:00Z' },
      { id: '2', role: 'assistant' as const, content: 'Here are some tips...', created_at: '2025-01-01T00:01:00Z' }
    ];

    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useChat).mockReturnValue({
      messages: mockMessages,
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      isLoading: false,
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

    render(<BrandCoach />, { wrapper });
    
    expect(screen.getByText('Conversation')).toBeInTheDocument();
    expect(screen.getByText('How can I improve?')).toBeInTheDocument();
    expect(screen.getByText('Here are some tips...')).toBeInTheDocument();
  });

  it('should clear chat when clear button is clicked', async () => {
    const mockMessages = [
      { id: '1', role: 'user' as const, content: 'Test message', created_at: '2025-01-01T00:00:00Z' }
    ];

    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useChat).mockReturnValue({
      messages: mockMessages,
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      isLoading: false,
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

    render(<BrandCoach />, { wrapper });
    
    const clearButton = screen.getByRole('button', { name: /Clear Chat/i });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(mockClearChat).toHaveBeenCalled();
    });
  });

  it('should show loading indicator when message is being sent', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    } as any);

    vi.mocked(useChat).mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      isLoading: true,
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

    render(<BrandCoach />, { wrapper });
    
    expect(screen.getByText('Brand Coach is thinking...')).toBeInTheDocument();
  });
});

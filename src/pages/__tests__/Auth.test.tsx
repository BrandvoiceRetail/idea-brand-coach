import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Auth from '../Auth';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');
vi.mock('@/components/BetaNavigationWidget', () => ({
  BetaNavigationWidget: () => <div>Beta Navigation</div>
}));

describe('Auth', () => {
  let queryClient: QueryClient;
  const mockNavigate = vi.fn();
  const mockSignIn = vi.fn();
  const mockSignUp = vi.fn();
  const mockSignOut = vi.fn();
  const mockResetPassword = vi.fn();

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

  it('should render sign in form by default', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPassword: mockResetPassword,
    } as any);

    render(<Auth />, { wrapper });
    
    expect(screen.getByText('Welcome to IDEA Brand Coach')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Let's go!/i })).toBeInTheDocument();
  });

  it('should switch to sign up form', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPassword: mockResetPassword,
    } as any);

    render(<Auth />, { wrapper });
    
    const signUpTab = screen.getByRole('tab', { name: /Sign Up/i });
    fireEvent.click(signUpTab);

    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Let's get started!/i })).toBeInTheDocument();
  });

  it('should validate email format', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPassword: mockResetPassword,
    } as any);

    render(<Auth />, { wrapper });
    
    const emailInput = screen.getByLabelText(/Email/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('should validate password length', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPassword: mockResetPassword,
    } as any);

    render(<Auth />, { wrapper });
    
    const passwordInput = screen.getByLabelText(/Password/i);
    fireEvent.change(passwordInput, { target: { value: '12345' } });
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(screen.getByText(/Password must be at least 6 characters/i)).toBeInTheDocument();
    });
  });

  it('should call signIn when sign in form is submitted', async () => {
    mockSignIn.mockResolvedValue({ error: null });

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPassword: mockResetPassword,
    } as any);

    render(<Auth />, { wrapper });
    
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'password123' }
    });

    const signInButton = screen.getByRole('button', { name: /Let's go!/i });
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('should call signUp when sign up form is submitted', async () => {
    mockSignUp.mockResolvedValue({ error: null });

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPassword: mockResetPassword,
    } as any);

    render(<Auth />, { wrapper });
    
    // Switch to sign up tab
    const signUpTab = screen.getByRole('tab', { name: /Sign Up/i });
    fireEvent.click(signUpTab);

    // Fill out form
    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: 'Test User' }
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'password123' }
    });

    const signUpButton = screen.getByRole('button', { name: /Let's get started!/i });
    fireEvent.click(signUpButton);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User');
    });
  });

  it('should show reset password form when forgot password is clicked', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPassword: mockResetPassword,
    } as any);

    render(<Auth />, { wrapper });
    
    const forgotPasswordButton = screen.getByRole('button', { name: /Forgot password?/i });
    fireEvent.click(forgotPasswordButton);

    expect(screen.getByText('Reset Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Reset Link/i })).toBeInTheDocument();
  });

  it('should call resetPassword when reset form is submitted', async () => {
    mockResetPassword.mockResolvedValue({ error: null });

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPassword: mockResetPassword,
    } as any);

    render(<Auth />, { wrapper });
    
    // Open reset password form
    const forgotPasswordButton = screen.getByRole('button', { name: /Forgot password?/i });
    fireEvent.click(forgotPasswordButton);

    // Fill out form
    const emailInput = screen.getByLabelText(/Email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    const resetButton = screen.getByRole('button', { name: /Send Reset Link/i });
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('test@example.com');
    });
  });

  it('should show account management when user is logged in', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPassword: mockResetPassword,
    } as any);

    render(<Auth />, { wrapper });
    
    expect(screen.getByText('Account Management')).toBeInTheDocument();
    expect(screen.getByText(/You are already signed in as test@example.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();
  });

  it('should show loading state while checking auth', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: true,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPassword: mockResetPassword,
    } as any);

    render(<Auth />, { wrapper });
    
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loader2 has role="status"
  });

  it('should navigate to dashboard after successful sign in', async () => {
    mockSignIn.mockResolvedValue({ error: null });

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPassword: mockResetPassword,
    } as any);

    render(<Auth />, { wrapper });
    
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'password123' }
    });

    const signInButton = screen.getByRole('button', { name: /Let's go!/i });
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});

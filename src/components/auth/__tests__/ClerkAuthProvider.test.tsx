import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';
import { getSupabaseAccessToken } from '@/integrations/supabase/sessionToken';

// Mock Clerk so we can drive the bridge from fixed state. ClerkProvider is a
// passthrough; useAuth/useUser return our fixtures.
const { useClerkAuthMock, useUserMock } = vi.hoisted(() => ({
  useClerkAuthMock: vi.fn(),
  useUserMock: vi.fn(),
}));
vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: useClerkAuthMock,
  useUser: useUserMock,
}));
// Keep the real sessionToken module, but mock the supabase client it pulls in so
// no real client is constructed (the Clerk getter overrides the default anyway).
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));
vi.mock('@/lib/posthogClient', () => ({
  identifyUser: vi.fn(),
  resetIdentity: vi.fn(),
  captureAlphaEvent: vi.fn(),
}));

import { ClerkAuthProvider } from '../ClerkAuthProvider';

function Probe(): JSX.Element {
  const { user, session, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div data-testid="probe">{`${user?.id}|${user?.email}|${session?.user?.id ?? 'no-session'}`}</div>;
}

describe('ClerkAuthProvider bridge', () => {
  beforeEach(() => {
    useClerkAuthMock.mockReset();
    useUserMock.mockReset();
    setDefaultGetter();
  });

  function setDefaultGetter() {
    // restore default token getter between tests
    // (imported lazily to avoid a top-level dep on the setter)
    return import('@/integrations/supabase/sessionToken').then((m) =>
      m.setSupabaseAccessTokenGetter(null)
    );
  }

  it('maps a signed-in Clerk user onto the AuthContext user/session', () => {
    useClerkAuthMock.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: async () => 'clerk-token',
      signOut: vi.fn(),
    });
    useUserMock.mockReturnValue({
      user: {
        id: 'user_2abc',
        primaryEmailAddress: { emailAddress: 'maya@example.com' },
        fullName: 'Maya P',
        imageUrl: '',
        createdAt: new Date(0),
      },
    });

    render(
      <ClerkAuthProvider>
        <Probe />
      </ClerkAuthProvider>
    );

    expect(screen.getByTestId('probe').textContent).toBe(
      'user_2abc|maya@example.com|user_2abc'
    );
  });

  it('registers the Clerk token as the Supabase bearer source', async () => {
    useClerkAuthMock.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: async () => 'clerk-token-xyz',
      signOut: vi.fn(),
    });
    useUserMock.mockReturnValue({
      user: { id: 'user_2abc', primaryEmailAddress: { emailAddress: 'a@b.com' }, fullName: 'A', imageUrl: '', createdAt: new Date(0) },
    });

    render(
      <ClerkAuthProvider>
        <Probe />
      </ClerkAuthProvider>
    );

    await waitFor(async () => {
      expect(await getSupabaseAccessToken()).toBe('clerk-token-xyz');
    });
  });

  it('exposes loading until Clerk is loaded, and no user when signed out', () => {
    useClerkAuthMock.mockReturnValue({
      isLoaded: false,
      isSignedIn: false,
      getToken: async () => null,
      signOut: vi.fn(),
    });
    useUserMock.mockReturnValue({ user: null });

    render(
      <ClerkAuthProvider>
        <Probe />
      </ClerkAuthProvider>
    );

    expect(screen.getByText('loading')).toBeInTheDocument();
  });
});

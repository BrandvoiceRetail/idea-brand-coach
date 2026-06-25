/**
 * ClerkAuthProvider — flag-gated bridge from Clerk to the app's AuthContext.
 *
 * When `VITE_ENABLE_CLERK_AUTH` is on (and a publishable key is set), App.tsx
 * mounts this in place of the Supabase `AuthProvider`. It:
 *   1. wraps the tree in Clerk's <ClerkProvider>, and
 *   2. supplies the SAME `AuthContext` value shape (user/session/loading/signOut)
 *      mapped from Clerk state — so every `useAuth()` consumer works unchanged.
 *   3. registers Clerk's session token as the Supabase bearer source, so the
 *      native third-party integration authenticates every Supabase/edge request.
 *
 * The imperative email/password methods (signIn/signUp/resetPassword/…) are NOT
 * used in Clerk mode — Clerk's own <SignIn/>/<SignUp/> components own that UI —
 * so they resolve to a clear "use the Clerk UI" error rather than half-working.
 */

import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { ClerkProvider, useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import type { User, Session } from '@supabase/supabase-js';
import { AuthContext, type AuthContextType } from '@/hooks/useAuth';
import { getClerkPublishableKey } from '@/config/clerkConfig';
import { setSupabaseAccessTokenGetter } from '@/integrations/supabase/sessionToken';
import { captureAlphaEvent, identifyUser, resetIdentity } from '@/lib/posthogClient';
import { ensureClerkProfile } from './ensureClerkProfile';

// Imperative auth methods are disabled in Clerk mode (the Clerk UI owns sign-in).
const CLERK_UI_OWNS_AUTH = new Error(
  'Email/password auth is handled by the Clerk sign-in UI in this mode.'
);

// Mirror useAuth.signOut: clear user-scoped localStorage so the next visitor on a
// shared device never inherits stale brand/avatar/diagnostic state.
function purgeUserScopedLocalStorage(): void {
  try {
    const keysToRemove = Object.keys(localStorage).filter((k) =>
      k.startsWith('v2_field_values_') ||
      k.startsWith('v2_field_locks_') ||
      k.startsWith('brandCoach_') ||
      k === 'idea-selected-avatar-id' ||
      k === 'idea-context-avatar-ids' ||
      k === 'betaProgress' ||
      k === 'betaTesterInfo' ||
      k === 'diagnosticData'
    );
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // localStorage unavailable — still proceed with sign-out.
  }
}

function ClerkAuthBridge({ children }: { children: ReactNode }): JSX.Element {
  const { isLoaded, isSignedIn, getToken, signOut: clerkSignOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const authCompletedRef = useRef(false);
  // Provision the profiles row at most once per Clerk user id per page load.
  const provisionedForRef = useRef<string | null>(null);

  // Feed the live Clerk session token to the Supabase client + edge-fn callers.
  useEffect(() => {
    setSupabaseAccessTokenGetter(async () => {
      try {
        return (await getToken()) ?? null;
      } catch {
        return null;
      }
    });
    return () => setSupabaseAccessTokenGetter(null);
  }, [getToken]);

  // Map the Clerk user onto the Supabase `User` shape consumers already read
  // (id / email / user_metadata.full_name). The id is the Clerk user id, which is
  // exactly what RLS sees as `auth.jwt()->>'sub'` after the native-swap migration.
  const user = useMemo<User | null>(() => {
    if (!isSignedIn || !clerkUser) return null;
    return {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? undefined,
      user_metadata: {
        full_name: clerkUser.fullName ?? clerkUser.firstName ?? '',
        avatar_url: clerkUser.imageUrl ?? undefined,
      },
      app_metadata: {},
      aud: 'authenticated',
      created_at: clerkUser.createdAt?.toISOString?.() ?? new Date(0).toISOString(),
    } as unknown as User;
  }, [isSignedIn, clerkUser]);

  // A minimal Session for consumers that read `session.user`. The bearer is
  // resolved lazily via getSupabaseAccessToken() (Clerk tokens are async), so
  // `access_token` is intentionally empty here — direct readers were migrated to
  // the async accessor.
  const session = useMemo<Session | null>(() => {
    if (!user) return null;
    return {
      access_token: '',
      refresh_token: '',
      expires_in: 0,
      token_type: 'bearer',
      user,
    } as unknown as Session;
  }, [user]);

  // Thread the anonymous PostHog journey into the identified person, and fire the
  // auth_completed funnel event once per page load (mirrors the Supabase path).
  useEffect(() => {
    if (isSignedIn && user) {
      identifyUser(user.id);
      if (!authCompletedRef.current) {
        authCompletedRef.current = true;
        captureAlphaEvent('auth_completed');
      }
    }
  }, [isSignedIn, user]);

  // Create-on-first-load profile provisioning: Clerk users have no auth.users row,
  // so the handle_new_user trigger never creates their profiles row. Ensure it
  // exists once per user id (insert-only; never clobbers existing data).
  useEffect(() => {
    if (!isSignedIn || !clerkUser) return;
    if (provisionedForRef.current === clerkUser.id) return;
    provisionedForRef.current = clerkUser.id;
    void ensureClerkProfile({
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress,
      fullName: clerkUser.fullName ?? clerkUser.firstName,
    });
  }, [isSignedIn, clerkUser]);

  const signOut = useCallback(async () => {
    try {
      await clerkSignOut();
    } catch (error) {
      console.error('Clerk sign out error:', error);
    } finally {
      resetIdentity();
      purgeUserScopedLocalStorage();
      window.location.href = '/auth';
    }
  }, [clerkSignOut]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      isRecovering: false,
      signUp: async () => ({ error: CLERK_UI_OWNS_AUTH }),
      signIn: async () => ({ error: CLERK_UI_OWNS_AUTH }),
      signInWithGoogle: async () => ({ error: CLERK_UI_OWNS_AUTH }),
      signOut,
      resetPassword: async () => ({ error: CLERK_UI_OWNS_AUTH }),
      updatePassword: async () => ({ error: CLERK_UI_OWNS_AUTH }),
      loading: !isLoaded,
    }),
    [user, session, signOut, isLoaded]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function ClerkAuthProvider({ children }: { children: ReactNode }): JSX.Element {
  // App.tsx only mounts this when isClerkConfigured() is true, so the key is set.
  const publishableKey = getClerkPublishableKey();
  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/auth">
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}

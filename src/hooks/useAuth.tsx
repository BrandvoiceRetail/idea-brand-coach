import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useServices } from '@/services/ServiceProvider';
import { captureAlphaEvent, identifyUser, resetIdentity } from '@/lib/posthogClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  // True between a PASSWORD_RECOVERY event and a successful password update —
  // lets the Auth page render the set-new-password form instead of treating the
  // recovery session as a normal sign-in.
  isRecovering: boolean;
  // needsConfirmation is true when sign-up succeeded but no session was issued
  // (live project has email confirmation ON) — the caller must NOT navigate into
  // the app; it should prompt the user to confirm their email first.
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: unknown; needsConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: unknown }>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  const { toast } = useToast();
  // Guards auth_completed against duplicate SIGNED_IN emissions (tab refocus,
  // token refresh) — one event per user per page load.
  const authCompletedForRef = useRef<string | null>(null);

  // Safely get services - this can be undefined during HMR
  let authService;
  try {
    const services = useServices();
    authService = services.authService;
  } catch (error) {
    // During HMR, context might not be available yet
    console.warn('Services not available yet, waiting for context initialization');
  }

  useEffect(() => {
    console.log('Setting up auth state listener');

    // Set up auth state listener
    // onAuthStateChange will fire immediately with the current session
    // so we don't need a separate getSession() call
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Log only the event + user id — never the session object (it carries the
        // access_token + refresh_token, which must not land in the browser console).
        console.log('Auth state changed:', event, session?.user?.id ?? null);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // A password-reset link establishes a recovery session via this event.
        // Flag it so the Auth page shows the set-new-password form rather than
        // the "already signed in" card (which dead-ended on /v1/start-here).
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecovering(true);
        } else if (event === 'SIGNED_OUT') {
          setIsRecovering(false);
        }

        // Thread the anonymous PostHog journey into the identified person.
        // identify() is idempotent, so calling on every session-bearing event
        // (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED) is safe.
        if (session?.user) {
          identifyUser(session.user.id);
          // auth_completed fires only at a true sign-in, once per page load.
          if (event === 'SIGNED_IN' && authCompletedForRef.current !== session.user.id) {
            authCompletedForRef.current = session.user.id;
            captureAlphaEvent('auth_completed');
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    if (!authService) {
      throw new Error('Auth service not available');
    }
    try {
      const { session, error } = await authService.signUp(email, password, fullName);

      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      // No session => the live project requires email confirmation. Tell the
      // caller so it surfaces a "check your email" panel instead of routing the
      // sessionless user into the app (which read as "I can't create an account").
      const needsConfirmation = !session;

      toast({
        title: "Success!",
        description: needsConfirmation
          ? "Please check your email to confirm your account."
          : "Your account has been created.",
      });

      return { error: null, needsConfirmation };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!authService) {
      throw new Error('Auth service not available');
    }
    try {
      const { error } = await authService.signIn(email, password);
      
      if (error) {
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });
      }
      
      return { error };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    if (!authService) {
      throw new Error('Auth service not available');
    }
    try {
      await authService.signOut();
      // Clear local state immediately
      setUser(null);
      setSession(null);
      // Drop analytics identity so the next tester on this device starts fresh
      resetIdentity();
      // Clear all user-specific localStorage data to prevent cross-user data leaks
      try {
        const keysToRemove = Object.keys(localStorage).filter(k =>
          k.startsWith('v2_field_values_') ||
          k.startsWith('v2_field_locks_') ||
          k.startsWith('brandCoach_') ||
          // Avatar selection — a stale id would otherwise render authed surfaces
          // (e.g. the Funnel dashboard) for the next, signed-out visitor.
          k === 'idea-selected-avatar-id' ||
          k === 'idea-context-avatar-ids' ||
          k === 'betaProgress' ||
          k === 'betaTesterInfo' ||
          k === 'diagnosticData'
        );
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch {
        // localStorage access failure — still proceed with sign-out
      }
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      // Redirect to auth page
      window.location.href = '/auth';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const signInWithGoogle = async () => {
    if (!authService) {
      throw new Error('Auth service not available');
    }
    try {
      const { error } = await authService.signInWithOAuth('google');
      
      if (error) {
        toast({
          title: "Google sign in failed",
          description: error.message,
          variant: "destructive",
        });
      }
      
      return { error };
    } catch (error) {
      console.error('Google sign in error:', error);
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    if (!authService) {
      throw new Error('Auth service not available');
    }
    try {
      const { error } = await authService.resetPassword(email);
      return { error };
    } catch (error) {
      console.error('Reset password error:', error);
      return { error: error as Error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    if (!authService) {
      throw new Error('Auth service not available');
    }
    try {
      const { error } = await authService.updatePassword(newPassword);
      // Clear the recovery flag on success so the Auth page returns to its normal
      // signed-in behaviour after the password has been reset.
      if (!error) {
        setIsRecovering(false);
      }
      return { error };
    } catch (error) {
      console.error('Update password error:', error);
      return { error };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isRecovering,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      updatePassword,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
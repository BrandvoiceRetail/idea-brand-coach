import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useServices } from '@/services/ServiceProvider';
import { captureAlphaEvent, identifyUser, resetIdentity } from '@/lib/posthogClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
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
        console.log('Auth state changed:', event, session);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

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
      const { user: newUser, error } = await authService.signUp(email, password, fullName);
      
      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        const isConfirmed = !!newUser?.email_confirmed_at;
        
        toast({
          title: "Success!",
          description: isConfirmed 
            ? "Your account has been created. You can now sign in."
            : "Please check your email to confirm your account.",
        });
      }
      
      return { error };
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

  return (
    <AuthContext.Provider value={{
      user,
      session,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
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
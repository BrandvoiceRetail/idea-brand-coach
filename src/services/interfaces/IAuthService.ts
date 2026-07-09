/**
 * IAuthService Interface
 * Contract for authentication operations
 */

import { User, Session } from '@supabase/supabase-js';

export interface IAuthService {
  /**
   * Sign up a new user with email and password.
   * `policyAcceptance` stamps the agreed privacy-notice version into the auth
   * user's metadata (GDPR Art. 7(1) demonstrability) — the signup form requires
   * it, so callers should always pass the current version.
   */
  signUp(email: string, password: string, fullName?: string, policyAcceptance?: { version: string }): Promise<{
    user: User | null;
    session: Session | null;
    error: Error | null;
  }>;

  /**
   * Sign in an existing user with email and password
   */
  signIn(email: string, password: string): Promise<{
    user: User | null;
    session: Session | null;
    error: Error | null;
  }>;

  /**
   * Sign out the current user
   */
  signOut(): Promise<{ error: Error | null }>;

  /**
   * Get the current authenticated user
   */
  getCurrentUser(): Promise<User | null>;

  /**
   * Get the current session
   */
  getCurrentSession(): Promise<Session | null>;

  /**
   * Sign in with OAuth provider (Google)
   */
  signInWithOAuth(provider: 'google'): Promise<{
    error: Error | null;
  }>;

  /**
   * Send password reset email
   */
  resetPassword(email: string): Promise<{ error: Error | null }>;

  /**
   * Update password with reset token
   */
  updatePassword(newPassword: string): Promise<{ error: Error | null }>;
}

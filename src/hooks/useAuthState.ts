import { useAuth } from './useAuth';

/**
 * useAuthState Hook
 *
 * Provides a clearer three-state pattern for auth status.
 * Makes it easier for components to handle loading, authenticated,
 * and unauthenticated states without ambiguity.
 */
export function useAuthState() {
  const { user, loading, session } = useAuth();

  return {
    // Three distinct states for clearer component logic
    isLoading: loading,
    isAuthenticated: !!user && !loading,
    isUnauthenticated: !user && !loading,

    // Raw data for when needed
    user,
    session
  };
}
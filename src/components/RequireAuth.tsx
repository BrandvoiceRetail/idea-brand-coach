import { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * RequireAuth — per-route login gate.
 *
 * `AuthGate` (global) already blocks render until auth state has resolved, so
 * `loading` is normally false by the time this mounts. Redirects unauthenticated
 * visitors to `/auth`, preserving the attempted path via `?redirect=` so Auth can
 * return them after sign-in (Auth.tsx already honours that param).
 *
 * Usage — wrap a single element (`<RequireAuth><Page/></RequireAuth>`) or use as
 * a layout route element and render nested routes through `<Outlet/>`.
 */
export function RequireAuth({ children }: { children?: ReactNode }): JSX.Element | null {
  const { user, loading } = useAuth();
  const location = useLocation();

  // AuthGate normally covers this; guard anyway so we never flash a redirect
  // before auth has resolved.
  if (loading) return null;

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?redirect=${redirect}`} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

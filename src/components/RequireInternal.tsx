/**
 * RequireInternal — gate for non-customer, internal surfaces (the /v4 spine, the v2 coach,
 * dev/test pages, beta). Auth + the internal allowlist; a signed-in *customer* who deep-links
 * one of these is bounced to the current customer surface rather than shown internal tooling.
 *
 * This is the "internal tier" of the default-deny surface model
 * (docs/architecture/ADR-APP-VS-MCP-SURFACE.md, Decision 5). Reuses the admin allowlist
 * (src/config/admin.ts) so "internal" == the project owners + Trevor, with no new config.
 * Admin *dashboards* keep <AdminGate> (an explicit access-denied notice); surface-style
 * internal routes use this (a clean redirect to the one customer surface).
 */
import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isAdminEmail } from '@/config/admin';
import { CURRENT_SURFACE } from '@/config/surface';

export function RequireInternal({ children }: { children: ReactNode }): JSX.Element {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not signed in → send to auth, preserving where they were headed.
  if (!user) {
    return <Navigate to={`/auth?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // Signed-in customer (not on the internal allowlist) → the one customer surface.
  if (!isAdminEmail(user.email)) {
    return <Navigate to={CURRENT_SURFACE} replace />;
  }

  return <>{children}</>;
}

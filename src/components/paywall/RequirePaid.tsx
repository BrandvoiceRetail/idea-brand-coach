/**
 * RequirePaid — gate a paid surface behind credits (Step 6 of docs/PAYWALL_CREDIT_METERING_DESIGN.md).
 *
 * PURE PASSTHROUGH unless VITE_PAYWALL_ENABLED — so with the flag off (the default, incl. the tester
 * window) it renders children and never even reads entitlement. When enabled and the user has no
 * credits, it redirects to the pricing page.
 */
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isPaywallEnabled } from '@/config/features';
import { useEntitlement } from '@/hooks/useEntitlement';

function PaidGate({ children }: { children: ReactNode }): JSX.Element {
  const { loading, hasAccess } = useEntitlement();
  if (loading) return <></>;
  return hasAccess ? <>{children}</> : <Navigate to="/v1/subscribe" replace />;
}

export function RequirePaid({ children }: { children: ReactNode }): JSX.Element {
  // Flag off → never mount the entitlement check (no extra reads, exact today's behavior).
  if (!isPaywallEnabled()) return <>{children}</>;
  return <PaidGate>{children}</PaidGate>;
}

export default RequirePaid;

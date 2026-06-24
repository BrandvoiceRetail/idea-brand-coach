/**
 * AdminGate — renders children only for an authenticated admin (email allowlist).
 *
 * Internal-only surfaces wrap their route in this gate. Non-admins never see the content;
 * they get a restricted notice rather than a redirect, so a deep link doesn't silently
 * bounce. Pairs with the global <AuthGate> (which handles the auth-loading state).
 */
import { type ReactNode } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isAdminEmail } from '@/config/admin';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AdminGateProps {
  children: ReactNode;
}

export function AdminGate({ children }: AdminGateProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdminEmail(user?.email)) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Admin access required</AlertTitle>
          <AlertDescription>
            This is an internal dashboard. Your account is not on the admin allowlist.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}

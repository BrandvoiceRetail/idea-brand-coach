import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface AuthGateProps {
  children: ReactNode;
}

/**
 * AuthGate Component
 *
 * Prevents children from rendering until auth state is fully initialized.
 * This solves the "flash of unauthenticated content" problem and ensures
 * that components using useAuth have access to the correct auth state.
 */
export function AuthGate({ children }: AuthGateProps) {
  const { loading } = useAuth();

  // Show loading spinner while auth is initializing
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-lg text-muted-foreground">Initializing...</span>
        </div>
      </div>
    );
  }

  // Auth is ready, render children
  return <>{children}</>;
}
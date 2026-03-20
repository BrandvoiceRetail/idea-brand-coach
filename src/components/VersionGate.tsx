import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useVersionContext } from '@/contexts/VersionContext';
import { V2_ROUTES } from '@/config/routes';

function getUserFirstName(user: { email?: string } | null): string {
  if (!user) return '';
  const email = user.email || '';
  const localPart = email.split('@')[0] || '';
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

export function VersionGate(): JSX.Element | null {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentVersion, setVersion, isNewUser, hasSeenIntroduction } = useVersionContext();
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // If user has a preference and has seen introduction, redirect immediately
    if (hasSeenIntroduction && !isNewUser) {
      if (currentVersion === 'v2') {
        navigate(V2_ROUTES.BRAND_COACH_V2, { replace: true });
      } else {
        navigate('/v1/start-here', { replace: true });
      }
    } else {
      setShouldRender(true);
    }
  }, [currentVersion, hasSeenIntroduction, isNewUser, navigate]);

  if (!shouldRender) return null;

  const firstName = getUserFirstName(user);

  const handleSelectV2 = (): void => {
    setVersion('v2');
    navigate(V2_ROUTES.BRAND_COACH_V2);
  };

  const handleSelectV1 = (): void => {
    setVersion('v1');
    navigate('/v1/start-here');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted px-4">
      <div className="max-w-lg w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
          </h1>
          <p className="text-muted-foreground text-lg">
            Choose how you'd like to work on your brand today.
          </p>
        </div>

        <div className="space-y-4">
          <Button
            variant="brand"
            size="lg"
            onClick={handleSelectV2}
            className="w-full py-6 text-lg gap-3"
          >
            <Sparkles className="h-5 w-5" />
            Continue to Brand Coach
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectV1}
            className="text-muted-foreground hover:text-foreground gap-2"
          >
            <Clock className="h-4 w-4" />
            Use Classic Version
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useVersionContext } from '@/contexts/VersionContext';
import { V2_ROUTES } from '@/config/routes';
import type { AppVersion } from '@/types/version';

const NUDGE_DISMISSED_KEY = 'versionNudgeDismissed';

function getCurrentVersion(pathname: string): AppVersion {
  if (pathname.startsWith('/v2')) return 'v2';
  return 'v1';
}

export function VersionSwitcher(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { setVersion } = useVersionContext();
  const currentVersion = getCurrentVersion(location.pathname);

  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    if (currentVersion === 'v1') {
      const dismissed = localStorage.getItem(NUDGE_DISMISSED_KEY);
      if (!dismissed) {
        const timer = setTimeout(() => setShowNudge(true), 2000);
        return () => clearTimeout(timer);
      }
    }
    setShowNudge(false);
  }, [currentVersion]);

  const handleSwitch = (version: AppVersion): void => {
    setVersion(version); // Updates both localStorage and DB
    if (version === 'v2') {
      setShowNudge(false);
      localStorage.setItem(NUDGE_DISMISSED_KEY, 'true');
      navigate(V2_ROUTES.BRAND_COACH_V2);
    } else {
      navigate('/v1/start-here');
    }
  };

  const dismissNudge = (): void => {
    setShowNudge(false);
    localStorage.setItem(NUDGE_DISMISSED_KEY, 'true');
  };

  const triggerButton = (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className="gap-2 text-sm">
        {currentVersion === 'v2' ? (
          <>
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Brand Coach</span>
          </>
        ) : (
          <>
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Classic View</span>
          </>
        )}
      </Button>
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) dismissNudge(); }}>
      {showNudge ? (
        <Tooltip open={showNudge}>
          <TooltipTrigger asChild>
            {triggerButton}
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="bg-primary text-primary-foreground cursor-pointer"
            onClick={dismissNudge}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Try the new Brand Coach experience
            </span>
          </TooltipContent>
        </Tooltip>
      ) : (
        triggerButton
      )}

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => handleSwitch('v2')}
          className="gap-2 cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          Brand Coach
          {currentVersion === 'v2' && (
            <span className="ml-auto text-xs text-muted-foreground">Active</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSwitch('v1')}
          className="gap-2 cursor-pointer"
        >
          <Clock className="h-4 w-4" />
          Classic View
          {currentVersion === 'v1' && (
            <span className="ml-auto text-xs text-muted-foreground">Active</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

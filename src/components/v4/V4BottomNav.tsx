/**
 * V4BottomNav — mobile bottom navigation for the /v4 surface. Shows the five
 * spine stages as icon + label tap targets. Visible below `md`; the desktop
 * sidebar replaces it at >=768px. Fixed to the viewport bottom, safe-area aware.
 */
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { V4_SPINE, activeStageFor, type SpineStage } from '@/config/v4';

const TONE_TEXT: Record<SpineStage['tone'], string> = {
  'idea-i': 'text-idea-i',
  'idea-d': 'text-idea-d',
  'idea-e': 'text-idea-e',
  'idea-a': 'text-idea-a',
  'gold-warm': 'text-gold-warm',
};

export function V4BottomNav(): JSX.Element {
  const { pathname } = useLocation();
  // Single source of active-stage truth (shared with SpineStepper + V4Sidebar)
  // so highlighting is identical across all three surfaces, sub-routes included.
  const activeKey = activeStageFor(pathname)?.key ?? null;

  return (
    <nav
      aria-label="Brand journey"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-background/10 bg-foreground pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1">
        {V4_SPINE.map((stage) => {
          const Icon = stage.icon;
          const isActive = activeKey === stage.key;
          return (
            <li key={stage.key} className="flex-1">
              <NavLink
                to={stage.path}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors',
                  isActive
                    ? cn(TONE_TEXT[stage.tone])
                    : 'text-background/60 hover:text-background',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{stage.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

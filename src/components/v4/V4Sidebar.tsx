/**
 * V4Sidebar — desktop navigation rail for the /v4 surface. Lists the spine
 * stages (with blurbs) and a footer link back to the legacy app. Hidden below
 * the `md` breakpoint, where V4BottomNav takes over — desktop/laptop and
 * half-screen widths (>=768px) keep the rail instead of falling to phone layout.
 */
import { NavLink, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { V4_ROUTES, V4_SPINE, activeStageFor, type SpineStage } from '@/config/v4';
import { ProfileMenu } from './ProfileMenu';
import { CustomerAvatarChip } from './avatar/CustomerAvatarChip';

const TONE_TEXT: Record<SpineStage['tone'], string> = {
  'idea-i': 'text-idea-i',
  'idea-d': 'text-idea-d',
  'idea-e': 'text-idea-e',
  'idea-a': 'text-idea-a',
  'gold-warm': 'text-gold-warm',
};

export function V4Sidebar(): JSX.Element {
  const { pathname } = useLocation();
  // Single source of active-stage truth (shared with SpineStepper + V4BottomNav)
  // so highlighting is identical across all three surfaces, sub-routes included.
  const activeKey = activeStageFor(pathname)?.key ?? null;

  return (
    <aside className="v4-chrome hidden w-64 shrink-0 flex-col bg-foreground text-background md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gold-warm text-foreground">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-base font-bold tracking-tight text-background">
          Brand Coach
        </span>
      </div>

      {/* Customer Avatar control — the active customer lens (top of rail, opposite
          the account owner's ProfileMenu pinned at the bottom). */}
      <div className="mb-2 border-b border-background/10 pb-2">
        <CustomerAvatarChip variant="full" />
      </div>

      <NavLink
        to={V4_ROUTES.CHOICE}
        className={({ isActive }) =>
          cn(
            'mx-3 mb-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-background/10 text-background'
              : 'text-background/65 hover:bg-background/10 hover:text-background',
          )
        }
      >
        Onboarding
      </NavLink>

      <nav className="flex-1 space-y-1 px-3" aria-label="Spine">
        {V4_SPINE.map((stage) => {
          const Icon = stage.icon;
          const isActive = activeKey === stage.key;
          return (
            <NavLink
              key={stage.key}
              to={stage.path}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-start gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-background/10 text-background'
                  : 'text-background/65 hover:bg-background/10 hover:text-background',
              )}
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', TONE_TEXT[stage.tone])} />
              <span className="flex flex-col">
                <span className="font-medium leading-tight text-background">{stage.label}</span>
                <span className="text-xs leading-tight text-background/55">{stage.blurb}</span>
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Account owner control pinned to the rail bottom (opens upward). */}
      <div className="mt-2 border-t border-background/10 pt-1">
        <ProfileMenu variant="full" side="top" />
      </div>

      <div className="border-t border-background/10 p-3">
        <NavLink
          to="/v2/coach"
          className="block rounded-md px-3 py-2 text-xs text-background/55 transition-colors hover:bg-background/10 hover:text-background"
        >
          Classic version
        </NavLink>
      </div>
    </aside>
  );
}

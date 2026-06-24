/**
 * BrandCoachHeader Component
 *
 * Top-level header for the BrandCoachV2 page showing:
 * - Brand title and chapter progress badge
 * - Saved field count and overall completion rate
 * - Brand export, version switcher, and avatar dropdown
 *
 * Responsive: stacks controls vertically on mobile, condenses chapter info.
 */

import { LogOut, Settings, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { BrandMarkdownExport } from '@/components/export/BrandMarkdownExport';
import type { BrandMarkdownExportRef } from '@/components/export/BrandMarkdownExport';
import { VersionSwitcher } from '@/components/VersionSwitcher';
import { AvatarHeaderDropdown } from '@/components/v2/AvatarHeaderDropdown';
import type { AvatarData } from '@/components/v2/AvatarHeaderDropdown';
import { ContextAvatarChecklist } from '@/components/v2/ContextAvatarChecklist';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { CHAPTER_FIELDS_MAP } from '@/config/chapterFields';
import type { ChapterProgress } from '@/types/chapter';
import type { MilestoneData } from '@/hooks/v2/useMilestone';

/**
 * Avatar context for the header dropdown
 */
interface AvatarContext {
  currentAvatar: AvatarData | null;
  avatars: AvatarData[];
}

/**
 * Avatar type matching AvatarHeaderDropdown expectations
 */
interface Avatar {
  id: string;
}

interface BrandCoachHeaderProps {
  currentChapter: { number: number; title: string } | null;
  chapterProgress: ChapterProgress | null;
  avatarContext: AvatarContext;
  onAvatarChange: (avatar: Avatar) => void;
  savedFieldCount: number;
  fieldValues: Record<string, string | string[]>;
  onCreateAvatar: () => void;
  /** Brand name for the coaching-context banner ("Coaching: <avatar> · Brand: <brand>"). */
  brandName?: string | null;
  /** Avatar CRUD callbacks (forwarded to the dropdown kebab). */
  onRenameAvatar: (avatarId: string) => void;
  onDuplicateAvatar: (avatarId: string) => void;
  onDeleteAvatar: (avatarId: string) => void;
  onSetPrimaryAvatar: (avatarId: string) => void;
  onForensicBuild: (avatarId: string) => void;
  /** Currently active milestone for visual effects (pulse/gold) */
  activeMilestone?: MilestoneData | null;
  /** Whether all 35 fields have been captured (persistent gold badge) */
  isMilestoneComplete?: boolean;
  /** Callback to open export readiness modal before exporting */
  onBeforeExport?: () => void;
  /** Ref forwarded to BrandMarkdownExport for programmatic export triggering */
  exportRef?: React.RefObject<BrandMarkdownExportRef | null>;
}

/**
 * ChapterProgressBadge - Inline badge showing the current chapter title
 */
function ChapterProgressBadge({ title }: { title: string }): JSX.Element {
  return (
    <Badge variant="outline" className="text-xs">
      {title}
    </Badge>
  );
}

export function BrandCoachHeader({
  currentChapter,
  chapterProgress,
  avatarContext,
  onAvatarChange,
  savedFieldCount,
  fieldValues,
  onCreateAvatar,
  brandName,
  onRenameAvatar,
  onDuplicateAvatar,
  onDeleteAvatar,
  onSetPrimaryAvatar,
  onForensicBuild,
  activeMilestone,
  isMilestoneComplete,
  onBeforeExport,
  exportRef,
}: BrandCoachHeaderProps): JSX.Element {
  const { isMobile } = useDeviceType();
  const { signOut } = useAuth();
  const figmaEnabled = useFeatureFlag('FIGMA_INTEGRATION', false);
  // The active coaching SET + the multi-toggle switch path (Multi-Avatar §2.2).
  // The checklist owns set switching; the dropdown below stays single-target CRUD.
  const { contextAvatarIds, toggleAvatarInContext } = useAvatarContext();

  // Calculate overall completion percentage
  const totalFields = Object.values(CHAPTER_FIELDS_MAP).reduce(
    (sum, chapter) => sum + (chapter.fields?.length || 0),
    0
  );
  const filledFields = Object.values(fieldValues).filter(
    v => v && String(v).trim()
  ).length;
  const completionRate = totalFields > 0
    ? Math.round((filledFields / totalFields) * 100)
    : 0;

  // Banner reflects the active SET (focus-first names), not a single avatar.
  // Fall back to the focus avatar's name when the set hasn't resolved yet.
  const coachingNames = contextAvatarIds
    .map((id) => avatarContext.avatars.find((a) => a.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const coachingLabel =
    coachingNames.length > 0
      ? coachingNames.join(', ')
      : avatarContext.currentAvatar?.name ?? null;

  return (
    <header className="flex-shrink-0 border-b px-4 py-3 flex flex-wrap items-center justify-between gap-y-2">
      {coachingLabel && (
        <div
          className="w-full text-xs text-muted-foreground -mt-1 mb-1"
          data-testid="coaching-context-banner"
        >
          Coaching across: <span className="font-medium text-foreground">{coachingLabel}</span>
          {brandName && (
            <>
              {' '}&middot; Brand: <span className="font-medium text-foreground">{brandName}</span>
            </>
          )}
        </div>
      )}
      <div className={isMobile ? 'flex flex-col gap-1' : 'flex items-center gap-3'}>
        <h1 className="font-semibold text-sm lg:text-base">IDEA Brand Coach</h1>
        <div className="flex items-center gap-2">
          <ChapterProgressBadge
            title={currentChapter?.title ?? 'Brand Purpose'}
          />
          <div className="flex items-center gap-2">
            <div className="relative h-2 w-24 lg:w-32 rounded-full bg-muted overflow-hidden">
              {completionRate > 0 && (
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-progress-gradient transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(completionRate, 100)}%` }}
                />
              )}
            </div>
            <span className={cn(
              'text-xs text-muted-foreground whitespace-nowrap transition-colors',
              activeMilestone?.showPulse && 'milestone-pulse text-[hsl(var(--heart-red))]',
              (activeMilestone?.showGold || isMilestoneComplete) && 'text-[hsl(var(--gold-warm))]',
            )}>
              {isMobile
                ? `${filledFields}/35`
                : `${filledFields} of 35 fields captured`}
            </span>
          </div>
        </div>
      </div>

      <div className={isMobile ? 'flex flex-col items-end gap-1' : 'flex items-center gap-2'}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <BrandMarkdownExport
            ref={exportRef}
            variant="outline"
            size="sm"
            fieldValues={fieldValues}
            onBeforeExport={onBeforeExport}
          />
          {/* Cross-destination nav: the coach and the Funnel Mapper are the two
              top-level surfaces; make the Funnel discoverable from here. */}
          <Button
            asChild
            variant="ghost"
            size="sm"
            title="Funnel Mapper"
            aria-label="Funnel Mapper"
            className="text-muted-foreground hover:text-foreground"
          >
            <Link to="/v2/funnel">
              <TrendingUp className="h-4 w-4" />
              {!isMobile && <span className="ml-1.5">Funnel</span>}
            </Link>
          </Button>
          <VersionSwitcher />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* "One surface switches" — the coaching SET multi-toggle. The dropdown
              beside it stays single-target CRUD (rename/duplicate/delete/etc). */}
          <ContextAvatarChecklist
            avatars={avatarContext.avatars}
            selectedIds={contextAvatarIds}
            onToggle={(id) => { void toggleAvatarInContext(id); }}
          />
          <AvatarHeaderDropdown
            currentAvatar={avatarContext.currentAvatar}
            avatars={avatarContext.avatars}
            onAvatarSelect={(avatarId: string) => onAvatarChange({ id: avatarId })}
            onCreateAvatar={onCreateAvatar}
            onRenameAvatar={onRenameAvatar}
            onDuplicateAvatar={onDuplicateAvatar}
            onDeleteAvatar={onDeleteAvatar}
            onSetPrimaryAvatar={onSetPrimaryAvatar}
            onForensicBuild={onForensicBuild}
          />
          {figmaEnabled && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              title="Settings"
              aria-label="Settings"
              className="text-muted-foreground hover:text-foreground"
            >
              <Link to={ROUTES.SETTINGS}>
                <Settings className="h-4 w-4" />
                {!isMobile && <span className="ml-1.5">Settings</span>}
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            title="Log out"
            aria-label="Log out"
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            {!isMobile && <span className="ml-1.5">Log out</span>}
          </Button>
        </div>
      </div>
    </header>
  );
}

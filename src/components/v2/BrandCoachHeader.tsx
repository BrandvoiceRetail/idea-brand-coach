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

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDeviceType } from '@/hooks/useDeviceType';
import { BrandMarkdownExport } from '@/components/export/BrandMarkdownExport';
import type { BrandMarkdownExportRef } from '@/components/export/BrandMarkdownExport';
import { VersionSwitcher } from '@/components/VersionSwitcher';
import { AvatarHeaderDropdown } from '@/components/v2/AvatarHeaderDropdown';
import type { AvatarData } from '@/components/v2/AvatarHeaderDropdown';
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
  onProceed: () => void;
  canProceed: boolean;
  avatarContext: AvatarContext;
  onAvatarChange: (avatar: Avatar) => void;
  savedFieldCount: number;
  fieldValues: Record<string, string | string[]>;
  onCreateAvatar: () => void;
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
  activeMilestone,
  isMilestoneComplete,
  onBeforeExport,
  exportRef,
}: BrandCoachHeaderProps): JSX.Element {
  const { isMobile } = useDeviceType();

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

  return (
    <header className="flex-shrink-0 border-b px-4 py-3 flex items-center justify-between">
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
        <div className="flex items-center gap-2">
          <BrandMarkdownExport
            ref={exportRef}
            variant="outline"
            size="sm"
            fieldValues={fieldValues}
            onBeforeExport={onBeforeExport}
          />
          <VersionSwitcher />
        </div>
        <AvatarHeaderDropdown
          currentAvatar={avatarContext.currentAvatar}
          avatars={avatarContext.avatars}
          onAvatarSelect={(avatarId: string) => onAvatarChange({ id: avatarId })}
          onCreateAvatar={onCreateAvatar}
        />
      </div>
    </header>
  );
}

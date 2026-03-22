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
import { CheckCircle, Sparkles } from 'lucide-react';
import { useDeviceType } from '@/hooks/useDeviceType';
import { BrandMarkdownExport } from '@/components/export/BrandMarkdownExport';
import { VersionSwitcher } from '@/components/VersionSwitcher';
import { AvatarHeaderDropdown } from '@/components/v2/AvatarHeaderDropdown';
import type { AvatarData } from '@/components/v2/AvatarHeaderDropdown';
import { CHAPTER_FIELDS_MAP } from '@/config/chapterFields';
import type { ChapterProgress } from '@/types/chapter';

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
}

/**
 * ChapterProgressBadge - Inline component showing "Chapter X of 11"
 */
function ChapterProgressBadge({ current, total }: { current: number; total: number }): JSX.Element {
  return (
    <Badge variant="outline" className="text-xs">
      Chapter {current} of {total}
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
            current={chapterProgress?.current_chapter_number ?? 1}
            total={11}
          />
          {savedFieldCount > 0 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3 mr-1" />
              {isMobile ? savedFieldCount : `${savedFieldCount} fields saved`}
            </Badge>
          )}
          {completionRate > 0 && (
            <Badge
              variant={completionRate > 75 ? 'default' : completionRate > 50 ? 'secondary' : 'outline'}
              className="text-xs"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {completionRate}% complete
            </Badge>
          )}
        </div>
      </div>

      <div className={isMobile ? 'flex flex-col items-end gap-1' : 'flex items-center gap-2'}>
        <div className="flex items-center gap-2">
          <BrandMarkdownExport variant="outline" size="sm" />
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

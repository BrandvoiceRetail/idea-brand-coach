/**
 * RecentlyUpdatedWidget Component
 *
 * Displays the last 5 recently updated fields with timestamps and source indicators.
 * Adapts layout based on device type:
 * - Mobile: Collapsible section in Fields tab
 * - Desktop: Persistent sidebar widget
 *
 * Highlights new vs changed values with color-coded indicators.
 */

import * as React from 'react';
import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Clock,
  ChevronDown,
  ChevronUp,
  Bot,
  Pencil,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeviceType } from '@/hooks/useDeviceType';
import type { FieldSource } from '@/config/chapterFields';

/**
 * Represents a recently updated field entry
 */
export interface RecentFieldUpdate {
  /** Field identifier */
  fieldId: string;

  /** Human-readable field label */
  label: string;

  /** Current value */
  value: string | string[];

  /** Previous value (undefined if this is a new field) */
  previousValue?: string | string[];

  /** Source of the update */
  source: FieldSource;

  /** Timestamp of the update */
  updatedAt: Date;

  /** Chapter name this field belongs to */
  chapterName?: string;
}

/**
 * Props for RecentlyUpdatedWidget
 */
export interface RecentlyUpdatedWidgetProps {
  /** List of recently updated fields */
  updates: RecentFieldUpdate[];

  /** Maximum number of updates to display */
  maxItems?: number;

  /** Callback when a field entry is clicked */
  onFieldClick?: (fieldId: string) => void;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Format a relative timestamp (e.g., "2m ago", "1h ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

/**
 * Truncate a display value for preview
 */
function truncateValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value.slice(0, 2).join(', ') + (value.length > 2 ? ` +${value.length - 2}` : '');
  }
  return value.length > 60 ? value.slice(0, 60) + '...' : value;
}

/**
 * Determine if this is a new field (no previous value) or a change
 */
function isNewField(update: RecentFieldUpdate): boolean {
  return update.previousValue === undefined || update.previousValue === '' ||
    (Array.isArray(update.previousValue) && update.previousValue.length === 0);
}

/**
 * Single field update entry
 */
const FieldUpdateEntry: React.FC<{
  update: RecentFieldUpdate;
  onClick?: () => void;
  index: number;
}> = ({ update, onClick, index }) => {
  const isNew = isNewField(update);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className={cn(
        'group flex items-start gap-3 p-2.5 rounded-lg transition-colors',
        'hover:bg-muted/50 cursor-pointer',
        isNew && 'border-l-2 border-green-500'
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Source icon */}
      <div className={cn(
        'mt-0.5 flex-shrink-0 rounded-full p-1',
        update.source === 'ai'
          ? 'bg-blue-500/10 text-blue-600'
          : 'bg-purple-500/10 text-purple-600'
      )}>
        {update.source === 'ai' ? (
          <Bot className="h-3 w-3" />
        ) : (
          <Pencil className="h-3 w-3" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{update.label}</span>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1 py-0 h-4 flex-shrink-0',
              isNew
                ? 'bg-green-500/10 text-green-600 border-green-500/20'
                : 'bg-orange-500/10 text-orange-600 border-orange-500/20'
            )}
          >
            {isNew ? 'new' : 'changed'}
          </Badge>
        </div>

        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {truncateValue(update.value)}
        </div>

        {/* Previous value indicator for changes */}
        {!isNew && update.previousValue && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/70">
            <span className="line-through truncate max-w-[120px]">
              {truncateValue(update.previousValue)}
            </span>
            <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="text-foreground/70 truncate max-w-[120px]">
              {truncateValue(update.value)}
            </span>
          </div>
        )}

        {update.chapterName && (
          <div className="text-[10px] text-muted-foreground/60 mt-0.5">
            {update.chapterName}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5">
              {formatRelativeTime(update.updatedAt)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{update.updatedAt.toLocaleString()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </motion.div>
  );
};

/**
 * Mobile collapsible variant
 */
const MobileRecentlyUpdated: React.FC<{
  updates: RecentFieldUpdate[];
  onFieldClick?: (fieldId: string) => void;
}> = ({ updates, onFieldClick }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full flex items-center justify-between px-3 py-2 h-auto"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">Recent Updates</span>
            {updates.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {updates.length}
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 px-1 pb-2">
          <AnimatePresence mode="popLayout">
            {updates.map((update, index) => (
              <FieldUpdateEntry
                key={`${update.fieldId}-${update.updatedAt.getTime()}`}
                update={update}
                onClick={() => onFieldClick?.(update.fieldId)}
                index={index}
              />
            ))}
          </AnimatePresence>
          {updates.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-4">
              No recent updates yet
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

/**
 * Desktop persistent sidebar widget variant
 */
const DesktopRecentlyUpdated: React.FC<{
  updates: RecentFieldUpdate[];
  onFieldClick?: (fieldId: string) => void;
}> = ({ updates, onFieldClick }) => {
  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Recent Updates</span>
        {updates.length > 0 && (
          <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
            {updates.length}
          </Badge>
        )}
      </div>

      {/* Updates list */}
      <div className="p-2 space-y-0.5">
        <AnimatePresence mode="popLayout">
          {updates.map((update, index) => (
            <FieldUpdateEntry
              key={`${update.fieldId}-${update.updatedAt.getTime()}`}
              update={update}
              onClick={() => onFieldClick?.(update.fieldId)}
              index={index}
            />
          ))}
        </AnimatePresence>
        {updates.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-6">
            <Clock className="h-5 w-5 mx-auto mb-2 opacity-40" />
            No recent updates yet.
            <br />
            <span className="text-xs">Chat with the AI coach to start filling fields.</span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * RecentlyUpdatedWidget Component
 *
 * Adapts between mobile (collapsible) and desktop (persistent sidebar) layouts.
 *
 * @example
 * ```tsx
 * <RecentlyUpdatedWidget
 *   updates={recentUpdates}
 *   onFieldClick={(fieldId) => scrollToField(fieldId)}
 *   maxItems={5}
 * />
 * ```
 */
export const RecentlyUpdatedWidget: React.FC<RecentlyUpdatedWidgetProps> = ({
  updates,
  maxItems = 5,
  onFieldClick,
  className,
}) => {
  const { isMobile } = useDeviceType();

  const sortedUpdates = useMemo(() => {
    return [...updates]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, maxItems);
  }, [updates, maxItems]);

  return (
    <div className={className}>
      {isMobile ? (
        <MobileRecentlyUpdated
          updates={sortedUpdates}
          onFieldClick={onFieldClick}
        />
      ) : (
        <DesktopRecentlyUpdated
          updates={sortedUpdates}
          onFieldClick={onFieldClick}
        />
      )}
    </div>
  );
};

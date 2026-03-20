/**
 * FieldExtractionBadges Component
 *
 * Displays extracted fields as green badges under AI messages.
 * Provides hover previews on desktop and tap-to-review on mobile.
 * Integrates with the field review system for editing extracted values.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeviceType } from '@/hooks/useDeviceType';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Extracted field data
 */
export interface ExtractedField {
  /** Field identifier */
  fieldId: string;

  /** Human-readable field label */
  label: string;

  /** Extracted value */
  value: string | string[];

  /** Confidence score (0-1) */
  confidence?: number;

  /** Whether this field has been accepted/reviewed */
  isReviewed?: boolean;

  /** Whether this field is locked from AI updates */
  isLocked?: boolean;
}

/**
 * Props for FieldExtractionBadges
 */
export interface FieldExtractionBadgesProps {
  /** List of extracted fields to display */
  fields: ExtractedField[];

  /** Callback when a field badge is clicked */
  onFieldClick?: (field: ExtractedField) => void;

  /** Whether to show the celebratory animation */
  showAnimation?: boolean;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Format field value for preview display
 */
function formatPreviewValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value.slice(0, 3).join(', ') + (value.length > 3 ? '...' : '');
  }

  const trimmed = value.trim();
  if (trimmed.length > 100) {
    return trimmed.slice(0, 100) + '...';
  }
  return trimmed;
}

/**
 * FieldExtractionBadges Component
 *
 * @example
 * ```tsx
 * <FieldExtractionBadges
 *   fields={[
 *     { fieldId: 'brand-name', label: 'Brand Name', value: 'Acme Corp' },
 *     { fieldId: 'mission', label: 'Mission', value: 'To make the world better' }
 *   ]}
 *   onFieldClick={(field) => openFieldReview(field)}
 * />
 * ```
 */
export const FieldExtractionBadges: React.FC<FieldExtractionBadgesProps> = ({
  fields,
  onFieldClick,
  showAnimation = true,
  className,
}) => {
  const { isMobile } = useDeviceType();

  if (fields.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-wrap gap-2 mt-3',
        showAnimation && 'animate-in fade-in-50 slide-in-from-bottom-2',
        className
      )}
    >
      {/* Success indicator badge */}
      <Badge
        variant="outline"
        className="bg-green-500/10 text-green-700 border-green-500/30 px-2 py-1 text-xs"
      >
        <Sparkles className="h-3 w-3 mr-1" />
        {fields.length} field{fields.length !== 1 ? 's' : ''} extracted
      </Badge>

      {/* Field badges */}
      <AnimatePresence>
        {fields.map((field, index) => (
          <motion.div
            key={field.fieldId}
            initial={showAnimation ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              delay: showAnimation ? index * 0.05 : 0,
              duration: 0.2,
            }}
          >
            {isMobile ? (
              // Mobile: Simple clickable badge
              <Badge
                variant="outline"
                className={cn(
                  'cursor-pointer transition-all hover:scale-105 active:scale-95',
                  'bg-gradient-to-r from-green-500/10 to-emerald-500/10',
                  'text-green-700 border-green-500/30 hover:border-green-500/50',
                  'px-2.5 py-1 text-xs font-medium',
                  field.isReviewed && 'opacity-80',
                  field.isLocked && 'border-amber-500/30 bg-amber-500/10 text-amber-700'
                )}
                onClick={() => onFieldClick?.(field)}
              >
                <span className="flex items-center gap-1">
                  {field.label}
                  {field.confidence && field.confidence < 0.7 && (
                    <span className="text-[10px] opacity-60">
                      ({Math.round(field.confidence * 100)}%)
                    </span>
                  )}
                  <ChevronRight className="h-3 w-3 opacity-50" />
                </span>
              </Badge>
            ) : (
              // Desktop: Badge with hover preview
              <TooltipProvider>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={cn(
                        'cursor-pointer transition-all hover:scale-105',
                        'bg-gradient-to-r from-green-500/10 to-emerald-500/10',
                        'text-green-700 border-green-500/30 hover:border-green-500/50',
                        'px-2.5 py-1 text-xs font-medium',
                        'hover:shadow-sm hover:shadow-green-500/20',
                        field.isReviewed && 'opacity-80',
                        field.isLocked && 'border-amber-500/30 bg-amber-500/10 text-amber-700'
                      )}
                      onClick={() => onFieldClick?.(field)}
                    >
                      <span className="flex items-center gap-1">
                        {field.label}
                        {field.confidence && field.confidence < 0.7 && (
                          <span className="text-[10px] opacity-60">
                            ({Math.round(field.confidence * 100)}%)
                          </span>
                        )}
                        {field.isReviewed && (
                          <span className="text-green-600">✓</span>
                        )}
                      </span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-xs p-3 space-y-2"
                  >
                    <div className="font-semibold text-sm">{field.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatPreviewValue(field.value)}
                    </div>
                    <div className="text-xs text-primary/60 pt-1 border-t">
                      Click to review or edit
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

/**
 * Simplified badge for inline display (e.g., in chat history)
 */
export const FieldExtractionBadge: React.FC<{
  count: number;
  className?: string;
}> = ({ count, className }) => {
  if (count === 0) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        'bg-green-500/10 text-green-600 border-green-500/30',
        'px-1.5 py-0.5 text-[10px] font-medium',
        className
      )}
    >
      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
      {count} field{count !== 1 ? 's' : ''}
    </Badge>
  );
};
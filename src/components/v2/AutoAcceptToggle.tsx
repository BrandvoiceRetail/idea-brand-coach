/**
 * AutoAcceptToggle Component
 *
 * Toggle control placed in the chat bar area that enables/disables
 * automatic acceptance of AI-extracted field values.
 *
 * When enabled, extracted fields are saved directly without requiring
 * manual review. When disabled, extracted fields go through the
 * review flow (AdaptiveFieldReview).
 */

import * as React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props for AutoAcceptToggle
 */
export interface AutoAcceptToggleProps {
  /** Whether auto-accept is enabled */
  enabled: boolean;

  /** Callback when toggled */
  onToggle: (enabled: boolean) => void;

  /** Whether the toggle is disabled */
  disabled?: boolean;

  /** Additional CSS classes */
  className?: string;
}

/**
 * AutoAcceptToggle Component
 *
 * @example
 * ```tsx
 * <AutoAcceptToggle
 *   enabled={autoAccept}
 *   onToggle={(enabled) => setAutoAccept(enabled)}
 * />
 * ```
 */
export const AutoAcceptToggle: React.FC<AutoAcceptToggleProps> = ({
  enabled,
  onToggle,
  disabled = false,
  className,
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'flex items-center gap-2',
            disabled && 'opacity-50 pointer-events-none',
            className
          )}>
            <Zap className={cn(
              'h-3.5 w-3.5 transition-colors',
              enabled ? 'text-amber-500' : 'text-muted-foreground'
            )} />
            <Label
              htmlFor="auto-accept-toggle"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              Auto-accept
            </Label>
            <Switch
              id="auto-accept-toggle"
              checked={enabled}
              onCheckedChange={onToggle}
              disabled={disabled}
              className="scale-75"
              aria-label="Auto-accept extracted fields"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs max-w-[200px]">
            {enabled
              ? 'AI-extracted fields are saved automatically without review'
              : 'AI-extracted fields require your review before saving'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

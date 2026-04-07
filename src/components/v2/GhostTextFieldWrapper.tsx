/**
 * GhostTextFieldWrapper Component
 *
 * Wraps an Input or Textarea field to overlay ghost (autocomplete) text
 * for pending AI-extracted values. The ghost text appears at 40% opacity
 * in the field when:
 *   - A pending extracted value exists for this field
 *   - The field is currently empty (no user-entered value)
 *
 * Keyboard interactions:
 *   - Tab: accepts the ghost value (calls onAccept)
 *   - Escape: dismisses the ghost text (calls onDismiss if provided)
 *   - Any typing: the ghost text is ignored; user input takes precedence
 *
 * Mobile behavior:
 *   - Ghost text is hidden on mobile (viewport < 768px) since narrow
 *     screens make the overlay confusing. The `hidden md:block` class
 *     on the overlay handles this via Tailwind responsive utilities.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Props for GhostTextFieldWrapper
 */
export interface GhostTextFieldWrapperProps {
  /** The pending AI-extracted value to show as ghost text */
  pendingValue: string;

  /** Called when the user accepts the ghost value (Tab key) */
  onAccept: (value: string) => void;

  /** Called when the user dismisses the ghost text (Escape key) */
  onDismiss?: () => void;

  /** The wrapped input/textarea element */
  children: React.ReactElement;

  /** Additional class names for the wrapper container */
  className?: string;
}

/**
 * GhostTextFieldWrapper
 *
 * Renders ghost (autocomplete) text over an empty input field.
 * The ghost text is positioned absolutely to overlay the input,
 * matching its padding and font so text aligns perfectly.
 *
 * @example
 * ```tsx
 * <GhostTextFieldWrapper
 *   pendingValue="To inspire innovation"
 *   onAccept={(val) => onChange(fieldId, val)}
 * >
 *   <Input value="" onChange={handleChange} placeholder="Enter brand purpose" />
 * </GhostTextFieldWrapper>
 * ```
 */
export function GhostTextFieldWrapper({
  pendingValue,
  onAccept,
  onDismiss,
  children,
  className,
}: GhostTextFieldWrapperProps): JSX.Element {
  const [isDismissed, setIsDismissed] = React.useState(false);

  // Reset dismissed state when pendingValue changes
  React.useEffect(() => {
    setIsDismissed(false);
  }, [pendingValue]);

  /**
   * Handle keyboard events on the wrapper to intercept Tab and Escape
   * before they reach the child input.
   */
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (isDismissed) return;

    if (e.key === 'Tab' && pendingValue) {
      e.preventDefault();
      onAccept(pendingValue);
    } else if (e.key === 'Escape' && pendingValue) {
      e.preventDefault();
      setIsDismissed(true);
      onDismiss?.();
    }
  };

  const shouldShowGhost = Boolean(pendingValue) && !isDismissed;

  return (
    <div
      className={cn('relative', className)}
      onKeyDown={handleKeyDown}
    >
      {children}

      {shouldShowGhost && (
        <div
          className="hidden md:block absolute inset-0 pointer-events-none select-none"
          aria-hidden="true"
        >
          <div
            className="px-3 py-2 text-sm text-muted-foreground/40 truncate"
            data-testid="ghost-text-overlay"
          >
            {pendingValue}
          </div>
        </div>
      )}

      {shouldShowGhost && (
        <div className="hidden md:block text-xs text-muted-foreground/60 mt-1" data-testid="ghost-text-hint">
          Press <kbd className="px-1 py-0.5 rounded border bg-muted text-xs">Tab</kbd> to accept
        </div>
      )}
    </div>
  );
}

GhostTextFieldWrapper.displayName = 'GhostTextFieldWrapper';

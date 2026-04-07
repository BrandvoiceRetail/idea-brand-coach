/**
 * GhostTextChatInput Component
 *
 * Chat textarea with inline ghost-text suggestions. After TrevBot responds,
 * the next suggested prompt appears as gray text at 40% opacity.
 *
 * - Tab: accept the suggestion into the input
 * - Escape: dismiss ghost text
 * - Any typing: ghost text disappears, replaced by user input
 */

import React, { useState, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface GhostTextChatInputProps {
  /** Current input value (controlled) */
  value: string;
  /** Change handler for the input value */
  onChange: (value: string) => void;
  /** Key-down handler (e.g. for Enter-to-send) */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Ghost text suggestion to display (null = no suggestion) */
  suggestion: string | null;
  /** Callback when the user accepts the ghost suggestion via Tab */
  onAcceptSuggestion?: (accepted: string) => void;
  /** Placeholder when no ghost text and no value */
  placeholder?: string;
  /** Additional className for the textarea */
  className?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function GhostTextChatInput({
  value,
  onChange,
  onKeyDown,
  suggestion,
  onAcceptSuggestion,
  placeholder = 'Type your message...',
  className,
  disabled = false,
}: GhostTextChatInputProps): JSX.Element {
  const [isDismissed, setIsDismissed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset dismissed state when suggestion changes
  const prevSuggestionRef = useRef(suggestion);
  if (suggestion !== prevSuggestionRef.current) {
    prevSuggestionRef.current = suggestion;
    setIsDismissed(false);
  }

  const showGhost = Boolean(suggestion) && value.trim() === '' && !isDismissed;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Tab' && showGhost && suggestion) {
      e.preventDefault();
      onAcceptSuggestion?.(suggestion);
    }

    if (e.key === 'Escape' && showGhost) {
      e.preventDefault();
      setIsDismissed(true);
    }

    onKeyDown?.(e);
  };

  return (
    <div className="flex-1 min-w-0 relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={showGhost ? '' : placeholder}
        className={cn('resize-none w-full', className)}
        disabled={disabled}
      />

      {showGhost && (
        <div
          className="absolute inset-0 pointer-events-none select-none overflow-hidden"
          aria-hidden="true"
        >
          <div className="px-3 py-2 text-sm text-muted-foreground/40 truncate">
            {suggestion}
          </div>
        </div>
      )}
    </div>
  );
}

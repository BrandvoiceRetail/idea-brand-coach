/**
 * GhostTextChatInput Component
 *
 * Wraps the chat textarea with inline ghost-text autocomplete powered by
 * react-copilot-autocomplete. After TrevBot responds, the next suggested
 * prompt from useGhostSuggestion appears as gray inline text at 40% opacity.
 *
 * - Tab: accept the suggestion into the input
 * - Escape: dismiss ghost text
 * - Any typing: ghost text disappears, replaced by user input
 */

import React, { useEffect, useRef, forwardRef } from 'react';
import Autocomplete, {
  type AutocompleteTextareaRef,
} from 'react-copilot-autocomplete';
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
// Inner textarea that forwards ref for react-copilot-autocomplete's asChild
// ============================================================================

const AutocompleteTextarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>((props, ref) => {
  const { className, ...rest } = props;
  return (
    <Textarea
      ref={ref}
      className={cn('resize-none flex-1', className)}
      {...rest}
    />
  );
});
AutocompleteTextarea.displayName = 'AutocompleteTextarea';

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
  const autocompleteRef = useRef<AutocompleteTextareaRef>(null);

  // Push the external suggestion into the autocomplete overlay whenever it changes
  useEffect(() => {
    if (!autocompleteRef.current) return;

    if (suggestion && value.trim() === '') {
      autocompleteRef.current.setSuggestion(suggestion);
    } else {
      autocompleteRef.current.clearSuggestion();
    }
  }, [suggestion, value]);

  const handleChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ): void => {
    onChange(e.target.value);
  };

  const handleCompletion = ({
    setSuggestion: setAutocompleteSuggestion,
    value: currentValue,
  }: {
    value: string;
    currentSuggestion: string;
    setSuggestion: (s: string) => void;
    onChangeEvent: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>;
  }): void => {
    // When the user types, clear the ghost suggestion.
    // If they clear the input back to empty and we have a suggestion, re-show it.
    if (currentValue.trim() === '' && suggestion) {
      setAutocompleteSuggestion(suggestion);
    } else {
      setAutocompleteSuggestion('');
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
    // Escape dismisses ghost text
    if (e.key === 'Escape' && autocompleteRef.current) {
      autocompleteRef.current.clearSuggestion();
    }

    // When Tab is pressed on an empty input with a suggestion, notify parent
    if (e.key === 'Tab' && value.trim() === '' && suggestion) {
      onAcceptSuggestion?.(suggestion);
    }

    // Delegate to parent's keydown handler (e.g., Enter to send)
    onKeyDown?.(e);
  };

  return (
    <Autocomplete
      ref={autocompleteRef}
      asChild
      autocompleteEnabled={!disabled}
      handleCompletion={handleCompletion}
      completionShortcut={new Set(['Tab'])}
      styles={{
        suggestion: {
          opacity: 0.4,
        },
      }}
    >
      <AutocompleteTextarea
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
    </Autocomplete>
  );
}

/**
 * GhostTextFieldWrapper Component
 *
 * Wraps chapter panel Input/Textarea fields with ghost-text autocomplete
 * showing pending extracted values from AI. Uses react-copilot-autocomplete's
 * asChild pattern to overlay suggestion text on existing form controls.
 *
 * - Tab: accept the pending value into the field (calls onChange)
 * - Any typing: dismisses the ghost text
 * - Array values: displayed joined with ", " for preview
 */

import React, { useEffect, useRef, useCallback } from 'react';
import Autocomplete, {
  type AutocompleteInputRef,
  type AutocompleteTextareaRef,
} from 'react-copilot-autocomplete';

// ============================================================================
// Types
// ============================================================================

interface GhostTextFieldWrapperProps {
  /** The field identifier (used for keying) */
  fieldId: string;
  /** Pending AI-extracted value to show as ghost text */
  pendingValue?: string | string[];
  /** Called when the user accepts the ghost suggestion via Tab */
  onAccept?: (fieldId: string, value: string | string[]) => void;
  /** The existing Input or Textarea element to wrap */
  children: React.ReactElement;
}

type AutocompleteRef = AutocompleteInputRef | AutocompleteTextareaRef;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a pending value for display as ghost text.
 * Arrays are joined with ", " for a readable preview.
 */
function formatPendingValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value;
}

/**
 * Detect whether the child element is a textarea (vs input).
 */
function isTextareaChild(child: React.ReactElement): boolean {
  const type = child.type;
  if (typeof type === 'string') {
    return type === 'textarea';
  }
  // Check displayName for wrapped components like shadcn Textarea
  if (typeof type === 'object' && type !== null && 'displayName' in type) {
    return (type as { displayName?: string }).displayName === 'Textarea';
  }
  return false;
}

// ============================================================================
// Component
// ============================================================================

export function GhostTextFieldWrapper({
  fieldId,
  pendingValue,
  onAccept,
  children,
}: GhostTextFieldWrapperProps): JSX.Element {
  const autocompleteRef = useRef<AutocompleteRef>(null);
  const formattedValue = pendingValue ? formatPendingValue(pendingValue) : '';
  const hasPending = formattedValue.trim() !== '';
  const isTextarea = isTextareaChild(children);

  // Push the pending value into the autocomplete overlay
  useEffect(() => {
    if (!autocompleteRef.current) return;

    if (hasPending) {
      autocompleteRef.current.setSuggestion(formattedValue);
    } else {
      autocompleteRef.current.clearSuggestion();
    }
  }, [formattedValue, hasPending]);

  // When Tab completes the suggestion, notify the parent with the original value
  const handleCompletion = useCallback(
    ({
      setSuggestion,
      value: currentValue,
    }: {
      value: string;
      currentSuggestion: string;
      setSuggestion: (s: string) => void;
      onChangeEvent: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>;
    }): void => {
      // If user types, dismiss the ghost text
      if (currentValue.trim() !== '') {
        setSuggestion('');
      } else if (hasPending) {
        setSuggestion(formattedValue);
      }
    },
    [hasPending, formattedValue],
  );

  // Intercept Tab to fire onAccept with the original (non-formatted) value
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>): void => {
      if (e.key === 'Tab' && hasPending) {
        onAccept?.(fieldId, pendingValue!);
      }

      // Escape dismisses ghost text
      if (e.key === 'Escape' && autocompleteRef.current) {
        autocompleteRef.current.clearSuggestion();
      }

      // Forward the original child's onKeyDown if present
      const childProps = children.props as Record<string, unknown>;
      if (typeof childProps.onKeyDown === 'function') {
        (childProps.onKeyDown as (e: React.KeyboardEvent<HTMLElement>) => void)(e);
      }
    },
    [hasPending, pendingValue, fieldId, onAccept, children.props],
  );

  // If there's no pending value, render the child as-is (no wrapper overhead)
  if (!hasPending) {
    return children;
  }

  // Clone child to inject the onKeyDown interceptor
  const enhancedChild = React.cloneElement(children, {
    onKeyDown: handleKeyDown,
  } as Partial<React.HTMLAttributes<HTMLElement>>);

  return (
    <Autocomplete
      ref={autocompleteRef}
      asChild
      as={isTextarea ? 'textarea' : 'input'}
      autocompleteEnabled={hasPending}
      handleCompletion={handleCompletion}
      completionShortcut={new Set(['Tab'])}
      styles={{
        suggestion: {
          opacity: 0.4,
        },
      }}
    >
      {enhancedChild}
    </Autocomplete>
  );
}

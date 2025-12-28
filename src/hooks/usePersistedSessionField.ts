/**
 * usePersistedSessionField Hook
 * Combines per-session field storage with database persistence
 * Each session's fields are stored separately in the database
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePersistedField } from '@/hooks/usePersistedField';
import type { KnowledgeCategory } from '@/lib/knowledge-base/interfaces';

interface UsePersistedSessionFieldConfig {
  sessionId: string | null;
  fieldName: 'message' | 'context';
  category?: KnowledgeCategory;
  defaultValue?: string;
  debounceDelay?: number;
}

interface UsePersistedSessionFieldReturn {
  value: string;
  setValue: (value: string) => void;
  isLoading: boolean;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
}

/**
 * Hook for persisted session-specific fields
 * Each session has its own persisted values in the database
 */
export function usePersistedSessionField({
  sessionId,
  fieldName,
  category = 'consultant',
  defaultValue = '',
  debounceDelay = 1000
}: UsePersistedSessionFieldConfig): UsePersistedSessionFieldReturn {
  const { user } = useAuth();

  // Create a unique field identifier for this session+field combination
  // Format: consultant_session_{sessionId}_{fieldName}
  const fieldIdentifier = sessionId
    ? `consultant_session_${sessionId}_${fieldName}`
    : `consultant_draft_${fieldName}`; // Fallback for no session

  // Use the existing usePersistedField hook with session-specific identifier
  const persistedField = usePersistedField({
    fieldIdentifier,
    category,
    defaultValue,
    debounceDelay
  });

  // If no session or no user, return empty state
  if (!sessionId || !user) {
    return {
      value: defaultValue,
      setValue: () => {},
      isLoading: false,
      syncStatus: 'offline'
    };
  }

  return {
    value: persistedField.value,
    setValue: persistedField.onChange,
    isLoading: persistedField.isLoading,
    syncStatus: persistedField.syncStatus
  };
}

/**
 * Hook for managing multiple persisted session fields
 * Useful for forms with both message and context fields
 */
export function usePersistedSessionForm({
  sessionId,
  category = 'consultant',
  debounceDelay = 1000
}: {
  sessionId: string | null;
  category?: KnowledgeCategory;
  debounceDelay?: number;
}) {
  const messageField = usePersistedSessionField({
    sessionId,
    fieldName: 'message',
    category,
    debounceDelay
  });

  const contextField = usePersistedSessionField({
    sessionId,
    fieldName: 'context',
    category,
    debounceDelay
  });

  return {
    message: messageField.value,
    setMessage: messageField.setValue,
    context: contextField.value,
    setContext: contextField.setValue,
    isLoading: messageField.isLoading || contextField.isLoading,
    syncStatus: messageField.syncStatus === 'offline' || contextField.syncStatus === 'offline'
      ? 'offline'
      : messageField.syncStatus === 'syncing' || contextField.syncStatus === 'syncing'
      ? 'syncing'
      : 'synced'
  };
}
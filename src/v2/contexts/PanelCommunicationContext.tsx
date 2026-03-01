import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * Message types for inter-panel communication
 */
export type PanelMessageType =
  | 'field_selected'
  | 'field_updated'
  | 'panel_focus'
  | 'panel_blur'
  | 'scroll_to_field'
  | 'custom';

/**
 * Message payload for inter-panel communication
 */
export interface PanelMessage {
  type: PanelMessageType;
  sourcePanel: 'left' | 'center' | 'right';
  targetPanel?: 'left' | 'center' | 'right' | 'all';
  payload?: {
    fieldId?: string;
    fieldValue?: unknown;
    section?: string;
    metadata?: Record<string, unknown>;
  };
  timestamp: number;
}

/**
 * Field selection state
 */
export interface FieldSelection {
  fieldId: string;
  section: string;
  panel: 'left' | 'center' | 'right';
  timestamp: number;
}

/**
 * Message listener callback type
 */
type MessageListener = (message: PanelMessage) => void;

/**
 * PanelCommunicationContext - Event bus for inter-panel messaging
 * Handles panel focus events, field selection, and custom messages
 */
interface PanelCommunicationContextType {
  // Current state
  selectedField: FieldSelection | null;
  lastMessage: PanelMessage | null;

  // Field selection
  selectField: (fieldId: string, section: string, panel: 'left' | 'center' | 'right') => void;
  clearFieldSelection: () => void;

  // Messaging
  sendMessage: (message: Omit<PanelMessage, 'timestamp'>) => void;
  subscribeToMessages: (listener: MessageListener) => () => void;

  // Convenience methods
  notifyFieldUpdate: (fieldId: string, value: unknown, panel: 'left' | 'center' | 'right') => void;
  notifyPanelFocus: (panel: 'left' | 'center' | 'right') => void;
  notifyPanelBlur: (panel: 'left' | 'center' | 'right') => void;
  scrollToField: (fieldId: string, targetPanel: 'left' | 'center' | 'right') => void;
}

const PanelCommunicationContext = createContext<PanelCommunicationContextType | undefined>(undefined);

export const PanelCommunicationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedField, setSelectedField] = useState<FieldSelection | null>(null);
  const [lastMessage, setLastMessage] = useState<PanelMessage | null>(null);
  const [listeners, setListeners] = useState<Set<MessageListener>>(new Set());

  /**
   * Select a field and notify all panels
   */
  const selectField = useCallback((fieldId: string, section: string, panel: 'left' | 'center' | 'right'): void => {
    const selection: FieldSelection = {
      fieldId,
      section,
      panel,
      timestamp: Date.now(),
    };

    setSelectedField(selection);

    // Broadcast field selection message
    sendMessage({
      type: 'field_selected',
      sourcePanel: panel,
      targetPanel: 'all',
      payload: {
        fieldId,
        section,
      },
    });
  }, []);

  /**
   * Clear current field selection
   */
  const clearFieldSelection = useCallback((): void => {
    setSelectedField(null);
  }, []);

  /**
   * Send a message to other panels
   */
  const sendMessage = useCallback((message: Omit<PanelMessage, 'timestamp'>): void => {
    const fullMessage: PanelMessage = {
      ...message,
      timestamp: Date.now(),
    };

    setLastMessage(fullMessage);

    // Notify all listeners
    listeners.forEach(listener => {
      try {
        listener(fullMessage);
      } catch (error) {
        console.error('Error in message listener:', error);
      }
    });
  }, [listeners]);

  /**
   * Subscribe to messages
   * Returns unsubscribe function
   */
  const subscribeToMessages = useCallback((listener: MessageListener): (() => void) => {
    setListeners(prev => {
      const next = new Set(prev);
      next.add(listener);
      return next;
    });

    // Return unsubscribe function
    return () => {
      setListeners(prev => {
        const next = new Set(prev);
        next.delete(listener);
        return next;
      });
    };
  }, []);

  /**
   * Notify that a field was updated
   */
  const notifyFieldUpdate = useCallback((
    fieldId: string,
    value: unknown,
    panel: 'left' | 'center' | 'right'
  ): void => {
    sendMessage({
      type: 'field_updated',
      sourcePanel: panel,
      targetPanel: 'all',
      payload: {
        fieldId,
        fieldValue: value,
      },
    });
  }, [sendMessage]);

  /**
   * Notify that a panel received focus
   */
  const notifyPanelFocus = useCallback((panel: 'left' | 'center' | 'right'): void => {
    sendMessage({
      type: 'panel_focus',
      sourcePanel: panel,
      targetPanel: 'all',
    });
  }, [sendMessage]);

  /**
   * Notify that a panel lost focus
   */
  const notifyPanelBlur = useCallback((panel: 'left' | 'center' | 'right'): void => {
    sendMessage({
      type: 'panel_blur',
      sourcePanel: panel,
      targetPanel: 'all',
    });
  }, [sendMessage]);

  /**
   * Request a panel to scroll to a specific field
   */
  const scrollToField = useCallback((fieldId: string, targetPanel: 'left' | 'center' | 'right'): void => {
    sendMessage({
      type: 'scroll_to_field',
      sourcePanel: 'center',
      targetPanel,
      payload: {
        fieldId,
      },
    });
  }, [sendMessage]);

  const value: PanelCommunicationContextType = {
    selectedField,
    lastMessage,
    selectField,
    clearFieldSelection,
    sendMessage,
    subscribeToMessages,
    notifyFieldUpdate,
    notifyPanelFocus,
    notifyPanelBlur,
    scrollToField,
  };

  return (
    <PanelCommunicationContext.Provider value={value}>
      {children}
    </PanelCommunicationContext.Provider>
  );
};

/**
 * Custom hook to access panel communication
 * Must be used within PanelCommunicationProvider
 */
export const usePanelCommunication = (): PanelCommunicationContextType => {
  const context = useContext(PanelCommunicationContext);
  if (context === undefined) {
    throw new Error('usePanelCommunication must be used within a PanelCommunicationProvider');
  }
  return context;
};

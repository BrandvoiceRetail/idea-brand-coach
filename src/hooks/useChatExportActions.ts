/**
 * useChatExportActions Hook
 *
 * Extracted from BrandCoachV2.tsx — encapsulates chat export actions:
 * download conversation, copy to clipboard, clear chat history.
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface DisplayMessage {
  role: string;
  content: string;
}

interface UseChatExportActionsConfig {
  /** Displayed messages (system messages already filtered) */
  displayMessages: DisplayMessage[];
  /** Clear chat mutation from useChat */
  clearChat: () => void;
}

interface UseChatExportActionsReturn {
  /** Whether the copy-to-clipboard icon should show a checkmark */
  isCopied: boolean;
  /** Download conversation as a .txt file */
  downloadResponse: () => void;
  /** Copy conversation text to clipboard */
  handleCopyChat: () => void;
  /** Clear conversation history */
  handleClearChat: () => Promise<void>;
}

export function useChatExportActions(config: UseChatExportActionsConfig): UseChatExportActionsReturn {
  const { displayMessages, clearChat } = config;
  const { toast } = useToast();
  const [isCopied, setIsCopied] = useState(false);

  const formatMessages = useCallback((): string => {
    return displayMessages
      .map(m => `${m.role === 'user' ? 'You' : 'Trevor'}: ${m.content}`)
      .join('\n\n');
  }, [displayMessages]);

  const downloadResponse = useCallback((): void => {
    const allMessages = formatMessages();
    const blob = new Blob([allMessages], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brand-coach-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [formatMessages]);

  const handleCopyChat = useCallback((): void => {
    const allMessages = formatMessages();

    navigator.clipboard.writeText(allMessages).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast({
        title: 'Copied to clipboard',
        description: 'The conversation has been copied to your clipboard',
      });
    }).catch(() => {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    });
  }, [formatMessages, toast]);

  const handleClearChat = useCallback(async (): Promise<void> => {
    try {
      await clearChat();
      toast({
        title: 'Conversation Cleared',
        description: 'Your conversation history has been cleared',
      });
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  }, [clearChat, toast]);

  return {
    isCopied,
    downloadResponse,
    handleCopyChat,
    handleClearChat,
  };
}

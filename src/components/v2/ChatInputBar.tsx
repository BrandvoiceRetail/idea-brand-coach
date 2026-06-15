/**
 * ChatInputBar Component
 *
 * Chat input area with message textarea, document upload toggle, and send button.
 * Includes a document context indicator above the input row.
 *
 * Mobile: safe-area padding for bottom bar, keyboard-aware positioning.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Paperclip } from 'lucide-react';
import { useDeviceType } from '@/hooks/useDeviceType';
import { GhostTextChatInput } from '@/components/v2/GhostTextChatInput';
import { cn } from '@/lib/utils';

interface ChatInputBarProps {
  onSendMessage: (content: string) => Promise<void>;
  isStreaming: boolean;
  isSending: boolean;
  showUploadPanel: boolean;
  onToggleUpload: () => void;
  placeholder?: string;
  userDocumentCount: number;
  ghostSuggestion?: string | null;
}

export function ChatInputBar({
  onSendMessage,
  isStreaming,
  isSending,
  showUploadPanel,
  onToggleUpload,
  placeholder = 'Type your message...',
  userDocumentCount,
  ghostSuggestion = null,
}: ChatInputBarProps): JSX.Element {
  const { isMobile, isTouchDevice } = useDeviceType();
  const [message, setMessage] = useState('');

  const handleSend = async (): Promise<void> => {
    if (!message.trim() || isSending) return;
    const content = message;
    setMessage('');
    await onSendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn('flex-shrink-0 border-t p-4', isMobile && 'pb-safe')}>
      {/* Document context indicator */}
      {userDocumentCount > 0 && !showUploadPanel && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Paperclip className="h-3 w-3" />
          <span>{userDocumentCount} document(s) will be included for context</span>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <GhostTextChatInput
          value={message}
          onChange={setMessage}
          onKeyDown={handleKeyDown}
          suggestion={ghostSuggestion}
          onAcceptSuggestion={(accepted) => setMessage(accepted)}
          placeholder={placeholder}
          className={cn(
            isMobile ? 'min-h-[44px] text-base' : 'min-h-[60px]'
          )}
          disabled={isSending}
        />

        {/* Action icons grouped next to send */}
        <div className="flex gap-1 lg:gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleUpload}
            className={cn(
              'relative',
              isTouchDevice ? 'h-11 w-11' : 'h-10 w-10 lg:h-[60px] lg:w-[60px]'
            )}
            title={showUploadPanel ? 'Hide document upload' : 'Upload documents'}
          >
            <Paperclip className={cn(
              'h-4 w-4 lg:h-5 lg:w-5',
              userDocumentCount > 0 && 'text-primary'
            )} />
            {userDocumentCount > 0 && (
              <Badge
                variant="secondary"
                className="absolute -top-1 -right-1 h-4 w-4 lg:h-5 lg:w-5 p-0 flex items-center justify-center text-[10px]"
              >
                {userDocumentCount}
              </Badge>
            )}
          </Button>
          <Button
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            size="icon"
            className={isTouchDevice ? 'h-11 w-11' : 'h-10 w-10 lg:h-[60px] lg:w-[60px]'}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 lg:h-5 lg:w-5 animate-spin" />
            ) : (
              <Send className="h-4 w-4 lg:h-5 lg:w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

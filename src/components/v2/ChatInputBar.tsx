/**
 * ChatInputBar Component
 *
 * Chat input area with message textarea, document upload toggle, tools menu, and send button.
 * Includes document context indicator and review data indicator above the input row.
 *
 * Mobile: safe-area padding for bottom bar, keyboard-aware positioning.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Paperclip, Search } from 'lucide-react';
import { useDeviceType } from '@/hooks/useDeviceType';
import { ChatToolsMenu } from '@/components/v2/ChatToolsMenu';
import { cn } from '@/lib/utils';

interface ChatInputBarProps {
  onSendMessage: (content: string) => Promise<void>;
  isStreaming: boolean;
  isSending: boolean;
  showUploadPanel: boolean;
  onToggleUpload: () => void;
  placeholder?: string;
  userDocumentCount: number;
  reviewContextActive: boolean;
  reviewEnrichmentStatus: 'none' | 'pending' | 'complete';
  reviewCount: number;
  onClearReviewContext: () => void;
  onSendReviewContext: (contextString: string) => void;
  onEnrichmentComplete: (contextString: string, totalReviews: number) => void;
}

export function ChatInputBar({
  onSendMessage,
  isStreaming,
  isSending,
  showUploadPanel,
  onToggleUpload,
  placeholder = 'Type your message...',
  userDocumentCount,
  reviewContextActive,
  reviewEnrichmentStatus,
  reviewCount,
  onClearReviewContext,
  onSendReviewContext,
  onEnrichmentComplete,
}: ChatInputBarProps): JSX.Element {
  const { isMobile } = useDeviceType();
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

      {/* Review context indicator */}
      {reviewContextActive && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground italic">
          <Search className="h-3 w-3" />
          <span>
            Review data shared with Trevor
            {reviewEnrichmentStatus === 'pending' && (
              <> &middot; <Loader2 className="inline h-3 w-3 animate-spin" /> Enriching...</>
            )}
            {reviewEnrichmentStatus === 'complete' && (
              <> &middot; {reviewCount} reviews analyzed</>
            )}
          </span>
          <button
            type="button"
            onClick={onClearReviewContext}
            className="ml-auto text-xs underline hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'resize-none flex-1',
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
              isMobile ? 'h-11 w-11' : 'h-10 w-10 lg:h-[60px] lg:w-[60px]'
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
          <ChatToolsMenu
            onSendReviewContext={onSendReviewContext}
            onEnrichmentComplete={onEnrichmentComplete}
            triggerClassName={isMobile ? 'h-11 w-11' : 'h-10 w-10 lg:h-[60px] lg:w-[60px]'}
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            size="icon"
            className={isMobile ? 'h-11 w-11' : 'h-10 w-10 lg:h-[60px] lg:w-[60px]'}
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

/**
 * ChatMessageList Component
 *
 * Renders the scrollable list of chat messages between the user and Trevor.
 * Handles:
 * - Empty state with welcome message
 * - User and assistant message bubbles
 * - Extracted field badges on assistant messages
 * - Streaming response display
 * - Loading indicator for sends and document extraction
 *
 * Mobile: larger touch targets for field accept/reject (min 44px), readable font sizes.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useDeviceType } from '@/hooks/useDeviceType';
import { FieldExtractionBadges } from '@/components/v2/FieldExtractionBadges';
import type { ExtractedField } from '@/components/v2/FieldExtractionBadges';
import { CHAPTER_FIELDS_MAP } from '@/config/chapterFields';
import { cn } from '@/lib/utils';
import type { ChapterId } from '@/types/chapter';
import type { ChatMessage } from '@/types/chat';

/**
 * Display message extends ChatMessage with optional extracted fields overlay.
 */
interface DisplayMessage extends ChatMessage {
  extractedFields?: Record<string, string>;
}

/**
 * Metadata about which fields were extracted from each message.
 */
interface MessageExtractionRecord {
  allAccepted: boolean;
}

interface ChatMessageListProps {
  messages: DisplayMessage[];
  isStreaming: boolean;
  streamingContent: string | null;
  isSending: boolean;
  isExtractingFromDoc: boolean;
  messageExtractions: Record<string, MessageExtractionRecord>;
  fieldValues: Record<string, string | string[]>;
  isFieldLocked: (fieldId: string) => boolean;
  onFieldClick: (field: ExtractedField) => void;
  onAcceptAllFromMessage: (extractedFields: Record<string, string>) => void;
  onFieldAccept: (fieldId: string, value: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export function ChatMessageList({
  messages,
  isStreaming,
  streamingContent,
  isSending,
  isExtractingFromDoc,
  messageExtractions,
  fieldValues,
  isFieldLocked,
  onFieldClick,
  onAcceptAllFromMessage,
  onFieldAccept,
  messagesEndRef,
}: ChatMessageListProps): JSX.Element {
  const { isMobile } = useDeviceType();

  return (
    <div
      ref={messagesEndRef}
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Welcome to Brand Coach</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            I'm Trevor, your IDEA Framework coach. Let's build your brand together,
            chapter by chapter. Tell me about your brand to get started!
          </p>
        </div>
      ) : (
        messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <Card
              className={cn(
                'max-w-[80%]',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted',
                msg.id.startsWith('pending-') && 'opacity-80'
              )}
            >
              <CardContent className={cn('p-3', isMobile && 'text-base')}>
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>

                {/* Extracted field badges */}
                {msg.extractedFields && Object.keys(msg.extractedFields).length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border/30">
                    <FieldExtractionBadges
                      fields={Object.entries(msg.extractedFields).map(([fieldId, value]): ExtractedField => {
                        let fieldLabel = fieldId;
                        let chapterTitle: string | undefined;
                        let ideaRelevance: string | undefined;
                        for (const chapter of Object.values(CHAPTER_FIELDS_MAP)) {
                          const field = chapter.fields?.find((f: { id: string }) => f.id === fieldId);
                          if (field) {
                            fieldLabel = field.label;
                            chapterTitle = chapter.title;
                            ideaRelevance = field.ideaRelevance;
                            break;
                          }
                        }

                        const msgMeta = messageExtractions[msg.id];
                        const isAccepted = msgMeta?.allAccepted || fieldValues[fieldId] !== undefined;
                        const locked = isFieldLocked(fieldId);

                        return {
                          fieldId,
                          label: fieldLabel,
                          value: value as string,
                          chapterTitle,
                          ideaRelevance,
                          isReviewed: isAccepted,
                          isLocked: locked,
                          confidence: 0.95,
                        };
                      })}
                      onFieldClick={onFieldClick}
                      onAcceptAll={() => {
                        if (msg.extractedFields) {
                          onAcceptAllFromMessage(msg.extractedFields);
                        }
                      }}
                      className={isMobile ? 'min-h-[44px]' : undefined}
                    />
                  </div>
                )}

                <div className="text-xs opacity-70 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </div>
              </CardContent>
            </Card>
          </div>
        ))
      )}

      {/* Streaming response */}
      {isStreaming && streamingContent && (
        <div className="flex justify-start">
          <Card className="bg-muted max-w-[85%]">
            <CardContent className="p-3">
              <div className="text-sm whitespace-pre-wrap">{streamingContent}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading indicator (non-streaming sends or document extraction) */}
      {((isSending && !isStreaming && !streamingContent) || isExtractingFromDoc) && (
        <div className="flex justify-start">
          <Card className="bg-muted">
            <CardContent className="p-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isExtractingFromDoc && (
                <span className="text-xs text-muted-foreground">
                  Analyzing document and extracting fields...
                </span>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

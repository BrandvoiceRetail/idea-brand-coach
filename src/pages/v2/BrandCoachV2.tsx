import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { MessageSquare, Loader2, Download, Trash2, Copy, Check, Menu, Send, Paperclip } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useChat } from '@/hooks/useChat';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useChapterProgress } from '@/hooks/useChapterProgress';
import { useFieldExtractionV2 } from '@/hooks/useFieldExtractionV2';
import { useAuth } from '@/hooks/useAuth';
import { useSystemKB } from '@/contexts/SystemKBContext';
import { useDiagnostic } from '@/hooks/useDiagnostic';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { DocumentUpload } from '@/components/DocumentUpload';
import { TwoPanelTemplate } from '@/components/templates/TwoPanelTemplate';
import { ChapterSectionAccordion } from '@/components/v2/ChapterSectionAccordion';
import { AvatarHeaderDropdown } from '@/components/v2/AvatarHeaderDropdown';
import type { AvatarData } from '@/components/v2/AvatarHeaderDropdown';
import { CHAPTER_FIELDS_MAP } from '@/config/chapterFields';
import type { ChapterId, ChapterContext } from '@/types/chapter';
import type { ChatMessage } from '@/types/chat';
import { cn } from '@/lib/utils';

/**
 * ChapterProgressBadge - Inline component showing "Chapter X of 11"
 */
function ChapterProgressBadge({ current, total }: { current: number; total: number }): JSX.Element {
  return (
    <Badge variant="outline" className="text-xs">
      Chapter {current} of {total}
    </Badge>
  );
}

/**
 * BrandCoachV2 Page
 *
 * Chat-first UX with Trevor as the Brand Coach:
 * - RIGHT panel: Chat interface (primary)
 * - LEFT panel: Chapter accordion showing coach-managed fields
 * - Header: Avatar dropdown + chapter progress
 * - Field extraction: AI responses auto-populate left panel fields
 * - Chapter advancement: "Proceed to Next Section" button advances both panels
 */
const BrandCoachV2 = (): JSX.Element => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { latestDiagnostic } = useDiagnostic();
  const { useSystemKB: isSystemKBEnabled } = useSystemKB();

  // Avatar state (placeholder - will be replaced with proper avatar management)
  const [currentAvatarId, setCurrentAvatarId] = useState<string | null>('default-avatar');
  const [avatars] = useState<AvatarData[]>([
    { id: 'default-avatar', name: 'My Brand', image_url: null },
  ]);
  const currentAvatar = avatars.find(a => a.id === currentAvatarId) ?? null;

  // Session management
  const {
    sessions,
    currentSessionId,
    isLoadingSessions,
    isCreating,
    isRegeneratingTitle,
    createNewChat,
    renameSession,
    deleteSession,
    regenerateTitle,
    switchToSession,
  } = useChatSessions({ chatbotType: 'idea-framework-consultant' });

  // Chapter progress
  const {
    progress,
    currentChapter,
    allChapters,
    isLoading: isLoadingChapter,
    completeCurrentChapter,
    navigateToChapter,
    initializeProgress,
    isInitializing,
  } = useChapterProgress({ sessionId: currentSessionId });

  // Field extraction
  const {
    extractFields,
    fieldValues,
    fieldSources,
    setFieldManual,
    extractedCount,
    clearFields,
  } = useFieldExtractionV2(currentAvatarId);

  // Chat for current session
  const { messages, sendMessage, isSending, clearChat } = useChat({
    chatbotType: 'idea-framework-consultant',
    sessionId: currentSessionId,
  });

  // UI state
  const [message, setMessage] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);

  // User documents state (uploaded documents from DocumentUpload component)
  const [userDocuments, setUserDocuments] = useState<any[]>([]);

  // Field focus tracking for conversational guidance
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);
  const [fieldInteractionCounts, setFieldInteractionCounts] = useState<Record<string, number>>({});

  // Chat container ref for auto-scrolling
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Process messages to extract fields from AI responses
  const processedMessages = useMemo(() => {
    return messages.map((msg) => {
      if (msg.role !== 'assistant') return msg;

      // Only process if message contains extraction delimiter
      if (msg.content.includes('---FIELD_EXTRACTION_JSON---')) {
        const cleanContent = extractFields(msg.content);
        return { ...msg, content: cleanContent };
      }

      return msg;
    });
  }, [messages, extractFields]);

  // Filter system messages from display
  const displayMessages = useMemo(() => {
    return processedMessages.filter((msg) => !msg.metadata?.isSystemMessage);
  }, [processedMessages]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // Initialize chapter progress if needed
  useEffect(() => {
    if (!isLoadingChapter && !progress && currentSessionId && !isInitializing) {
      initializeProgress();
    }
  }, [isLoadingChapter, progress, currentSessionId, isInitializing, initializeProgress]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [displayMessages]);

  // Clear fields when avatar changes
  const prevAvatarId = useRef(currentAvatarId);
  useEffect(() => {
    if (prevAvatarId.current !== currentAvatarId && currentAvatarId !== null) {
      clearFields();
      prevAvatarId.current = currentAvatarId;
    }
  }, [currentAvatarId, clearFields]);

  // Auto-close sidebar on session selection
  const handleSessionSelect = (sessionId: string): void => {
    switchToSession(sessionId);
    setIsSidebarOpen(false);
  };

  /**
   * Send message with chapter context metadata
   */
  const handleSendMessage = async (): Promise<void> => {
    if (!message.trim()) return;

    // Build context with ALL fields from ALL chapters for comprehensive extraction
    // This allows the AI to update any field based on the conversation or documents
    const allFieldsToCapture: string[] = [];
    const allFieldLabels: Record<string, string> = {};

    // Collect all fields from all chapters
    Object.values(CHAPTER_FIELDS_MAP).forEach(chapter => {
      if (chapter.fields) {
        chapter.fields.forEach(field => {
          allFieldsToCapture.push(field.id);
          allFieldLabels[field.id] = field.label;
        });
      }
    });

    // Get focused field details if one is selected
    let currentFieldDetails = null;
    if (focusedFieldId) {
      // Find the field in the chapter fields map
      for (const chapter of Object.values(CHAPTER_FIELDS_MAP)) {
        const field = chapter.fields?.find(f => f.id === focusedFieldId);
        if (field) {
          currentFieldDetails = {
            id: field.id,
            label: field.label,
            type: field.type,
            helpText: field.helpText,
          };
          break;
        }
      }

      // Track interaction count for this field
      setFieldInteractionCounts(prev => ({
        ...prev,
        [focusedFieldId]: (prev[focusedFieldId] || 0) + 1,
      }));
    }

    // Always provide all fields for extraction, but include focused field context
    const chapterContext: ChapterContext = {
      chapterId: 'all-chapters',
      chapterTitle: 'All Chapters',
      chapterNumber: 0,
      fieldsToCapture: allFieldsToCapture,
      fieldLabels: allFieldLabels,
      focusedField: focusedFieldId,
      currentFieldDetails,
      // Enable conversational mode by default
      comprehensiveMode: false,
    };

    try {
      await sendMessage({
        content: message,
        role: 'user',
        metadata: {
          userDocuments, // Include uploaded documents
          useSystemKB: isSystemKBEnabled,
          latestDiagnostic: latestDiagnostic || undefined,
          chapterContext,
        },
      });
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  /**
   * Handle chapter advancement ("Proceed to Next Section" button)
   */
  const handleProceed = async (chapterId: ChapterId): Promise<void> => {
    try {
      // 1. First validate that all required fields are filled
      const currentChapterFields = CHAPTER_FIELDS_MAP[chapterId] ?? [];
      const emptyFields = currentChapterFields.filter(field => {
        const value = fieldValues[field.id];
        return !value || value.trim() === '';
      });

      if (emptyFields.length > 0) {
        // Show helpful guidance instead of generic error
        toast({
          title: 'Complete Required Fields',
          description: 'Please chat with Trevor to complete all fields before marking this chapter complete. The AI coach will help you develop meaningful responses for each field.',
          variant: 'default',
        });
        return;
      }

      // 2. Mark chapter complete and advance to next
      await completeCurrentChapter();

      // 3. Get next chapter
      const currentIndex = allChapters.findIndex(ch => ch.id === chapterId);
      const nextChapter = allChapters[currentIndex + 1];

      if (!nextChapter) {
        // Last chapter completed
        await sendMessage({
          content: '[SYSTEM] User has completed all chapters. Please congratulate them and summarize their brand journey.',
          role: 'user',
          metadata: { isSystemMessage: true },
        });
        return;
      }

      // 3. Send Trevor a system message acknowledging chapter completion
      await sendMessage({
        content: `[SYSTEM] User has marked Chapter ${currentIndex + 1}: ${allChapters[currentIndex].title} as complete. Great progress on their brand journey!`,
        role: 'user',
        metadata: {
          isSystemMessage: true,
        },
      });
    } catch (error) {
      console.error('Error advancing chapter:', error);
      toast({
        title: 'Error',
        description: 'Failed to advance to next chapter',
        variant: 'destructive',
      });
    }
  };

  /**
   * Download conversation as text file
   */
  const downloadResponse = (): void => {
    const allMessages = displayMessages
      .map(m => `${m.role === 'user' ? 'You' : 'Trevor'}: ${m.content}`)
      .join('\n\n');

    const blob = new Blob([allMessages], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brand-coach-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Copy conversation to clipboard
   */
  const handleCopyChat = (): void => {
    const allMessages = displayMessages
      .map(m => `${m.role === 'user' ? 'You' : 'Trevor'}: ${m.content}`)
      .join('\n\n');

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
  };

  /**
   * Clear chat history
   */
  const handleClearChat = async (): Promise<void> => {
    try {
      await clearChat();
      toast({
        title: 'Conversation Cleared',
        description: 'Your conversation history has been cleared',
      });
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  /**
   * Avatar dropdown handlers
   */
  const handleAvatarSelect = (avatarId: string): void => {
    setCurrentAvatarId(avatarId);
  };

  const handleCreateAvatar = (): void => {
    toast({
      title: 'Coming Soon',
      description: 'Avatar creation will be available in a future update',
    });
  };

  // Loading state
  if (isLoadingChapter || isLoadingSessions) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex-shrink-0 border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold">IDEA Brand Coach</h1>
          <ChapterProgressBadge
            current={progress?.current_chapter_number ?? 1}
            total={11}
          />
        </div>
        <AvatarHeaderDropdown
          currentAvatar={currentAvatar}
          avatars={avatars}
          onAvatarSelect={handleAvatarSelect}
          onCreateAvatar={handleCreateAvatar}
        />
      </header>

      {/* Two-panel body */}
      <TwoPanelTemplate
        leftPanel={
          <div className="h-full overflow-y-auto p-4">
            <ChapterSectionAccordion
              chapters={(() => {
                const mappedChapters = allChapters?.map((bookChapter, index) => {
                // Map book chapter numbers to CHAPTER_FIELDS_MAP keys
                const chapterFieldsMap: Record<number, string> = {
                  1: 'BRAND_FOUNDATION',
                  2: 'BRAND_VALUES',
                  3: 'CUSTOMER_AVATAR',
                  4: 'MARKET_INSIGHT',
                  5: 'BUYER_INTENT',
                  6: 'POSITIONING',
                  7: 'BRAND_PERSONALITY',
                  8: 'EMOTIONAL_CONNECTION',
                  9: 'CUSTOMER_EXPERIENCE',
                  10: 'BRAND_AUTHORITY',
                  11: 'BRAND_AUTHENTICITY'
                };

                // Get the chapter with fields from CHAPTER_FIELDS_MAP
                const chapterKey = chapterFieldsMap[bookChapter.number];
                const chapterWithFields = chapterKey ? CHAPTER_FIELDS_MAP[chapterKey] : undefined;

                // Merge book chapter data with fields
                const mergedChapter = chapterWithFields ? {
                  ...bookChapter,
                  ...chapterWithFields,
                  id: bookChapter.id, // Keep the book chapter ID for consistency
                  fields: chapterWithFields.fields || []
                } : {
                  ...bookChapter,
                  fields: [], // Fallback empty fields if no match
                  pillar: bookChapter.category
                };

                // Determine chapter status - all chapters are now accessible
                let chapterStatus: 'completed' | 'active' | 'future';
                if (progress?.chapter_statuses?.[bookChapter.id]) {
                  const progressStatus = progress.chapter_statuses[bookChapter.id];
                  if (progressStatus === 'completed') {
                    chapterStatus = 'completed';
                  } else {
                    // All non-completed chapters are active (accessible)
                    chapterStatus = 'active';
                  }
                } else {
                  // Default: all chapters are active
                  chapterStatus = 'active';
                }

                return {
                  chapter: mergedChapter,
                  status: chapterStatus,
                  fieldValues: fieldValues,
                  fieldSources: fieldSources,
                };
              }) || [];

                return mappedChapters;
              })()}
              activeChapterId={progress?.current_chapter_id ?? 'chapter-01-introduction'}
              onProceed={handleProceed}
              onFieldChange={(chapterId, fieldId, value) => {
                // setFieldManual expects just fieldId and value, not chapterId
                setFieldManual(fieldId, value);
              }}
              onFieldFocus={(fieldId) => {
                // Track which field the user is focusing on for conversational guidance
                setFocusedFieldId(fieldId);
              }}
            />
          </div>
        }
        rightPanel={
          <div className="flex flex-col h-full">
            {/* Chat Header with Actions */}
            <div className="flex-shrink-0 border-b px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80 p-0">
                    <SheetHeader className="px-4 py-3 border-b">
                      <SheetTitle>Conversations</SheetTitle>
                    </SheetHeader>
                    <ChatSidebar
                      sessions={sessions || []}
                      currentSessionId={currentSessionId}
                      onSelectSession={handleSessionSelect}
                      onCreateNew={createNewChat}
                      onRenameSession={renameSession}
                      onDeleteSession={deleteSession}
                      onRegenerateTitle={regenerateTitle}
                      isLoading={isLoadingSessions}
                      isCreating={isCreating}
                      isRegeneratingTitle={isRegeneratingTitle}
                    />
                  </SheetContent>
                </Sheet>
                <span className="font-medium">Trevor</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyChat}
                  disabled={displayMessages.length === 0}
                  title="Copy conversation"
                >
                  {isCopied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={downloadResponse}
                  disabled={displayMessages.length === 0}
                  title="Download conversation"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearChat}
                  disabled={displayMessages.length === 0}
                  title="Clear conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {displayMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Welcome to Brand Coach</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    I'm Trevor, your IDEA Framework coach. Let's build your brand together,
                    chapter by chapter. Tell me about your brand to get started!
                  </p>
                </div>
              ) : (
                displayMessages.map((msg) => (
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
                          : 'bg-muted'
                      )}
                    >
                      <CardContent className="p-3">
                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))
              )}

              {isSending && (
                <div className="flex justify-start">
                  <Card className="bg-muted">
                    <CardContent className="p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Document Upload Panel (collapsible) */}
            {showDocumentUpload && (
              <div className="flex-shrink-0 border-t bg-muted/30">
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Upload Documents</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDocumentUpload(false)}
                    >
                      Close
                    </Button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    <DocumentUpload onDocumentsChange={setUserDocuments} />
                  </div>
                </div>
              </div>
            )}

            {/* Chat Input */}
            <div className="flex-shrink-0 border-t p-4">
              {/* Document context indicator */}
              {userDocuments.length > 0 && !showDocumentUpload && (
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Paperclip className="h-3 w-3" />
                  <span>{userDocuments.length} document(s) will be included for context</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDocumentUpload(!showDocumentUpload)}
                  className="h-[60px] w-[60px]"
                  title={showDocumentUpload ? "Hide document upload" : "Upload documents"}
                >
                  <Paperclip className={cn(
                    "h-5 w-5",
                    userDocuments.length > 0 && "text-primary"
                  )} />
                  {userDocuments.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center"
                    >
                      {userDocuments.length}
                    </Badge>
                  )}
                </Button>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  className="min-h-[60px] resize-none"
                  disabled={isSending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isSending}
                  size="icon"
                  className="h-[60px] w-[60px]"
                >
                  {isSending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        }
        rightPanelTitle="Brand Coach — Trevor"
      />
    </div>
  );
};

export { BrandCoachV2 };

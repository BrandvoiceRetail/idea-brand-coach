import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Loader2, Download, Trash2, Copy, Check, Menu, BookOpen, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useChat } from '@/hooks/useChat';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useChapterProgress } from '@/hooks/useChapterProgress';
import { useFieldExtraction } from '@/hooks/useFieldExtraction';
import { useAuth } from '@/hooks/useAuth';
import { useSystemKB } from '@/contexts/SystemKBContext';
import { useDiagnostic } from '@/hooks/useDiagnostic';
import { useAvatarService } from '@/hooks/useAvatarService';
import { useDefaultAvatar } from '@/hooks/useDefaultAvatar';
import { useAvatarFieldSync } from '@/hooks/useAvatarFieldSync';
import { useSimpleFieldSync } from '@/hooks/useSimpleFieldSync';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseBrandService } from '@/services/SupabaseBrandService';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { DocumentUpload } from '@/components/DocumentUpload';
import { TwoPanelTemplate } from '@/components/templates/TwoPanelTemplate';
import { ChapterSectionAccordion } from '@/components/v2/ChapterSectionAccordion';
import type { ChapterAccordionHandle } from '@/components/v2/ChapterSectionAccordion';
import { useDeviceType } from '@/hooks/useDeviceType';
import type { AvatarData } from '@/components/v2/AvatarHeaderDropdown';
import type { ExtractedField } from '@/components/v2/FieldExtractionBadges';
import { CHAPTER_FIELDS_MAP, BOOK_CHAPTER_NUMBER_TO_FIELDS_KEY } from '@/config/chapterFields';
import { useFieldReview } from '@/contexts/FieldReviewContext';
import { useServices } from '@/services/ServiceProvider';
import type { UploadedDocument } from '@/types/document';

// Extracted hooks
import { useBrandCoachChat } from '@/hooks/useBrandCoachChat';
import { useChatExportActions } from '@/hooks/useChatExportActions';
import { useDocumentUploadFlow } from '@/hooks/useDocumentUploadFlow';
import { useFieldExtractionOrchestrator } from '@/hooks/useFieldExtractionOrchestrator';
import { useChapterProceeding } from '@/hooks/useChapterProceeding';

// Extracted components
import { BrandCoachHeader } from '@/components/v2/BrandCoachHeader';
import { ChatMessageList } from '@/components/v2/ChatMessageList';
import { ChatInputBar } from '@/components/v2/ChatInputBar';

/**
 * BrandCoachV2 Page — Thin Orchestrator
 *
 * Chat-first UX with Trevor as the Brand Coach.
 * Wires together extracted hooks and components.
 */
const BrandCoachV2 = (): JSX.Element => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, loading: isLoadingAuth } = useAuth();
  const { chatService } = useServices();
  const { isMobile } = useDeviceType();
  const { latestDiagnostic } = useDiagnostic();
  const { useSystemKB: isSystemKBEnabled } = useSystemKB();

  // ── Review context state ──────────────────────────────────────────────
  const [reviewContextActive, setReviewContextActive] = useState(false);
  const [reviewEnrichmentStatus, setReviewEnrichmentStatus] = useState<'none' | 'pending' | 'complete'>('none');
  const [reviewCount, setReviewCount] = useState(0);

  const handleSendReviewContext = (contextString: string): void => {
    chatService.setCompetitiveInsightsContext(contextString);
    setReviewContextActive(true);
    setReviewEnrichmentStatus('pending');
    toast({ title: 'Review data shared with Trevor', description: 'Competitor analysis context is now available in chat.' });
  };

  const handleEnrichmentComplete = (contextString: string, totalReviews: number): void => {
    chatService.setCompetitiveInsightsContext(contextString);
    setReviewEnrichmentStatus('complete');
    setReviewCount(totalReviews);
  };

  // ── Avatar management ─────────────────────────────────────────────────
  const { avatars, currentAvatar, isLoading: isLoadingAvatars, createAvatar, selectAvatarById } = useAvatarService();

  const avatarData: AvatarData[] = avatars.map(a => ({ id: a.id, name: a.name, image_url: a.image_url }));

  // ── Session management ────────────────────────────────────────────────
  const {
    sessions, currentSessionId, isLoadingSessions, isCreating, isRegeneratingTitle,
    createNewChat, renameSession, deleteSession, regenerateTitle, switchToSession,
  } = useChatSessions({ chatbotType: 'idea-framework-consultant', avatarId: currentAvatar?.id });

  // ── Chapter progress ──────────────────────────────────────────────────
  const {
    progress, currentChapter, allChapters, isLoading: isLoadingChapter,
    completeCurrentChapter, initializeProgress, isInitializing,
  } = useChapterProgress({ sessionId: currentSessionId });

  // ── Field extraction ──────────────────────────────────────────────────
  const {
    fieldValues, fieldSources, setFieldManual, setFieldLock,
    clearFields, isFieldLocked,
  } = useFieldExtraction(currentAvatar?.id || null);

  // ── Field review context ──────────────────────────────────────────────
  const {
    enqueueFields, setMessageExtraction, registerFieldAcceptHandler,
    pendingCount, acceptAllFields, messageExtractions, setActiveReviewFieldId,
  } = useFieldReview();

  const setFieldManualRef = useRef(setFieldManual);
  setFieldManualRef.current = setFieldManual;

  useEffect(() => {
    registerFieldAcceptHandler((fieldId: string, value: string | string[]) => {
      setFieldManualRef.current(fieldId, value);
    });
  }, [registerFieldAcceptHandler]);

  // ── Field sync ────────────────────────────────────────────────────────
  const { savedFieldCount } = useSimpleFieldSync({
    avatarId: currentAvatar?.id || null,
    fieldValues,
    fieldSources,
    onFieldsLoaded: (loadedFields) => {
      Object.entries(loadedFields).forEach(([fieldId, { value, isLocked }]) => {
        setFieldManual(fieldId, value);
        if (isLocked) setFieldLock(fieldId, true);
      });
    },
  });

  // ── Chat ──────────────────────────────────────────────────────────────
  const { messages, sendMessage, sendMessageStreaming, isSending, isStreaming, streamingContent, clearChat } = useChat({
    chatbotType: 'idea-framework-consultant',
    sessionId: currentSessionId,
  });

  // ── UI state ──────────────────────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [mobileAccordionOpen, setMobileAccordionOpen] = useState(false);
  const [userDocuments, setUserDocuments] = useState<UploadedDocument[]>([]);
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const accordionRef = useRef<ChapterAccordionHandle>(null);

  // ── Extracted hooks ───────────────────────────────────────────────────
  const { messagesWithPending, displayMessages, handleSendMessage } = useBrandCoachChat({
    messages,
    currentChapter,
    fieldValues,
    focusedFieldId,
    userDocuments,
    isSystemKBEnabled,
    latestDiagnostic,
    sendMessageStreaming,
  });

  const { isCopied, downloadResponse, handleCopyChat, handleClearChat } = useChatExportActions({
    displayMessages,
    clearChat,
  });

  const { isExtractingFromDoc, handleDocumentUploadComplete } = useDocumentUploadFlow({
    sendMessage,
    userDocuments,
    isSystemKBEnabled,
    latestDiagnostic,
  });

  const { recentlyUpdatedChapterIds, fieldToBookChapterId } = useFieldExtractionOrchestrator({
    messages,
    allChapters,
    fieldValues,
    fieldSources,
    setFieldManual,
    setMessageExtraction,
    enqueueFields,
  });

  const { handleProceed } = useChapterProceeding({
    allChapters,
    fieldValues,
    completeCurrentChapter,
    sendMessage,
  });

  // ── Side effects ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoadingAuth && !user) navigate('/auth');
  }, [isLoadingAuth, user, navigate]);

  useEffect(() => {
    if (!isLoadingChapter && !progress && currentSessionId && !isInitializing) initializeProgress();
  }, [isLoadingChapter, progress, currentSessionId, isInitializing, initializeProgress]);

  useDefaultAvatar({ user, avatars, isLoadingAvatars, createAvatar });

  useEffect(() => {
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [messagesWithPending, streamingContent]);

  useAvatarFieldSync({ currentAvatarId: currentAvatar?.id, clearFields });

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleSessionSelect = (sessionId: string): void => {
    switchToSession(sessionId);
    setIsSidebarOpen(false);
  };

  const handleAvatarSelect = (avatarId: string): void => selectAvatarById(avatarId);

  const handleCreateAvatar = async (): Promise<void> => {
    try {
      const brandService = new SupabaseBrandService(supabase);
      const { data: brand, error: brandError } = await brandService.getOrCreateDefaultBrand();
      if (brandError || !brand) {
        toast({ title: 'Error', description: 'Failed to create avatar: Could not get brand', variant: 'destructive' });
        return;
      }
      const newAvatar = await createAvatar({
        name: `Avatar ${avatars.length + 1}`,
        brand_id: brand.id,
        demographics: {},
        psychographics: {},
        behavioral_traits: {},
        status: 'active',
      });
      if (newAvatar) {
        selectAvatarById(newAvatar.id);
        toast({ title: 'Avatar Created', description: 'Your new avatar has been created' });
      }
    } catch (error) {
      console.error('Error creating avatar:', error);
      toast({ title: 'Error', description: 'Failed to create avatar', variant: 'destructive' });
    }
  };

  const handleFieldClick = (field: ExtractedField): void => {
    setActiveReviewFieldId(field.fieldId);
    const bookChapterId = fieldToBookChapterId[field.fieldId];
    if (bookChapterId) {
      if (isMobile) {
        setMobileAccordionOpen(true);
        setTimeout(() => accordionRef.current?.focusChapter(bookChapterId), 300);
      } else {
        accordionRef.current?.focusChapter(bookChapterId);
      }
    }
  };

  // ── Precomputed data ──────────────────────────────────────────────────
  const chapterAccordionData = useMemo(() =>
    allChapters?.map(bookChapter => {
      const key = BOOK_CHAPTER_NUMBER_TO_FIELDS_KEY[bookChapter.number];
      const chapterWithFields = key ? CHAPTER_FIELDS_MAP[key] : undefined;
      const mergedChapter = chapterWithFields
        ? { ...bookChapter, ...chapterWithFields, id: bookChapter.id, fields: chapterWithFields.fields || [] }
        : { ...bookChapter, fields: [], pillar: bookChapter.category };

      const chapterStatus: 'completed' | 'active' | 'future' =
        progress?.chapter_statuses?.[bookChapter.id] === 'completed' ? 'completed' : 'active';

      return { chapter: mergedChapter, status: chapterStatus, fieldValues, fieldSources };
    }) ?? [],
  [allChapters, progress, fieldValues, fieldSources]);

  // ── Loading gate ──────────────────────────────────────────────────────
  if (isLoadingAuth || isLoadingChapter || isLoadingSessions || isLoadingAvatars) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen">
      <BrandCoachHeader
        currentChapter={currentChapter}
        chapterProgress={progress}
        onProceed={() => {}}
        canProceed={false}
        avatarContext={{
          currentAvatar: currentAvatar ? { id: currentAvatar.id, name: currentAvatar.name, image_url: currentAvatar.image_url } : null,
          avatars: avatarData,
        }}
        onAvatarChange={(avatar) => handleAvatarSelect(avatar.id)}
        savedFieldCount={savedFieldCount}
        fieldValues={fieldValues}
        onCreateAvatar={handleCreateAvatar}
      />

      <TwoPanelTemplate
        mobileSheetOpen={mobileAccordionOpen}
        onMobileSheetOpenChange={setMobileAccordionOpen}
        mobileSheetTitle="Brand Chapters"
        leftPanel={
          <div className="h-full overflow-y-auto p-4">
            <ChapterSectionAccordion
              ref={accordionRef}
              chapters={chapterAccordionData}
              activeChapterId={progress?.current_chapter_id ?? 'chapter-01-introduction'}
              recentlyUpdatedChapterIds={recentlyUpdatedChapterIds}
              onProceed={handleProceed}
              onFieldChange={(_chapterId, fieldId, value) => setFieldManual(fieldId, value)}
              onFieldFocus={setFocusedFieldId}
            />
          </div>
        }
        rightPanel={
          <div className="flex flex-col h-full">
            {/* Chat sub-header with sidebar + actions */}
            <div className="flex-shrink-0 border-b px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80 p-0">
                    <SheetHeader className="px-4 py-3 border-b"><SheetTitle>Conversations</SheetTitle></SheetHeader>
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
                {isMobile && (
                  <Button variant="ghost" size="sm" onClick={() => setMobileAccordionOpen(true)} className="lg:hidden ml-2">
                    <BookOpen className="h-4 w-4 mr-1" />Chapters
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {pendingCount > 0 && (
                  <Button variant="outline" size="sm" className="text-xs text-amber-600 border-amber-500/30 hover:bg-amber-500/10" onClick={acceptAllFields} title={`Accept all ${pendingCount} pending field(s)`}>
                    <CheckCircle className="h-3 w-3 mr-1" />{pendingCount} pending
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={handleCopyChat} disabled={displayMessages.length === 0} title="Copy conversation">
                  {isCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={downloadResponse} disabled={displayMessages.length === 0} title="Download conversation">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleClearChat} disabled={displayMessages.length === 0} title="Clear conversation">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ChatMessageList
              messages={messagesWithPending}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              isSending={isSending}
              isExtractingFromDoc={isExtractingFromDoc}
              messageExtractions={messageExtractions}
              fieldValues={fieldValues}
              isFieldLocked={isFieldLocked}
              onFieldClick={handleFieldClick}
              onAcceptAllFromMessage={(fields) => {
                Object.entries(fields).forEach(([fieldId, value]) => setFieldManual(fieldId, value));
              }}
              onFieldAccept={(fieldId, value) => setFieldManual(fieldId, value)}
              messagesEndRef={chatContainerRef}
            />

            {showDocumentUpload && (
              <div className="flex-shrink-0 border-t bg-muted/30">
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Upload Documents</span>
                    <Button variant="ghost" size="sm" onClick={() => setShowDocumentUpload(false)}>Close</Button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    <DocumentUpload onDocumentsChange={setUserDocuments} onUploadComplete={handleDocumentUploadComplete} />
                  </div>
                </div>
              </div>
            )}

            <ChatInputBar
              onSendMessage={handleSendMessage}
              isStreaming={isStreaming}
              isSending={isSending}
              showUploadPanel={showDocumentUpload}
              onToggleUpload={() => setShowDocumentUpload(!showDocumentUpload)}
              userDocumentCount={userDocuments.length}
              reviewContextActive={reviewContextActive}
              reviewEnrichmentStatus={reviewEnrichmentStatus}
              reviewCount={reviewCount}
              onClearReviewContext={() => {
                chatService.setCompetitiveInsightsContext(null);
                setReviewContextActive(false);
                setReviewEnrichmentStatus('none');
                setReviewCount(0);
              }}
              onSendReviewContext={handleSendReviewContext}
              onEnrichmentComplete={handleEnrichmentComplete}
            />
          </div>
        }
        rightPanelTitle="Brand Coach — Trevor"
      />
    </div>
  );
};

export default BrandCoachV2;

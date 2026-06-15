import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Loader2, Download, Trash2, Copy, Check, Menu, BookOpen, CheckCircle, Target, ArrowRight } from 'lucide-react';
import { parseGapParam, gapOpenerPrompt } from '@/lib/journeyBridge';
import { TRUST_GAP_DIMENSION_META } from '@/lib/trustGap';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { DocumentUpload } from '@/components/DocumentUpload';
import { TwoPanelTemplate } from '@/components/templates/TwoPanelTemplate';
import { ChapterSectionAccordion } from '@/components/v2/ChapterSectionAccordion';
import { BrandCoachHeader } from '@/components/v2/BrandCoachHeader';
import { ExportReadinessModal } from '@/components/v2/ExportReadinessModal';
import { ChatMessageList } from '@/components/v2/ChatMessageList';
import { ChatInputBar } from '@/components/v2/ChatInputBar';
import { SignatureReveal } from '@/components/v2/signature/SignatureReveal';
import { MilestoneOverlay } from '@/components/v2/MilestoneOverlay';
import { BatchReviewOrchestrator } from '@/components/v2/BatchReviewOrchestrator';
import { useBrandCoachV2State } from '@/hooks/v2/useBrandCoachV2State';
import { useServices } from '@/services/ServiceProvider';
import { SavedSignature } from '@/services/interfaces/ISignatureService';

/**
 * BrandCoachV2 Page — Thin Orchestrator
 *
 * Chat-first UX with Trevor as the Brand Coach.
 * All state, hooks, and actions are composed in useBrandCoachV2State.
 * This component focuses purely on rendering and composition.
 */
const BrandCoachV2 = (): JSX.Element => {
  const { signatureService } = useServices();
  // The user's saved Signature pick — shown outside the reveal dialog so the
  // recognition moment survives reloads (persistence is the Alpha bar).
  const [savedSignature, setSavedSignature] = React.useState<SavedSignature | null>(null);
  React.useEffect(() => {
    signatureService
      .getLatestSignature()
      .then(setSavedSignature)
      .catch((error) => console.warn('[BrandCoachV2] Failed to load saved Signature:', error));
  }, [signatureService]);

  const {
    // State
    isLoading,
    isMobile,
    currentAvatar,
    avatarData,
    sessions,
    currentSessionId,
    isLoadingSessions,
    isCreating,
    isRegeneratingTitle,
    progress,
    currentChapter,
    fieldValues,
    savedFieldCount,
    pendingCount,
    messageExtractions,
    messagesWithPending,
    displayMessages,
    isSending,
    isStreaming,
    streamingContent,
    memoryActivity,
    isExtractingFromDoc,
    isCopied,
    chapterAccordionData,
    recentlyUpdatedChapterIds,
    isSidebarOpen,
    setIsSidebarOpen,
    showDocumentUpload,
    setShowDocumentUpload,
    mobileAccordionOpen,
    setMobileAccordionOpen,
    userDocuments,
    setUserDocuments,
    focusedFieldId,
    setFocusedFieldId,
    chatContainerRef,
    accordionRef,
    isFieldLocked,
    activeMilestone,
    prefersReducedMotion,
    isMilestoneComplete,
    exportReadiness,
    isExportReadinessOpen,
    setIsExportReadinessOpen,
    exportRef,
    ghostSuggestion,
    extractionQueue,
    extractionQueueIndex,
    isReviewOpen,
    alwaysAccept,
    preloadedReviews,
    preloadedReviewCount,

    // Actions
    handleSessionSelect,
    createNewChat,
    renameSession,
    deleteSession,
    regenerateTitle,
    handleAvatarSelect,
    handleCreateAvatar,
    handleSendMessage,
    handleCopyChat,
    handleClearChat,
    downloadResponse,
    setFieldManual,
    handleReviewAccept,
    handleReviewReject,
    handleReviewAcceptAll,
    handleReviewClose,
    toggleAlwaysAccept,
    handleFieldAcceptFromBadge,
    handleAcceptAllFromBadge,
    handleDocumentUploadComplete,
    handleFieldClick,
    handleReopenReview,
    dismissMilestone,
  } = useBrandCoachV2State();

  // ── Journey bridge entry (F-059) ───────────────────────────────────────
  // When arriving from the Trust Gap™ bridge (`?gap=`), open the conversation on
  // the user's weakest pillar with a one-click opener. Shown only before the
  // conversation has started, so it never disturbs an in-progress chat.
  const [searchParams] = useSearchParams();
  const gap = parseGapParam(searchParams.get('gap'));
  // Gate the opener on an empty conversation AND a ready session, so it never
  // disturbs an in-progress chat and never fires handleSendMessage before the
  // session exists.
  const showGapOpener = !!gap && !!currentSessionId && displayMessages.length === 0;
  const gapLabel = gap ? TRUST_GAP_DIMENSION_META[gap].label : null;

  // ── Loading gate ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen">
      <MilestoneOverlay
        activeMilestone={activeMilestone}
        prefersReducedMotion={prefersReducedMotion}
        onComplete={dismissMilestone}
      />
      <BrandCoachHeader
        currentChapter={currentChapter}
        chapterProgress={progress}
        avatarContext={{
          currentAvatar: currentAvatar ? { id: currentAvatar.id, name: currentAvatar.name, image_url: currentAvatar.image_url } : null,
          avatars: avatarData,
        }}
        onAvatarChange={(avatar) => handleAvatarSelect(avatar.id)}
        savedFieldCount={savedFieldCount}
        fieldValues={fieldValues}
        onCreateAvatar={handleCreateAvatar}
        activeMilestone={activeMilestone}
        isMilestoneComplete={isMilestoneComplete}
        onBeforeExport={() => setIsExportReadinessOpen(true)}
        exportRef={exportRef}
      />

      <ExportReadinessModal
        isOpen={isExportReadinessOpen}
        onClose={() => setIsExportReadinessOpen(false)}
        onExportAnyway={() => exportRef.current?.startExport()}
        onQuickWinClick={(fieldId) => handleFieldClick({ fieldId })}
        readiness={exportReadiness}
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
                <SignatureReveal
                  messages={displayMessages}
                  fieldValues={fieldValues}
                  preloadedReviews={preloadedReviews}
                  preloadedReviewCount={preloadedReviewCount}
                  sessionId={currentSessionId ?? null}
                  onSignatureSaved={setSavedSignature}
                />
                {pendingCount > 0 && (
                  <Button variant="outline" size="sm" className="text-xs text-amber-600 border-amber-500/30 hover:bg-amber-500/10" onClick={handleReviewAcceptAll} title={`Accept all ${pendingCount} pending field(s)`}>
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

            {savedSignature && (
              <div
                className="px-4 py-1.5 text-xs italic text-amber-700 bg-amber-500/10 border-b border-amber-500/20 truncate"
                title={savedSignature.signatureText}
                data-testid="saved-signature-strip"
              >
                Your Signature: {savedSignature.signatureText}
              </div>
            )}

            {/* Batch review controls (visible when extraction queue has items) */}
            <BatchReviewOrchestrator
              queue={extractionQueue}
              currentIndex={extractionQueueIndex}
              isOpen={isReviewOpen}
              onAccept={handleReviewAccept}
              onReject={handleReviewReject}
              onAcceptAll={handleReviewAcceptAll}
              onClose={handleReviewClose}
              alwaysAccept={alwaysAccept}
              onToggleAlwaysAccept={toggleAlwaysAccept}
            />

            {showGapOpener && gap && (
              <div
                role="region"
                aria-label={`Trust Gap quick start: ${gapLabel}`}
                className="flex-shrink-0 border-b bg-primary/5 px-4 py-3"
              >
                <div className="flex items-center gap-2 text-primary mb-1">
                  <Target className="h-4 w-4" />
                  <span className="text-sm font-semibold">Your biggest Trust Gap: {gapLabel}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Let's build the Signature that closes your {gapLabel} gap. Start the conversation here.
                </p>
                <Button size="sm" onClick={() => handleSendMessage(gapOpenerPrompt(gap))} disabled={isSending || isStreaming}>
                  Work on my {gapLabel} gap
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            <ChatMessageList
              messages={messagesWithPending}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              memoryActivity={memoryActivity}
              isSending={isSending}
              isExtractingFromDoc={isExtractingFromDoc}
              messageExtractions={messageExtractions}
              fieldValues={fieldValues}
              isFieldLocked={isFieldLocked}
              onFieldClick={handleFieldClick}
              onAcceptAllFromMessage={handleAcceptAllFromBadge}
              onFieldAccept={handleFieldAcceptFromBadge}
              onReopenReview={handleReopenReview}
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
              ghostSuggestion={ghostSuggestion}
              showUploadPanel={showDocumentUpload}
              onToggleUpload={() => setShowDocumentUpload(!showDocumentUpload)}
              userDocumentCount={userDocuments.length}
            />
          </div>
        }
      />

    </div>
  );
};

export { BrandCoachV2 };
export default BrandCoachV2;

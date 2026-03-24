import React from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Loader2, Download, Trash2, Copy, Check, Menu, BookOpen, CheckCircle } from 'lucide-react';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { DocumentUpload } from '@/components/DocumentUpload';
import { TwoPanelTemplate } from '@/components/templates/TwoPanelTemplate';
import { ChapterSectionAccordion } from '@/components/v2/ChapterSectionAccordion';
import { BrandCoachHeader } from '@/components/v2/BrandCoachHeader';
import { ChatMessageList } from '@/components/v2/ChatMessageList';
import { ChatInputBar } from '@/components/v2/ChatInputBar';
import { useBrandCoachV2State } from '@/hooks/v2/useBrandCoachV2State';

/**
 * BrandCoachV2 Page — Thin Orchestrator
 *
 * Chat-first UX with Trevor as the Brand Coach.
 * All state, hooks, and actions are composed in useBrandCoachV2State.
 * This component focuses purely on rendering and composition.
 */
const BrandCoachV2 = (): JSX.Element => {
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
    reviewContextActive,
    reviewEnrichmentStatus,
    reviewCount,
    isFieldLocked,

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
    acceptAllFields,
    handleProceed,
    handleDocumentUploadComplete,
    handleSendReviewContext,
    handleEnrichmentComplete,
    handleClearReviewContext,
    handleFieldClick,
  } = useBrandCoachV2State();

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
              onClearReviewContext={handleClearReviewContext}
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

export { BrandCoachV2 };
export default BrandCoachV2;

/**
 * useBrandCoachV2State Hook
 *
 * Consolidates all state-providing hooks used by BrandCoachV2 into a single
 * composed hook that returns a structured state object. This keeps the page
 * component focused purely on rendering and composition.
 *
 * This is a pure structural refactor — no behavior changes.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useChapterProgress } from '@/hooks/useChapterProgress';
import { useFieldExtraction } from '@/hooks/useFieldExtraction';
import { useAvatarService } from '@/hooks/useAvatarService';
import { useDefaultAvatar } from '@/hooks/useDefaultAvatar';
import { useAvatarFieldSync } from '@/hooks/useAvatarFieldSync';
import { useSimpleFieldSync } from '@/hooks/useSimpleFieldSync';
import { useSystemKB } from '@/contexts/SystemKBContext';
import { useDiagnostic } from '@/hooks/useDiagnostic';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useFieldReviewPipeline } from '@/hooks/v2/useFieldReviewPipeline';
import type { PendingField as QueuePendingField } from '@/hooks/v2/useExtractionQueue';
import { useRejectionMessages } from '@/hooks/v2/useRejectionMessages';
import { useMilestone } from '@/hooks/v2/useMilestone';
import { useExportReadiness } from '@/hooks/v2/useExportReadiness';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseBrandService } from '@/services/SupabaseBrandService';
import { useServices } from '@/services/ServiceProvider';
import { useBrandCoachChat } from '@/hooks/useBrandCoachChat';
import { useChatExportActions } from '@/hooks/useChatExportActions';
import { useDocumentUploadFlow } from '@/hooks/useDocumentUploadFlow';
import { useFieldExtractionOrchestrator } from '@/hooks/useFieldExtractionOrchestrator';
import { useGhostSuggestion } from '@/hooks/v2/useGhostSuggestion';
import { CHAPTER_FIELDS_MAP, BOOK_CHAPTER_NUMBER_TO_FIELDS_KEY } from '@/config/chapterFields';
import type { AvatarData } from '@/components/v2/AvatarHeaderDropdown';
import type { ChapterAccordionHandle } from '@/components/v2/ChapterSectionAccordion';
import type { UploadedDocument } from '@/types/document';
import type { ProcessedMessage } from '@/hooks/useBrandCoachChat';
import type { FieldSource } from '@/hooks/useFieldExtraction';
import type { MessageExtractionMeta } from '@/contexts/FieldReviewContext';
import type { ChatSession } from '@/types/chat';
import type { ChapterProgress, Chapter, ChapterId } from '@/types/chapter';
import type { Avatar } from '@/hooks/useAvatarService';
import type { MilestoneData } from '@/hooks/v2/useMilestone';
import type { ExportReadiness } from '@/hooks/v2/useExportReadiness';
import type { BrandMarkdownExportRef } from '@/components/export/BrandMarkdownExport';

// ============================================================================
// Types
// ============================================================================

interface ChapterAccordionItem {
  chapter: {
    id: string;
    number: number;
    title: string;
    category: string;
    description: string;
    fields: Array<{ id: string; label: string; type: string; helpText?: string }>;
    pillar?: string;
  };
  status: 'completed' | 'active' | 'future';
  fieldValues: Record<string, string | string[]>;
  fieldSources: Record<string, FieldSource>;
  pendingValues?: Record<string, string | string[]>;
}

export interface BrandCoachV2State {
  /** Whether all data is still loading */
  isLoading: boolean;

  /** Navigation */
  navigate: ReturnType<typeof useNavigate>;

  /** Device type */
  isMobile: boolean;

  /** Avatar data */
  currentAvatar: Avatar | null;
  avatarData: AvatarData[];
  avatars: Avatar[];

  /** Session data */
  sessions: ChatSession[];
  currentSessionId: string | undefined;
  isLoadingSessions: boolean;
  isCreating: boolean;
  isRegeneratingTitle: boolean;

  /** Chapter progress */
  progress: ChapterProgress | null;
  currentChapter: Chapter | null;
  allChapters: Chapter[];

  /** Field extraction */
  fieldValues: Record<string, string | string[]>;
  fieldSources: Record<string, FieldSource>;
  savedFieldCount: number;

  /** Field review context */
  pendingCount: number;
  messageExtractions: Record<string, MessageExtractionMeta>;

  /** Chat */
  messagesWithPending: ProcessedMessage[];
  displayMessages: ProcessedMessage[];
  isSending: boolean;
  isStreaming: boolean;
  streamingContent: string;
  isExtractingFromDoc: boolean;

  /** Export actions */
  isCopied: boolean;

  /** Chapter accordion precomputed data */
  chapterAccordionData: ChapterAccordionItem[];

  /** Field extraction orchestrator */
  recentlyUpdatedChapterIds: string[];
  fieldToBookChapterId: Record<string, string>;

  /** UI state */
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  showDocumentUpload: boolean;
  setShowDocumentUpload: (show: boolean) => void;
  mobileAccordionOpen: boolean;
  setMobileAccordionOpen: (open: boolean) => void;
  userDocuments: UploadedDocument[];
  setUserDocuments: (docs: UploadedDocument[]) => void;
  focusedFieldId: string | null;
  setFocusedFieldId: (id: string | null) => void;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  accordionRef: React.RefObject<ChapterAccordionHandle>;

  /** Review context state */
  reviewContextActive: boolean;
  reviewEnrichmentStatus: 'none' | 'pending' | 'complete';
  reviewCount: number;

  /** Field locked check */
  isFieldLocked: (fieldId: string) => boolean;

  /** Milestone celebrations */
  activeMilestone: MilestoneData | null;
  prefersReducedMotion: boolean;
  isMilestoneComplete: boolean;

  /** Export readiness */
  exportReadiness: ExportReadiness;
  isExportReadinessOpen: boolean;
  setIsExportReadinessOpen: (open: boolean) => void;
  exportRef: React.RefObject<BrandMarkdownExportRef | null>;

  /** Ghost text suggestion for chat input */
  ghostSuggestion: string | null;

  /** Extraction review queue */
  extractionQueue: QueuePendingField[];
  extractionQueueIndex: number;
  isReviewOpen: boolean;
  alwaysAccept: boolean;
}

export interface BrandCoachV2Actions {
  /** Session actions */
  handleSessionSelect: (sessionId: string) => void;
  createNewChat: () => void;
  renameSession: (sessionId: string, title: string) => void;
  deleteSession: (sessionId: string) => void;
  regenerateTitle: (sessionId: string) => void;

  /** Avatar actions */
  handleAvatarSelect: (avatarId: string) => void;
  handleCreateAvatar: () => Promise<void>;

  /** Chat actions */
  handleSendMessage: (content: string) => Promise<void>;
  handleCopyChat: () => void;
  handleClearChat: () => Promise<void>;
  downloadResponse: () => void;

  /** Field actions */
  setFieldManual: (fieldId: string, value: string | string[]) => void;

  /** Review modal actions */
  handleReviewAccept: (fieldId: string, value: string | string[]) => void;
  handleReviewReject: (fieldId: string) => void;
  handleReviewAcceptAll: () => void;
  handleReviewClose: () => void;
  toggleAlwaysAccept: () => void;

  /** Badge accept actions (with scroll-open-flash) */
  handleFieldAcceptFromBadge: (fieldId: string, value: string | string[]) => void;
  handleAcceptAllFromBadge: (fields: Record<string, string | string[]>) => void;

  /** Rejection-to-chat actions */
  handleRejectField: (fieldId: string) => void;
  flushRejections: () => void;

  /** Milestone dismiss */
  dismissMilestone: () => void;

  /** Document upload */
  handleDocumentUploadComplete: (doc: { id: string; filename: string }) => Promise<void>;

  /** Review context actions */
  handleSendReviewContext: (contextString: string) => void;
  handleEnrichmentComplete: (contextString: string, totalReviews: number) => void;
  handleClearReviewContext: () => void;

  /** Field click handler */
  handleFieldClick: (field: { fieldId: string }) => void;

  /** Reopen review for a message's extracted fields */
  handleReopenReview: (extractedFields: Record<string, string | string[]>) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useBrandCoachV2State(): BrandCoachV2State & BrandCoachV2Actions {
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

  const handleClearReviewContext = (): void => {
    chatService.setCompetitiveInsightsContext(null);
    setReviewContextActive(false);
    setReviewEnrichmentStatus('none');
    setReviewCount(0);
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
    initializeProgress, isInitializing,
  } = useChapterProgress({ sessionId: currentSessionId });

  // ── Field extraction ──────────────────────────────────────────────────
  const {
    fieldValues, fieldSources, setFieldManual, setFieldLock,
    clearFields, isFieldLocked,
  } = useFieldExtraction(currentAvatar?.id || null);

  // ── Field review pipeline (queue + flash + handlers) ───────────────────

  // ── Field sync ────────────────────────────────────────────────────────
  const { savedFieldCount } = useSimpleFieldSync({
    avatarId: currentAvatar?.id || null,
    fieldValues,
    fieldSources,
    onFieldsLoaded: (loadedFields) => {
      Object.entries(loadedFields).forEach(([fieldId, { value, isLocked }]) => {
        setFieldManual(fieldId, value);
        if (isLocked) setFieldLock(fieldId, true, true);
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

  const {
    reviewQueue, reviewQueueIndex, isReviewOpen, pendingCount,
    alwaysAccept, toggleAlwaysAccept,
    messageExtractions, setMessageExtraction,
    enqueueFieldsForReview,
    handleReviewAccept, handleReviewReject, handleReviewAcceptAll, handleReviewClose,
    handleFieldAcceptFromBadge, handleAcceptAllFromBadge, handleFieldClick, handleReopenReview,
  } = useFieldReviewPipeline({ accordionRef, setFieldManual, isMobile, setMobileAccordionOpen });

  // ── Rejection-to-chat messages ───────────────────────────────────────
  const {
    rejectionMessages, trackRejection, flushRejections, clearRejectionMessages,
  } = useRejectionMessages();

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
    injectedMessages: rejectionMessages,
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
    setMessageExtraction,
    enqueueFields: enqueueFieldsForReview,
  });

  // ── Pending values map (fieldId -> pending extracted value) ───────────
  const pendingValuesMap = useMemo<Record<string, string | string[]>>(
    () => Object.fromEntries(reviewQueue.map(f => [f.fieldId, f.value])),
    [reviewQueue]
  );

  // ── Milestone celebrations ────────────────────────────────────────────
  const {
    activeMilestone, dismissMilestone, prefersReducedMotion,
    isComplete: isMilestoneComplete,
  } = useMilestone(savedFieldCount, currentAvatar?.id ?? null);

  // ── Export readiness ──────────────────────────────────────────────────
  const exportReadiness = useExportReadiness({ fieldValues });
  const [isExportReadinessOpen, setIsExportReadinessOpen] = useState(false);
  const exportRef = useRef<BrandMarkdownExportRef | null>(null);

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

  // Clear rejection messages when session changes
  useEffect(() => {
    clearRejectionMessages();
  }, [currentSessionId, clearRejectionMessages]);

  // ── Rejection-to-chat handler ──────────────────────────────────────────
  const handleRejectField = useCallback((fieldId: string): void => {
    const pending = reviewQueue.find((f) => f.fieldId === fieldId);
    const fieldLabel = pending?.label ?? fieldId;
    trackRejection(fieldId, fieldLabel);
    handleReviewReject(fieldId);
  }, [reviewQueue, trackRejection, handleReviewReject]);

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

  // ── Precomputed data ──────────────────────────────────────────────────
  const chapterAccordionData = useMemo(() =>
    allChapters?.map(bookChapter => {
      const key = BOOK_CHAPTER_NUMBER_TO_FIELDS_KEY[bookChapter.number];
      const chapterWithFields = key ? CHAPTER_FIELDS_MAP[key] : undefined;
      const mergedChapter = chapterWithFields
        ? { ...bookChapter, ...chapterWithFields, id: bookChapter.id, fields: chapterWithFields.fields || [] }
        : { ...bookChapter, fields: [], pillar: bookChapter.category };

      // All chapters are always active/editable — no completed state
      const chapterStatus = 'active' as const;

      return { chapter: mergedChapter, status: chapterStatus, fieldValues, fieldSources, pendingValues: pendingValuesMap };
    }) ?? [],
  [allChapters, progress, fieldValues, fieldSources, pendingValuesMap]);

  // ── Ghost text suggestion ─────────────────────────────────────────────
  const ghostSuggestion = useGhostSuggestion(currentChapter?.id ?? null, fieldValues);

  // ── Loading gate ──────────────────────────────────────────────────────
  const isLoading = isLoadingAuth || isLoadingChapter || isLoadingSessions || isLoadingAvatars;

  return {
    // State
    isLoading,
    navigate,
    isMobile,
    currentAvatar,
    avatarData,
    avatars,
    sessions,
    currentSessionId,
    isLoadingSessions,
    isCreating,
    isRegeneratingTitle,
    progress,
    currentChapter,
    allChapters,
    fieldValues,
    fieldSources,
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
    fieldToBookChapterId,
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
    activeMilestone,
    prefersReducedMotion,
    isMilestoneComplete,
    exportReadiness,
    isExportReadinessOpen,
    setIsExportReadinessOpen,
    exportRef,
    ghostSuggestion,
    extractionQueue: reviewQueue,
    extractionQueueIndex: reviewQueueIndex,
    isReviewOpen,
    alwaysAccept,

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
    handleSendReviewContext,
    handleEnrichmentComplete,
    handleClearReviewContext,
    handleFieldClick,
    handleReopenReview,
    handleRejectField,
    flushRejections,
    dismissMilestone,
  };
}

/**
 * useBrandCoachUI Hook
 *
 * Owns all UI-local state: sidebar toggles, refs, focused field,
 * user documents, device type, and cross-panel navigation (field click).
 */

import { useState, useRef, useCallback } from 'react';
import { useDeviceType } from '@/hooks/useDeviceType';
import type { ChapterAccordionHandle } from '@/components/v2/ChapterSectionAccordion';
import type { UploadedDocument } from '@/types/document';

// ============================================================================
// Types
// ============================================================================

export interface UseBrandCoachUIConfig {
  /** Reverse lookup: fieldId -> book chapter ID (from field orchestration) */
  fieldToBookChapterId: Record<string, string>;
  /** Callback to set the active review field in FieldReviewContext */
  setActiveReviewFieldId: (fieldId: string | null) => void;
}

export interface UseBrandCoachUIReturn {
  /** Device type */
  isMobile: boolean;

  /** UI toggles */
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  showDocumentUpload: boolean;
  setShowDocumentUpload: (show: boolean) => void;
  mobileAccordionOpen: boolean;
  setMobileAccordionOpen: (open: boolean) => void;

  /** User documents */
  userDocuments: UploadedDocument[];
  setUserDocuments: (docs: UploadedDocument[]) => void;

  /** Focused field */
  focusedFieldId: string | null;
  setFocusedFieldId: (id: string | null) => void;

  /** Refs */
  chatContainerRef: React.RefObject<HTMLDivElement>;
  accordionRef: React.RefObject<ChapterAccordionHandle>;

  /** Cross-panel field click handler */
  handleFieldClick: (field: { fieldId: string }) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useBrandCoachUI({
  fieldToBookChapterId,
  setActiveReviewFieldId,
}: UseBrandCoachUIConfig): UseBrandCoachUIReturn {
  const { isMobile } = useDeviceType();

  // ── UI toggles ───────────────────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [mobileAccordionOpen, setMobileAccordionOpen] = useState(false);
  const [userDocuments, setUserDocuments] = useState<UploadedDocument[]>([]);
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const accordionRef = useRef<ChapterAccordionHandle>(null);

  // ── Cross-panel field click ───────────────────────────────────────────
  const handleFieldClick = useCallback((field: { fieldId: string }): void => {
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
  }, [fieldToBookChapterId, isMobile, setActiveReviewFieldId]);

  return {
    isMobile,
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
    handleFieldClick,
  };
}

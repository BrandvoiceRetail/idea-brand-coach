/**
 * useDocumentUploadFlow Hook
 *
 * Extracted from BrandCoachV2.tsx — encapsulates the document upload completion
 * handler that triggers bulk field extraction via the chat service.
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { collectCurrentFields } from '@/hooks/useBrandCoachChat';
import type { ChapterContext } from '@/types/chapter';
import type { ChatMessageCreate } from '@/types/chat';

interface UseDocumentUploadFlowConfig {
  /** Non-streaming sendMessage from useChat (used for system messages) */
  sendMessage: (message: ChatMessageCreate) => Promise<unknown>;
  /** User's uploaded documents */
  userDocuments: unknown[];
  /** Whether system KB is enabled */
  isSystemKBEnabled: boolean;
  /** Latest diagnostic data */
  latestDiagnostic: unknown | null;
}

interface UseDocumentUploadFlowReturn {
  /** Whether a document extraction is in progress */
  isExtractingFromDoc: boolean;
  /** Handler to call when a document upload completes */
  handleDocumentUploadComplete: (document: { id: string; filename: string }) => Promise<void>;
}

export function useDocumentUploadFlow(config: UseDocumentUploadFlowConfig): UseDocumentUploadFlowReturn {
  const { sendMessage, userDocuments, isSystemKBEnabled, latestDiagnostic } = config;
  const { toast } = useToast();
  const [isExtractingFromDoc, setIsExtractingFromDoc] = useState(false);

  const handleDocumentUploadComplete = useCallback(async (
    document: { id: string; filename: string },
  ): Promise<void> => {
    const { allFieldsToCapture, allFieldLabels } = collectCurrentFields();

    const chapterContext: ChapterContext = {
      chapterId: 'all-chapters',
      chapterTitle: 'All Chapters',
      chapterNumber: 0,
      fieldsToCapture: allFieldsToCapture,
      fieldLabels: allFieldLabels,
      comprehensiveMode: true,
    };

    setIsExtractingFromDoc(true);

    try {
      await sendMessage({
        content: `[SYSTEM] User uploaded document "${document.filename}". Analyze the document content and extract as many brand profile fields as possible. Be thorough and proactive — fill in every field you can infer from the document.`,
        role: 'user',
        chapterContext,
        metadata: {
          isSystemMessage: true,
          triggerBulkExtraction: true,
          documentId: document.id,
          documentFilename: document.filename,
          userDocuments,
          useSystemKB: isSystemKBEnabled,
          latestDiagnostic: latestDiagnostic || undefined,
        },
      });

      toast({
        title: 'Document Sent',
        description: `"${document.filename}" is being analyzed by Trevor`,
      });
    } catch (error) {
      console.error('Error triggering bulk extraction:', error);
      toast({
        title: 'Extraction Error',
        description: 'Failed to analyze document for field extraction',
        variant: 'destructive',
      });
    } finally {
      setIsExtractingFromDoc(false);
    }
  }, [sendMessage, userDocuments, isSystemKBEnabled, latestDiagnostic, toast]);

  return {
    isExtractingFromDoc,
    handleDocumentUploadComplete,
  };
}

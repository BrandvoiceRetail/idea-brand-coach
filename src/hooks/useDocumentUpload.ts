/**
 * useDocumentUpload Hook
 *
 * Encapsulates all document upload state and handlers.
 * Uses DocumentUploadService for data operations.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { validateFile } from '@/utils/documentValidation';
import { DocumentUploadService } from '@/services/DocumentUploadService';
import type { UploadedDocument } from '@/types/document';

interface UseDocumentUploadOptions {
  onDocumentsChange?: (documents: UploadedDocument[]) => void;
  onUploadComplete?: (document: { id: string; filename: string }) => void;
}

interface UseDocumentUploadReturn {
  documents: UploadedDocument[];
  isUploading: boolean;
  uploadProgress: number;
  dragActive: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteDocument: (documentId: string, filename: string) => Promise<void>;
  handleDeleteAllDocuments: () => Promise<void>;
  loadUserDocuments: () => Promise<void>;
}

const service = new DocumentUploadService();

export function useDocumentUpload(options: UseDocumentUploadOptions = {}): UseDocumentUploadReturn {
  const { onDocumentsChange, onUploadComplete } = options;
  const { toast } = useToast();
  const { user, session } = useAuth();
  const { currentAvatarId } = useBrand();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Track whether any documents are in a processing state via ref
  // to avoid re-triggering the polling effect when documents change.
  const hasProcessingRef = useRef(false);

  const loadUserDocuments = useCallback(async (): Promise<void> => {
    if (!user) return;

    const result = await service.loadUserDocuments(user.id);
    if (result.success) {
      setDocuments(result.documents);
      onDocumentsChange?.(result.documents);

      // Update processing ref
      hasProcessingRef.current = result.documents.some(doc =>
        ['uploading', 'processing', 'indexing'].includes(doc.status) ||
        doc.extraction_status === 'extracting'
      );
    } else {
      console.error('Error loading documents:', result.error);
      toast({
        title: 'Error',
        description: 'Failed to load your documents',
        variant: 'destructive',
      });
    }
  }, [user, onDocumentsChange, toast]);

  // Load documents on mount
  useEffect(() => {
    if (user) {
      loadUserDocuments();
    }
  }, [user, loadUserDocuments]);

  // Poll for status updates while documents are processing.
  // FIX: Uses a ref to track processing state instead of depending on
  // the documents array, which previously caused re-registration every
  // time documents changed.
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      if (hasProcessingRef.current) {
        loadUserDocuments();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [user, loadUserDocuments]);

  const handleDrag = useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files?.[0]) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, session, currentAvatarId]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      if (e.target.files?.[0]) {
        handleFileUpload(e.target.files[0]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, session, currentAvatarId]
  );

  const handleFileUpload = async (file: File): Promise<void> => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to upload documents',
        variant: 'destructive',
      });
      return;
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      toast({
        title: 'Invalid File',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      setUploadProgress(25);

      const result = await service.uploadDocument(
        user.id,
        file,
        currentAvatarId,
        session
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      setUploadProgress(100);

      toast({
        title: 'Upload Successful',
        description: `${file.name} has been uploaded and is being processed`,
      });

      // Notify consumer of the completed upload
      if (result.document) {
        onUploadComplete?.({ id: result.document.id, filename: result.document.filename });
      }

      await loadUserDocuments();

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload document',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDocument = async (documentId: string, filename: string): Promise<void> => {
    const result = await service.deleteDocument(documentId);
    if (result.success) {
      toast({
        title: 'Document Deleted',
        description: `${filename} has been deleted`,
      });
      await loadUserDocuments();
    } else {
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAllDocuments = async (): Promise<void> => {
    if (!user || documents.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete all ${documents.length} documents? This action cannot be undone.`
    );
    if (!confirmed) return;

    const result = await service.deleteAllDocuments(user.id);
    if (result.success) {
      toast({
        title: 'All Documents Deleted',
        description: `Successfully deleted ${documents.length} documents`,
      });
      await loadUserDocuments();
    } else {
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete all documents',
        variant: 'destructive',
      });
    }
  };

  return {
    documents,
    isUploading,
    uploadProgress,
    dragActive,
    fileInputRef,
    handleDrag,
    handleDrop,
    handleFileSelect,
    handleDeleteDocument,
    handleDeleteAllDocuments,
    loadUserDocuments,
  };
}

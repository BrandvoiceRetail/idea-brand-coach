/**
 * IDocumentUploadService Interface
 *
 * Contract for document upload operations including storage, metadata persistence,
 * and vector store integration.
 */

import type { UploadedDocument } from '@/types/document';
import type { Session } from '@supabase/supabase-js';

/** Result of a document upload operation */
export interface DocumentUploadResult {
  success: boolean;
  document?: UploadedDocument;
  error?: string;
}

/** Result of a document deletion operation */
export interface DocumentDeleteResult {
  success: boolean;
  error?: string;
}

/** Result of loading documents */
export interface DocumentLoadResult {
  success: boolean;
  documents: UploadedDocument[];
  error?: string;
}

export interface IDocumentUploadService {
  /**
   * Upload a document: store the file, create metadata record,
   * and trigger vector store indexing.
   *
   * @param userId - The authenticated user's ID
   * @param file - The file to upload
   * @param avatarId - Optional avatar ID to associate the document with
   * @param session - The current auth session (needed for edge function calls)
   * @returns Upload result with the created document record
   */
  uploadDocument(
    userId: string,
    file: File,
    avatarId?: string | null,
    session?: Session | null
  ): Promise<DocumentUploadResult>;

  /**
   * Delete a single document by ID.
   *
   * @param documentId - The document ID to delete
   * @returns Deletion result
   */
  deleteDocument(documentId: string): Promise<DocumentDeleteResult>;

  /**
   * Delete all documents for a user.
   *
   * @param userId - The user whose documents to delete
   * @returns Deletion result
   */
  deleteAllDocuments(userId: string): Promise<DocumentDeleteResult>;

  /**
   * Load all documents for a user.
   *
   * @param userId - The user whose documents to load
   * @returns Load result with documents array
   */
  loadUserDocuments(userId: string): Promise<DocumentLoadResult>;
}

/**
 * DocumentUploadService
 *
 * Handles document upload operations: file storage, metadata persistence,
 * and vector store integration. Returns typed results without side effects
 * (no toast calls) — consumers decide how to present results.
 */

import { supabase } from '@/integrations/supabase/client';
import { generateStoragePath, isValidUuid } from '@/utils/documentValidation';
import type {
  IDocumentUploadService,
  DocumentUploadResult,
  DocumentDeleteResult,
  DocumentLoadResult,
} from '@/services/interfaces/IDocumentUploadService';
import type { UploadedDocument } from '@/types/document';
import type { Session } from '@supabase/supabase-js';

export class DocumentUploadService implements IDocumentUploadService {
  async uploadDocument(
    userId: string,
    file: File,
    avatarId?: string | null,
    session?: Session | null
  ): Promise<DocumentUploadResult> {
    try {
      // Upload file to Supabase Storage
      const uploadData = await this.uploadToStorage(userId, file);
      if (!uploadData) {
        return { success: false, error: 'Failed to upload file to storage' };
      }

      // Save document metadata — only pass avatar_id if it's a valid UUID
      const { data: docData, error: docError } = await supabase
        .from('uploaded_documents')
        .insert({
          user_id: userId,
          avatar_id: isValidUuid(avatarId) ? avatarId : null,
          filename: file.name,
          file_path: uploadData.path,
          file_size: file.size,
          mime_type: file.type,
          status: 'processing',
          extraction_status: 'pending',
        })
        .select()
        .single();

      if (docError) {
        return { success: false, error: docError.message };
      }

      // Trigger vector store indexing via edge function
      if (session?.access_token) {
        const { error: vectorError } = await supabase.functions.invoke(
          'upload-document-to-vector-store',
          {
            body: { documentId: docData.id },
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );

        if (vectorError) {
          console.warn('Vector store upload failed:', vectorError);
          // Non-fatal — document is still saved
        }
      } else {
        console.warn('No auth session available for vector store upload');
      }

      return { success: true, document: docData as UploadedDocument };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload document';
      console.error('Upload error:', error);
      return { success: false, error: message };
    }
  }

  async deleteDocument(documentId: string): Promise<DocumentDeleteResult> {
    try {
      const { error } = await supabase
        .from('uploaded_documents')
        .delete()
        .eq('id', documentId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete document';
      console.error('Delete error:', error);
      return { success: false, error: message };
    }
  }

  async deleteAllDocuments(userId: string): Promise<DocumentDeleteResult> {
    try {
      const { error } = await supabase
        .from('uploaded_documents')
        .delete()
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete all documents';
      console.error('Delete all error:', error);
      return { success: false, error: message };
    }
  }

  async loadUserDocuments(userId: string): Promise<DocumentLoadResult> {
    try {
      const { data, error } = await supabase
        .from('uploaded_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, documents: [], error: error.message };
      }

      return { success: true, documents: (data || []) as UploadedDocument[] };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load documents';
      console.error('Load documents error:', error);
      return { success: false, documents: [], error: message };
    }
  }

  /**
   * Upload a file to Supabase Storage, retrying once on conflict.
   */
  private async uploadToStorage(
    userId: string,
    file: File
  ): Promise<{ path: string } | null> {
    const fileName = generateStoragePath(userId, file.name);
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, file, { upsert: true });

    if (!error) return data;

    // Retry on 409 conflict with a fresh path
    if (error.message?.includes('409')) {
      const retryFileName = generateStoragePath(userId, file.name);
      const { data: retryData, error: retryError } = await supabase.storage
        .from('documents')
        .upload(retryFileName, file, { upsert: true });

      if (!retryError) return retryData;
    }

    return null;
  }
}

/**
 * Shared types for the document upload feature.
 */

/** Represents a document that has been uploaded by the user */
export interface UploadedDocument {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  status: string;
  created_at: string;
  extracted_content?: string;
  avatar_id?: string;
  extraction_status?: 'pending' | 'extracting' | 'completed' | 'failed' | 'skipped';
  fields_extracted?: number;
  extraction_error?: string;
}

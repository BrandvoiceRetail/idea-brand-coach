/**
 * Document validation utilities for file upload.
 * Centralizes file type, size, and path validation logic.
 */

/** Allowed MIME types for document upload */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

/** Maximum file size in bytes (20MB) */
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/** Accept string for file input elements */
export const ACCEPT_STRING = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp';

/** Human-readable description of allowed file types */
export const ALLOWED_TYPES_DESCRIPTION =
  'PDF, DOC, DOCX, TXT, or image files (JPG, PNG, GIF, WEBP)';

interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a file for upload eligibility (type + size).
 *
 * @param file - The File object to validate
 * @returns Validation result with optional error message
 */
export function validateFile(file: File): FileValidationResult {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      valid: false,
      error: `Please upload ${ALLOWED_TYPES_DESCRIPTION} only`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Please upload files smaller than 20MB',
    };
  }

  return { valid: true };
}

/**
 * Generate a unique storage path for a file upload.
 *
 * @param userId - The authenticated user's ID
 * @param filename - The original filename
 * @returns A unique storage path string
 */
export function generateStoragePath(userId: string, filename: string): string {
  const randomId = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now();
  const safeFileName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${userId}/${timestamp}-${randomId}-${safeFileName}`;
}

/**
 * Format a byte count into a human-readable file size string.
 *
 * @param bytes - The file size in bytes
 * @returns A formatted string like "1.5 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/** UUID v4 regex pattern */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID v4.
 *
 * @param value - The string to check
 * @returns True if the string is a valid UUID
 */
export function isValidUuid(value: string | null | undefined): boolean {
  return value != null && UUID_PATTERN.test(value);
}

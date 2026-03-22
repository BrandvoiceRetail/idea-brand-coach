/**
 * DocumentStatusBanner
 *
 * Renders contextual status banners based on the aggregate state
 * of the user's uploaded documents (processing, extracting, ready).
 */

import { CheckCircle, Sparkles } from 'lucide-react';
import type { UploadedDocument } from '@/types/document';

interface DocumentStatusBannerProps {
  documents: UploadedDocument[];
}

export function DocumentStatusBanner({ documents }: DocumentStatusBannerProps): JSX.Element | null {
  const hasProcessing = documents.some(doc =>
    ['uploading', 'processing', 'indexing'].includes(doc.status)
  );
  const hasExtracting = documents.some(doc => doc.extraction_status === 'extracting');
  const hasReady = documents.some(doc => doc.status === 'ready');

  return (
    <>
      {hasProcessing && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Processing documents... They'll be ready for chat soon!</span>
          </div>
        </div>
      )}

      {hasExtracting && (
        <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-950/50 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
            <Sparkles className="w-4 h-4" />
            <span>Auto-populating brand fields from your documents...</span>
          </div>
        </div>
      )}

      {hasReady && !hasProcessing && !hasExtracting && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
            <CheckCircle className="w-4 h-4" />
            <span>Documents are ready! You can now ask questions about them in the Brand Coach.</span>
          </div>
        </div>
      )}
    </>
  );
}

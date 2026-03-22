/**
 * DocumentListItem
 *
 * Renders a single document row with status icon, metadata, extraction
 * status, and a delete action button.
 */

import { Button } from '@/components/ui/button';
import {
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { formatFileSize } from '@/utils/documentValidation';
import type { UploadedDocument } from '@/types/document';

interface DocumentListItemProps {
  document: UploadedDocument;
  onDelete: (id: string, filename: string) => void;
}

function getStatusIcon(status: string): JSX.Element {
  switch (status) {
    case 'completed':
    case 'vectorized':
    case 'ready':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'uploading':
    case 'processing':
    case 'indexing':
      return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    default:
      return <FileText className="w-4 h-4 text-muted-foreground" />;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'uploading':
      return 'Uploading to AI';
    case 'processing':
      return 'Processing content';
    case 'indexing':
      return 'Indexing for search';
    case 'ready':
      return 'Ready for chat';
    case 'completed':
    case 'vectorized':
      return 'Available';
    case 'error':
      return 'Failed';
    default:
      return status;
  }
}

export function DocumentListItem({ document: doc, onDelete }: DocumentListItemProps): JSX.Element {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {getStatusIcon(doc.status)}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{doc.filename}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(doc.file_size)} &bull;{' '}
            {new Date(doc.created_at).toLocaleDateString()} &bull;{' '}
            <span
              className={`font-medium ${
                doc.status === 'ready'
                  ? 'text-green-600 dark:text-green-400'
                  : doc.status === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-blue-600 dark:text-blue-400'
              }`}
            >
              {getStatusLabel(doc.status)}
            </span>
          </p>
          {/* Extraction status indicators */}
          {doc.status === 'ready' && doc.extraction_status === 'extracting' && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-purple-600 dark:text-purple-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Extracting brand fields...</span>
            </div>
          )}
          {doc.extraction_status === 'completed' && doc.fields_extracted != null && doc.fields_extracted > 0 && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-purple-600 dark:text-purple-400">
              <Sparkles className="h-3 w-3" />
              <span>
                {doc.fields_extracted} field{doc.fields_extracted !== 1 ? 's' : ''} auto-populated
              </span>
            </div>
          )}
          {doc.extraction_status === 'failed' && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              <span>Field extraction failed</span>
            </div>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(doc.id, doc.filename)}
        className="text-muted-foreground hover:text-destructive"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

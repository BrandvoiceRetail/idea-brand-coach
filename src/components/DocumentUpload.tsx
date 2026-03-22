/**
 * DocumentUpload
 *
 * Thin orchestrator component for document upload UI.
 * Delegates state management to useDocumentUpload hook and
 * renders sub-components for status banners and document list items.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, Trash2, MessageSquare } from 'lucide-react';
import { DesktopOnlyFeature } from '@/components/DesktopOnlyFeature';
import { DocumentStatusBanner } from '@/components/document/DocumentStatusBanner';
import { DocumentListItem } from '@/components/document/DocumentListItem';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { ACCEPT_STRING } from '@/utils/documentValidation';
import type { UploadedDocument } from '@/types/document';

interface DocumentUploadProps {
  onDocumentsChange?: (documents: UploadedDocument[]) => void;
  onUploadComplete?: (document: { id: string; filename: string }) => void;
}

export type { UploadedDocument };

export const DocumentUpload = ({ onDocumentsChange, onUploadComplete }: DocumentUploadProps): JSX.Element => {
  const {
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
  } = useDocumentUpload({ onDocumentsChange, onUploadComplete });

  const mobileAlternative = (
    <div className="space-y-3">
      <p className="text-xs text-amber-700 dark:text-amber-200 font-medium">
        Instead, you can:
      </p>
      <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-200">
        <MessageSquare className="w-3 h-3" />
        <span>Share key information directly in the text input when using AI consultations</span>
      </div>
    </div>
  );

  return (
    <DesktopOnlyFeature
      featureName="Document Upload"
      mobileMessage="Document upload and processing is optimized for desktop use with drag-and-drop functionality, better file management, and enhanced processing capabilities."
      mobileAlternative={mobileAlternative}
    >
      <div className="space-y-6">
        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Share Your Knowledge Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/5'
              } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="space-y-4 pointer-events-none">
                <div className="mx-auto w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Drop your documents here, or{' '}
                    <span className="text-primary underline">browse files</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    I can work with PDF, DOC, DOCX, TXT, and image files (JPG, PNG, GIF, WEBP) up to 20MB - whatever works best for you!
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_STRING}
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
            </div>

            {isUploading && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {!isUploading && (
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Select Document to Upload
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Documents List */}
        {documents.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Your Knowledge Documents</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteAllDocuments}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={documents.length === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All Documents
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DocumentStatusBanner documents={documents} />
              <div className="space-y-3">
                {documents.map((doc) => (
                  <DocumentListItem
                    key={doc.id}
                    document={doc}
                    onDelete={handleDeleteDocument}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Information */}
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  How it works
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-200">
                  Upload your brand books, strategy documents, research materials, or visual brand assets (logos, product images, marketing materials). The content will be processed and integrated into your IDEA Framework consultations to provide personalized, context-aware guidance based on your specific knowledge base.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Statement */}
        <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Privacy & Security
                </p>
                <p className="text-xs text-green-700 dark:text-green-200">
                  Your documents and conversations are stored securely and are only accessible to you. Document content is processed to enhance AI consultations but is never shared with other users, not used to train AI models, and you can delete your documents and clear your conversation history at any time. All data is encrypted in transit and at rest. We use trusted service providers (like OpenAI and our cloud infrastructure) to deliver the service, all bound by strict confidentiality obligations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DesktopOnlyFeature>
  );
};

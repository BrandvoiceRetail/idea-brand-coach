import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, X, CheckCircle, AlertCircle, Trash2, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { DesktopOnlyFeature } from '@/components/DesktopOnlyFeature';

interface UploadedDocument {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  status: string;
  created_at: string;
  extracted_content?: string;
  openai_file_id?: string;
}

interface DocumentUploadProps {
  onDocumentsChange?: (documents: UploadedDocument[]) => void;
}

export const DocumentUpload = ({ onDocumentsChange }: DocumentUploadProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Load user documents on component mount
  useEffect(() => {
    if (user) {
      loadUserDocuments();
    }
  }, [user]);

  // Poll for document status updates while any are processing
  useEffect(() => {
    const processingDocs = documents.filter(doc =>
      ['uploading', 'processing', 'indexing'].includes(doc.status)
    );

    if (processingDocs.length === 0) return;

    const interval = setInterval(() => {
      loadUserDocuments();
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [documents, user]);

  const loadUserDocuments = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('uploaded_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDocuments(data || []);
      onDocumentsChange?.(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: "Error",
        description: "Failed to load your documents",
        variant: "destructive",
      });
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upload documents",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Image types
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload PDF, DOC, DOCX, TXT, or image files (JPG, PNG, GIF, WEBP) only",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (20MB limit)
    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload files smaller than 20MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Create file path with user ID
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${file.name}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          upsert: false
        });

      if (uploadError) throw uploadError;

      setUploadProgress(50);

      // Save document metadata to database
      const { data: docData, error: docError } = await supabase
        .from('uploaded_documents')
        .insert({
          user_id: user.id,
          filename: file.name,
          file_path: uploadData.path,
          file_size: file.size,
          mime_type: file.type,
          status: 'processing'
        })
        .select()
        .single();

      if (docError) throw docError;

      setUploadProgress(75);

      // Upload document directly to OpenAI vector store (bypasses local text extraction)
      const { data: vectorResult, error: vectorError } = await supabase.functions.invoke('upload-document-to-vector-store', {
        body: { documentId: docData.id }
      });

      if (vectorError) {
        console.warn('Vector store upload failed:', vectorError);
        // Don't fail the upload, just log the warning - document is still saved
      } else {
        console.log('Document uploaded to vector store:', vectorResult);
      }

      setUploadProgress(100);

      toast({
        title: "Upload Successful",
        description: `${file.name} has been uploaded and is being processed`,
      });

      // Reload documents
      await loadUserDocuments();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDocument = async (documentId: string, filename: string) => {
    try {
      const { error } = await supabase
        .from('uploaded_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      toast({
        title: "Document Deleted",
        description: `${filename} has been deleted`,
      });

      await loadUserDocuments();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAllDocuments = async () => {
    if (!user || documents.length === 0) return;

    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete all ${documents.length} documents? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('uploaded_documents')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "All Documents Deleted",
        description: `Successfully deleted ${documents.length} documents`,
      });

      await loadUserDocuments();
    } catch (error) {
      console.error('Delete all error:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete all documents",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
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
  };

  const getStatusLabel = (status: string): string => {
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
  };

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
                  <span className="text-primary underline">
                    browse files
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  I can work with PDF, DOC, DOCX, TXT, and image files (JPG, PNG, GIF, WEBP) up to 20MB - whatever works best for you!
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp"
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
            {/* Show status message if any documents are processing */}
            {documents.some(doc => ['uploading', 'processing', 'indexing'].includes(doc.status)) && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>Processing documents... They'll be ready for chat soon!</span>
                </div>
              </div>
            )}

            {/* Show ready message for recently ready documents */}
            {documents.some(doc => doc.status === 'ready') &&
             !documents.some(doc => ['uploading', 'processing', 'indexing'].includes(doc.status)) && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle className="w-4 h-4" />
                  <span>Documents are ready! You can now ask questions about them in the Brand Coach.</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getStatusIcon(doc.status)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(doc.file_size)} • {' '}
                        {new Date(doc.created_at).toLocaleDateString()} • {' '}
                        <span className={`font-medium ${
                          doc.status === 'ready' ? 'text-green-600 dark:text-green-400' :
                          doc.status === 'error' ? 'text-red-600 dark:text-red-400' :
                          'text-blue-600 dark:text-blue-400'
                        }`}>
                          {getStatusLabel(doc.status)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
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
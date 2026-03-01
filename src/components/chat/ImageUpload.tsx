import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Image, X, Upload, Loader2, Settings2, FileImage } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ChatImageAttachment } from '@/types/chat';
import imageCompression from 'browser-image-compression';

interface ImageUploadProps {
  onImagesChange?: (images: ChatImageAttachment[]) => void;
  maxImages?: number;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onImagesChange,
  maxImages = 5
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [attachedImages, setAttachedImages] = useState<ChatImageAttachment[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<{[key: string]: number}>({});
  const [compressionEnabled, setCompressionEnabled] = useState(true);

  // Helper function to format file sizes
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Compression function
  const compressImage = async (file: File, fileName: string): Promise<File> => {
    // Skip compression if disabled or file is already small
    if (!compressionEnabled || file.size < 1024 * 1024) { // < 1MB
      return file;
    }

    // Determine compression settings based on file size
    let maxSizeMB: number;
    if (file.size < 2 * 1024 * 1024) { // < 2MB
      maxSizeMB = 1.5;
    } else if (file.size < 5 * 1024 * 1024) { // < 5MB
      maxSizeMB = 2;
    } else { // > 5MB
      maxSizeMB = 3;
    }

    const options = {
      maxSizeMB,
      maxWidthOrHeight: 2048, // Optimal for GPT-4 Vision
      useWebWorker: true,
      fileType: file.type,
      initialQuality: 0.9, // High quality for brand materials
      alwaysKeepResolution: false,
      preserveExif: true,
      onProgress: (progress: number) => {
        setCompressionProgress(prev => ({
          ...prev,
          [fileName]: Math.round(progress)
        }));
      }
    };

    try {
      setIsCompressing(true);
      const compressedFile = await imageCompression(file, options);

      // Log compression results
      const originalSize = formatFileSize(file.size);
      const compressedSize = formatFileSize(compressedFile.size);
      const reduction = Math.round((1 - compressedFile.size / file.size) * 100);

      console.log(`Compressed ${file.name}: ${originalSize} → ${compressedSize} (-${reduction}%)`);

      // Clear progress for this file
      setCompressionProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileName];
        return newProgress;
      });

      return compressedFile;
    } catch (error) {
      console.warn('Compression failed, using original:', error);
      // Clear progress on error
      setCompressionProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileName];
        return newProgress;
      });
      return file; // Fallback to original
    } finally {
      setIsCompressing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      handleMultipleImages(filesArray);
    }
  };

  const handleMultipleImages = async (files: File[]) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upload images",
        variant: "destructive",
      });
      return;
    }

    // Check if adding these files would exceed the max
    if (attachedImages.length + files.length > maxImages) {
      toast({
        title: "Too Many Images",
        description: `You can only attach up to ${maxImages} images per message`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const newImages: ChatImageAttachment[] = [];
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    for (const file of files) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not a supported image format`,
          variant: "destructive",
        });
        continue;
      }

      // Validate file size (20MB limit)
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: `${file.name} exceeds 20MB limit`,
          variant: "destructive",
        });
        continue;
      }

      try {
        const originalSize = file.size;
        totalOriginalSize += originalSize;

        // Compress the image if enabled
        const fileToUpload = await compressImage(file, file.name);
        const compressedSize = fileToUpload.size;
        totalCompressedSize += compressedSize;

        // Create file path with user ID
        const fileName = `${user.id}/images/${Date.now()}-${file.name}`;

        // Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, fileToUpload, {
            upsert: false,
            contentType: fileToUpload.type
          });

        if (uploadError) throw uploadError;

        // Get public URL for the image
        const { data: publicUrlData } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        const imageAttachment: ChatImageAttachment = {
          id: crypto.randomUUID(),
          url: publicUrlData.publicUrl,
          filename: file.name,
          mime_type: fileToUpload.type,
          file_size: compressedSize,
          original_file_size: originalSize !== compressedSize ? originalSize : undefined,
          compression_ratio: originalSize !== compressedSize
            ? Math.round((1 - compressedSize / originalSize) * 100)
            : undefined,
          was_compressed: originalSize !== compressedSize
        };

        newImages.push(imageAttachment);
      } catch (error) {
        console.error('Image upload error:', error);
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }

    if (newImages.length > 0) {
      const updatedImages = [...attachedImages, ...newImages];
      setAttachedImages(updatedImages);
      onImagesChange?.(updatedImages);

      // Show compression results if compression was applied
      if (compressionEnabled && totalOriginalSize > totalCompressedSize) {
        const saved = totalOriginalSize - totalCompressedSize;
        const reduction = Math.round((saved / totalOriginalSize) * 100);
        toast({
          title: "Images Optimized & Attached",
          description: `${newImages.length} image(s) ready to send (${formatFileSize(saved)} saved, -${reduction}%)`,
        });
      } else {
        toast({
          title: "Images Attached",
          description: `${newImages.length} image(s) ready to send with your message`,
        });
      }
    }

    setIsUploading(false);
    setIsCompressing(false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (imageId: string) => {
    const updatedImages = attachedImages.filter(img => img.id !== imageId);
    setAttachedImages(updatedImages);
    onImagesChange?.(updatedImages);
  };

  const clearAllImages = () => {
    setAttachedImages([]);
    onImagesChange?.([]);
  };

  return (
    <div className="space-y-2">
      {/* Upload Button */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isCompressing || attachedImages.length >= maxImages}
          title="Supported formats: JPEG, PNG, GIF, WEBP (max 20MB)"
        >
          {isUploading || isCompressing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Image className="w-4 h-4 mr-2" />
          )}
          {isCompressing ? "Optimizing..." : "Add Images"}
        </Button>

        {/* Compression Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCompressionEnabled(!compressionEnabled)}
          title={compressionEnabled ? "Compression enabled - click to disable" : "Compression disabled - click to enable"}
        >
          <Settings2 className="w-4 h-4 mr-1" />
          {compressionEnabled ? (
            <span className="text-xs">Optimization On</span>
          ) : (
            <span className="text-xs text-muted-foreground">Optimization Off</span>
          )}
        </Button>

        {attachedImages.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {attachedImages.length}/{maxImages} images attached
          </span>
        )}

        {attachedImages.length === 0 && !isCompressing && (
          <span className="text-xs text-muted-foreground">
            JPEG, PNG, GIF, WEBP (max 20MB each)
          </span>
        )}

        {attachedImages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllImages}
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Compression Progress */}
      {Object.keys(compressionProgress).length > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
          {Object.entries(compressionProgress).map(([fileName, progress]) => (
            <div key={fileName} className="flex items-center gap-2">
              <FileImage className="w-3 h-3" />
              <span>Optimizing {fileName}...</span>
              <span className="font-mono">{progress}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        multiple
        className="hidden"
        disabled={isUploading}
      />

      {/* Image Previews */}
      {attachedImages.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-lg">
          {attachedImages.map((image) => (
            <div
              key={image.id}
              className="relative group"
            >
              <div className="w-20 h-20 rounded overflow-hidden border">
                <img
                  src={image.url}
                  alt={image.filename}
                  className="w-full h-full object-cover"
                />
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 w-5 h-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeImage(image.id)}
              >
                <X className="w-3 h-3" />
              </Button>
              <div className="mt-1">
                <p className="text-xs text-center truncate w-20">
                  {image.filename}
                </p>
                {image.was_compressed && (
                  <p className="text-xs text-center text-green-600">
                    -{image.compression_ratio}%
                  </p>
                )}
                {image.file_size && (
                  <p className="text-xs text-center text-muted-foreground">
                    {formatFileSize(image.file_size)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
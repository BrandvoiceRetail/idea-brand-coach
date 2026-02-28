import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Image, X, Upload, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ChatImageAttachment } from '@/types/chat';

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
        // Create file path with user ID
        const fileName = `${user.id}/images/${Date.now()}-${file.name}`;

        // Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file, {
            upsert: false,
            contentType: file.type
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
          mime_type: file.type,
          file_size: file.size
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

      toast({
        title: "Images Attached",
        description: `${newImages.length} image(s) ready to send with your message`,
      });
    }

    setIsUploading(false);

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
          disabled={isUploading || attachedImages.length >= maxImages}
          title="Supported formats: JPEG, PNG, GIF, WEBP (max 20MB)"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Image className="w-4 h-4 mr-2" />
          )}
          Add Images
        </Button>

        {attachedImages.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {attachedImages.length}/{maxImages} images attached
          </span>
        )}

        {attachedImages.length === 0 && (
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
              <p className="text-xs text-center truncate w-20 mt-1">
                {image.filename}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
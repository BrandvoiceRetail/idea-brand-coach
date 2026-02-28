import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageUpload } from './ImageUpload';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import imageCompression from 'browser-image-compression';

// Mock browser-image-compression
vi.mock('browser-image-compression', () => ({
  default: vi.fn()
}));

// Mock other dependencies
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/use-toast');
vi.mock('@/integrations/supabase/client');

// Mock crypto.randomUUID
const mockRandomUUID = vi.fn(() => 'test-uuid-123');
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: mockRandomUUID },
  writable: true,
});

describe('ImageUpload - Compression Features', () => {
  const mockToast = vi.fn();
  const mockOnImagesChange = vi.fn();
  const mockUser = { id: 'user-123' };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the imageCompression mock
    (imageCompression as unknown as Mock).mockReset();

    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
    vi.mocked(useToast).mockReturnValue({ toast: mockToast } as any);

    // Mock Supabase storage
    const mockStorage = {
      from: vi.fn().mockReturnThis(),
      upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/test-image.jpg' }
      }),
    };
    vi.mocked(supabase).storage = mockStorage as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Compression Function', () => {
    it('should compress images larger than 1MB', async () => {
      // Create mock file larger than 1MB but less than 2MB
      const largeFile = new File(['a'.repeat(1.5 * 1024 * 1024)], 'large-image.jpg', {
        type: 'image/jpeg',
      });

      const compressedFile = new File(['a'.repeat(600 * 1024)], 'large-image.jpg', {
        type: 'image/jpeg',
      });

      (imageCompression as unknown as Mock).mockResolvedValueOnce(compressedFile);

      const { container } = render(
        <ImageUpload onImagesChange={mockOnImagesChange} />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Trigger file selection
      const fileList = {
        0: largeFile,
        length: 1,
        item: (index: number) => index === 0 ? largeFile : null,
      };
      Object.defineProperty(fileInput, 'files', {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // Wait for compression and upload
      await waitFor(() => {
        expect(imageCompression as unknown as Mock).toHaveBeenCalledWith(
          largeFile,
          expect.objectContaining({
            maxSizeMB: 1.5,
            maxWidthOrHeight: 2048,
            useWebWorker: true,
            fileType: 'image/jpeg',
            initialQuality: 0.9,
            preserveExif: true,
          })
        );
      });

      // Verify the compressed file was uploaded
      await waitFor(() => {
        expect(mockOnImagesChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              was_compressed: true,
              compression_ratio: expect.any(Number),
              original_file_size: 1.5 * 1024 * 1024,
            })
          ])
        );
      });

      // Verify success toast with compression info
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Optimized'),
        })
      );
    });

    it('should skip compression for images smaller than 1MB', async () => {
      // Create mock file smaller than 1MB
      const smallFile = new File(['a'.repeat(500 * 1024)], 'small-image.jpg', {
        type: 'image/jpeg',
      });

      const { container } = render(
        <ImageUpload onImagesChange={mockOnImagesChange} />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Trigger file selection
      const fileList = {
        0: smallFile,
        length: 1,
        item: (index: number) => index === 0 ? smallFile : null,
      };
      Object.defineProperty(fileInput, 'files', {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // Wait for upload (no compression)
      await waitFor(() => {
        expect(mockOnImagesChange).toHaveBeenCalled();
      });

      // Verify compression was not called
      expect(imageCompression as unknown as Mock).not.toHaveBeenCalled();

      // Verify no compression metadata
      expect(mockOnImagesChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            was_compressed: false,
          })
        ])
      );
    });

    it('should apply different compression levels based on file size', async () => {
      // Test file between 2-5MB
      const mediumFile = new File(['a'.repeat(3 * 1024 * 1024)], 'medium-image.jpg', {
        type: 'image/jpeg',
      });

      const compressedFile = new File(['a'.repeat(1.5 * 1024 * 1024)], 'medium-image.jpg', {
        type: 'image/jpeg',
      });

      (imageCompression as unknown as Mock).mockResolvedValueOnce(compressedFile);

      const { container } = render(
        <ImageUpload onImagesChange={mockOnImagesChange} />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Trigger file selection
      const fileList = {
        0: mediumFile,
        length: 1,
        item: (index: number) => index === 0 ? mediumFile : null,
      };
      Object.defineProperty(fileInput, 'files', {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // Wait for compression
      await waitFor(() => {
        expect(imageCompression as unknown as Mock).toHaveBeenCalledWith(
          mediumFile,
          expect.objectContaining({
            maxSizeMB: 2, // Medium compression for 2-5MB files
          })
        );
      });
    });

    it('should apply heavy compression for files larger than 5MB', async () => {
      // Test file larger than 5MB
      const largeFile = new File(['a'.repeat(8 * 1024 * 1024)], 'huge-image.jpg', {
        type: 'image/jpeg',
      });

      const compressedFile = new File(['a'.repeat(2.5 * 1024 * 1024)], 'huge-image.jpg', {
        type: 'image/jpeg',
      });

      (imageCompression as unknown as Mock).mockResolvedValueOnce(compressedFile);

      const { container } = render(
        <ImageUpload onImagesChange={mockOnImagesChange} />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Trigger file selection
      const fileList = {
        0: largeFile,
        length: 1,
        item: (index: number) => index === 0 ? largeFile : null,
      };
      Object.defineProperty(fileInput, 'files', {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // Wait for compression
      await waitFor(() => {
        expect(imageCompression as unknown as Mock).toHaveBeenCalledWith(
          largeFile,
          expect.objectContaining({
            maxSizeMB: 3, // Heavy compression for > 5MB files
          })
        );
      });
    });
  });

  describe('Compression Toggle', () => {
    it('should show compression toggle button', () => {
      render(<ImageUpload onImagesChange={mockOnImagesChange} />);

      const toggleButton = screen.getByTitle(/compression enabled/i);
      expect(toggleButton).toBeInTheDocument();
      expect(screen.getByText('Optimization On')).toBeInTheDocument();
    });

    it('should toggle compression on/off', async () => {
      render(<ImageUpload onImagesChange={mockOnImagesChange} />);

      const toggleButton = screen.getByTitle(/compression enabled/i);

      // Click to disable compression
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('Optimization Off')).toBeInTheDocument();
      });

      // Click to enable compression again
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('Optimization On')).toBeInTheDocument();
      });
    });

    it('should not compress when compression is disabled', async () => {
      const largeFile = new File(['a'.repeat(2 * 1024 * 1024)], 'large-image.jpg', {
        type: 'image/jpeg',
      });

      const { container } = render(
        <ImageUpload onImagesChange={mockOnImagesChange} />
      );

      // Disable compression
      const toggleButton = screen.getByTitle(/compression enabled/i);
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('Optimization Off')).toBeInTheDocument();
      });

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Trigger file selection
      const fileList = {
        0: largeFile,
        length: 1,
        item: (index: number) => index === 0 ? largeFile : null,
      };
      Object.defineProperty(fileInput, 'files', {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // Wait for upload
      await waitFor(() => {
        expect(mockOnImagesChange).toHaveBeenCalled();
      });

      // Verify compression was not called even for large file
      expect(imageCompression as unknown as Mock).not.toHaveBeenCalled();
    });
  });

  describe('Compression UI Feedback', () => {
    it('should show "Optimizing..." during compression', async () => {
      const largeFile = new File(['a'.repeat(2 * 1024 * 1024)], 'large-image.jpg', {
        type: 'image/jpeg',
      });

      // Mock compression to take some time
      (imageCompression as unknown as Mock).mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(new File(['a'.repeat(800 * 1024)], 'large-image.jpg', {
              type: 'image/jpeg',
            }));
          }, 100);
        })
      );

      const { container } = render(
        <ImageUpload onImagesChange={mockOnImagesChange} />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Trigger file selection
      const fileList = {
        0: largeFile,
        length: 1,
        item: (index: number) => index === 0 ? largeFile : null,
      };
      Object.defineProperty(fileInput, 'files', {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // Should show optimizing state
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /optimizing/i });
        expect(button).toBeInTheDocument();
      });
    });

    it('should show compression ratio in image preview', async () => {
      const largeFile = new File(['a'.repeat(2 * 1024 * 1024)], 'test-image.jpg', {
        type: 'image/jpeg',
      });

      const compressedFile = new File(['a'.repeat(800 * 1024)], 'test-image.jpg', {
        type: 'image/jpeg',
      });

      (imageCompression as unknown as Mock).mockResolvedValueOnce(compressedFile);

      const { container } = render(
        <ImageUpload onImagesChange={mockOnImagesChange} />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Trigger file selection
      const fileList = {
        0: largeFile,
        length: 1,
        item: (index: number) => index === 0 ? largeFile : null,
      };
      Object.defineProperty(fileInput, 'files', {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // Wait for compression and upload
      await waitFor(() => {
        expect(mockOnImagesChange).toHaveBeenCalled();
      });

      // Check that compression ratio is displayed
      await waitFor(() => {
        // The compression ratio should be approximately 61% ((2MB - 0.8MB) / 2MB * 100)
        const compressionIndicator = screen.getByText(/-\d+%/);
        expect(compressionIndicator).toBeInTheDocument();
      });

      // Check that file size is displayed
      const fileSize = screen.getByText(/\d+(\.\d+)?\s*(B|KB|MB)/);
      expect(fileSize).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should fallback to original file if compression fails', async () => {
      const file = new File(['a'.repeat(2 * 1024 * 1024)], 'image.jpg', {
        type: 'image/jpeg',
      });

      // Mock compression failure
      (imageCompression as unknown as Mock).mockRejectedValueOnce(new Error('Compression failed'));

      // Spy on console.warn
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { container } = render(
        <ImageUpload onImagesChange={mockOnImagesChange} />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Trigger file selection
      const fileList = {
        0: file,
        length: 1,
        item: (index: number) => index === 0 ? file : null,
      };
      Object.defineProperty(fileInput, 'files', {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // Wait for upload
      await waitFor(() => {
        expect(mockOnImagesChange).toHaveBeenCalled();
      });

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Compression failed, using original:',
        expect.any(Error)
      );

      // Verify original file was uploaded
      expect(mockOnImagesChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            was_compressed: false,
            file_size: 2 * 1024 * 1024,
          })
        ])
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle multiple file compression with mixed success/failure', async () => {
      const file1 = new File(['a'.repeat(2 * 1024 * 1024)], 'image1.jpg', {
        type: 'image/jpeg',
      });
      const file2 = new File(['a'.repeat(3 * 1024 * 1024)], 'image2.jpg', {
        type: 'image/jpeg',
      });

      const compressedFile1 = new File(['a'.repeat(800 * 1024)], 'image1.jpg', {
        type: 'image/jpeg',
      });

      // Mock: first file compresses successfully, second fails
      (imageCompression as unknown as Mock)
        .mockResolvedValueOnce(compressedFile1)
        .mockRejectedValueOnce(new Error('Compression failed'));

      const { container } = render(
        <ImageUpload onImagesChange={mockOnImagesChange} />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Trigger file selection with multiple files
      const fileList = {
        0: file1,
        1: file2,
        length: 2,
        item: (index: number) => index === 0 ? file1 : index === 1 ? file2 : null,
      };
      Object.defineProperty(fileInput, 'files', {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // Wait for both files to be processed
      await waitFor(() => {
        expect(mockOnImagesChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              filename: 'image1.jpg',
              was_compressed: true,
            }),
            expect.objectContaining({
              filename: 'image2.jpg',
              was_compressed: false,
            })
          ])
        );
      });
    });
  });

  describe('File Format Handling', () => {
    it('should preserve MIME type during compression', async () => {
      const pngFile = new File(['a'.repeat(2 * 1024 * 1024)], 'image.png', {
        type: 'image/png',
      });

      const compressedFile = new File(['a'.repeat(800 * 1024)], 'image.png', {
        type: 'image/png',
      });

      (imageCompression as unknown as Mock).mockResolvedValueOnce(compressedFile);

      const { container } = render(
        <ImageUpload onImagesChange={mockOnImagesChange} />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Trigger file selection
      const fileList = {
        0: pngFile,
        length: 1,
        item: (index: number) => index === 0 ? pngFile : null,
      };
      Object.defineProperty(fileInput, 'files', {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // Verify PNG type is preserved
      await waitFor(() => {
        expect(imageCompression as unknown as Mock).toHaveBeenCalledWith(
          pngFile,
          expect.objectContaining({
            fileType: 'image/png',
          })
        );
      });

      // Verify uploaded file maintains PNG type
      expect(mockOnImagesChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            mime_type: 'image/png',
          })
        ])
      );
    });

    it('should handle WebP format without errors', async () => {
      const webpFile = new File(['a'.repeat(1.5 * 1024 * 1024)], 'image.webp', {
        type: 'image/webp',
      });

      const compressedFile = new File(['a'.repeat(600 * 1024)], 'image.webp', {
        type: 'image/webp',
      });

      (imageCompression as unknown as Mock).mockResolvedValueOnce(compressedFile);

      const { container } = render(
        <ImageUpload onImagesChange={mockOnImagesChange} />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Trigger file selection
      const fileList = {
        0: webpFile,
        length: 1,
        item: (index: number) => index === 0 ? webpFile : null,
      };
      Object.defineProperty(fileInput, 'files', {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // Wait for compression and upload
      await waitFor(() => {
        expect(mockOnImagesChange).toHaveBeenCalled();
      });

      // Verify WebP was processed successfully
      expect(mockOnImagesChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            mime_type: 'image/webp',
            was_compressed: true,
          })
        ])
      );
    });
  });
});
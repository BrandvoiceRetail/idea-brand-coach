import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageUpload } from '../ImageUpload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Mock dependencies
vi.mock('@/integrations/supabase/client');
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/use-toast');

describe('ImageUpload', () => {
  const mockUser = { id: 'user-123' };
  const mockToast = vi.fn();
  const mockOnImagesChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      loading: false,
      signOut: vi.fn(),
    });

    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      toasts: [],
      dismiss: vi.fn(),
    });

    // Mock crypto.randomUUID
    Object.defineProperty(global, 'crypto', {
      value: {
        randomUUID: vi.fn(() => 'mock-uuid'),
      },
      writable: true,
    });
  });

  it('should render image upload button', () => {
    render(<ImageUpload onImagesChange={mockOnImagesChange} />);

    expect(screen.getByRole('button', { name: /add images/i })).toBeInTheDocument();
  });

  it('should handle successful image upload', async () => {
    const mockFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });
    const mockPublicUrl = 'https://example.com/image.jpg';

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: { path: 'user-123/images/test.jpg' },
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: mockPublicUrl },
      }),
    } as any);

    render(<ImageUpload onImagesChange={mockOnImagesChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [mockFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnImagesChange).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'mock-uuid',
          url: mockPublicUrl,
          filename: 'test.jpg',
          mime_type: 'image/jpeg',
          file_size: mockFile.size,
        }),
      ]);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Images Attached',
      description: '1 image(s) ready to send with your message',
    });
  });

  it('should reject invalid file types', async () => {
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    render(<ImageUpload onImagesChange={mockOnImagesChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [mockFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Invalid File Type',
        description: 'test.pdf is not a supported image format',
        variant: 'destructive',
      });
    });

    expect(mockOnImagesChange).not.toHaveBeenCalled();
  });

  it('should reject files over 20MB', async () => {
    const largeFile = new File(['x'.repeat(21 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg'
    });

    render(<ImageUpload onImagesChange={mockOnImagesChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [largeFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'File Too Large',
        description: 'large.jpg exceeds 20MB limit',
        variant: 'destructive',
      });
    });

    expect(mockOnImagesChange).not.toHaveBeenCalled();
  });

  it('should enforce maximum image limit', async () => {
    const mockFiles = Array.from({ length: 6 }, (_, i) =>
      new File(['content'], `test${i}.jpg`, { type: 'image/jpeg' })
    );

    render(<ImageUpload onImagesChange={mockOnImagesChange} maxImages={5} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: mockFiles,
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Too Many Images',
        description: 'You can only attach up to 5 images per message',
        variant: 'destructive',
      });
    });

    expect(mockOnImagesChange).not.toHaveBeenCalled();
  });

  it('should display image previews after upload', async () => {
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const mockPublicUrl = 'https://example.com/image.jpg';

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: { path: 'user-123/images/test.jpg' },
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: mockPublicUrl },
      }),
    } as any);

    render(<ImageUpload onImagesChange={mockOnImagesChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [mockFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByAltText('test.jpg')).toBeInTheDocument();
      expect(screen.getByText('1/5 images attached')).toBeInTheDocument();
    });
  });

  it('should remove individual images', async () => {
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const mockPublicUrl = 'https://example.com/image.jpg';

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: { path: 'user-123/images/test.jpg' },
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: mockPublicUrl },
      }),
    } as any);

    const { container } = render(<ImageUpload onImagesChange={mockOnImagesChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [mockFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByAltText('test.jpg')).toBeInTheDocument();
    });

    // Find and click the remove button
    const removeButton = container.querySelector('.group button[class*="destructive"]');
    fireEvent.click(removeButton!);

    await waitFor(() => {
      expect(screen.queryByAltText('test.jpg')).not.toBeInTheDocument();
      expect(mockOnImagesChange).toHaveBeenLastCalledWith([]);
    });
  });

  it('should clear all images', async () => {
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const mockPublicUrl = 'https://example.com/image.jpg';

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: { path: 'user-123/images/test.jpg' },
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: mockPublicUrl },
      }),
    } as any);

    render(<ImageUpload onImagesChange={mockOnImagesChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [mockFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Clear All')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Clear All'));

    await waitFor(() => {
      expect(screen.queryByAltText('test.jpg')).not.toBeInTheDocument();
      expect(mockOnImagesChange).toHaveBeenLastCalledWith([]);
    });
  });

  it('should require authentication', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signOut: vi.fn(),
    });

    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    render(<ImageUpload onImagesChange={mockOnImagesChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [mockFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Authentication Required',
        description: 'Please sign in to upload images',
        variant: 'destructive',
      });
    });

    expect(mockOnImagesChange).not.toHaveBeenCalled();
  });
});
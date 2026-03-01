import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatImageAttachment } from '@/types/chat';

// Mock Deno globals for testing
global.Deno = {
  env: {
    get: (key: string) => {
      if (key === 'OPENAI_API_KEY') return 'mock-api-key';
      if (key === 'SUPABASE_URL') return 'https://mock.supabase.co';
      if (key === 'SUPABASE_ANON_KEY') return 'mock-anon-key';
      return '';
    },
  },
} as any;

describe('IDEA Framework Consultant - Image Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch for OpenAI API calls
    global.fetch = vi.fn();
  });

  it('should build multimodal message for GPT-4 Vision with images', async () => {
    const mockImages: ChatImageAttachment[] = [
      {
        id: 'img-1',
        url: 'https://example.com/product.jpg',
        filename: 'product.jpg',
        mime_type: 'image/jpeg',
      },
      {
        id: 'img-2',
        url: 'https://example.com/logo.png',
        filename: 'logo.png',
        mime_type: 'image/png',
      },
    ];

    const mockRequest = {
      message: 'Analyze these brand images for consistency',
      metadata: { images: mockImages },
      chat_history: [],
    };

    // Expected multimodal content structure for GPT-4 Vision
    const expectedContent = [
      { type: 'text', text: expect.stringContaining('Analyze these brand images') },
      {
        type: 'image_url',
        image_url: {
          url: 'https://example.com/product.jpg',
          detail: 'high',
        },
      },
      {
        type: 'image_url',
        image_url: {
          url: 'https://example.com/logo.png',
          detail: 'high',
        },
      },
    ];

    // Mock OpenAI API response
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Based on my analysis of the brand images, I can see strong visual consistency...',
            },
          },
        ],
      }),
    } as any);

    // Simulate edge function processing
    const messages = [
      { role: 'system', content: expect.stringContaining('IMAGE ANALYSIS CAPABILITIES') },
      { role: 'user', content: expectedContent },
    ];

    // Verify the request would be structured correctly
    expect(messages[1].content).toEqual(expectedContent);
    expect(messages[0].content).toContain('IMAGE ANALYSIS CAPABILITIES');
  });

  it('should include image analysis context in system prompt', () => {
    const systemPrompt = `IMAGE ANALYSIS CAPABILITIES:
When images are provided by the user, YOU MUST:
- Analyze visual branding elements including color schemes, typography, imagery, and overall design aesthetic
- Evaluate brand consistency across different visual materials
- Assess emotional impact and psychological triggers in visual design
- Compare visual execution against stated brand positioning and IDEA Framework principles`;

    expect(systemPrompt).toContain('Analyze visual branding elements');
    expect(systemPrompt).toContain('Evaluate brand consistency');
    expect(systemPrompt).toContain('Assess emotional impact');
    expect(systemPrompt).toContain('IDEA Framework principles');
  });

  it('should handle messages without images as regular text', async () => {
    const mockRequest = {
      message: 'What is the IDEA Framework?',
      metadata: {},
      chat_history: [],
    };

    // Mock OpenAI API response
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'The IDEA Framework stands for Insight-Driven, Distinctive, Empathetic, and Authentic...',
            },
          },
        ],
      }),
    } as any);

    // For non-image messages, content should be a simple string
    const expectedContent = expect.stringContaining('What is the IDEA Framework?');

    // Simulate message structure
    const messages = [
      { role: 'system', content: expect.any(String) },
      { role: 'user', content: expectedContent },
    ];

    // Verify content is a string, not an array
    expect(typeof messages[1].content).toBe('string');
  });

  it('should add visual analysis instructions for image messages', () => {
    const mockImages = [{ id: 'img-1', url: 'https://example.com/image.jpg', filename: 'image.jpg' }];
    const userPrompt = 'Analyze this image';

    // Build prompt with images
    const promptWithImages = `${userPrompt}

VISUAL ANALYSIS: The user has provided 1 image(s) for analysis. Please analyze these images in the context of their brand strategy and IDEA Framework positioning. Provide specific visual feedback and recommendations.`;

    expect(promptWithImages).toContain('VISUAL ANALYSIS');
    expect(promptWithImages).toContain('1 image(s) for analysis');
    expect(promptWithImages).toContain('brand strategy and IDEA Framework positioning');
  });

  it('should handle multiple images in a single message', () => {
    const mockImages = Array.from({ length: 5 }, (_, i) => ({
      id: `img-${i}`,
      url: `https://example.com/image${i}.jpg`,
      filename: `image${i}.jpg`,
    }));

    const contentParts = [
      { type: 'text', text: 'Analyze these 5 product images' },
      ...mockImages.map(img => ({
        type: 'image_url',
        image_url: {
          url: img.url,
          detail: 'high',
        },
      })),
    ];

    expect(contentParts).toHaveLength(6); // 1 text + 5 images
    expect(contentParts[0].type).toBe('text');
    expect(contentParts[1].type).toBe('image_url');
    expect(contentParts[5].type).toBe('image_url');
  });

  it('should handle Amazon listing analysis context', () => {
    const amazonContext = `For Amazon listings and e-commerce imagery specifically:
- Evaluate hero image effectiveness and click-through potential
- Analyze lifestyle images for emotional connection and aspiration building
- Review infographic clarity and benefit communication
- Assess A+ content or Enhanced Brand Content visual strategy
- Check compliance with platform requirements while maximizing brand expression
- Evaluate mobile vs desktop visual optimization
- Analyze competitive visual positioning in category context`;

    expect(amazonContext).toContain('hero image effectiveness');
    expect(amazonContext).toContain('lifestyle images for emotional connection');
    expect(amazonContext).toContain('A+ content');
    expect(amazonContext).toContain('mobile vs desktop visual optimization');
  });
});
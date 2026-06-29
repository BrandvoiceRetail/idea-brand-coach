/**
 * Layer 2 (tool) — `generate_listing_image` (OWNED — the brief-driven image generator).
 *
 * The executor that pairs with `generate_listing_image_brief`: the brief tool produces
 * the IDEA brief + IMAGE_PROMPT, this turns a prompt (+ the real product photo as a
 * reference) into an actual image via the `gemini-image-generate` edge function — Google's
 * Gemini API with Nano Banana Pro (Gemini 3 Pro Image), a reference-conditioned model that
 * keeps the real product accurate instead of inventing one.
 *
 * Unlike ASIN-in/we-decide tools (Genrupt, Pixii), the prompt + reference ARE the input,
 * so the IDEA brief drives the pixels. Requires an authenticated Supabase JWT (the edge
 * fn is identity-gated). The image is persisted to the private brand-assets bucket; the
 * tool returns durable storage paths + signed display URLs.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { EdgeFnClient } from '../edgeFn/client.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

interface ImageResult {
  ok: boolean;
  status?: string;
  model?: string;
  images?: Array<{ storage_path: string; signed_url: string | null; source_url: string }>;
  error?: string;
  code?: string;
}

const inputSchema = {
  prompt: z
    .string()
    .min(10)
    .describe('The IMAGE_PROMPT for one slot (from generate_listing_image_brief): subject, scene, lighting, on-image copy, negative prompt.'),
  reference_image_urls: z
    .array(z.string().url())
    .optional()
    .describe('The real product photo URL(s). Strongly recommended — the reference keeps the actual product accurate (required for the main image; a generated product is not your product).'),
  model: z.string().optional().describe('Gemini image model override (default: GEMINI_IMAGE_MODEL, Nano Banana Pro / gemini-3-pro-image-preview).'),
  aspect_ratio: z
    .enum(['1:1', '4:3', '3:4', '16:9', '9:16'])
    .optional()
    .describe('Aspect ratio. Default 1:1 — the Amazon main/gallery shape. Use a wide/tall ratio only for off-Amazon creative.'),
  image_size: z
    .enum(['1K', '2K', '4K'])
    .optional()
    .describe('Resolution tier. Default 2K → 2048x2048 at 1:1 (Amazon zoom-eligible). 4K for hero/print.'),
};

export function registerGenerateListingImageTool(server: McpServer, edgeFn: EdgeFnClient): void {
  server.registerTool(
    'generate_listing_image',
    {
      title: 'Generate a listing image (brief-driven)',
      description:
        'Turn one slot\'s IMAGE_PROMPT (from generate_listing_image_brief) plus the real product photo into an actual image, via a reference-conditioned generator we own: Google\'s Gemini API with Nano Banana Pro (Gemini 3 Pro Image). The prompt + reference image ARE the input, so the IDEA brief drives the result — and the real product stays accurate (it never invents a product). Outputs 2048x2048 by default (1:1 @ 2K — Amazon zoom-eligible). Persists to the private brand-assets bucket and returns storage paths + signed display URLs. Requires an authenticated Supabase JWT. For the MAIN image, always pass the real product photo as reference and keep the background pure white with no added text/badges (Amazon policy).',
      inputSchema,
    },
    async ({ prompt, reference_image_urls, model, aspect_ratio, image_size }) => {
      const identity = getIdentity();
      const res = await edgeFn.invoke<ImageResult>('gemini-image-generate', {
        prompt,
        referenceImageUrls: reference_image_urls,
        model,
        aspectRatio: aspect_ratio,
        imageSize: image_size,
      });
      if (!res.ok || !res.data) {
        safeLog({ level: 'warn', event: 'tool.generate_listing_image.unavailable', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `generate_listing_image unavailable: ${res.note ?? 'sign in required, or the generator is unreachable'}` }],
          structuredContent: { ok: false, images: [], note: res.note ?? 'unavailable' },
        };
      }
      const data = res.data;
      if (!data.ok) {
        safeLog({ event: 'tool.generate_listing_image.failed', caller: userTag(identity), code: data.code ?? null });
        return {
          content: [{ type: 'text' as const, text: `generate_listing_image failed: ${data.error ?? 'unknown error'}${data.code === 'NOT_CONFIGURED' ? ' (set the GEMINI_API_KEY secret)' : ''}` }],
          structuredContent: { ok: false, images: [], error: data.error ?? 'failed', code: data.code ?? null },
        };
      }
      const images = data.images ?? [];
      safeLog({ event: 'tool.generate_listing_image', caller: userTag(identity), model: data.model ?? null, count: images.length });
      return {
        content: [{ type: 'text' as const, text: `Generated ${images.length} image(s) with ${data.model ?? 'fal'} and stored them.\n\n${JSON.stringify({ images }, null, 2)}` }],
        structuredContent: { ok: true, model: data.model ?? null, images },
      };
    },
  );
}

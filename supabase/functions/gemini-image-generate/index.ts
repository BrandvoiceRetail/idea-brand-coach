import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { encode as base64Encode, decode as base64Decode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthedUserId, getServiceClient, jsonResponse } from '../_shared/edge-auth.ts';
import {
  generateImage,
  resolveGeminiImageModel,
  validateGeminiImageInput,
  type InlineImage,
} from '../_shared/gemini.ts';
import { createRateLimiter } from '../_shared/rateLimit.ts';

/**
 * gemini-image-generate — the brief-driven image generator we own, on Google's own
 * Gemini API with Nano Banana Pro (Gemini 3 Pro Image). Pairs with the brand-coach
 * `generate_listing_image_brief` tool: the coach composes the IDEA brief + IMAGE_PROMPT,
 * this turns that prompt (+ the real product photo as a reference) into an actual image.
 *
 * Synchronous (Gemini is request/response, not a queue): fetch the reference photo(s) →
 * generateContent → decode the returned image(s) → store in the private `brand-assets`
 * bucket → return durable storage paths + signed display URLs. One call, one result.
 *
 * Auth: caller derived from the verified JWT (getAuthedUserId); GEMINI_API_KEY stays
 * server-side. The reference keeps the real product accurate — it never invents a product.
 */

const BUCKET = 'brand-assets';
const SIGNED_URL_TTL_SECONDS = 3600;
const MAX_REFERENCES = 4;
const MAX_REF_BYTES = 12 * 1024 * 1024; // 12MB per reference image

const createLimiter = createRateLimiter(15, 60_000);

interface CreateBody {
  prompt?: string;
  referenceImageUrls?: string[];
  model?: string;
  /** Aspect ratio (default 1:1 for Amazon). */
  aspectRatio?: string;
  /** Resolution tier "1K"|"2K"|"4K" (default 2K → 2048x2048 at 1:1 for Amazon). */
  imageSize?: string;
}

function fail(error: string, extra: Record<string, unknown> = {}): Response {
  return jsonResponse({ ok: false, error, ...extra }, 200);
}

/** Basic SSRF guard: https only, no localhost / private-range hosts. */
function isSafeRemoteImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.localhost')) return false;
    if (/^(127\.|0\.|10\.|169\.254\.|192\.168\.)/.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    if (h === '::1' || h === '0.0.0.0') return false;
    return true;
  } catch {
    return false;
  }
}

/** Fetch a reference image url and return it as an inline (base64) image, or null. */
async function fetchReference(url: string): Promise<InlineImage | null> {
  if (!isSafeRemoteImageUrl(url)) {
    console.warn('gemini-image-generate: refusing unsafe reference url');
    return null;
  }
  try {
    const resp = await fetch(url);
    if (!resp.ok) { console.warn('gemini-image-generate: reference fetch failed', resp.status); return null; }
    const ct = resp.headers.get('content-type') ?? 'image/png';
    if (!ct.startsWith('image/')) { console.warn('gemini-image-generate: reference is not an image', ct); return null; }
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > MAX_REF_BYTES) { console.warn('gemini-image-generate: reference too large', buf.byteLength); return null; }
    return { mimeType: ct.split(';')[0], dataB64: base64Encode(buf) };
  } catch (err) {
    console.warn('gemini-image-generate: reference fetch error', err instanceof Error ? err.message : err);
    return null;
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
    if (createLimiter.isRateLimited(userId)) return jsonResponse({ ok: false, error: 'rate_limited' }, 429);

    const body = (await req.json().catch(() => ({}))) as CreateBody;
    const prompt = (body.prompt ?? '').trim();
    const invalid = validateGeminiImageInput({ prompt });
    if (invalid) return fail(invalid);

    // Fetch reference photo(s) → inline base64 (keeps the real product accurate).
    const refUrls = (body.referenceImageUrls ?? []).slice(0, MAX_REFERENCES);
    const referenceImages: InlineImage[] = [];
    for (const url of refUrls) {
      const ref = await fetchReference(url);
      if (ref) referenceImages.push(ref);
    }

    const model = resolveGeminiImageModel(body.model);
    const result = await generateImage(model, { prompt, referenceImages, aspectRatio: body.aspectRatio, imageSize: body.imageSize });
    if (result.status === 'not_configured') {
      return fail('Image generation is not configured. Set the GEMINI_API_KEY secret.', { code: 'NOT_CONFIGURED' });
    }
    if (result.status === 'error') {
      return fail(result.message, { httpStatus: result.httpStatus, code: 'GEMINI_ERROR' });
    }

    const svc = getServiceClient();
    const folder = crypto.randomUUID();
    const images = await persistImages(svc, userId, folder, result.images);
    if (!images.length) return fail('Could not store the generated image.', { code: 'PERSIST_FAILED' });

    return jsonResponse({ ok: true, status: 'completed', model, images });
  } catch (err) {
    console.error('gemini-image-generate error:', err instanceof Error ? err.message : err);
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : 'gemini-image-generate failed' }, 500);
  }
});

interface PersistedImage {
  storage_path: string;
  signed_url: string | null;
  /** base64 bytes + mime, so the caller (MCP tool) can emit an inline image content
   *  block for the connector to render. Echoed back to the model, NOT to logs. */
  b64: string;
  mimeType: string;
}

/** Decode each returned base64 image into the private bucket; return paths + signed urls + b64. */
async function persistImages(
  svc: ReturnType<typeof getServiceClient>,
  userId: string,
  folder: string,
  images: InlineImage[],
): Promise<PersistedImage[]> {
  const out: PersistedImage[] = [];
  for (let i = 0; i < images.length; i++) {
    try {
      const ct = images[i].mimeType || 'image/png';
      const bytes = base64Decode(images[i].dataB64);
      const ext = ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : ct.includes('webp') ? 'webp' : 'png';
      const path = `${userId}/coach/generated/${folder}/${i}.${ext}`;
      const { error: upErr } = await svc.storage.from(BUCKET).upload(path, bytes, { contentType: ct, upsert: true });
      if (upErr) { console.warn('gemini-image-generate: storage upload failed', upErr.message); continue; }
      const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      out.push({ storage_path: path, signed_url: signed?.signedUrl ?? null, b64: images[i].dataB64, mimeType: ct });
    } catch (err) {
      console.warn('gemini-image-generate: persist error', err instanceof Error ? err.message : err);
    }
  }
  return out;
}

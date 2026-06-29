/**
 * Gemini image client (Content-Generation — BRIEF-DRIVEN image provider).
 *
 * Calls Google's Gemini API directly (generativelanguage.googleapis.com) with the
 * "Nano Banana Pro" image model (Gemini 3 Pro Image). Unlike fal/Pixii/Genrupt this is
 * the model's own endpoint — no reseller markup — and it is reference-conditioned: pass
 * the real product photo(s) as inline image parts and the model edits them into the
 * briefed scene rather than inventing a product. That is what keeps an Amazon main image
 * the actual product, and it is where the IDEA brief becomes the input that drives the pixels.
 *
 * Boundary discipline (mirrors _shared/fal.ts):
 *  - Never throws across the public boundary; every method returns a typed result with a
 *    discriminating `status` so the edge function can branch.
 *  - Credentials resolved lazily (no top-level Deno.env read) so it imports under vitest.
 *  - Relays only what Gemini returns; never fabricates an image.
 *
 * Request: POST {base}/models/{model}:generateContent with contents[].parts of a text
 * prompt plus optional inlineData reference images; responseModalities includes IMAGE.
 * Response: candidates[0].content.parts[] where an image part carries inlineData.{mimeType,data}.
 */

const GEMINI_DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';
/** Nano Banana Pro = Gemini 3 Pro Image. Override with GEMINI_IMAGE_MODEL. */
const GEMINI_DEFAULT_IMAGE_MODEL = 'gemini-3-pro-image-preview';

// ── Config ───────────────────────────────────────────────────────────────────

export interface GeminiConfig {
  apiKey: string;
  base: string;
}

type DenoEnv = { get(k: string): string | undefined };
function readEnv(): DenoEnv | undefined {
  const g = globalThis as { Deno?: { env?: DenoEnv } };
  return typeof g.Deno !== 'undefined' ? g.Deno?.env : undefined;
}

/** Resolve Gemini config. Returns null when no key is set (the not_configured case). */
export function resolveGeminiConfig(override?: Partial<GeminiConfig>): GeminiConfig | null {
  const env = readEnv();
  const apiKey = override?.apiKey ?? env?.get('GEMINI_API_KEY') ?? env?.get('GOOGLE_API_KEY');
  if (!apiKey) return null;
  const base = (override?.base ?? env?.get('GEMINI_API_BASE') ?? GEMINI_DEFAULT_BASE).replace(/\/+$/, '');
  return { apiKey, base };
}

/** The configured default image model (env GEMINI_IMAGE_MODEL, else Nano Banana Pro). */
export function resolveGeminiImageModel(override?: string): string {
  if (override?.trim()) return override.trim();
  return readEnv()?.get('GEMINI_IMAGE_MODEL')?.trim() || GEMINI_DEFAULT_IMAGE_MODEL;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface InlineImage {
  mimeType: string;
  /** base64-encoded image bytes (no data: prefix). */
  dataB64: string;
}

export interface GeminiImageInput {
  prompt: string;
  /** Reference image(s) — the real product photo(s), already fetched + base64-encoded. */
  referenceImages?: InlineImage[];
}

export type GeminiImageResult =
  | { status: 'ok'; images: InlineImage[] }
  | { status: 'not_configured' }
  | { status: 'error'; httpStatus?: number; message: string };

// ── Pure helpers (exported for tests) ────────────────────────────────────────

export function validateGeminiImageInput(input: Partial<GeminiImageInput>): string | null {
  if (!input.prompt || !input.prompt.trim()) return 'prompt is required';
  if (input.referenceImages && input.referenceImages.some((r) => !r?.dataB64 || !r?.mimeType)) {
    return 'each reference image needs mimeType + dataB64';
  }
  return null;
}

/** Build the generateContent request body (camelCase JSON, accepted by v1beta). */
export function buildGeminiRequest(input: GeminiImageInput): Record<string, unknown> {
  const parts: Array<Record<string, unknown>> = [{ text: input.prompt.trim() }];
  for (const ref of input.referenceImages ?? []) {
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.dataB64 } });
  }
  return {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  };
}

/** Extract inline image parts from a generateContent response (handles common shapes). */
export function extractInlineImages(json: unknown): InlineImage[] {
  const r = json as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }> } }> } | null;
  const parts = r?.candidates?.[0]?.content?.parts ?? [];
  const out: InlineImage[] = [];
  for (const p of parts) {
    const inline = p.inlineData ?? p.inline_data;
    const data = (inline as { data?: string } | undefined)?.data;
    const mimeType = (p.inlineData?.mimeType ?? p.inline_data?.mime_type) || 'image/png';
    if (data) out.push({ mimeType, dataB64: data });
  }
  return out;
}

function errMessage(body: unknown, fallback: string): string {
  const b = body as { error?: { message?: string } | string } | null;
  if (b && typeof b.error === 'object' && typeof b.error?.message === 'string') return b.error.message;
  if (typeof b?.error === 'string') return b.error;
  return fallback;
}

// ── HTTP (never-throws) ──────────────────────────────────────────────────────

/** Transient statuses worth retrying — the Nano Banana Pro preview model returns
 *  intermittent 404s and occasional 5xx that succeed on a retry. */
export function isTransientGeminiStatus(httpStatus: number): boolean {
  return httpStatus === 404 || httpStatus === 429 || httpStatus === 503 || httpStatus === 500;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** One generateContent attempt (no retry). */
async function generateImageOnce(config: GeminiConfig, model: string, input: GeminiImageInput, timeoutMs: number): Promise<GeminiImageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${config.base}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      body: JSON.stringify(buildGeminiRequest(input)),
      signal: controller.signal,
    });
    const json = await resp.json().catch(() => null);
    if (!resp.ok) return { status: 'error', httpStatus: resp.status, message: errMessage(json, `gemini http ${resp.status}`) };
    const images = extractInlineImages(json);
    if (!images.length) return { status: 'error', httpStatus: resp.status, message: 'gemini: response had no image (the model may have refused or returned text only)' };
    return { status: 'ok', images };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'gemini request failed' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST {model}:generateContent — generate image(s) from a prompt + optional references.
 * Retries transient failures (the preview model 404s intermittently) up to `maxAttempts`.
 */
export async function generateImage(model: string, input: GeminiImageInput, override?: Partial<GeminiConfig>, timeoutMs = 90000, maxAttempts = 3): Promise<GeminiImageResult> {
  const config = resolveGeminiConfig(override);
  if (!config) return { status: 'not_configured' };
  let last: GeminiImageResult = { status: 'error', message: 'gemini: no attempt made' };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await generateImageOnce(config, model, input, timeoutMs);
    if (last.status === 'ok') return last;
    if (last.status === 'error' && last.httpStatus != null && isTransientGeminiStatus(last.httpStatus) && attempt < maxAttempts) {
      await sleep(1500 * attempt);
      continue;
    }
    return last;
  }
  return last;
}

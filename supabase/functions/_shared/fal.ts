/**
 * fal.ai client (Content-Generation feature — cloud VIDEO provider).
 *
 * fal.ai (https://fal.ai) is an async, queue-based generation API. It powers the
 * native-video funnel pieces of the Brand Funnel Tracker's generate-content
 * interface as the CLOUD default (the sibling local option is Palmier):
 *   - social_video → a short paid-social video ad (TikTok / Reels / Meta)
 *   - ugc_video    → a UGC-style short-form clip
 *
 * Unlike Palmier (a local desktop app), fal returns a DOWNLOADABLE MP4 url, so the
 * fal-video-generate edge function persists the file into the `brand-assets` bucket
 * exactly like pixii-generate — which is why it works in prod for every user with
 * no local app or tunnel.
 *
 * Boundary discipline (mirrors _shared/pixii.ts):
 *  - Never throws across the public boundary. Every method returns a typed result
 *    with a discriminating `status` so the edge function can branch.
 *  - Credentials are resolved lazily (no top-level `Deno.env` read), so this module
 *    imports cleanly under vitest. `apiKey`/`queueBase`/`model` can be injected.
 *  - This client only RELAYS what fal returns. It never fabricates a clip.
 *
 * Async (queue) pattern: POST queue.fal.run/{model} → { request_id, status_url,
 * response_url }; poll GET status_url until status is COMPLETED; GET response_url
 * for the output `{ video: { url } }`. The output url is a fal CDN link, so the
 * caller persists it to durable storage.
 */

const FAL_DEFAULT_QUEUE_BASE = 'https://queue.fal.run';
/** Default text-to-video model; override with FAL_VIDEO_MODEL. */
const FAL_DEFAULT_VIDEO_MODEL = 'fal-ai/bytedance/seedance/v1/lite/text-to-video';

// ── Config ───────────────────────────────────────────────────────────────────

export interface FalConfig {
  apiKey: string;
  queueBase: string;
}

type DenoEnv = { get(k: string): string | undefined };
function readEnv(): DenoEnv | undefined {
  const g = globalThis as { Deno?: { env?: DenoEnv } };
  return typeof g.Deno !== 'undefined' ? g.Deno?.env : undefined;
}

/** Resolve fal config. Returns null when no FAL_KEY is set (the not_configured case). */
export function resolveFalConfig(override?: Partial<FalConfig>): FalConfig | null {
  const env = readEnv();
  const apiKey = override?.apiKey ?? env?.get('FAL_KEY');
  if (!apiKey) return null;
  const queueBase = (override?.queueBase ?? env?.get('FAL_QUEUE_BASE') ?? FAL_DEFAULT_QUEUE_BASE).replace(/\/+$/, '');
  return { apiKey, queueBase };
}

/** The configured default video model (env FAL_VIDEO_MODEL, else the built-in default). */
export function resolveFalVideoModel(override?: string): string {
  if (override?.trim()) return override.trim();
  return readEnv()?.get('FAL_VIDEO_MODEL')?.trim() || FAL_DEFAULT_VIDEO_MODEL;
}

// ── Result types ─────────────────────────────────────────────────────────────

export type FalStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED';
export type GenerationStatus = 'processing' | 'completed' | 'failed';

export interface FalVideoInput {
  prompt: string;
  aspectRatio?: string;
  durationS?: number;
}

export type FalSubmitResult =
  | { status: 'ok'; requestId: string; statusUrl: string; responseUrl: string }
  | { status: 'not_configured' }
  | { status: 'error'; httpStatus?: number; message: string };

export type FalStatusResult =
  | { status: 'ok'; falStatus: FalStatus; generation: GenerationStatus }
  | { status: 'not_configured' }
  | { status: 'error'; httpStatus?: number; message: string };

export type FalResultResult =
  | { status: 'ok'; videoUrl: string; contentType?: string }
  | { status: 'not_configured' }
  | { status: 'error'; httpStatus?: number; message: string };

// ── Pure helpers (validation, parsing, SSRF guard) — exported for tests ──────

/** Validate a video input; returns a human error string or null. */
export function validateFalVideoInput(input: Partial<FalVideoInput>): string | null {
  if (!input.prompt || !input.prompt.trim()) return 'prompt is required';
  if (input.durationS != null && (!Number.isFinite(input.durationS) || input.durationS <= 0)) {
    return 'durationS, if provided, must be a positive number';
  }
  return null;
}

/**
 * Build the fal model input, omitting empty optionals. `aspect_ratio`/`duration`
 * are passed as strings (the shape most fal video models accept); a model that
 * ignores or rejects one surfaces a normal fal error.
 */
export function buildFalVideoInput(input: FalVideoInput): Record<string, unknown> {
  const out: Record<string, unknown> = { prompt: input.prompt.trim() };
  if (input.aspectRatio?.trim()) out.aspect_ratio = input.aspectRatio.trim();
  if (input.durationS != null) out.duration = String(Math.round(input.durationS));
  return out;
}

/** Map fal's queue status to our normalized status. */
export function mapFalStatus(falStatus: string): GenerationStatus {
  return falStatus === 'COMPLETED' ? 'completed' : 'processing';
}

/** Extract the output video url from a fal result payload (handles common shapes). */
export function extractVideoUrl(result: unknown): string | null {
  const r = result as { video?: { url?: string }; videos?: Array<{ url?: string }>; output?: { video?: { url?: string } } } | null;
  return r?.video?.url ?? r?.videos?.[0]?.url ?? r?.output?.video?.url ?? null;
}

/**
 * SSRF guard for the download step: only fetch from fal's own CDN over HTTPS. The
 * output is produced by fal (authenticated by our key), but we still refuse to
 * fetch arbitrary hosts before writing them into our storage bucket.
 */
export function isFalCdnUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname;
    return h === 'fal.media' || h.endsWith('.fal.media') || h.endsWith('.fal.run');
  } catch {
    return false;
  }
}

// ── HTTP (never-throws) ──────────────────────────────────────────────────────

async function falFetch(url: string, apiKey: string, init: RequestInit, timeoutMs: number): Promise<Response | { __err: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      headers: { Authorization: `Key ${apiKey}`, ...(init.headers ?? {}) },
      signal: controller.signal,
    });
  } catch (error) {
    return { __err: error instanceof Error ? error.message : 'fal request failed' };
  } finally {
    clearTimeout(timer);
  }
}

function errMessage(body: unknown, fallback: string): string {
  const b = body as { detail?: unknown; message?: string } | null;
  if (typeof b?.message === 'string') return b.message;
  if (typeof b?.detail === 'string') return b.detail;
  if (Array.isArray(b?.detail) && b.detail[0] && typeof (b.detail[0] as { msg?: string }).msg === 'string') {
    return (b.detail[0] as { msg: string }).msg;
  }
  return fallback;
}

/** POST queue.fal.run/{model} — submit a text-to-video job; returns the queue urls. */
export async function submitTextToVideo(model: string, input: FalVideoInput, override?: Partial<FalConfig>, timeoutMs = 20000): Promise<FalSubmitResult> {
  const config = resolveFalConfig(override);
  if (!config) return { status: 'not_configured' };
  const resp = await falFetch(
    `${config.queueBase}/${model}`,
    config.apiKey,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildFalVideoInput(input)) },
    timeoutMs,
  );
  if ('__err' in resp) return { status: 'error', message: resp.__err };
  const json = await resp.json().catch(() => null);
  if (!resp.ok) return { status: 'error', httpStatus: resp.status, message: errMessage(json, `fal http ${resp.status}`) };
  const data = json as { request_id?: string; status_url?: string; response_url?: string } | null;
  if (!data?.request_id || !data.status_url || !data.response_url) {
    return { status: 'error', httpStatus: resp.status, message: 'fal: submit response missing request_id/urls' };
  }
  return { status: 'ok', requestId: data.request_id, statusUrl: data.status_url, responseUrl: data.response_url };
}

/** GET status_url — poll the queue status. */
export async function getQueueStatus(statusUrl: string, override?: Partial<FalConfig>, timeoutMs = 8000): Promise<FalStatusResult> {
  const config = resolveFalConfig(override);
  if (!config) return { status: 'not_configured' };
  const resp = await falFetch(statusUrl, config.apiKey, { method: 'GET' }, timeoutMs);
  if ('__err' in resp) return { status: 'error', message: resp.__err };
  const json = await resp.json().catch(() => null);
  if (!resp.ok) return { status: 'error', httpStatus: resp.status, message: errMessage(json, `fal http ${resp.status}`) };
  const falStatus = (json as { status?: string } | null)?.status as FalStatus | undefined;
  if (!falStatus) return { status: 'error', httpStatus: resp.status, message: 'fal: status response missing status' };
  return { status: 'ok', falStatus, generation: mapFalStatus(falStatus) };
}

/** GET response_url — fetch the completed job's output and pull the video url. */
export async function getQueueResult(responseUrl: string, override?: Partial<FalConfig>, timeoutMs = 15000): Promise<FalResultResult> {
  const config = resolveFalConfig(override);
  if (!config) return { status: 'not_configured' };
  const resp = await falFetch(responseUrl, config.apiKey, { method: 'GET' }, timeoutMs);
  if ('__err' in resp) return { status: 'error', message: resp.__err };
  const json = await resp.json().catch(() => null);
  if (!resp.ok) return { status: 'error', httpStatus: resp.status, message: errMessage(json, `fal http ${resp.status}`) };
  const videoUrl = extractVideoUrl(json);
  if (!videoUrl) return { status: 'error', httpStatus: resp.status, message: 'fal: result had no video url' };
  const contentType = (json as { video?: { content_type?: string } } | null)?.video?.content_type;
  return { status: 'ok', videoUrl, contentType };
}

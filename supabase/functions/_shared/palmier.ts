/**
 * Palmier MCP client (Content-Generation feature — VIDEO provider).
 *
 * Palmier Pro (https://www.palmier.io) is an AI-native macOS video editor that
 * runs a LOCAL MCP server on http://127.0.0.1:19789/mcp. It powers the native-video
 * funnel pieces of the Brand Funnel Tracker's generate-content interface:
 *   - social_video → a short paid-social video ad (TikTok / Reels / Meta)
 *   - ugc_video    → a UGC-style short-form clip
 *
 * Unlike Pixii (a cloud HTTP API), Palmier is a desktop app reachable only where
 * it runs. From the cloud (a Supabase edge function) 127.0.0.1 is the runtime's
 * own loopback, NOT the user's Mac, so calls fail fast and the caller degrades to
 * a ready-to-run brief. To drive Palmier from prod, expose it via a tunnel and set
 * PALMIER_MCP_URL — Palmier validates Origin === localhost, so this client sends a
 * configurable localhost `Origin` header (PALMIER_ORIGIN) that the tunnel forwards.
 *
 * Boundary discipline (mirrors _shared/pixii.ts):
 *  - Never throws across the public boundary. Every method returns a typed result
 *    with a discriminating `status` so the edge function can branch.
 *  - Credentials are resolved lazily (no top-level `Deno.env` read), so this module
 *    imports cleanly under vitest. `url`/`origin` can be injected.
 *  - This client only RELAYS what Palmier returns. It never fabricates a clip.
 *
 * Async pattern: `generate_video` is fire-and-poll. tools/call returns TEXT only —
 * "Generation started. Placeholder asset ID: <id>…" (no structuredContent) — so the
 * placeholder id is parsed out. There is NO status tool; completion is read from
 * `get_media`'s per-asset `generationStatus` (generating | downloading | failed | none).
 * Generation also requires a signed-in + credited Palmier account; the gate comes
 * back as a tools/call result with `isError: true`.
 */

const PALMIER_DEFAULT_URL = 'http://127.0.0.1:19789/mcp';
const PALMIER_DEFAULT_ORIGIN = 'http://127.0.0.1:19789';
const MCP_PROTOCOL_VERSION = '2025-06-18';

// ── Config ───────────────────────────────────────────────────────────────────

export interface PalmierConfig {
  /** Full MCP endpoint, e.g. http://127.0.0.1:19789/mcp or a tunnel https URL. */
  url: string;
  /** Origin header Palmier's validator requires (must read as localhost). */
  origin: string;
}

type DenoEnv = { get(k: string): string | undefined };
function readEnv(): DenoEnv | undefined {
  const g = globalThis as { Deno?: { env?: DenoEnv } };
  return typeof g.Deno !== 'undefined' ? g.Deno?.env : undefined;
}

/**
 * Resolve Palmier config. Defaults to the local app endpoint; returns null only
 * when explicitly disabled (PALMIER_ENABLED=false) so ops can hard-off the tool.
 */
export function resolvePalmierConfig(override?: Partial<PalmierConfig>): PalmierConfig | null {
  const env = readEnv();
  if ((env?.get('PALMIER_ENABLED') ?? '').toLowerCase() === 'false') return null;
  const url = (override?.url ?? env?.get('PALMIER_MCP_URL') ?? PALMIER_DEFAULT_URL).trim();
  if (!url) return null;
  const origin = (override?.origin ?? env?.get('PALMIER_ORIGIN') ?? PALMIER_DEFAULT_ORIGIN).trim();
  return { url, origin };
}

// ── Result types ─────────────────────────────────────────────────────────────

export interface PalmierVideoInput {
  prompt: string;
  /** Palmier model id; omit ⇒ Palmier picks its first available model. */
  model?: string;
  durationS?: number;
  aspect?: string;
  resolution?: string;
  /** Palmier media ref for image-to-video first frame (already imported into Palmier). */
  startFrameMediaRef?: string;
  referenceImageMediaRefs?: string[];
}

/** Our normalized generation status, mapped from Palmier's per-asset value. */
export type GenerationStatus = 'processing' | 'completed' | 'failed';

export type PalmierGenerateResult =
  | { status: 'ok'; placeholderId: string; raw: string }
  | { status: 'not_configured' }
  | { status: 'unreachable'; message: string }
  | { status: 'tool_error'; code: 'NEEDS_SIGNIN' | 'NO_CREDITS' | 'TOOL_ERROR'; message: string }
  | { status: 'error'; httpStatus?: number; message: string };

export type PalmierStatusResult =
  | { status: 'ok'; generation: GenerationStatus; palmierStatus: string }
  | { status: 'not_configured' }
  | { status: 'unreachable'; message: string }
  | { status: 'unknown'; message: string } // reachable, but the asset/status wasn't found
  | { status: 'error'; httpStatus?: number; message: string };

// ── Pure helpers (validation, parsing) — exported for tests ──────────────────

/** Validate a video input; returns a human error string or null. */
export function validateVideoInput(input: Partial<PalmierVideoInput>): string | null {
  if (!input.prompt || !input.prompt.trim()) return 'prompt is required';
  if (input.durationS != null && (!Number.isFinite(input.durationS) || input.durationS <= 0)) {
    return 'durationS, if provided, must be a positive number';
  }
  return null;
}

/** Build the `generate_video` arguments, omitting empty optionals (so Palmier defaults apply). */
export function buildVideoArguments(input: PalmierVideoInput): Record<string, unknown> {
  const args: Record<string, unknown> = { prompt: input.prompt.trim() };
  if (input.model?.trim()) args.model = input.model.trim();
  if (input.durationS != null) args.duration = Math.round(input.durationS);
  if (input.aspect?.trim()) args.aspectRatio = input.aspect.trim();
  if (input.resolution?.trim()) args.resolution = input.resolution.trim();
  if (input.startFrameMediaRef?.trim()) args.startFrameMediaRef = input.startFrameMediaRef.trim();
  if (input.referenceImageMediaRefs?.length) args.referenceImageMediaRefs = input.referenceImageMediaRefs;
  return args;
}

/** Pull the placeholder asset id out of a `generate_video` text result. */
export function parsePlaceholderId(text: string): string | null {
  const m = text.match(/Placeholder asset ID:\s*([A-Za-z0-9_.\-]+)/);
  return m ? m[1].replace(/[.\s]+$/, '') : null;
}

/** Classify an `isError` tool result into an actionable code. */
export function classifyToolError(text: string): 'NEEDS_SIGNIN' | 'NO_CREDITS' | 'TOOL_ERROR' {
  const t = text.toLowerCase();
  if (t.includes('credit')) return 'NO_CREDITS';
  if (t.includes('sign in') || t.includes('signing in') || t.includes('sign-in')) return 'NEEDS_SIGNIN';
  return 'TOOL_ERROR';
}

/** Map Palmier's per-asset generationStatus to our normalized status. */
export function mapPalmierStatus(palmierStatus: string): GenerationStatus {
  switch (palmierStatus) {
    case 'failed':
      return 'failed';
    case 'none':
      return 'completed'; // no longer generating ⇒ the asset is ready/usable
    case 'generating':
    case 'downloading':
    default:
      return 'processing';
  }
}

/** True for a loopback endpoint (informational — tunnels intentionally aren't). */
export function looksLikeLoopback(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === '127.0.0.1' || h === 'localhost' || h === '::1';
  } catch {
    return false;
  }
}

interface RpcEnvelope {
  jsonrpc?: string;
  id?: number | string | null;
  result?: unknown;
  error?: { code?: number; message?: string };
}

/**
 * Parse an MCP Streamable-HTTP response body, which is either a JSON-RPC envelope
 * (Content-Type: application/json) or an SSE stream of them (text/event-stream).
 * Returns the envelope carrying `result`/`error` (preferring a matching id).
 */
export function parseRpcResponse(contentType: string, body: string, expectedId?: number | string): RpcEnvelope | null {
  const tryParse = (s: string): RpcEnvelope | null => {
    try {
      return JSON.parse(s) as RpcEnvelope;
    } catch {
      return null;
    }
  };

  if (contentType.includes('text/event-stream')) {
    const candidates: RpcEnvelope[] = [];
    for (const block of body.split(/\n\n+/)) {
      const data = block
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('\n');
      if (!data) continue;
      const env = tryParse(data);
      if (env && (env.result !== undefined || env.error !== undefined)) candidates.push(env);
    }
    if (!candidates.length) return null;
    if (expectedId !== undefined) {
      const matched = candidates.find((c) => c.id === expectedId);
      if (matched) return matched;
    }
    return candidates[candidates.length - 1];
  }

  return tryParse(body);
}

// ── Transport ────────────────────────────────────────────────────────────────

type RpcOutcome =
  | { status: 'ok'; result: unknown }
  | { status: 'unreachable'; message: string }
  | { status: 'error'; httpStatus?: number; message: string };

let rpcId = 0;

/** Low-level JSON-RPC POST to the Palmier MCP endpoint. Never throws. */
async function mcpCall(
  config: PalmierConfig,
  method: string,
  params: Record<string, unknown>,
  timeoutMs: number,
): Promise<RpcOutcome> {
  const id = ++rpcId;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Origin: config.origin,
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: controller.signal,
    });
    const text = await resp.text();
    if (!resp.ok) return { status: 'error', httpStatus: resp.status, message: `palmier http ${resp.status}` };
    const env = parseRpcResponse(resp.headers.get('content-type') ?? '', text, id);
    if (!env) return { status: 'error', httpStatus: resp.status, message: 'palmier: unparseable MCP response' };
    if (env.error) return { status: 'error', httpStatus: resp.status, message: env.error.message ?? 'palmier rpc error' };
    return { status: 'ok', result: env.result };
  } catch (error) {
    // Connection refused / DNS / timeout (AbortError) all mean "not reachable here".
    const message = error instanceof Error ? error.message : 'palmier request failed';
    return { status: 'unreachable', message };
  } finally {
    clearTimeout(timer);
  }
}

interface ToolCallOk {
  status: 'ok';
  text: string;
  isError: boolean;
  structured: unknown;
}
type ToolCallOutcome = ToolCallOk | { status: 'unreachable'; message: string } | { status: 'error'; httpStatus?: number; message: string };

function textFromContent(result: unknown): string {
  const content = (result as { content?: Array<{ type?: string; text?: string }> } | null)?.content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c?.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
    .join('\n');
}

/** Invoke an MCP tool (`tools/call`) and normalize the CallTool result. */
async function callTool(
  config: PalmierConfig,
  name: string,
  args: Record<string, unknown>,
  timeoutMs: number,
): Promise<ToolCallOutcome> {
  const outcome = await mcpCall(config, 'tools/call', { name, arguments: args }, timeoutMs);
  if (outcome.status !== 'ok') return outcome;
  const result = outcome.result as { isError?: boolean; structuredContent?: unknown } | null;
  return {
    status: 'ok',
    text: textFromContent(outcome.result),
    isError: !!result?.isError,
    structured: result?.structuredContent,
  };
}

// ── Public methods ───────────────────────────────────────────────────────────

/** Quick reachability probe (tools/list). Cheap; used to decide brief-vs-call. */
export async function probe(override?: Partial<PalmierConfig>, timeoutMs = 3000): Promise<{ reachable: boolean; message?: string }> {
  const config = resolvePalmierConfig(override);
  if (!config) return { reachable: false, message: 'not_configured' };
  const outcome = await mcpCall(config, 'tools/list', {}, timeoutMs);
  if (outcome.status === 'ok') return { reachable: true };
  return { reachable: false, message: outcome.message };
}

/** POST generate_video — start an async video generation; returns the placeholder id. */
export async function generateVideo(input: PalmierVideoInput, override?: Partial<PalmierConfig>, timeoutMs = 15000): Promise<PalmierGenerateResult> {
  const config = resolvePalmierConfig(override);
  if (!config) return { status: 'not_configured' };
  const res = await callTool(config, 'generate_video', buildVideoArguments(input), timeoutMs);
  if (res.status === 'unreachable') return { status: 'unreachable', message: res.message };
  if (res.status === 'error') return { status: 'error', httpStatus: res.httpStatus, message: res.message };
  if (res.isError) return { status: 'tool_error', code: classifyToolError(res.text), message: res.text || 'Palmier rejected the generation' };
  const placeholderId = parsePlaceholderId(res.text);
  if (!placeholderId) return { status: 'error', message: 'palmier: could not parse placeholder asset id from result' };
  return { status: 'ok', placeholderId, raw: res.text };
}

/** Poll get_media for one asset's generationStatus, mapped to our status. */
export async function getMediaStatus(mediaRef: string, override?: Partial<PalmierConfig>, timeoutMs = 8000): Promise<PalmierStatusResult> {
  const config = resolvePalmierConfig(override);
  if (!config) return { status: 'not_configured' };
  const res = await callTool(config, 'get_media', { mediaRef }, timeoutMs);
  if (res.status === 'unreachable') return { status: 'unreachable', message: res.message };
  if (res.status === 'error') return { status: 'error', httpStatus: res.httpStatus, message: res.message };
  const palmierStatus = findGenerationStatus(res.structured, res.text, mediaRef);
  if (!palmierStatus) return { status: 'unknown', message: 'asset not found in get_media result' };
  return { status: 'ok', generation: mapPalmierStatus(palmierStatus), palmierStatus };
}

/**
 * Find an asset's `generationStatus` in a get_media result. Prefers structured
 * content (array/object of media), falls back to locating the ref in the text and
 * reading the nearest generationStatus token.
 */
export function findGenerationStatus(structured: unknown, text: string, mediaRef: string): string | null {
  const STATUSES = ['generating', 'downloading', 'failed', 'none'];

  const scanObj = (obj: Record<string, unknown>): string | null => {
    const idLike = String(obj.id ?? obj.mediaRef ?? obj.ref ?? '');
    const status = obj.generationStatus;
    if (idLike === mediaRef && typeof status === 'string') return status;
    return null;
  };

  if (structured && typeof structured === 'object') {
    const items: unknown[] = Array.isArray(structured)
      ? structured
      : Array.isArray((structured as { media?: unknown[] }).media)
        ? ((structured as { media: unknown[] }).media)
        : [structured];
    for (const it of items) {
      if (it && typeof it === 'object') {
        const found = scanObj(it as Record<string, unknown>);
        if (found) return found;
      }
    }
  }

  // Text fallback: find the ref, then the nearest status keyword after it.
  const idx = text.indexOf(mediaRef);
  if (idx >= 0) {
    const window = text.slice(idx, idx + 400).toLowerCase();
    for (const s of STATUSES) {
      if (window.includes(`generationstatus`) && window.includes(s)) return s;
    }
  }
  return null;
}

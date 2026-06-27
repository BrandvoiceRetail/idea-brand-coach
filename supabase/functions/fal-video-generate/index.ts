import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthedUserId, getServiceClient, jsonResponse } from '../_shared/edge-auth.ts';
import {
  submitTextToVideo,
  getQueueStatus,
  getQueueResult,
  resolveFalVideoModel,
  validateFalVideoInput,
  isFalCdnUrl,
  type FalVideoInput,
} from '../_shared/fal.ts';
import { createRateLimiter } from '../_shared/rateLimit.ts';

/**
 * fal-video-generate — the CLOUD video provider behind the Brand Funnel Tracker's
 * generate-content interface. Two branches on one deployable (mirrors pixii-generate):
 *
 *   CREATE  { avatarId, touchpointId, capability, prompt, model?, durationS?, aspect? }
 *           → validates, submits to fal's queue, records a content_generation_jobs row,
 *             returns { ok, jobId, externalJobId, status: 'processing' }.
 *   POLL    { poll: <jobId> }
 *           → polls fal; on completion downloads the MP4 (SSRF-guarded to fal's CDN)
 *             into the private `brand-assets` bucket and returns a durable storage
 *             path + a freshly signed display URL.
 *
 * Auth: caller's user is derived from the verified JWT (getAuthedUserId); the FAL_KEY
 * secret stays server-side and never reaches the browser. Unlike Palmier this runs
 * fully in the cloud, so prod video works for every user with no local app.
 */

const BUCKET = 'brand-assets';
const SIGNED_URL_TTL_SECONDS = 3600;

// Per-isolate sliding-window limiters (shared helper with opportunistic cleanup so
// the hit map can't grow unbounded). Create is stricter (spends fal credits); poll
// is lenient (the UI polls every ~5s).
const createLimiter = createRateLimiter(15, 60_000);
const pollLimiter = createRateLimiter(240, 60_000);

interface CreateBody {
  avatarId: string;
  touchpointId: string;
  capability: string;
  prompt?: string;
  videoPrompt?: string;
  model?: string;
  durationS?: number;
  aspect?: string;
}

function fail(error: string, extra: Record<string, unknown> = {}): Response {
  return jsonResponse({ ok: false, error, ...extra }, 200);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const svc = getServiceClient();

    if (body?.poll) {
      if (pollLimiter.isRateLimited(userId)) return jsonResponse({ ok: false, error: 'rate_limited' }, 429);
      return await handlePoll(svc, userId, String(body.poll));
    }

    if (createLimiter.isRateLimited(userId)) return jsonResponse({ ok: false, error: 'rate_limited' }, 429);
    return await handleCreate(svc, userId, body as CreateBody);
  } catch (err) {
    console.error('fal-video-generate error:', err instanceof Error ? err.message : err);
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : 'fal-video-generate failed' }, 500);
  }
});

async function handleCreate(
  svc: ReturnType<typeof getServiceClient>,
  userId: string,
  body: CreateBody,
): Promise<Response> {
  if (!body?.avatarId || !body?.touchpointId || !body?.capability) {
    return fail('avatarId, touchpointId and capability are required');
  }

  const { data: avatar, error: avErr } = await svc
    .from('avatars')
    .select('id, user_id, brand_id')
    .eq('id', body.avatarId)
    .maybeSingle();
  if (avErr) return jsonResponse({ ok: false, error: 'avatar lookup failed' }, 500);
  if (!avatar || avatar.user_id !== userId) return fail('avatar not found');

  const input: FalVideoInput = {
    prompt: (body.videoPrompt ?? body.prompt ?? '').trim(),
    aspectRatio: body.aspect,
    durationS: body.durationS,
  };
  const invalid = validateFalVideoInput(input);
  if (invalid) return fail(invalid);

  const model = resolveFalVideoModel(body.model);
  const res = await submitTextToVideo(model, input);
  if (res.status === 'not_configured') {
    return fail('Cloud video is not configured. Set the FAL_KEY secret.', { code: 'NOT_CONFIGURED' });
  }
  if (res.status === 'error') {
    return fail(res.message, { httpStatus: res.httpStatus });
  }

  const request = {
    prompt: input.prompt,
    model,
    aspect: input.aspectRatio ?? null,
    duration_s: input.durationS ?? null,
    status_url: res.statusUrl,
    response_url: res.responseUrl,
  };
  const { data: row, error: insErr } = await svc
    .from('content_generation_jobs')
    .insert({
      user_id: userId,
      brand_id: avatar.brand_id,
      avatar_id: body.avatarId,
      touchpoint_id: body.touchpointId,
      provider: 'fal',
      capability: body.capability,
      output_kind: 'video',
      external_job_id: res.requestId,
      status: 'processing',
      request,
    })
    .select('id')
    .single();
  if (insErr) {
    console.error('fal-video-generate insert error:', insErr.message);
    return jsonResponse({ ok: false, error: 'could not record the generation job' }, 500);
  }

  return jsonResponse({ ok: true, jobId: row.id, externalJobId: res.requestId, status: 'processing' });
}

interface PersistedVideo {
  storage_path: string;
  signed_url: string | null;
  source_url: string;
}

async function handlePoll(
  svc: ReturnType<typeof getServiceClient>,
  userId: string,
  jobRowId: string,
): Promise<Response> {
  const { data: row, error: rowErr } = await svc
    .from('content_generation_jobs')
    .select('*')
    .eq('id', jobRowId)
    .eq('user_id', userId)
    .maybeSingle();
  if (rowErr) return jsonResponse({ ok: false, error: 'job lookup failed' }, 500);
  if (!row) return fail('job not found');

  if (row.status === 'completed') {
    const videos = await reSignVideos(svc, (row.output?.videos ?? []) as PersistedVideo[]);
    return jsonResponse({ ok: true, status: 'completed', output: { ...row.output, videos } });
  }
  if (row.status === 'failed') {
    return jsonResponse({ ok: true, status: 'failed', error: row.error });
  }

  const req = (row.request ?? {}) as { status_url?: string; response_url?: string; prompt?: string; model?: string; aspect?: string | null; duration_s?: number | null };
  if (!row.external_job_id || !req.status_url || !req.response_url) {
    return fail('job has no fal queue urls to poll');
  }

  const statusRes = await getQueueStatus(req.status_url);
  if (statusRes.status === 'not_configured') {
    return fail('Cloud video is not configured.', { code: 'NOT_CONFIGURED' });
  }
  if (statusRes.status === 'error') {
    return fail(statusRes.message, { httpStatus: statusRes.httpStatus });
  }
  if (statusRes.generation !== 'completed') {
    return jsonResponse({ ok: true, status: 'processing' });
  }

  // Completed — fetch the result, persist the MP4, return signed display url.
  const resultRes = await getQueueResult(req.response_url);
  if (resultRes.status === 'not_configured') {
    return fail('Cloud video is not configured.', { code: 'NOT_CONFIGURED' });
  }
  if (resultRes.status === 'error') {
    const error = { code: 'FAL_RESULT_ERROR', message: resultRes.message };
    await svc.from('content_generation_jobs').update({ status: 'failed', error }).eq('id', jobRowId);
    return jsonResponse({ ok: true, status: 'failed', error });
  }

  const persisted = await persistVideo(svc, userId, jobRowId, resultRes.videoUrl, resultRes.contentType);
  if (!persisted) {
    const error = { code: 'FAL_PERSIST_FAILED', message: 'Could not store the generated video.' };
    await svc.from('content_generation_jobs').update({ status: 'failed', error }).eq('id', jobRowId);
    return jsonResponse({ ok: true, status: 'failed', error });
  }

  const output = {
    videos: [
      {
        storage_path: persisted.storage_path,
        signed_url: persisted.signed_url,
        source_url: persisted.source_url,
        prompt: req.prompt ?? '',
        model: req.model ?? null,
        duration_s: req.duration_s ?? null,
        aspect: req.aspect ?? null,
      },
    ],
  };
  await svc.from('content_generation_jobs').update({ status: 'completed', output }).eq('id', jobRowId);
  return jsonResponse({ ok: true, status: 'completed', output });
}

/** Download the fal CDN video into the private bucket; return a durable path + signed url. */
async function persistVideo(
  svc: ReturnType<typeof getServiceClient>,
  userId: string,
  jobRowId: string,
  url: string,
  contentType?: string,
): Promise<PersistedVideo | null> {
  if (!isFalCdnUrl(url)) {
    console.warn('fal-video-generate: refusing non-fal video url', url);
    return null;
  }
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn('fal-video-generate: video fetch failed', resp.status, url);
      return null;
    }
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const ct = contentType ?? resp.headers.get('content-type') ?? 'video/mp4';
    const ext = ct.includes('webm') ? 'webm' : ct.includes('quicktime') ? 'mov' : 'mp4';
    const path = `${userId}/funnel/generated/${jobRowId}/0.${ext}`;
    const { error: upErr } = await svc.storage.from(BUCKET).upload(path, bytes, { contentType: ct, upsert: true });
    if (upErr) {
      console.warn('fal-video-generate: storage upload failed', upErr.message);
      return null;
    }
    const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    return { storage_path: path, signed_url: signed?.signedUrl ?? null, source_url: url };
  } catch (err) {
    console.warn('fal-video-generate: video persist error', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Re-sign already-stored videos for a completed job (signed URLs are short-lived). */
async function reSignVideos(
  svc: ReturnType<typeof getServiceClient>,
  videos: PersistedVideo[],
): Promise<PersistedVideo[]> {
  const out: PersistedVideo[] = [];
  for (const v of videos) {
    if (!v.storage_path) { out.push(v); continue; }
    const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(v.storage_path, SIGNED_URL_TTL_SECONDS);
    out.push({ ...v, signed_url: signed?.signedUrl ?? v.signed_url ?? null });
  }
  return out;
}

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthedUserId, getServiceClient, jsonResponse } from '../_shared/edge-auth.ts';
import {
  generateVideo,
  getMediaStatus,
  validateVideoInput,
  type PalmierVideoInput,
} from '../_shared/palmier.ts';

/**
 * palmier-generate — the VIDEO provider behind the Brand Funnel Tracker's
 * generate-content interface. Two branches on one deployable:
 *
 *   CREATE  { avatarId, touchpointId, capability, prompt, model?, durationS?, aspect? }
 *           → validates, attempts the LOCAL Palmier MCP app (generate_video), records
 *             a content_generation_jobs row, and returns either:
 *               · mode 'generating' — Palmier was reachable; an async clip is in flight
 *                 (poll it), or
 *               · mode 'brief' — Palmier wasn't reachable (the usual cloud case) or the
 *                 account needs sign-in/credits; the job parks with a ready-to-run brief.
 *   POLL    { poll: <jobId> }
 *           → reads the asset's generationStatus via get_media; on completion records the
 *             video REFERENCE (Palmier produces a local asset, not a downloadable URL).
 *
 * Auth: caller's user is derived from the verified JWT (getAuthedUserId). Palmier is
 * local and unauthenticated; the PALMIER_MCP_URL / PALMIER_ORIGIN secrets stay
 * server-side. Copy/email pieces route to brand-copy-generator; images to pixii-generate.
 */

// In-memory per-user rate limits (best-effort; resets on cold start). Create is
// stricter because it spends Palmier credits; poll is lenient (UI polls every ~5s).
const CREATE_RL = new Map<string, number[]>();
const POLL_RL = new Map<string, number[]>();
function rateLimited(map: Map<string, number[]>, uid: string, maxPerMin: number): boolean {
  const now = Date.now();
  const arr = (map.get(uid) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= maxPerMin) {
    map.set(uid, arr);
    return true;
  }
  arr.push(now);
  map.set(uid, arr);
  return false;
}

interface CreateBody {
  avatarId: string;
  touchpointId: string;
  capability: string;
  prompt?: string;
  videoPrompt?: string;
  model?: string;
  durationS?: number;
  aspect?: string;
  resolution?: string;
}

interface Brief {
  prompt: string;
  model: string | null;
  duration_s: number | null;
  aspect: string | null;
}

/**
 * Handled, user-actionable failure. Returned as HTTP 200 with `ok:false` so the
 * frontend reads `data.ok`/`data.code` directly rather than unwrapping a
 * FunctionsHttpError stream. Hard failures (401 unauth / 500 crash) stay non-2xx.
 */
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
      if (rateLimited(POLL_RL, userId, 240)) return jsonResponse({ ok: false, error: 'rate_limited' }, 429);
      return await handlePoll(svc, userId, String(body.poll));
    }

    if (rateLimited(CREATE_RL, userId, 15)) return jsonResponse({ ok: false, error: 'rate_limited' }, 429);
    return await handleCreate(svc, userId, body as CreateBody);
  } catch (err) {
    console.error('palmier-generate error:', err instanceof Error ? err.message : err);
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : 'palmier-generate failed' }, 500);
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

  // Ownership: the avatar must belong to the caller. Stamp brand_id for scoping.
  const { data: avatar, error: avErr } = await svc
    .from('avatars')
    .select('id, user_id, brand_id')
    .eq('id', body.avatarId)
    .maybeSingle();
  if (avErr) return jsonResponse({ ok: false, error: 'avatar lookup failed' }, 500);
  if (!avatar || avatar.user_id !== userId) return fail('avatar not found');

  const input: PalmierVideoInput = {
    prompt: (body.videoPrompt ?? body.prompt ?? '').trim(),
    model: body.model,
    durationS: body.durationS,
    aspect: body.aspect,
    resolution: body.resolution,
  };
  const invalid = validateVideoInput(input);
  if (invalid) return fail(invalid);

  const brief: Brief = {
    prompt: input.prompt,
    model: input.model ?? null,
    duration_s: input.durationS ?? null,
    aspect: input.aspect ?? null,
  };
  const request = { ...brief, capability: body.capability, touchpoint_id: body.touchpointId };

  const res = await generateVideo(input);

  // Palmier explicitly disabled → not a brief situation, surface it.
  if (res.status === 'not_configured') {
    return fail('Palmier video is disabled (PALMIER_ENABLED=false).', { code: 'NOT_CONFIGURED' });
  }

  // Reachable + generation started → an async clip is in flight; poll it.
  if (res.status === 'ok') {
    const row = await insertJob(svc, userId, avatar.brand_id, body, request, {
      status: 'processing',
      externalJobId: res.placeholderId,
    });
    if (!row) return jsonResponse({ ok: false, error: 'could not record the generation job' }, 500);
    return jsonResponse({ ok: true, jobId: row, externalJobId: res.placeholderId, status: 'processing', mode: 'generating' });
  }

  // Reachable but the account can't generate (sign-in / credits) → park the brief.
  if (res.status === 'tool_error') {
    const reason = res.code === 'NO_CREDITS' ? 'no_credits' : res.code === 'NEEDS_SIGNIN' ? 'needs_signin' : 'tool_error';
    const row = await insertJob(svc, userId, avatar.brand_id, body, request, {
      status: 'pending',
      output: { brief },
      error: { code: res.code, message: res.message },
    });
    if (!row) return jsonResponse({ ok: false, error: 'could not record the generation job' }, 500);
    return jsonResponse({ ok: true, jobId: row, status: 'pending', mode: 'brief', reason, message: res.message, output: { brief } });
  }

  // Unreachable (the usual cloud case) or transient error → park a ready-to-run brief.
  const reason = res.status === 'unreachable' ? 'unreachable' : 'error';
  const row = await insertJob(svc, userId, avatar.brand_id, body, request, {
    status: 'pending',
    output: { brief },
    error: res.status === 'error' ? { code: 'PALMIER_ERROR', message: res.message } : null,
  });
  if (!row) return jsonResponse({ ok: false, error: 'could not record the generation job' }, 500);
  return jsonResponse({ ok: true, jobId: row, status: 'pending', mode: 'brief', reason, output: { brief } });
}

interface JobFields {
  status: 'pending' | 'processing';
  externalJobId?: string;
  output?: Record<string, unknown>;
  error?: Record<string, unknown> | null;
}

/** Insert a content_generation_jobs row; returns its id or null. */
async function insertJob(
  svc: ReturnType<typeof getServiceClient>,
  userId: string,
  brandId: string | null,
  body: CreateBody,
  request: Record<string, unknown>,
  fields: JobFields,
): Promise<string | null> {
  const { data: row, error: insErr } = await svc
    .from('content_generation_jobs')
    .insert({
      user_id: userId,
      brand_id: brandId,
      avatar_id: body.avatarId,
      touchpoint_id: body.touchpointId,
      provider: 'palmier',
      capability: body.capability,
      output_kind: 'video',
      external_job_id: fields.externalJobId ?? null,
      status: fields.status,
      request,
      output: fields.output ?? null,
      error: fields.error ?? null,
    })
    .select('id')
    .single();
  if (insErr) {
    console.error('palmier-generate insert error:', insErr.message);
    return null;
  }
  return row.id;
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
    return jsonResponse({ ok: true, status: 'completed', output: row.output });
  }
  if (row.status === 'failed') {
    return jsonResponse({ ok: true, status: 'failed', error: row.error });
  }
  // Brief mode (parked, no in-flight Palmier job) — nothing to poll; keep the brief.
  if (row.status === 'pending' || !row.external_job_id) {
    return jsonResponse({ ok: true, status: 'pending', mode: 'brief', output: row.output });
  }

  // In flight — read the asset's generationStatus from Palmier.
  const res = await getMediaStatus(row.external_job_id);
  if (res.status === 'not_configured') {
    return jsonResponse({ ok: true, status: 'processing' }); // can't poll; assume still running
  }
  if (res.status === 'unreachable' || res.status === 'unknown') {
    // Generation continues on the user's machine; keep the client polling.
    return jsonResponse({ ok: true, status: 'processing' });
  }
  if (res.status === 'error') {
    return fail(res.message, { httpStatus: res.httpStatus });
  }

  if (res.generation === 'failed') {
    const error = { code: 'PALMIER_JOB_FAILED', message: 'Palmier could not generate this video.' };
    await svc.from('content_generation_jobs').update({ status: 'failed', error }).eq('id', jobRowId);
    return jsonResponse({ ok: true, status: 'failed', error });
  }

  if (res.generation === 'processing') {
    if (row.status !== 'processing') {
      await svc.from('content_generation_jobs').update({ status: 'processing' }).eq('id', jobRowId);
    }
    return jsonResponse({ ok: true, status: 'processing' });
  }

  // Completed — record the video REFERENCE (the binary lives in the user's Palmier project).
  const brief = (row.request ?? {}) as { prompt?: string; model?: string | null; duration_s?: number | null; aspect?: string | null };
  const output = {
    videos: [
      {
        palmier_asset_id: row.external_job_id,
        generation_status: 'ready',
        prompt: brief.prompt ?? '',
        model: brief.model ?? null,
        duration_s: brief.duration_s ?? null,
        aspect: brief.aspect ?? null,
        storage_path: null,
        signed_url: null,
      },
    ],
  };
  await svc.from('content_generation_jobs').update({ status: 'completed', output }).eq('id', jobRowId);
  return jsonResponse({ ok: true, status: 'completed', output });
}

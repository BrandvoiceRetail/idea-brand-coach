import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthedUserId, getServiceClient, jsonResponse } from '../_shared/edge-auth.ts';
import { createRateLimiter } from '../_shared/rateLimit.ts';
import {
  createListingBuilder,
  createAPlus,
  createScale,
  getJob,
  imageUrlsFromJob,
  adErrorsFromJob,
  isPixiiCdnUrl,
  validateListingBuilderInput,
  validateAPlusInput,
  type PixiiResult,
  type APlusInput,
  type ListingBuilderInput,
  type ScaleInput,
} from '../_shared/pixii.ts';

/**
 * pixii-generate — the VISUAL provider behind the Brand Funnel Tracker's
 * generate-content interface. Two branches on one deployable:
 *
 *   CREATE  { avatarId, touchpointId, capability, asin, countryCode, ... }
 *           → validates, calls Pixii, records a content_generation_jobs row,
 *             returns { ok, jobId, externalJobId, status }.
 *   POLL    { poll: <jobId> }
 *           → polls Pixii; on completion downloads the images (SSRF-guarded to
 *             *.pixii.ai) into the private `brand-assets` bucket — Pixii URLs
 *             expire after 7 days — and returns durable storage paths + freshly
 *             signed display URLs.
 *
 * Auth: caller's user is derived from the verified JWT (getAuthedUserId); the
 * PIXII_API_KEY secret stays server-side and never reaches the browser. Copy /
 * email pieces do NOT use this function — they route to brand-copy-generator.
 */

const BUCKET = 'brand-assets';
const MAX_IMAGES = 12;
const SIGNED_URL_TTL_SECONDS = 3600;

// Per-isolate sliding-window rate limits keyed by userId (shared helper handles
// eviction). Create is stricter (spends Pixii credits); poll is lenient (~5s UI poll).
const createLimiter = createRateLimiter(15, 60_000);
const pollLimiter = createRateLimiter(240, 60_000);

interface CreateBody {
  avatarId: string;
  touchpointId: string;
  capability: 'listing_images' | 'main_image' | 'a_plus' | 'scale';
  asin: string;
  countryCode: string;
  listingType?: string;
  types?: string[];
  scaleMode?: string;
  scaleItems?: ScaleInput['items'];
  mainImageUrl?: string;
  otherImageUrls?: string[];
  userPrompt?: string;
}

/**
 * Handled, user-actionable failure. Returned as HTTP 200 with `ok:false` so the
 * frontend reads `data.ok`/`data.code` directly rather than unwrapping a
 * FunctionsHttpError stream. Hard failures (401 unauth / 500 crash) stay non-2xx.
 */
function fail(error: string, extra: Record<string, unknown> = {}): Response {
  return jsonResponse({ ok: false, error, ...extra }, 200);
}

/** Map a Pixii error result to a user-actionable failure body. */
function pixiiErrorResponse(res: Extract<PixiiResult, { status: 'error' }>): Response {
  return fail(res.message, { code: res.code, retryAfter: res.retryAfter, httpStatus: res.httpStatus });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const svc = getServiceClient();

    // ── POLL branch ──────────────────────────────────────────────────────────
    if (body?.poll) {
      if (pollLimiter.isRateLimited(userId)) return jsonResponse({ ok: false, error: 'rate_limited' }, 429);
      return await handlePoll(svc, userId, String(body.poll));
    }

    // ── CREATE branch ─────────────────────────────────────────────────────────
    if (createLimiter.isRateLimited(userId)) return jsonResponse({ ok: false, error: 'rate_limited' }, 429);
    return await handleCreate(svc, userId, body as CreateBody);
  } catch (err) {
    console.error('pixii-generate error:', err instanceof Error ? err.message : err);
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : 'pixii-generate failed' }, 500);
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

  // Build + validate the Pixii input for the requested capability.
  let pixiiCall: Promise<PixiiResult>;
  let request: Record<string, unknown>;
  const { asin, countryCode, mainImageUrl, otherImageUrls, userPrompt } = body;

  if (body.capability === 'listing_images' || body.capability === 'main_image') {
    const input: ListingBuilderInput = {
      asin,
      country_code: countryCode,
      listing_type: body.capability === 'main_image' ? 'amazon_main_images' : (body.listingType ?? 'amazon_listing'),
      main_image_url: mainImageUrl,
      other_image_urls: otherImageUrls,
    };
    const invalid = validateListingBuilderInput(input);
    if (invalid) return fail(invalid);
    request = input as unknown as Record<string, unknown>;
    pixiiCall = createListingBuilder(input);
  } else if (body.capability === 'a_plus') {
    const input: APlusInput = {
      asin,
      country_code: countryCode,
      types: body.types ?? ['A+ Basic'],
      main_image_url: mainImageUrl,
      other_image_urls: otherImageUrls,
      user_prompt: userPrompt,
    };
    const invalid = validateAPlusInput(input);
    if (invalid) return fail(invalid);
    request = input as unknown as Record<string, unknown>;
    pixiiCall = createAPlus(input);
  } else if (body.capability === 'scale') {
    if (!body.scaleMode || !body.scaleItems?.length) {
      return fail('scale requires scaleMode and at least one scaleItem');
    }
    const input: ScaleInput = {
      asin,
      country_code: countryCode,
      scale_mode: body.scaleMode,
      main_image_input: mainImageUrl,
      other_images_input: otherImageUrls,
      user_prompt: userPrompt,
      items: body.scaleItems,
    };
    request = input as unknown as Record<string, unknown>;
    pixiiCall = createScale(input);
  } else {
    return fail(`unknown capability: ${body.capability}`);
  }

  const res = await pixiiCall;
  if (res.status === 'not_configured') {
    return fail('Pixii is not configured. Set the PIXII_API_KEY secret.', { code: 'NOT_CONFIGURED' });
  }
  if (res.status === 'error') return pixiiErrorResponse(res);

  const externalJobId = res.job.job_id ?? res.job.id ?? null;
  const status = res.job.status ?? 'pending';

  const { data: row, error: insErr } = await svc
    .from('content_generation_jobs')
    .insert({
      user_id: userId,
      brand_id: avatar.brand_id,
      avatar_id: body.avatarId,
      touchpoint_id: body.touchpointId,
      provider: 'pixii',
      capability: body.capability,
      output_kind: 'image',
      external_job_id: externalJobId,
      status,
      request,
    })
    .select('id')
    .single();
  if (insErr) {
    console.error('pixii-generate insert error:', insErr.message);
    return jsonResponse({ ok: false, error: 'could not record the generation job' }, 500);
  }

  return jsonResponse({ ok: true, jobId: row.id, externalJobId, status });
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

  // Terminal already: re-sign stored images (cached signed URLs may have expired).
  if (row.status === 'completed') {
    const images = await reSignImages(svc, row.output?.images ?? []);
    return jsonResponse({ ok: true, status: 'completed', output: { ...row.output, images } });
  }
  if (row.status === 'failed') {
    return jsonResponse({ ok: true, status: 'failed', error: row.error });
  }
  if (!row.external_job_id) {
    return fail('job has no external id to poll');
  }

  const res = await getJob(row.external_job_id);
  if (res.status === 'not_configured') {
    return fail('Pixii is not configured.', { code: 'NOT_CONFIGURED' });
  }
  if (res.status === 'error') {
    // A definitively-missing job is terminal; transient errors keep the row open.
    if (res.code === 'JOB_NOT_FOUND') {
      await svc.from('content_generation_jobs')
        .update({ status: 'failed', error: { code: 'JOB_NOT_FOUND', message: res.message } })
        .eq('id', jobRowId);
      return jsonResponse({ ok: true, status: 'failed', error: { code: 'JOB_NOT_FOUND', message: res.message } });
    }
    return pixiiErrorResponse(res);
  }

  const job = res.job;

  if (job.status === 'failed') {
    const error = { code: job.error_code ?? 'PIXII_JOB_FAILED', message: 'Pixii could not generate this asset.' };
    await svc.from('content_generation_jobs').update({ status: 'failed', error }).eq('id', jobRowId);
    return jsonResponse({ ok: true, status: 'failed', error });
  }

  if (job.status !== 'completed') {
    // pending / processing — keep the row in step, tell the client to keep polling.
    if (row.status !== job.status) {
      await svc.from('content_generation_jobs').update({ status: job.status }).eq('id', jobRowId);
    }
    return jsonResponse({ ok: true, status: job.status });
  }

  // Completed — persist the images durably, then return signed display URLs.
  const sourceUrls = imageUrlsFromJob(job).slice(0, MAX_IMAGES);
  const images = await persistImages(svc, userId, jobRowId, sourceUrls);
  const adErrors = adErrorsFromJob(job);

  // Pixii reported completion and produced image URLs, but NONE could be persisted
  // (CDN/storage failure or all URLs rejected by the SSRF guard). Don't mark the job
  // 'completed' with an empty gallery — that strands spent credits with nothing to
  // save and no error. Surface it as failed so the UI can retry.
  if (sourceUrls.length > 0 && images.length === 0) {
    const error = { code: 'IMAGE_PERSIST_FAILED', message: 'Pixii generated images but none could be saved. Please try again.' };
    await svc.from('content_generation_jobs').update({ status: 'failed', error }).eq('id', jobRowId);
    return jsonResponse({ ok: true, status: 'failed', error });
  }

  const output = {
    images,
    ad_errors: adErrors,
    remaining_credits: job.remaining_credits ?? null,
  };
  await svc.from('content_generation_jobs').update({ status: 'completed', output }).eq('id', jobRowId);
  return jsonResponse({ ok: true, status: 'completed', output });
}

interface PersistedImage {
  storage_path: string;
  signed_url: string | null;
  source_url: string;
}

/** Download Pixii CDN images into the private bucket; return durable paths + signed URLs. */
async function persistImages(
  svc: ReturnType<typeof getServiceClient>,
  userId: string,
  jobRowId: string,
  urls: string[],
): Promise<PersistedImage[]> {
  const out: PersistedImage[] = [];
  let i = 0;
  for (const url of urls) {
    if (!isPixiiCdnUrl(url)) {
      console.warn('pixii-generate: refusing non-pixii image url', url);
      continue;
    }
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn('pixii-generate: image fetch failed', resp.status, url);
        continue;
      }
      const bytes = new Uint8Array(await resp.arrayBuffer());
      const contentType = resp.headers.get('content-type') ?? 'image/png';
      const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png';
      const path = `${userId}/funnel/generated/${jobRowId}/${i}.${ext}`;
      const { error: upErr } = await svc.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
      if (upErr) {
        console.warn('pixii-generate: storage upload failed', upErr.message);
        continue;
      }
      const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      out.push({ storage_path: path, signed_url: signed?.signedUrl ?? null, source_url: url });
      i += 1;
    } catch (err) {
      console.warn('pixii-generate: image persist error', err instanceof Error ? err.message : err);
    }
  }
  return out;
}

/** Re-sign already-stored images for a completed job (signed URLs are short-lived). */
async function reSignImages(
  svc: ReturnType<typeof getServiceClient>,
  images: PersistedImage[],
): Promise<PersistedImage[]> {
  const out: PersistedImage[] = [];
  for (const img of images) {
    const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(img.storage_path, SIGNED_URL_TTL_SECONDS);
    out.push({ ...img, signed_url: signed?.signedUrl ?? img.signed_url ?? null });
  }
  return out;
}

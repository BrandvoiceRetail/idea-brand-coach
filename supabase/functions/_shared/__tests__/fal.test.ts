import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  resolveFalConfig,
  resolveFalVideoModel,
  validateFalVideoInput,
  buildFalVideoInput,
  mapFalStatus,
  extractVideoUrl,
  isFalCdnUrl,
  submitTextToVideo,
  getQueueStatus,
  getQueueResult,
} from '../fal';

const CFG = { apiKey: 'fal_test', queueBase: 'https://queue.fal.run' };
const MODEL = 'fal-ai/bytedance/seedance/v1/lite/text-to-video';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('resolveFalConfig', () => {
  it('returns null without a key (vitest runtime), uses + trims an override', () => {
    expect(resolveFalConfig()).toBeNull();
    expect(resolveFalConfig({ apiKey: 'k' })).toEqual({ apiKey: 'k', queueBase: 'https://queue.fal.run' });
    expect(resolveFalConfig({ apiKey: 'k', queueBase: 'https://q.example/' })?.queueBase).toBe('https://q.example');
  });
});

describe('resolveFalVideoModel', () => {
  it('falls back to the built-in default and honours an override', () => {
    expect(resolveFalVideoModel()).toBe('fal-ai/bytedance/seedance/v1/lite/text-to-video');
    expect(resolveFalVideoModel('fal-ai/kling-video/v2/master/text-to-video')).toBe('fal-ai/kling-video/v2/master/text-to-video');
  });
});

describe('validateFalVideoInput', () => {
  it('requires a prompt and a positive duration', () => {
    expect(validateFalVideoInput({})).toMatch(/prompt/);
    expect(validateFalVideoInput({ prompt: 'x', durationS: -1 })).toMatch(/positive/);
    expect(validateFalVideoInput({ prompt: 'a city at night' })).toBeNull();
  });
});

describe('buildFalVideoInput', () => {
  it('passes prompt and maps aspect/duration (as strings), omitting empties', () => {
    expect(buildFalVideoInput({ prompt: ' hero ' })).toEqual({ prompt: 'hero' });
    expect(buildFalVideoInput({ prompt: 'p', aspectRatio: '9:16', durationS: 8 })).toEqual({
      prompt: 'p',
      aspect_ratio: '9:16',
      duration: '8',
    });
  });
});

describe('mapFalStatus', () => {
  it('maps queue status to our normalized status', () => {
    expect(mapFalStatus('IN_QUEUE')).toBe('processing');
    expect(mapFalStatus('IN_PROGRESS')).toBe('processing');
    expect(mapFalStatus('COMPLETED')).toBe('completed');
  });
});

describe('extractVideoUrl', () => {
  it('reads the common fal output shapes', () => {
    expect(extractVideoUrl({ video: { url: 'https://v3.fal.media/a.mp4' } })).toBe('https://v3.fal.media/a.mp4');
    expect(extractVideoUrl({ videos: [{ url: 'https://v3.fal.media/b.mp4' }] })).toBe('https://v3.fal.media/b.mp4');
    expect(extractVideoUrl({ output: { video: { url: 'https://v3.fal.media/c.mp4' } } })).toBe('https://v3.fal.media/c.mp4');
    expect(extractVideoUrl({ nope: true })).toBeNull();
  });
});

describe('isFalCdnUrl (SSRF guard)', () => {
  it('allows only https fal CDN hosts', () => {
    expect(isFalCdnUrl('https://v3.fal.media/files/x.mp4')).toBe(true);
    expect(isFalCdnUrl('https://fal.media/x.mp4')).toBe(true);
    expect(isFalCdnUrl('https://queue.fal.run/x')).toBe(true);
    expect(isFalCdnUrl('http://v3.fal.media/x.mp4')).toBe(false); // not https
    expect(isFalCdnUrl('https://evil.com/x.mp4')).toBe(false);
    expect(isFalCdnUrl('https://fal.media.evil.com/x.mp4')).toBe(false);
    expect(isFalCdnUrl('not a url')).toBe(false);
  });
});

describe('submitTextToVideo', () => {
  it('returns not_configured without a key', async () => {
    expect(await submitTextToVideo(MODEL, { prompt: 'x' })).toEqual({ status: 'not_configured' });
  });

  it('posts with Key auth and returns the queue urls', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ request_id: 'r1', status_url: 'https://queue.fal.run/s', response_url: 'https://queue.fal.run/r' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await submitTextToVideo(MODEL, { prompt: 'a harbor' }, CFG);
    expect(res).toEqual({ status: 'ok', requestId: 'r1', statusUrl: 'https://queue.fal.run/s', responseUrl: 'https://queue.fal.run/r' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://queue.fal.run/${MODEL}`);
    expect((init as { headers: Record<string, string> }).headers.Authorization).toBe('Key fal_test');
  });

  it('maps a 422 error envelope to a typed error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'unknown model' }), { status: 422 })));
    const res = await submitTextToVideo(MODEL, { prompt: 'x' }, CFG);
    expect(res).toMatchObject({ status: 'error', httpStatus: 422, message: 'unknown model' });
  });
});

describe('getQueueStatus / getQueueResult', () => {
  it('reads a completed status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'COMPLETED' }), { status: 200 })));
    expect(await getQueueStatus('https://queue.fal.run/s', CFG)).toEqual({ status: 'ok', falStatus: 'COMPLETED', generation: 'completed' });
  });

  it('pulls the video url from the result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ video: { url: 'https://v3.fal.media/out.mp4', content_type: 'video/mp4' } }), { status: 200 }),
    ));
    expect(await getQueueResult('https://queue.fal.run/r', CFG)).toEqual({ status: 'ok', videoUrl: 'https://v3.fal.media/out.mp4', contentType: 'video/mp4' });
  });
});

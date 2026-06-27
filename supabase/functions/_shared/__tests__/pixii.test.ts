import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  resolvePixiiConfig,
  validateListingBuilderInput,
  validateAPlusInput,
  imageUrlsFromJob,
  adErrorsFromJob,
  isPixiiCdnUrl,
  createListingBuilder,
  getJob,
  type PixiiJob,
} from '../pixii';

const KEY = { apiKey: 'pk_test_abc' };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('resolvePixiiConfig', () => {
  it('returns null without an override and no Deno env (vitest runtime)', () => {
    expect(resolvePixiiConfig()).toBeNull();
  });

  it('uses an override and defaults + trims the base url', () => {
    expect(resolvePixiiConfig({ apiKey: 'pk_live_x' })).toEqual({
      apiKey: 'pk_live_x',
      baseUrl: 'https://api.pixii.ai',
    });
    expect(resolvePixiiConfig({ apiKey: 'k', baseUrl: 'https://h.example/' })?.baseUrl).toBe('https://h.example');
  });
});

describe('validateListingBuilderInput', () => {
  it('requires asin, a known country_code and listing_type', () => {
    expect(validateListingBuilderInput({})).toMatch(/asin/);
    expect(validateListingBuilderInput({ asin: 'B0X', country_code: 'ZZ', listing_type: 'amazon_listing' })).toMatch(/country_code/);
    expect(validateListingBuilderInput({ asin: 'B0X', country_code: 'US', listing_type: 'nope' })).toMatch(/listing_type/);
    expect(validateListingBuilderInput({ asin: 'B0X', country_code: 'US', listing_type: 'amazon_listing', other_image_urls: [] })).toMatch(/at least 1/);
    expect(validateListingBuilderInput({ asin: 'B0X', country_code: 'US', listing_type: 'amazon_listing' })).toBeNull();
  });
});

describe('validateAPlusInput', () => {
  it('requires at least one valid A+ type', () => {
    expect(validateAPlusInput({ asin: 'B0X', country_code: 'US', types: [] })).toMatch(/at least one/);
    expect(validateAPlusInput({ asin: 'B0X', country_code: 'US', types: ['A+ Deluxe'] })).toMatch(/unknown A\+ type/);
    expect(validateAPlusInput({ asin: 'B0X', country_code: 'US', types: ['A+ Basic'] })).toBeNull();
  });
});

describe('imageUrlsFromJob / adErrorsFromJob', () => {
  const job: PixiiJob = {
    status: 'completed',
    output: {
      ads: [
        { preview_url: 'https://cdn.pixii.ai/a.png', error: null },
        { preview_url: null, error: { code: 'IMAGE_GENERATION_ERROR', message: 'failed' } },
        { type: 'A+ Basic', preview: 'https://cdn.pixii.ai/p.png', modules: ['https://cdn.pixii.ai/m1.png', 'https://cdn.pixii.ai/m2.png'], error: null },
      ],
    },
  };

  it('flattens preview_url, preview and modules and skips failed ads', () => {
    expect(imageUrlsFromJob(job)).toEqual([
      'https://cdn.pixii.ai/a.png',
      'https://cdn.pixii.ai/p.png',
      'https://cdn.pixii.ai/m1.png',
      'https://cdn.pixii.ai/m2.png',
    ]);
  });

  it('collects per-ad errors', () => {
    expect(adErrorsFromJob(job)).toEqual([{ code: 'IMAGE_GENERATION_ERROR', message: 'failed' }]);
  });

  it('handles an empty/absent output safely', () => {
    expect(imageUrlsFromJob({ status: 'pending' })).toEqual([]);
    expect(adErrorsFromJob({ status: 'pending' })).toEqual([]);
  });
});

describe('isPixiiCdnUrl (SSRF guard)', () => {
  it('allows only https pixii.ai hosts', () => {
    expect(isPixiiCdnUrl('https://cdn.pixii.ai/outputs/x.png')).toBe(true);
    expect(isPixiiCdnUrl('https://pixii.ai/x.png')).toBe(true);
    expect(isPixiiCdnUrl('http://cdn.pixii.ai/x.png')).toBe(false); // not https
    expect(isPixiiCdnUrl('https://evil.com/x.png')).toBe(false);
    expect(isPixiiCdnUrl('https://cdn.pixii.ai.evil.com/x.png')).toBe(false);
    expect(isPixiiCdnUrl('not a url')).toBe(false);
  });
});

describe('createListingBuilder', () => {
  it('returns not_configured when no key', async () => {
    expect(await createListingBuilder({ asin: 'B0X', country_code: 'US', listing_type: 'amazon_listing' })).toEqual({ status: 'not_configured' });
  });

  it('posts with bearer auth and returns the created job', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { job_id: 'j1', status: 'pending' }, error: null }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await createListingBuilder({ asin: 'B0X', country_code: 'US', listing_type: 'amazon_listing' }, KEY);
    expect(res).toEqual({ status: 'ok', job: { job_id: 'j1', status: 'pending' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.pixii.ai/v1/api/listing_builder');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer pk_test_abc');
  });

  it('maps a 429 rate-limit envelope to a typed error with retryAfter', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ success: false, data: null, error: { code: 'RATE_LIMIT_MINUTE_EXCEEDED', message: 'slow down', retry_after: 47 } }), { status: 429 }),
    ));
    const res = await createListingBuilder({ asin: 'B0X', country_code: 'US', listing_type: 'amazon_listing' }, KEY);
    expect(res).toEqual({ status: 'error', httpStatus: 429, code: 'RATE_LIMIT_MINUTE_EXCEEDED', message: 'slow down', retryAfter: 47 });
  });
});

describe('getJob', () => {
  it('polls a completed job', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { id: 'j1', status: 'completed', output: { ads: [{ preview_url: 'https://cdn.pixii.ai/a.png', error: null }] } }, error: null }), { status: 200 }),
    ));
    const res = await getJob('j1', KEY);
    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.job.status).toBe('completed');
      expect(imageUrlsFromJob(res.job)).toEqual(['https://cdn.pixii.ai/a.png']);
    }
  });

  it('maps JOB_NOT_FOUND', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ success: false, data: null, error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } }), { status: 404 }),
    ));
    const res = await getJob('missing', KEY);
    expect(res).toMatchObject({ status: 'error', httpStatus: 404, code: 'JOB_NOT_FOUND' });
  });
});

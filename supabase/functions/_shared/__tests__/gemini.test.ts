import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  resolveGeminiConfig,
  resolveGeminiImageModel,
  validateGeminiImageInput,
  buildGeminiRequest,
  extractInlineImages,
  isTransientGeminiStatus,
  generateImage,
} from '../gemini';

const CFG = { apiKey: 'gem_test', base: 'https://generativelanguage.googleapis.com/v1beta' };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('resolveGeminiConfig', () => {
  it('returns null without a key (vitest runtime); uses + trims an override', () => {
    expect(resolveGeminiConfig()).toBeNull();
    expect(resolveGeminiConfig({ apiKey: 'k' })?.apiKey).toBe('k');
    expect(resolveGeminiConfig({ apiKey: 'k', base: 'https://x/' })?.base).toBe('https://x');
  });
});

describe('resolveGeminiImageModel', () => {
  it('defaults to Nano Banana Pro; honours an override', () => {
    expect(resolveGeminiImageModel()).toBe('gemini-3-pro-image-preview');
    expect(resolveGeminiImageModel('gemini-2.5-flash-image')).toBe('gemini-2.5-flash-image');
  });
});

describe('validateGeminiImageInput', () => {
  it('requires a prompt and well-formed references', () => {
    expect(validateGeminiImageInput({})).toMatch(/prompt/);
    expect(validateGeminiImageInput({ prompt: 'x', referenceImages: [{ mimeType: '', dataB64: 'a' }] })).toMatch(/reference/);
    expect(validateGeminiImageInput({ prompt: 'x' })).toBeNull();
  });
});

describe('buildGeminiRequest', () => {
  it('builds a text part + inline reference parts + IMAGE response modality', () => {
    const body = buildGeminiRequest({ prompt: '  hero shot  ', referenceImages: [{ mimeType: 'image/png', dataB64: 'AAA' }] }) as {
      contents: Array<{ parts: Array<Record<string, unknown>> }>;
      generationConfig: { responseModalities: string[] };
    };
    expect(body.contents[0].parts[0]).toEqual({ text: 'hero shot' });
    expect(body.contents[0].parts[1]).toEqual({ inlineData: { mimeType: 'image/png', data: 'AAA' } });
    expect(body.generationConfig.responseModalities).toContain('IMAGE');
  });
});

describe('extractInlineImages', () => {
  it('pulls inlineData (and snake_case inline_data) image parts', () => {
    const camel = { candidates: [{ content: { parts: [{ text: 'hi' }, { inlineData: { mimeType: 'image/jpeg', data: 'ZZZ' } }] } }] };
    expect(extractInlineImages(camel)).toEqual([{ mimeType: 'image/jpeg', dataB64: 'ZZZ' }]);
    const snake = { candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: 'QQQ' } }] } }] };
    expect(extractInlineImages(snake)).toEqual([{ mimeType: 'image/png', dataB64: 'QQQ' }]);
    expect(extractInlineImages({ candidates: [] })).toEqual([]);
  });
});

describe('isTransientGeminiStatus', () => {
  it('treats 404/429/500/503 as transient (the preview model 404s intermittently)', () => {
    expect(isTransientGeminiStatus(404)).toBe(true);
    expect(isTransientGeminiStatus(503)).toBe(true);
    expect(isTransientGeminiStatus(400)).toBe(false);
    expect(isTransientGeminiStatus(403)).toBe(false);
  });
});

describe('generateImage', () => {
  it('returns not_configured without a key', async () => {
    const r = await generateImage('m', { prompt: 'x' });
    expect(r.status).toBe('not_configured');
  });

  it('returns the image on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'IMG' } }] } }] }),
      { status: 200 },
    )));
    const r = await generateImage('m', { prompt: 'x' }, CFG);
    expect(r).toEqual({ status: 'ok', images: [{ mimeType: 'image/png', dataB64: 'IMG' }] });
  });

  it('retries a transient 404 then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 404, message: 'not found' } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'OK' } }] } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await generateImage('m', { prompt: 'x' }, CFG, 90000, 3);
    expect(r.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-transient 400', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: 400, message: 'bad' } }), { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await generateImage('m', { prompt: 'x' }, CFG, 90000, 3);
    expect(r.status).toBe('error');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

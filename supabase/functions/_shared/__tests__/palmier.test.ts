import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  resolvePalmierConfig,
  validateVideoInput,
  buildVideoArguments,
  parsePlaceholderId,
  classifyToolError,
  mapPalmierStatus,
  looksLikeLoopback,
  parseRpcResponse,
  findGenerationStatus,
  generateVideo,
  getMediaStatus,
} from '../palmier';

const CFG = { url: 'http://127.0.0.1:19789/mcp', origin: 'http://127.0.0.1:19789' };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('resolvePalmierConfig', () => {
  it('defaults to the local Palmier app endpoint + localhost origin (vitest runtime, no Deno env)', () => {
    expect(resolvePalmierConfig()).toEqual({ url: 'http://127.0.0.1:19789/mcp', origin: 'http://127.0.0.1:19789' });
  });

  it('honours url/origin overrides (e.g. a tunnel) and trims them', () => {
    expect(resolvePalmierConfig({ url: ' https://tunnel.example/mcp ', origin: ' http://127.0.0.1:19789 ' })).toEqual({
      url: 'https://tunnel.example/mcp',
      origin: 'http://127.0.0.1:19789',
    });
  });
});

describe('validateVideoInput', () => {
  it('requires a prompt and a positive duration', () => {
    expect(validateVideoInput({})).toMatch(/prompt/);
    expect(validateVideoInput({ prompt: '   ' })).toMatch(/prompt/);
    expect(validateVideoInput({ prompt: 'x', durationS: 0 })).toMatch(/positive/);
    expect(validateVideoInput({ prompt: 'a harbor at sunset' })).toBeNull();
  });
});

describe('buildVideoArguments', () => {
  it('passes prompt and omits empty optionals so Palmier defaults apply', () => {
    expect(buildVideoArguments({ prompt: '  hero shot ' })).toEqual({ prompt: 'hero shot' });
  });

  it('maps durationS→duration, aspect→aspectRatio and includes provided refs', () => {
    expect(
      buildVideoArguments({ prompt: 'p', model: ' veo3.1-fast ', durationS: 8.4, aspect: '9:16', resolution: '1080p', startFrameMediaRef: 'm1', referenceImageMediaRefs: ['@Image1'] }),
    ).toEqual({
      prompt: 'p',
      model: 'veo3.1-fast',
      duration: 8,
      aspectRatio: '9:16',
      resolution: '1080p',
      startFrameMediaRef: 'm1',
      referenceImageMediaRefs: ['@Image1'],
    });
  });
});

describe('parsePlaceholderId', () => {
  it('extracts the placeholder id from a generate result', () => {
    expect(parsePlaceholderId('Generation started. Placeholder asset ID: ph_abc-123. Model: Veo, duration: 5s')).toBe('ph_abc-123');
    expect(parsePlaceholderId('Edit started. Placeholder asset ID: edit_9. Place it with add_clips.')).toBe('edit_9');
    expect(parsePlaceholderId('no id here')).toBeNull();
  });
});

describe('classifyToolError', () => {
  it('classifies the sign-in and credits gates', () => {
    expect(classifyToolError('Generation requires signing in to Palmier. Tell the user to sign in.')).toBe('NEEDS_SIGNIN');
    expect(classifyToolError('Out of credits. Tell the user to add credits or subscribe.')).toBe('NO_CREDITS');
    expect(classifyToolError('something else went wrong')).toBe('TOOL_ERROR');
  });
});

describe('mapPalmierStatus', () => {
  it('maps Palmier generationStatus to our normalized status', () => {
    expect(mapPalmierStatus('generating')).toBe('processing');
    expect(mapPalmierStatus('downloading')).toBe('processing');
    expect(mapPalmierStatus('none')).toBe('completed');
    expect(mapPalmierStatus('failed')).toBe('failed');
    expect(mapPalmierStatus('weird')).toBe('processing');
  });
});

describe('looksLikeLoopback', () => {
  it('recognises loopback hosts, rejects tunnels and junk', () => {
    expect(looksLikeLoopback('http://127.0.0.1:19789/mcp')).toBe(true);
    expect(looksLikeLoopback('http://localhost:19789/mcp')).toBe(true);
    expect(looksLikeLoopback('https://tunnel.example/mcp')).toBe(false);
    expect(looksLikeLoopback('not a url')).toBe(false);
  });
});

describe('parseRpcResponse', () => {
  it('parses a plain JSON envelope', () => {
    const env = parseRpcResponse('application/json', JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: true } }));
    expect(env?.result).toEqual({ ok: true });
  });

  it('parses an SSE stream and prefers the matching id', () => {
    const body = [
      'event: message',
      'data: {"jsonrpc":"2.0","id":1,"result":{"first":true}}',
      '',
      'event: message',
      'data: {"jsonrpc":"2.0","id":2,"result":{"second":true}}',
      '',
    ].join('\n');
    expect(parseRpcResponse('text/event-stream', body, 2)?.result).toEqual({ second: true });
    expect(parseRpcResponse('text/event-stream', body)?.result).toEqual({ second: true }); // last wins without an id
  });
});

describe('findGenerationStatus', () => {
  it('reads generationStatus from structured media', () => {
    const structured = { media: [{ id: 'other', generationStatus: 'none' }, { id: 'ph_1', generationStatus: 'generating' }] };
    expect(findGenerationStatus(structured, '', 'ph_1')).toBe('generating');
  });

  it('falls back to the text near the ref', () => {
    const text = 'Asset ph_2 — generationStatus: downloading (in progress)';
    expect(findGenerationStatus(null, text, 'ph_2')).toBe('downloading');
  });

  it('returns null when the asset is absent', () => {
    expect(findGenerationStatus({ media: [] }, '', 'ph_x')).toBeNull();
  });
});

describe('generateVideo (mocked transport)', () => {
  function jsonRpc(result: unknown): Response {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  it('parses the placeholder id from a successful generate', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      jsonRpc({ content: [{ type: 'text', text: 'Generation started. Placeholder asset ID: ph_1. Model: Veo, duration: 8s' }], isError: false }),
    ));
    const res = await generateVideo({ prompt: 'a UGC unboxing' }, CFG);
    expect(res).toMatchObject({ status: 'ok', placeholderId: 'ph_1' });
  });

  it('surfaces the sign-in gate as a tool_error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      jsonRpc({ content: [{ type: 'text', text: 'Generation requires signing in to Palmier. Tell the user to sign in.' }], isError: true }),
    ));
    const res = await generateVideo({ prompt: 'x' }, CFG);
    expect(res).toMatchObject({ status: 'tool_error', code: 'NEEDS_SIGNIN' });
  });

  it('degrades to unreachable when the transport throws (the cloud case)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:19789'); }));
    const res = await generateVideo({ prompt: 'x' }, CFG);
    expect(res.status).toBe('unreachable');
  });

  it('sends the localhost Origin header Palmier requires', async () => {
    const fetchMock = vi.fn(async () =>
      jsonRpc({ content: [{ type: 'text', text: 'Generation started. Placeholder asset ID: ph_1.' }], isError: false }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await generateVideo({ prompt: 'x' }, CFG);
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers.Origin).toBe('http://127.0.0.1:19789');
    expect(headers.Accept).toContain('text/event-stream');
  });
});

describe('getMediaStatus (mocked transport)', () => {
  it('maps a structured generationStatus to our status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        jsonrpc: '2.0', id: 1,
        result: { content: [{ type: 'text', text: 'ok' }], structuredContent: { media: [{ id: 'ph_1', generationStatus: 'none' }] } },
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    ));
    const res = await getMediaStatus('ph_1', CFG);
    expect(res).toMatchObject({ status: 'ok', generation: 'completed', palmierStatus: 'none' });
  });
});

import { describe, it, expect } from 'vitest';
import {
  generateCodeVerifier,
  deriveCodeChallenge,
  base64UrlEncode,
  buildAuthorizeUrl,
  buildBasicAuthHeader,
  buildTokenExchangeBody,
  buildRefreshTokenBody,
  isTokenExpired,
  normalizeDesign,
  DEFAULT_CANVA_SCOPES,
  CANVA_AUTHORIZE_URL,
} from '../canva';

describe('base64UrlEncode', () => {
  it('produces url-safe output with no padding', () => {
    // 0xFB 0xFF -> base64 "+/8=" -> base64url "-_8"
    const encoded = base64UrlEncode(new Uint8Array([0xfb, 0xff]));
    expect(encoded).toBe('-_8');
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

describe('generateCodeVerifier', () => {
  it('returns a 43–128 char url-safe string', () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    // RFC 7636 unreserved characters only: A-Z a-z 0-9 - . _ ~
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it('honours an explicit length and rejects out-of-range lengths', () => {
    expect(generateCodeVerifier(43).length).toBe(43);
    expect(generateCodeVerifier(128).length).toBe(128);
    expect(() => generateCodeVerifier(42)).toThrow();
    expect(() => generateCodeVerifier(129)).toThrow();
  });

  it('is effectively unique across calls', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });
});

describe('deriveCodeChallenge (S256)', () => {
  it('matches the RFC 7636 §A.2 known test vector', async () => {
    // RFC 7636 Appendix A worked example.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await deriveCodeChallenge(verifier);
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('round-trips a freshly generated verifier into a url-safe challenge', async () => {
    const challenge = await deriveCodeChallenge(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge).not.toMatch(/[+/=]/);
  });
});

describe('buildAuthorizeUrl', () => {
  it('builds a correct authorize URL with S256 and all params', () => {
    const url = buildAuthorizeUrl({
      clientId: 'client-123',
      redirectUri: 'https://example.functions.supabase.co/canva-oauth-callback',
      scope: DEFAULT_CANVA_SCOPES,
      state: 'opaque-state',
      codeChallenge: 'challenge-abc',
    });
    expect(url.startsWith(CANVA_AUTHORIZE_URL)).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('client-123');
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://example.functions.supabase.co/canva-oauth-callback'
    );
    expect(parsed.searchParams.get('scope')).toBe(DEFAULT_CANVA_SCOPES);
    expect(parsed.searchParams.get('state')).toBe('opaque-state');
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-abc');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });
});

describe('token request builders', () => {
  it('encodes Basic auth as base64(client_id:client_secret)', () => {
    // base64("client_id:secret") = Y2xpZW50X2lkOnNlY3JldA==
    expect(buildBasicAuthHeader('client_id', 'secret')).toBe(
      'Basic Y2xpZW50X2lkOnNlY3JldA=='
    );
  });

  it('builds the authorization-code exchange body', () => {
    const body = buildTokenExchangeBody({
      code: 'auth-code',
      codeVerifier: 'verifier',
      redirectUri: 'https://example/callback',
    });
    const params = new URLSearchParams(body);
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code')).toBe('auth-code');
    expect(params.get('code_verifier')).toBe('verifier');
    expect(params.get('redirect_uri')).toBe('https://example/callback');
  });

  it('builds the refresh-token body', () => {
    const params = new URLSearchParams(buildRefreshTokenBody('refresh-xyz'));
    expect(params.get('grant_type')).toBe('refresh_token');
    expect(params.get('refresh_token')).toBe('refresh-xyz');
  });
});

describe('isTokenExpired', () => {
  it('treats missing / unparseable timestamps as expired (fail closed)', () => {
    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired(undefined)).toBe(true);
    expect(isTokenExpired('not-a-date')).toBe(true);
  });

  it('returns false for a token comfortably in the future', () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    expect(isTokenExpired(future)).toBe(false);
  });

  it('returns true for a token already in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isTokenExpired(past)).toBe(true);
  });

  it('respects the skew boundary', () => {
    // 30s out with a 60s skew → considered expired.
    const soon = new Date(Date.now() + 30 * 1000).toISOString();
    expect(isTokenExpired(soon, 60)).toBe(true);
    // 30s out with a 0s skew → still valid.
    expect(isTokenExpired(soon, 0)).toBe(false);
  });
});

describe('normalizeDesign', () => {
  it('maps a fully-populated raw design', () => {
    const result = normalizeDesign({
      id: 'DAF123',
      title: 'Summer Campaign',
      thumbnail: { url: 'https://cdn/thumb.png' },
      urls: { edit_url: 'https://canva/edit', view_url: 'https://canva/view' },
      updated_at: '2026-06-16T12:00:00.000Z',
    });
    expect(result).toEqual({
      id: 'DAF123',
      title: 'Summer Campaign',
      thumbnailUrl: 'https://cdn/thumb.png',
      editUrl: 'https://canva/edit',
      viewUrl: 'https://canva/view',
      updatedAt: '2026-06-16T12:00:00.000Z',
    });
  });

  it('fills sane defaults when fields are missing', () => {
    const result = normalizeDesign({ id: 'DAF999' });
    expect(result.id).toBe('DAF999');
    expect(result.title).toBe('Untitled design');
    expect(result.thumbnailUrl).toBeNull();
    expect(result.editUrl).toBeNull();
    expect(result.viewUrl).toBeNull();
    expect(result.updatedAt).toBeNull();
  });

  it('coerces a unix-epoch updated_at to ISO', () => {
    const result = normalizeDesign({ id: 'x', updated_at: 1718539200 });
    expect(result.updatedAt).toBe(new Date(1718539200 * 1000).toISOString());
  });

  it('tolerates a non-object input', () => {
    const result = normalizeDesign(null);
    expect(result.id).toBe('');
    expect(result.title).toBe('Untitled design');
  });
});

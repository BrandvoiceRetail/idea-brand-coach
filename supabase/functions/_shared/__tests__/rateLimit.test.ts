import { describe, it, expect } from 'vitest';
import {
  clientIp,
  userIdFromAuthHeader,
  rateLimitKey,
  createRateLimiter,
} from '../rateLimit';

/** Minimal base64url JWT with the given payload (header.payload.signature). */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

function req(headers: Record<string, string>): Request {
  return new Request('https://example.com', { method: 'POST', headers });
}

describe('clientIp', () => {
  it('takes the first x-forwarded-for hop', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('falls back to cf-connecting-ip then unknown', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '9.9.9.9' }))).toBe('9.9.9.9');
    expect(clientIp(req({}))).toBe('unknown');
  });
});

describe('userIdFromAuthHeader', () => {
  it('reads the sub claim from a bearer JWT (no signature verification)', () => {
    const header = `Bearer ${fakeJwt({ sub: 'user-123', role: 'authenticated' })}`;
    expect(userIdFromAuthHeader(header)).toBe('user-123');
  });

  it('returns null for a missing header, a malformed token, or a sub-less payload', () => {
    expect(userIdFromAuthHeader(null)).toBeNull();
    expect(userIdFromAuthHeader('Bearer not-a-jwt')).toBeNull();
    expect(userIdFromAuthHeader(`Bearer ${fakeJwt({ role: 'anon' })}`)).toBeNull();
  });
});

describe('rateLimitKey — per-user when authenticated, else per-IP', () => {
  it('keys by user when a JWT sub is present (bounded across IPs)', () => {
    const key = rateLimitKey(
      req({ authorization: `Bearer ${fakeJwt({ sub: 'user-abc' })}`, 'x-forwarded-for': '1.1.1.1' }),
    );
    expect(key).toBe('user:user-abc');
  });

  it('keys by IP for an anonymous caller', () => {
    expect(rateLimitKey(req({ 'x-forwarded-for': '2.2.2.2' }))).toBe('ip:2.2.2.2');
  });
});

describe('createRateLimiter — sliding window', () => {
  it('allows up to the limit, then blocks the next hit in the window', () => {
    const now = 1_000_000;
    const limiter = createRateLimiter(3, 60_000, () => now);
    expect(limiter.isRateLimited('k')).toBe(false); // 1
    expect(limiter.isRateLimited('k')).toBe(false); // 2
    expect(limiter.isRateLimited('k')).toBe(false); // 3 (== max)
    expect(limiter.isRateLimited('k')).toBe(true); // 4 -> over
  });

  it('tracks keys independently (one user/IP cannot exhaust another)', () => {
    const now = 1_000_000;
    const limiter = createRateLimiter(1, 60_000, () => now);
    expect(limiter.isRateLimited('user:a')).toBe(false);
    expect(limiter.isRateLimited('user:a')).toBe(true);
    // A different key is unaffected.
    expect(limiter.isRateLimited('user:b')).toBe(false);
  });

  it('forgets hits that fall outside the window', () => {
    let now = 1_000_000;
    const limiter = createRateLimiter(1, 60_000, () => now);
    expect(limiter.isRateLimited('k')).toBe(false);
    expect(limiter.isRateLimited('k')).toBe(true);
    now += 60_001; // advance past the window
    expect(limiter.isRateLimited('k')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { parseCanvaReturn, getCanvaReturnToast } from '../returnParams';

describe('parseCanvaReturn', () => {
  it('returns null status when no canva param is present', () => {
    const result = parseCanvaReturn('?foo=bar');
    expect(result.status).toBeNull();
    expect(result.reason).toBeNull();
    expect(result.cleanedSearch).toBe('?foo=bar');
  });

  it('parses connected and strips the canva param', () => {
    const result = parseCanvaReturn('?canva=connected');
    expect(result.status).toBe('connected');
    expect(result.reason).toBeNull();
    expect(result.cleanedSearch).toBe('');
  });

  it('parses error with a reason and strips both params', () => {
    const result = parseCanvaReturn('?canva=error&reason=origin_not_allowed');
    expect(result.status).toBe('error');
    expect(result.reason).toBe('origin_not_allowed');
    expect(result.cleanedSearch).toBe('');
  });

  it('preserves unrelated params while stripping canva + reason', () => {
    const result = parseCanvaReturn('?utm=x&canva=error&reason=access_denied&page=2');
    expect(result.status).toBe('error');
    expect(result.reason).toBe('access_denied');
    expect(result.cleanedSearch).toBe('?utm=x&page=2');
  });

  it('ignores an unrecognized canva value but still strips it', () => {
    const result = parseCanvaReturn('?canva=weird');
    expect(result.status).toBeNull();
    expect(result.cleanedSearch).toBe('');
  });

  it('handles an empty search string', () => {
    const result = parseCanvaReturn('');
    expect(result.status).toBeNull();
    expect(result.cleanedSearch).toBe('');
  });
});

describe('getCanvaReturnToast', () => {
  it('returns a success toast for connected', () => {
    const toast = getCanvaReturnToast(parseCanvaReturn('?canva=connected'));
    expect(toast).toEqual({
      type: 'success',
      message: expect.stringContaining('Canva connected'),
    });
  });

  it('returns a friendly mapped message for a known error reason', () => {
    const toast = getCanvaReturnToast(parseCanvaReturn('?canva=error&reason=origin_not_allowed'));
    expect(toast?.type).toBe('error');
    expect(toast?.message).toMatch(/verify where the request came from/i);
  });

  it('falls back to a generic error message for an unknown reason', () => {
    const toast = getCanvaReturnToast(parseCanvaReturn('?canva=error&reason=mystery'));
    expect(toast?.type).toBe('error');
    expect(toast?.message).toMatch(/couldn't connect to canva/i);
  });

  it('returns null when there is nothing to announce', () => {
    expect(getCanvaReturnToast(parseCanvaReturn('?foo=bar'))).toBeNull();
  });
});

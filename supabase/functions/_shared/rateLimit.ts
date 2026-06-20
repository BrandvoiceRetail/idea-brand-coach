/**
 * Shared per-isolate rate-limit helpers (Competitor-Agents P7 — Track C harden).
 *
 * Pure, Deno-free, unit-testable. The Competitor-Agents edge functions
 * (competitor-analysis-asset / brand-defense-monitor) key their sliding-window
 * limiter PER USER when the caller is authenticated (so a signed-in user is
 * bounded across IPs and warm isolates), falling back to the client IP for
 * anonymous callers. This mirrors the per-isolate limiter pattern from
 * diagnostic-interpretation, lifted to a shared module so both fns share one
 * implementation.
 *
 * As with all per-isolate limiters here: this is best-effort (each edge isolate
 * keeps its own map; it resets on cold start). For a hard cross-instance
 * guarantee, back it with a shared store (Postgres/Upstash) or a CDN/WAF rule.
 */

/** Extract the client IP from the proxy headers (first XFF hop, else CF header). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') ?? 'unknown';
}

/**
 * Cheaply read the `sub` (user id) claim from a bearer JWT WITHOUT verifying the
 * signature — used ONLY to bucket the rate limiter per user. Auth is still
 * enforced downstream (supabase.auth.getUser); this is just a cheap, early key.
 * Returns null on any parse failure (caller falls back to IP).
 */
export function userIdFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    const sub = typeof json?.sub === 'string' ? json.sub : null;
    return sub && sub.length > 0 ? sub : null;
  } catch {
    return null;
  }
}

/**
 * Rate-limit bucket key: prefer the authenticated user (`user:<sub>`) so a
 * signed-in caller is bounded regardless of source IP; fall back to `ip:<addr>`
 * for anonymous callers.
 */
export function rateLimitKey(req: Request): string {
  const userId = userIdFromAuthHeader(req.headers.get('authorization'));
  return userId ? `user:${userId}` : `ip:${clientIp(req)}`;
}

/** A per-isolate sliding-window limiter, bound to one window/limit. */
export interface RateLimiter {
  /** Record a hit for `key` now; return true when the window limit is exceeded. */
  isRateLimited(key: string): boolean;
}

/**
 * Build a per-isolate sliding-window limiter. Each instance owns its own hit map
 * (so an edge fn keeps a single module-level limiter). `nowFn` is injectable for
 * deterministic tests.
 */
export function createRateLimiter(
  maxPerWindow: number,
  windowMs: number,
  nowFn: () => number = Date.now,
): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    isRateLimited(key: string): boolean {
      const now = nowFn();
      const windowStart = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);
      recent.push(now);
      hits.set(key, recent);
      // Opportunistic cleanup so the map cannot grow unbounded.
      if (hits.size > 5000) {
        for (const [k, v] of hits) {
          if (v.length === 0 || v[v.length - 1] <= windowStart) hits.delete(k);
        }
      }
      return recent.length > maxPerWindow;
    },
  };
}

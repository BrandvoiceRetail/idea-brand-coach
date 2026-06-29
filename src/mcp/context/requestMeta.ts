/**
 * Per-request caller geo (country/region), bound via AsyncLocalStorage.
 *
 * Separate from Identity (which has a strict isolation contract) so adding a geo
 * dimension to telemetry never touches auth correctness. Sourced from edge/CDN
 * headers so per-country latency works wherever the MCP is fronted (Cloudflare,
 * AWS CloudFront, Vercel) and from the explicit `x-client-country` the in-house
 * chat edge function forwards. `getRequestMeta()` outside any run returns empties.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestMeta {
  /** ISO 3166-1 alpha-2 country code (upper-cased), or null when no geo header is present. */
  country: string | null;
  /** Sub-country region/state code when the fronting CDN provides one, else null. */
  region: string | null;
  /**
   * The MCP session id (`Mcp-Session-Id`) when the host sends one — the correlation key that
   * stitches a session's tool calls into a sequence, so telemetry can see the path that leads
   * to a bounce. The server is stateless (no server-assigned id), so this is best-effort:
   * present when the host echoes a session id, null otherwise (analytics then falls back to
   * PostHog's per-user sessionization). Never used for auth/routing — telemetry only.
   */
  sessionId: string | null;
}

export const NO_REQUEST_META: RequestMeta = Object.freeze({ country: null, region: null, sessionId: null });

const als = new AsyncLocalStorage<RequestMeta>();

export function runWithRequestMeta<T>(meta: RequestMeta, fn: () => Promise<T>): Promise<T> {
  return als.run(meta, fn);
}

export function getRequestMeta(): RequestMeta {
  return als.getStore() ?? NO_REQUEST_META;
}

type Headers = Record<string, string | string[] | undefined>;

function header(headers: Headers, name: string): string | null {
  const v = headers[name];
  const val = Array.isArray(v) ? v[0] : v;
  return val && val.trim().length > 0 ? val.trim() : null;
}

/**
 * Resolve the caller's country/region from the request headers. Checks the explicit
 * forwarded header first, then the common CDN providers. Returns null fields when no
 * geo signal is present (e.g. an external MCP agent with no CDN in front).
 */
export function resolveRequestMeta(headers: Headers): RequestMeta {
  const country =
    header(headers, 'x-client-country') ??
    header(headers, 'cf-ipcountry') ??
    header(headers, 'cloudfront-viewer-country') ??
    header(headers, 'x-vercel-ip-country');
  const region =
    header(headers, 'x-client-region') ??
    header(headers, 'cloudfront-viewer-country-region') ??
    header(headers, 'x-vercel-ip-country-region');
  return {
    country: country ? country.toUpperCase() : null,
    region: region ?? null,
    // Best-effort session correlation; node lowercases header names.
    sessionId: header(headers, 'mcp-session-id'),
  };
}

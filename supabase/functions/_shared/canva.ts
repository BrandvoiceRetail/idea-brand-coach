/**
 * Pure, Vitest-importable Canva Connect helpers.
 *
 * IMPORTANT: this module must stay import-safe under Vitest — it does NOT
 * import from deno.land/esm.sh and does NOT touch `Deno.*` at the top level.
 * Only Web Crypto (`crypto.subtle`, `crypto.getRandomValues`, available as
 * globals in both Deno and the Vitest/Node runtime) and pure string/URL logic.
 * Network `fetch` and Supabase clients live in the `index.ts` files (or in
 * `canvaClient.ts`, which is NOT imported by tests and may use Deno/remote).
 */

// ── Endpoint / scope constants ───────────────────────────────────────────────

export const CANVA_AUTHORIZE_URL = 'https://www.canva.com/api/oauth/authorize';
export const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';
export const CANVA_REVOKE_URL = 'https://api.canva.com/rest/v1/oauth/revoke';
export const CANVA_API_BASE = 'https://api.canva.com/rest/v1';
export const CANVA_PROFILE_URL = `${CANVA_API_BASE}/users/me/profile`;
export const CANVA_IDENTITY_URL = `${CANVA_API_BASE}/users/me`;
export const CANVA_DESIGNS_URL = `${CANVA_API_BASE}/designs`;

/** Default OAuth scopes (space-separated), per the contract. */
export const DEFAULT_CANVA_SCOPES =
  'profile:read design:meta:read design:content:read asset:read';

// ── PKCE ─────────────────────────────────────────────────────────────────────

/** Url-safe alphabet for the PKCE verifier (RFC 7636 unreserved characters). */
const VERIFIER_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/**
 * base64url-encode raw bytes (no padding), per RFC 7636 §A.
 * Works in both Deno and Node/Vitest via the global `btoa`/Buffer fallback.
 */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : // Node fallback (Vitest) — only reached when btoa is unavailable.
        Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generate a PKCE `code_verifier`: a 43–128 character url-safe string built
 * from cryptographically-random bytes. We emit 64 characters (well within the
 * range) by mapping random bytes onto the unreserved alphabet.
 */
export function generateCodeVerifier(length = 64): string {
  if (length < 43 || length > 128) {
    throw new Error('PKCE verifier length must be between 43 and 128.');
  }
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let verifier = '';
  for (let i = 0; i < length; i++) {
    verifier += VERIFIER_ALPHABET[randomBytes[i] % VERIFIER_ALPHABET.length];
  }
  return verifier;
}

/**
 * Derive the PKCE `code_challenge` from a verifier using S256:
 * BASE64URL(SHA-256(ASCII(verifier))), no padding.
 */
export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/** Generate an opaque random `state` token (url-safe base64, no padding). */
export function generateState(byteLength = 32): string {
  const randomBytes = new Uint8Array(byteLength);
  crypto.getRandomValues(randomBytes);
  return base64UrlEncode(randomBytes);
}

// ── Authorize URL ────────────────────────────────────────────────────────────

export interface AuthorizeUrlParams {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
}

/**
 * Build the Canva authorize URL (OAuth 2.0 Authorization Code + PKCE / S256).
 */
export function buildAuthorizeUrl(params: AuthorizeUrlParams): string {
  const url = new URL(CANVA_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', params.scope);
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

// ── Token request builders (pure → testable; fetch lives elsewhere) ──────────

/** HTTP Basic auth header value for the token endpoint: `Basic base64(id:secret)`. */
export function buildBasicAuthHeader(clientId: string, clientSecret: string): string {
  const raw = `${clientId}:${clientSecret}`;
  const base64 =
    typeof btoa === 'function'
      ? btoa(raw)
      : Buffer.from(raw, 'utf-8').toString('base64');
  return `Basic ${base64}`;
}

export interface CodeExchangeParams {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

/**
 * Build the `application/x-www-form-urlencoded` body for the authorization-code
 * grant token exchange.
 */
export function buildTokenExchangeBody(params: CodeExchangeParams): string {
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', params.code);
  body.set('code_verifier', params.codeVerifier);
  body.set('redirect_uri', params.redirectUri);
  return body.toString();
}

/** Build the form body for the refresh-token grant. */
export function buildRefreshTokenBody(refreshToken: string): string {
  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);
  return body.toString();
}

// ── Expiry ───────────────────────────────────────────────────────────────────

/**
 * True when an access token is expired (or within `skewSeconds` of expiring).
 * The skew avoids racing a token that expires mid-request. An unparseable or
 * missing timestamp is treated as expired (fail closed → forces a refresh).
 */
export function isTokenExpired(expiresAtISO: string | null | undefined, skewSeconds = 60): boolean {
  if (!expiresAtISO) return true;
  const expiresAt = Date.parse(expiresAtISO);
  if (Number.isNaN(expiresAt)) return true;
  return Date.now() >= expiresAt - skewSeconds * 1000;
}

/** ISO timestamp `expires_in` seconds from now (Canva returns expires_in). */
export function expiresAtFromNow(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

// ── Design normalization ─────────────────────────────────────────────────────

export interface NormalizedDesign {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  editUrl: string | null;
  viewUrl: string | null;
  updatedAt: string | null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Normalize a raw Canva design item into the wire shape the frontend expects.
 * Tolerates missing nested `thumbnail`/`urls` objects and absent fields.
 * Raw shape: { id, title?, thumbnail?: { url }, urls?: { edit_url, view_url }, updated_at? }
 */
export function normalizeDesign(raw: unknown): NormalizedDesign {
  const record = asRecord(raw) ?? {};
  const thumbnail = asRecord(record.thumbnail);
  const urls = asRecord(record.urls);

  // updated_at may arrive as an ISO string or a unix-epoch number.
  let updatedAt: string | null = asString(record.updated_at);
  if (updatedAt === null && typeof record.updated_at === 'number') {
    updatedAt = new Date(record.updated_at * 1000).toISOString();
  }

  return {
    id: asString(record.id) ?? '',
    title: asString(record.title) ?? 'Untitled design',
    thumbnailUrl: thumbnail ? asString(thumbnail.url) : null,
    editUrl: urls ? asString(urls.edit_url) : null,
    viewUrl: urls ? asString(urls.view_url) : null,
    updatedAt,
  };
}

/**
 * Figma OAuth + REST client and token-at-rest encryption for edge functions.
 *
 * Deno runtime only (uses fetch + Web Crypto). Pure design-data extraction lives
 * in ./figma-extract.ts so it can be unit-tested without this module.
 *
 * OAuth references:
 *   Authorize: https://www.figma.com/developers/api#oauth2
 *   Token:     POST https://api.figma.com/v1/oauth/token   (HTTP Basic client auth)
 *   Refresh:   POST https://api.figma.com/v1/oauth/refresh (HTTP Basic client auth)
 */

export const FIGMA_AUTHORIZE_URL = 'https://www.figma.com/oauth';
export const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token';
export const FIGMA_REFRESH_URL = 'https://api.figma.com/v1/oauth/refresh';
export const FIGMA_API_BASE = 'https://api.figma.com/v1';

/** Default scope: read access to files, projects, components & styles. */
export const FIGMA_DEFAULT_SCOPE = 'files:read';

export interface FigmaTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  user_id?: string | number;
}

export interface FigmaUser {
  id: string;
  email?: string;
  handle?: string;
  img_url?: string;
}

/** A descriptive error that carries the upstream HTTP status (for response mapping). */
export class FigmaApiError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body = '') {
    super(message);
    this.name = 'FigmaApiError';
    this.status = status;
    this.body = body;
  }
}

// ── OAuth ───────────────────────────────────────────────────────────────────

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scope ?? FIGMA_DEFAULT_SCOPE,
    state: params.state,
    response_type: 'code',
  });
  return `${FIGMA_AUTHORIZE_URL}?${q.toString()}`;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

export async function exchangeCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<FigmaTokenResponse> {
  const body = new URLSearchParams({
    redirect_uri: params.redirectUri,
    code: params.code,
    grant_type: 'authorization_code',
  });
  const res = await fetch(FIGMA_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(params.clientId, params.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new FigmaApiError(`Figma token exchange failed (${res.status})`, res.status, text.slice(0, 300));
  }
  return JSON.parse(text) as FigmaTokenResponse;
}

export async function refreshAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<FigmaTokenResponse> {
  const body = new URLSearchParams({ refresh_token: params.refreshToken });
  const res = await fetch(FIGMA_REFRESH_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(params.clientId, params.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new FigmaApiError(`Figma token refresh failed (${res.status})`, res.status, text.slice(0, 300));
  }
  const parsed = JSON.parse(text) as FigmaTokenResponse;
  // Figma refresh responses may omit refresh_token (it stays the same).
  if (!parsed.refresh_token) parsed.refresh_token = params.refreshToken;
  return parsed;
}

// ── REST ─────────────────────────────────────────────────────────────────────

/** Figma personal access tokens authenticate via X-Figma-Token; OAuth tokens via Bearer. */
function figmaAuthHeaders(accessToken: string): Record<string, string> {
  return accessToken.startsWith('figd_')
    ? { 'X-Figma-Token': accessToken }
    : { Authorization: `Bearer ${accessToken}` };
}

async function figmaGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${FIGMA_API_BASE}${path}`, {
    headers: figmaAuthHeaders(accessToken),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new FigmaApiError(`Figma API GET ${path} failed (${res.status})`, res.status, text.slice(0, 300));
  }
  return JSON.parse(text) as T;
}

export function getMe(accessToken: string): Promise<FigmaUser> {
  return figmaGet<FigmaUser>('/me', accessToken);
}

/** Fetch a file. `depth` limits tree traversal; omit for a full document. */
export function getFile(
  accessToken: string,
  fileKey: string,
  opts: { depth?: number } = {},
): Promise<unknown> {
  const q = opts.depth ? `?depth=${opts.depth}` : '';
  return figmaGet<unknown>(`/files/${encodeURIComponent(fileKey)}${q}`, accessToken);
}

// ── Token encryption at rest (AES-256-GCM) ───────────────────────────────────
//
// When FIGMA_TOKEN_ENC_KEY (base64-encoded 32 bytes) is set, tokens are stored
// as `enc:v1:<ivB64>:<ctB64>`. When it is absent (e.g. local dev), tokens are
// stored as `plain:<token>` with a warning. decryptToken transparently handles
// both forms (and bare legacy plaintext), so rotating the key in is non-breaking.

const ENC_PREFIX = 'enc:v1:';
const PLAIN_PREFIX = 'plain:';

function b64encode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importAesKey(keyB64: string): Promise<CryptoKey> {
  const raw = b64decode(keyB64);
  if (raw.length !== 32) {
    throw new Error('FIGMA_TOKEN_ENC_KEY must be a base64-encoded 32-byte key (AES-256).');
  }
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Encrypt a token for storage. Falls back to a marked plaintext form if no key. */
export async function encryptToken(plaintext: string, keyB64?: string): Promise<string> {
  if (!keyB64) {
    console.warn('[figma] FIGMA_TOKEN_ENC_KEY not set — storing token unencrypted. Set it in production.');
    return `${PLAIN_PREFIX}${plaintext}`;
  }
  const key = await importAesKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${ENC_PREFIX}${b64encode(iv)}:${b64encode(new Uint8Array(ct))}`;
}

/** Decrypt a stored token. Handles enc:v1, plain:, and bare legacy plaintext. */
export async function decryptToken(stored: string, keyB64?: string): Promise<string> {
  if (stored.startsWith(PLAIN_PREFIX)) return stored.slice(PLAIN_PREFIX.length);
  if (!stored.startsWith(ENC_PREFIX)) return stored; // legacy bare plaintext
  if (!keyB64) {
    throw new Error('Encrypted Figma token found but FIGMA_TOKEN_ENC_KEY is not set.');
  }
  const [ivB64, ctB64] = stored.slice(ENC_PREFIX.length).split(':');
  if (!ivB64 || !ctB64) throw new Error('Malformed encrypted Figma token.');
  const key = await importAesKey(keyB64);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(ivB64) },
    key,
    b64decode(ctB64),
  );
  return new TextDecoder().decode(plain);
}

/** Generate a cryptographically-random OAuth state nonce. */
export function generateState(): string {
  return b64encode(crypto.getRandomValues(new Uint8Array(24)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

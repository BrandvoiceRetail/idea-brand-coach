/**
 * Canva Connect network client — the side-effecting counterpart to the pure
 * `canva.ts` helpers. This module DOES use `fetch` (and is read at runtime in
 * Deno edge functions only); it is intentionally NOT imported by Vitest tests.
 *
 * Pure request-shaping (form bodies, Basic-auth header, URL building) lives in
 * `./canva.ts`; this file just wires those into actual HTTP calls.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  CANVA_TOKEN_URL,
  CANVA_REVOKE_URL,
  CANVA_PROFILE_URL,
  CANVA_IDENTITY_URL,
  CANVA_DESIGNS_URL,
  CANVA_KB_FIELD,
  CANVA_KB_CATEGORY_PREFERRED,
  CANVA_KB_CATEGORY_FALLBACK,
  buildBasicAuthHeader,
  buildTokenExchangeBody,
  buildRefreshTokenBody,
  buildCanvaContextSummary,
  expiresAtFromNow,
  normalizeDesign,
  type NormalizedDesign,
  type CodeExchangeParams,
} from './canva.ts';

/** Service-role Supabase client (bypasses RLS). Shared by the canva-* functions. */
export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

export interface CanvaTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO
  scope: string | null;
}

export interface CanvaCredentials {
  clientId: string;
  clientSecret: string;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function postToken(
  creds: CanvaCredentials,
  body: string,
): Promise<CanvaTokenResult> {
  const response = await fetch(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: buildBasicAuthHeader(creds.clientId, creds.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Canva token endpoint ${response.status}: ${text.slice(0, 300)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Canva token endpoint returned non-JSON.');
  }
  const record = asRecord(parsed);
  const accessToken = asString(record?.access_token);
  const refreshToken = asString(record?.refresh_token);
  const expiresIn = typeof record?.expires_in === 'number' ? record.expires_in : null;
  if (!accessToken || !refreshToken || expiresIn === null) {
    throw new Error('Canva token response missing access_token / refresh_token / expires_in.');
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAtFromNow(expiresIn),
    scope: asString(record?.scope),
  };
}

/** Exchange an authorization code for tokens (PKCE: includes code_verifier). */
export function exchangeCodeForTokens(
  creds: CanvaCredentials,
  params: CodeExchangeParams,
): Promise<CanvaTokenResult> {
  return postToken(creds, buildTokenExchangeBody(params));
}

/** Refresh tokens. Canva rotates the refresh_token — persist the returned one. */
export function refreshAccessToken(
  creds: CanvaCredentials,
  refreshToken: string,
): Promise<CanvaTokenResult> {
  return postToken(creds, buildRefreshTokenBody(refreshToken));
}

export interface CanvaProfile {
  displayName: string | null;
  canvaUserId: string | null;
  canvaTeamId: string | null;
}

/** Fetch the connected user's display name + identity (team_user ids). */
export async function fetchCanvaProfile(accessToken: string): Promise<CanvaProfile> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  const [profileRes, identityRes] = await Promise.all([
    fetch(CANVA_PROFILE_URL, { headers }),
    fetch(CANVA_IDENTITY_URL, { headers }),
  ]);

  let displayName: string | null = null;
  if (profileRes.ok) {
    const profile = asRecord(await profileRes.json().catch(() => null));
    displayName = asString(asRecord(profile?.profile)?.display_name);
  }

  let canvaUserId: string | null = null;
  let canvaTeamId: string | null = null;
  if (identityRes.ok) {
    const identity = asRecord(await identityRes.json().catch(() => null));
    const teamUser = asRecord(identity?.team_user);
    canvaUserId = asString(teamUser?.user_id);
    canvaTeamId = asString(teamUser?.team_id);
  }

  return { displayName, canvaUserId, canvaTeamId };
}

export interface CanvaDesignsPage {
  designs: NormalizedDesign[];
  continuation: string | null;
}

/** List the user's Canva designs (one page; pass a continuation to paginate). */
export async function fetchCanvaDesigns(
  accessToken: string,
  continuation?: string | null,
): Promise<CanvaDesignsPage> {
  const url = new URL(CANVA_DESIGNS_URL);
  if (continuation) url.searchParams.set('continuation', continuation);

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Canva designs endpoint ${response.status}: ${text.slice(0, 300)}`);
  }

  const record = asRecord(JSON.parse(text));
  const items = Array.isArray(record?.items) ? record.items : [];
  return {
    designs: items.map((item) => normalizeDesign(item)),
    continuation: asString(record?.continuation),
  };
}

/** Best-effort token revoke (token-type-hint omitted; Canva infers it). */
export async function revokeCanvaToken(
  creds: CanvaCredentials,
  token: string,
): Promise<void> {
  const body = new URLSearchParams();
  body.set('token', token);
  await fetch(CANVA_REVOKE_URL, {
    method: 'POST',
    headers: {
      Authorization: buildBasicAuthHeader(creds.clientId, creds.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
}

// ── Coach context ingestion ──────────────────────────────────────────────────

export interface CanvaSyncResult {
  /** Whether the user_knowledge_base entry was written. */
  coachUpdated: boolean;
  /** Number of imported designs summarized. */
  count: number;
  /** The KB category actually used ('visual_identity' or 'core'), or null on failure. */
  category: string | null;
}

/** True when a Supabase error is the user_knowledge_base.category CHECK violation. */
function isCategoryCheckViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '23514' || /category/i.test(error.message ?? '');
}

/**
 * Summarize the user's imported Canva designs and write that summary into
 * user_knowledge_base via the update_knowledge_entry RPC, so the brand coach
 * references the user's real Canva collateral. Prefers the 'visual_identity'
 * category; if the live category CHECK doesn't allow it yet, transparently
 * falls back to 'core' (an always-allowed category the coach also reads).
 *
 * Best-effort: never throws. Returns what happened so callers can surface it.
 */
export async function syncCanvaContextToKb(
  service: SupabaseClient,
  userId: string,
): Promise<CanvaSyncResult> {
  const { data, error } = await service
    .from('canva_imported_designs')
    .select('title, view_url, imported_at')
    .eq('user_id', userId)
    .order('imported_at', { ascending: false });

  if (error) {
    console.warn('[canva-sync] could not read imported designs:', error.message);
    return { coachUpdated: false, count: 0, category: null };
  }

  const rows = (data ?? []) as Array<{ title: string | null; view_url: string | null }>;
  const summary = buildCanvaContextSummary(rows);
  const structuredData = {
    source: 'canva',
    count: rows.length,
    designs: rows.slice(0, 50).map((r) => ({ title: r.title, viewUrl: r.view_url })),
  };

  const writeWith = (category: string) =>
    service.rpc('update_knowledge_entry', {
      p_user_id: userId,
      p_field_identifier: CANVA_KB_FIELD,
      p_category: category,
      p_new_content: summary,
      p_new_structured_data: structuredData,
      p_new_metadata: { source: 'canva', count: rows.length },
    });

  let category = CANVA_KB_CATEGORY_PREFERRED;
  let { error: kbError } = await writeWith(category);
  if (isCategoryCheckViolation(kbError)) {
    category = CANVA_KB_CATEGORY_FALLBACK;
    ({ error: kbError } = await writeWith(category));
  }

  if (kbError) {
    console.warn('[canva-sync] KB write failed:', kbError.message);
    return { coachUpdated: false, count: rows.length, category: null };
  }
  return { coachUpdated: true, count: rows.length, category };
}

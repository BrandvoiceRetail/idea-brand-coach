/**
 * Per-request caller identity, bound via AsyncLocalStorage.
 *
 * Identity isolation is the core correctness property: under concurrent requests,
 * tool handlers must only ever see THEIR request's caller. We use `als.run()`, which
 * scopes the store to the wrapped async call and tears it down automatically when the
 * callback settles — strictly safer than `enterWith()` + a manual `finally` reset,
 * which can leak across `await` boundaries. `getIdentity()` outside any run returns the
 * anonymous identity, never a stale one.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { getServerSupabase } from '../supabaseServer.js';
import { safeLog } from '../logging/redact.js';

export interface Identity {
  /** Supabase auth user id, or null for anonymous/unverified callers. */
  userId: string | null;
  /** Verified bearer token (kept in-memory for downstream IV-OS calls); never logged. */
  token: string | null;
  authenticated: boolean;
}

export const ANONYMOUS: Identity = Object.freeze({ userId: null, token: null, authenticated: false });

const als = new AsyncLocalStorage<Identity>();

export function runWithIdentity<T>(identity: Identity, fn: () => Promise<T>): Promise<T> {
  return als.run(identity, fn);
}

export function getIdentity(): Identity {
  return als.getStore() ?? ANONYMOUS;
}

/** Stable, non-reversible tag for correlating logs without exposing the user id. */
export function userTag(identity: Identity): string {
  if (!identity.userId) return 'anon';
  let h = 0;
  for (let i = 0; i < identity.userId.length; i++) h = (h * 31 + identity.userId.charCodeAt(i)) | 0;
  return `u_${(h >>> 0).toString(36)}`;
}

function extractBearer(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m ? m[1].trim() : null;
}

/**
 * Verify a request's Authorization header against Supabase and produce an Identity.
 * Never throws on a bad/absent token — returns ANONYMOUS so the host can still serve
 * unauthenticated-safe tools (e.g. `health`). Per-tool authorization is enforced in
 * the tool layer, not here.
 */
export async function resolveIdentity(authHeader: string | undefined): Promise<Identity> {
  const token = extractBearer(authHeader);
  if (!token) return ANONYMOUS;
  try {
    const { data, error } = await getServerSupabase().auth.getUser(token);
    if (error || !data?.user) {
      safeLog({ level: 'warn', event: 'identity.verify_failed' });
      return ANONYMOUS;
    }
    return { userId: data.user.id, token, authenticated: true };
  } catch {
    safeLog({ level: 'warn', event: 'identity.verify_error' });
    return ANONYMOUS;
  }
}

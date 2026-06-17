/**
 * Per-request, RLS-honoring Supabase client bound to the CALLER's JWT.
 *
 * Distinct from `supabaseServer.ts`, which is a single cached anon-key client used
 * ONLY for `auth.getUser(token)` JWT verification. This factory instead mints a
 * fresh client per request whose every PostgREST call carries the caller's bearer
 * in the `Authorization` header, so row-level security evaluates `auth.uid()` as the
 * caller — no service-role, no privilege escalation (guardrail #5).
 *
 * The raw verified token already lives on the per-request `Identity` (set by
 * `resolveIdentity`, kept in-memory, never logged), so we read it from there rather
 * than threading it through every call site. `identity.ts` is intentionally left
 * untouched: it already retains `token`, which is exactly the seam this needs.
 *
 * Clients are NOT cached: each binds a different JWT, and caching by token would
 * grow unboundedly and risk cross-caller bleed. They persist no session.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadConfig } from './config.js';
import { getIdentity, type Identity } from './context/identity.js';

/** Raised when a JWT-bound client is requested without an authenticated caller. */
export class UnauthenticatedError extends Error {
  constructor(message = 'no authenticated caller in scope') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

/** Factory override seam for tests — lets specs inject a stubbed client. */
type ClientFactory = (token: string) => SupabaseClient;
let factoryOverride: ClientFactory | null = null;

/**
 * Build a Supabase client whose PostgREST/Storage calls run as the bearer's user.
 * Anon key (publishable) + `Authorization: Bearer <jwt>` is the RLS-honoring server
 * pattern: the anon key passes the API gateway, the bearer drives `auth.uid()`.
 */
function buildUserClient(token: string): SupabaseClient {
  if (factoryOverride) return factoryOverride(token);
  const { supabaseUrl, supabaseAnonKey } = loadConfig();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/**
 * A JWT-bound Supabase client for the CURRENT request identity.
 * @throws UnauthenticatedError when no authenticated caller is in scope.
 */
export function getUserSupabase(): SupabaseClient {
  return getUserSupabaseFor(getIdentity());
}

/**
 * A JWT-bound Supabase client for an explicit identity (useful when the caller
 * already holds the resolved identity and wants to avoid a second ALS read).
 * @throws UnauthenticatedError when the identity is anonymous / tokenless.
 */
export function getUserSupabaseFor(identity: Identity): SupabaseClient {
  if (!identity.authenticated || !identity.token) {
    throw new UnauthenticatedError();
  }
  return buildUserClient(identity.token);
}

/** Test seam: override the underlying client factory (pass `null` to restore). */
export function __setUserSupabaseFactory(factory: ClientFactory | null): void {
  factoryOverride = factory;
}

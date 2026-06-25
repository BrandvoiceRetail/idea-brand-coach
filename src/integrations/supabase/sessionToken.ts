/**
 * Single source of the Supabase bearer token.
 *
 * Two callers need "the access token to send to Supabase / edge functions":
 *  - the Supabase client itself (its `accessToken` option, in Clerk mode), and
 *  - the handful of services that hit edge functions with a raw `fetch` and must
 *    set `Authorization: Bearer <token>` by hand (SSE streaming, doc upload, …).
 *
 * Keeping ONE accessor means both modes resolve the token the same way:
 *  - Supabase-Auth mode (default): read the current Supabase session's access_token.
 *  - Clerk mode: read the live Clerk session token (registered by ClerkAuthProvider).
 *
 * The Clerk getter is injected at runtime so this module has no Clerk import and
 * stays usable from the generated `client.ts` without a dependency cycle.
 */

import { supabase } from './client';

type TokenGetter = () => Promise<string | null>;

// Default getter: the Supabase-Auth session token. Overridden in Clerk mode.
const defaultGetter: TokenGetter = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

let currentGetter: TokenGetter = defaultGetter;

/**
 * Register the source of the bearer token. ClerkAuthProvider calls this with a
 * getter backed by Clerk's `session.getToken()`. Pass `null` to restore the
 * default Supabase-session getter (e.g. on Clerk sign-out / unmount).
 */
export function setSupabaseAccessTokenGetter(getter: TokenGetter | null): void {
  currentGetter = getter ?? defaultGetter;
}

/** Resolve the current bearer token, or null when unauthenticated. */
export async function getSupabaseAccessToken(): Promise<string | null> {
  return currentGetter();
}

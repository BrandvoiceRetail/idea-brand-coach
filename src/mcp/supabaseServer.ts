/**
 * Server-side Supabase client for JWT verification.
 *
 * Distinct from the SPA client (`src/integrations/supabase/client.ts`), which uses
 * `localStorage` + `import.meta.env` and cannot run under Node. This one persists no
 * session and exists only to call `auth.getUser(token)` on a caller-supplied JWT.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadConfig } from './config.js';

let cached: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (cached) return cached;
  const { supabaseUrl, supabaseAnonKey } = loadConfig();
  cached = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Test seam. */
export function __setServerSupabase(client: SupabaseClient | null): void {
  cached = client;
}

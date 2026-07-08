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
let cachedServiceRole: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (cached) return cached;
  const { supabaseUrl, supabaseAnonKey } = loadConfig();
  cached = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Server-side Supabase client with service role key for elevated operations.
 * Used for reading coach_instructions during server initialization (no user context).
 * Falls back to anon-key client if service role key not available.
 */
export function getServiceRoleSupabase(): SupabaseClient {
  if (cachedServiceRole) return cachedServiceRole;

  const { supabaseUrl } = loadConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceRoleKey) {
    cachedServiceRole = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } else {
    // Fall back to anon client if service role key not available. Loud on
    // purpose: with the anon client, RLS blocks coach_instructions reads and
    // the substrate silently no-ops (deploy env must set the key — see
    // deploy/mcp/.env.example).
    console.warn(
      '[supabaseServer] SUPABASE_SERVICE_ROLE_KEY not set — falling back to the anon client; coach_instructions reads will be RLS-blocked (fail-open to inline prompts).',
    );
    cachedServiceRole = getServerSupabase();
  }

  return cachedServiceRole;
}

/** Test seam. */
export function __setServerSupabase(client: SupabaseClient | null): void {
  cached = client;
}

/** Test seam for service role client. */
export function __setServiceRoleSupabase(client: SupabaseClient | null): void {
  cachedServiceRole = client;
}

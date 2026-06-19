/**
 * Small shared helpers for authenticated edge functions:
 *  - getServiceClient(): service-role Supabase client (bypasses RLS).
 *  - getAuthedUserId(req): the caller's user id derived from the verified JWT,
 *    or null for anonymous/missing tokens.
 *  - jsonResponse(): JSON response with the shared CORS headers.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from './cors.ts';

export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

/**
 * Resolve the authenticated user's id from the request's Authorization header.
 * The JWT is passed explicitly to getUser(jwt) — relying on the global-header
 * client + no-arg getUser() does NOT resolve the user in the edge runtime
 * (there is no stored session, and the header doesn't reach the GoTrue client),
 * so it would return null even for a valid token.
 */
export async function getAuthedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^[Bb]earer\s+/, '').trim();
  if (!token) return null;
  const client = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  );
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error) return null;
  return user?.id ?? null;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

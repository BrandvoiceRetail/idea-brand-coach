// canva-oauth-callback — public GET hit by Canva's browser redirect.
//
// verify_jwt = false (no app JWT here). Security comes from the opaque `state`:
// it is looked up in canva_oauth_states, expiry-checked, and consumed. On
// success we exchange the code (Basic auth + code_verifier + redirect_uri),
// fetch the profile/identity, upsert canva_connections (service role), delete
// the state row, and 302 back to the validated return_url with ?canva=connected.
// Tokens are NEVER written to the response. Any failure 302s back with
// ?canva=error&reason=<slug>. The return_url host is re-validated against the
// allowlist (defense in depth) before any redirect.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { isTokenExpired } from '../_shared/canva.ts';
import {
  exchangeCodeForTokens,
  fetchCanvaProfile,
  type CanvaCredentials,
} from '../_shared/canvaClient.ts';

function allowedOrigins(): string[] {
  return (Deno.env.get('CANVA_ALLOWED_RETURN_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/** First allowed origin + the integrations path — the safe fallback target. */
function fallbackReturnUrl(): string {
  const first = allowedOrigins()[0] ?? '';
  return `${first}/v1/integrations`;
}

/** Validate that a return_url's origin is in the allowlist; else null. */
function safeReturnUrl(returnUrl: string | null | undefined): string | null {
  if (!returnUrl) return null;
  try {
    const origin = new URL(returnUrl).origin;
    return allowedOrigins().includes(origin) ? returnUrl : null;
  } catch {
    return null;
  }
}

function redirect(returnUrl: string, params: Record<string, string>): Response {
  try {
    const url = new URL(returnUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: url.toString() },
    });
  } catch {
    // No valid absolute return URL (e.g. CANVA_ALLOWED_RETURN_ORIGINS unset).
    // Never 500 the public endpoint — return a plain, closable message.
    const reason = params.reason ? ` (${params.reason})` : '';
    return new Response(
      `Canva connection ${params.canva ?? 'error'}${reason}. You can close this tab and return to the app.`,
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } },
    );
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Resolve a safe redirect target up front; refined once we know the state row.
  let returnUrl = fallbackReturnUrl();

  try {
    const requestUrl = new URL(req.url);
    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');
    const oauthError = requestUrl.searchParams.get('error');

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Canva reported an error (e.g. user denied consent).
    if (oauthError) {
      return redirect(returnUrl, { canva: 'error', reason: 'access_denied' });
    }
    if (!code || !state) {
      return redirect(returnUrl, { canva: 'error', reason: 'missing_params' });
    }

    // Look up + validate the state row.
    const { data: stateRow, error: stateError } = await admin
      .from('canva_oauth_states')
      .select('user_id, code_verifier, return_url, expires_at')
      .eq('state', state)
      .maybeSingle();

    if (stateError || !stateRow) {
      return redirect(returnUrl, { canva: 'error', reason: 'invalid_state' });
    }

    // Prefer the stored return_url (re-validated); fall back to the safe default.
    returnUrl = safeReturnUrl(stateRow.return_url) ?? returnUrl;

    if (isTokenExpired(stateRow.expires_at, 0)) {
      await admin.from('canva_oauth_states').delete().eq('state', state);
      return redirect(returnUrl, { canva: 'error', reason: 'state_expired' });
    }

    const clientId = Deno.env.get('CANVA_CLIENT_ID');
    const clientSecret = Deno.env.get('CANVA_CLIENT_SECRET');
    const redirectUri = Deno.env.get('CANVA_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      console.error('canva-oauth-callback: missing Canva secrets');
      return redirect(returnUrl, { canva: 'error', reason: 'not_configured' });
    }
    const creds: CanvaCredentials = { clientId, clientSecret };

    // Exchange the authorization code (PKCE: includes code_verifier).
    const tokens = await exchangeCodeForTokens(creds, {
      code,
      codeVerifier: stateRow.code_verifier,
      redirectUri,
    });

    // Best-effort identity enrichment — failure must not block the connection.
    const profile = await fetchCanvaProfile(tokens.accessToken).catch(() => ({
      displayName: null,
      canvaUserId: null,
      canvaTeamId: null,
    }));

    const { error: upsertError } = await admin.from('canva_connections').upsert(
      {
        user_id: stateRow.user_id,
        canva_user_id: profile.canvaUserId,
        canva_team_id: profile.canvaTeamId,
        display_name: profile.displayName,
        scopes: tokens.scope,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_expires_at: tokens.expiresAt,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (upsertError) {
      console.error('canva-oauth-callback upsert error:', upsertError.message);
      return redirect(returnUrl, { canva: 'error', reason: 'persist_failed' });
    }

    // Consume the one-time state row.
    await admin.from('canva_oauth_states').delete().eq('state', state);

    return redirect(returnUrl, { canva: 'connected' });
  } catch (err) {
    console.error('canva-oauth-callback error:', (err as Error)?.message ?? err);
    return redirect(returnUrl, { canva: 'error', reason: 'callback_failed' });
  }
});

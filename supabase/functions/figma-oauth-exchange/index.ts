/**
 * figma-oauth-exchange — completes the Figma OAuth flow.
 *
 * Called by the SPA callback route with the {code, state} returned by Figma.
 * Validates the single-use state against the authenticated user, exchanges the
 * code for tokens, fetches the Figma profile, and stores the connection with
 * tokens encrypted at rest. Everything is tied to auth.uid().
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient, getAuthedUserId, jsonResponse } from '../_shared/edge-auth.ts';
import {
  exchangeCodeForToken,
  getMe,
  encryptToken,
  FigmaApiError,
} from '../_shared/figma.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return jsonResponse({ error: 'Authentication required' }, 401);

    const clientId = Deno.env.get('FIGMA_CLIENT_ID');
    const clientSecret = Deno.env.get('FIGMA_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return jsonResponse({ error: 'Figma integration is not configured' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code : '';
    const state = typeof body?.state === 'string' ? body.state : '';
    const redirectUri = typeof body?.redirectUri === 'string' ? body.redirectUri.trim() : '';
    if (!code || !state || !redirectUri) {
      return jsonResponse({ error: 'Missing code, state, or redirectUri' }, 400);
    }

    const service = getServiceClient();

    // Atomically consume the single-use state row (DELETE ... RETURNING) so two
    // concurrent/replayed requests can't both pass validation (no SELECT→DELETE race).
    const { data: stateRow } = await service
      .from('figma_oauth_state')
      .delete()
      .eq('state', state)
      .select('user_id, redirect_uri, expires_at')
      .maybeSingle();

    if (!stateRow) return jsonResponse({ error: 'Invalid or expired connection state' }, 400);
    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      return jsonResponse({ error: 'Connection state expired — please try again' }, 400);
    }
    if (stateRow.user_id !== userId) {
      return jsonResponse({ error: 'Connection state does not match the signed-in user' }, 403);
    }
    // Bind the exchange to the redirect_uri captured when the flow started.
    if (stateRow.redirect_uri !== redirectUri) {
      return jsonResponse({ error: 'redirectUri mismatch' }, 400);
    }

    // Exchange the authorization code for tokens.
    const token = await exchangeCodeForToken({ clientId, clientSecret, redirectUri, code });

    // Best-effort profile lookup (don't fail the connection if /me hiccups).
    let me: Awaited<ReturnType<typeof getMe>> | null = null;
    try {
      me = await getMe(token.access_token);
    } catch (e) {
      console.warn('[figma-oauth-exchange] /me lookup failed:', e);
    }

    const encKey = Deno.env.get('FIGMA_TOKEN_ENC_KEY');
    const accessEnc = await encryptToken(token.access_token, encKey);
    const refreshEnc = token.refresh_token ? await encryptToken(token.refresh_token, encKey) : null;
    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null;

    const { error: upsertError } = await service.from('figma_connections').upsert(
      {
        user_id: userId,
        figma_user_id: me?.id ?? (token.user_id != null ? String(token.user_id) : null),
        figma_handle: me?.handle ?? null,
        figma_email: me?.email ?? null,
        scope: Deno.env.get('FIGMA_OAUTH_SCOPE') ?? 'files:read',
        access_token: accessEnc,
        refresh_token: refreshEnc,
        token_type: 'Bearer',
        expires_at: expiresAt,
      },
      { onConflict: 'user_id' },
    );
    if (upsertError) {
      console.error('[figma-oauth-exchange] failed to store connection:', upsertError);
      return jsonResponse({ error: 'Could not save the Figma connection' }, 500);
    }

    return jsonResponse({
      connected: true,
      handle: me?.handle ?? null,
      email: me?.email ?? null,
      figmaUserId: me?.id ?? null,
    });
  } catch (error) {
    if (error instanceof FigmaApiError) {
      // Don't log error.body — a provider error body could echo the auth code.
      console.error('[figma-oauth-exchange] Figma error status:', error.status);
      return jsonResponse({ error: 'Figma rejected the authorization. Please try connecting again.' }, 400);
    }
    console.error('[figma-oauth-exchange] error:', error);
    return jsonResponse({ error: 'Unexpected error completing Figma connection' }, 500);
  }
});

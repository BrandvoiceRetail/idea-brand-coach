/**
 * figma-oauth-start — begins the Figma OAuth flow for an authenticated user.
 *
 * Generates a single-use CSRF state, persists it (service-role only), and returns
 * the Figma authorize URL the browser should redirect to. Tied to auth.uid().
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient, getAuthedUserId, jsonResponse } from '../_shared/edge-auth.ts';
import { buildAuthorizeUrl, generateState, FIGMA_DEFAULT_SCOPE } from '../_shared/figma.ts';

const STATE_TTL_MS = Number(Deno.env.get('FIGMA_STATE_TTL_SECONDS') ?? '600') * 1000;
const CALLBACK_SUFFIX = '/integrations/figma/callback';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return jsonResponse({ error: 'Authentication required' }, 401);

    const clientId = Deno.env.get('FIGMA_CLIENT_ID');
    if (!clientId) return jsonResponse({ error: 'Figma integration is not configured' }, 500);

    const body = await req.json().catch(() => ({}));
    const redirectUri = typeof body?.redirectUri === 'string' ? body.redirectUri.trim() : '';

    // Validate the redirect: exact callback PATH (not a suffix match, which would
    // accept https://evil.com/x/integrations/figma/callback) and — when
    // FIGMA_ALLOWED_ORIGINS is set — an allow-listed origin.
    let redirectOrigin = '';
    try {
      const parsed = new URL(redirectUri);
      redirectOrigin = parsed.origin;
      if (parsed.pathname !== CALLBACK_SUFFIX) {
        return jsonResponse({ error: 'Invalid redirectUri' }, 400);
      }
    } catch {
      return jsonResponse({ error: 'Invalid redirectUri' }, 400);
    }
    const allowedOrigins = (Deno.env.get('FIGMA_ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (allowedOrigins.length > 0 && !allowedOrigins.includes(redirectOrigin)) {
      return jsonResponse({ error: 'redirectUri origin not allowed' }, 400);
    }

    const service = getServiceClient();
    // Opportunistic cleanup of expired state rows.
    await service.from('figma_oauth_state').delete().lt('expires_at', new Date().toISOString());

    const state = generateState();
    const { error: insertError } = await service.from('figma_oauth_state').insert({
      state,
      user_id: userId,
      redirect_uri: redirectUri,
      expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
    });
    if (insertError) {
      console.error('[figma-oauth-start] failed to persist state:', insertError);
      return jsonResponse({ error: 'Could not start Figma connection' }, 500);
    }

    const url = buildAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      scope: Deno.env.get('FIGMA_OAUTH_SCOPE') ?? FIGMA_DEFAULT_SCOPE,
    });

    return jsonResponse({ url, state });
  } catch (error) {
    console.error('[figma-oauth-start] error:', error);
    return jsonResponse({ error: 'Unexpected error starting Figma connection' }, 500);
  }
});

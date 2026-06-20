// canva-list-designs — list the user's live Canva designs (refresh if needed).
//
// JWT → user (verified). Loads the connection (service role); 409 not_connected
// if absent. If the access token is expired/near-expiry, refreshes via the
// refresh-token grant (Basic auth) and PERSISTS the rotated access+refresh+
// expiry before calling Canva. Returns normalized designs + an optional
// continuation cursor. Tokens are never returned to the client.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { isTokenExpired } from '../_shared/canva.ts';
import {
  refreshAccessToken,
  fetchCanvaDesigns,
  type CanvaCredentials,
} from '../_shared/canvaClient.ts';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: connection, error: connError } = await admin
      .from('canva_connections')
      .select('access_token, refresh_token, token_expires_at, scopes')
      .eq('user_id', user.id)
      .maybeSingle();
    if (connError) {
      console.error('canva-list-designs read error:', connError.message);
      return jsonResponse({ error: 'list_failed' }, 500);
    }
    if (!connection) {
      return jsonResponse({ error: 'not_connected' }, 409);
    }

    const body = await req.json().catch(() => ({}));
    const continuation =
      typeof body?.continuation === 'string' && body.continuation.length > 0
        ? body.continuation
        : null;

    let accessToken = connection.access_token as string;

    // Refresh + persist if the token is expired or near expiry.
    if (isTokenExpired(connection.token_expires_at)) {
      const clientId = Deno.env.get('CANVA_CLIENT_ID');
      const clientSecret = Deno.env.get('CANVA_CLIENT_SECRET');
      if (!clientId || !clientSecret) {
        console.error('canva-list-designs: missing Canva secrets for refresh');
        return jsonResponse({ error: 'integration_not_configured' }, 500);
      }
      const creds: CanvaCredentials = { clientId, clientSecret };

      let refreshed;
      try {
        refreshed = await refreshAccessToken(creds, connection.refresh_token);
      } catch (refreshErr) {
        console.error('canva-list-designs refresh error:', (refreshErr as Error)?.message);
        return jsonResponse({ error: 'token_refresh_failed' }, 502);
      }

      const { error: persistError } = await admin
        .from('canva_connections')
        .update({
          access_token: refreshed.accessToken,
          refresh_token: refreshed.refreshToken, // rotates — persist the new one
          token_expires_at: refreshed.expiresAt,
          scopes: refreshed.scope ?? connection.scopes,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      if (persistError) {
        console.error('canva-list-designs persist error:', persistError.message);
        return jsonResponse({ error: 'list_failed' }, 500);
      }

      accessToken = refreshed.accessToken;
    }

    let page;
    try {
      page = await fetchCanvaDesigns(accessToken, continuation);
    } catch (fetchErr) {
      console.error('canva-list-designs fetch error:', (fetchErr as Error)?.message);
      return jsonResponse({ error: 'canva_request_failed' }, 502);
    }

    return jsonResponse(
      {
        designs: page.designs,
        ...(page.continuation ? { continuation: page.continuation } : {}),
      },
      200,
    );
  } catch (err) {
    console.error('canva-list-designs error:', (err as Error)?.message ?? err);
    return jsonResponse({ error: 'list_failed' }, 500);
  }
});

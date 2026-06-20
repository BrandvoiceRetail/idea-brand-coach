// canva-disconnect — best-effort token revoke + delete the connection row.
//
// JWT → user (verified). Loads the connection (service role), best-effort POSTs
// the refresh + access tokens to Canva's revoke endpoint (failures are
// swallowed — the local delete is what matters), then deletes the row.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { revokeCanvaToken, type CanvaCredentials } from '../_shared/canvaClient.ts';

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

    const { data: connection } = await admin
      .from('canva_connections')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .maybeSingle();

    // Best-effort revoke; never let a revoke failure block the local delete.
    const clientId = Deno.env.get('CANVA_CLIENT_ID');
    const clientSecret = Deno.env.get('CANVA_CLIENT_SECRET');
    if (connection && clientId && clientSecret) {
      const creds: CanvaCredentials = { clientId, clientSecret };
      for (const token of [connection.refresh_token, connection.access_token]) {
        if (token) {
          await revokeCanvaToken(creds, token).catch((revokeErr) => {
            console.error('canva-disconnect revoke (non-fatal):', (revokeErr as Error)?.message);
          });
        }
      }
    }

    const { error: deleteError } = await admin
      .from('canva_connections')
      .delete()
      .eq('user_id', user.id);
    if (deleteError) {
      console.error('canva-disconnect delete error:', deleteError.message);
      return jsonResponse({ error: 'disconnect_failed' }, 500);
    }

    return jsonResponse({ disconnected: true }, 200);
  } catch (err) {
    console.error('canva-disconnect error:', (err as Error)?.message ?? err);
    return jsonResponse({ error: 'disconnect_failed' }, 500);
  }
});

// canva-status — report the caller's Canva connection status (NO tokens).
//
// JWT → user (verified). Reads canva_connections via the service role (the
// table has no client policies) and returns only non-sensitive status fields.
// access_token / refresh_token are never selected or returned.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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
    // Deliberately exclude access_token / refresh_token from the projection.
    const { data, error } = await admin
      .from('canva_connections')
      .select('display_name, canva_user_id, scopes, token_expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('canva-status read error:', error.message);
      return jsonResponse({ error: 'status_failed' }, 500);
    }

    if (!data) {
      return jsonResponse({ connected: false }, 200);
    }

    return jsonResponse(
      {
        connected: true,
        displayName: data.display_name ?? undefined,
        canvaUserId: data.canva_user_id ?? undefined,
        scopes: data.scopes ?? undefined,
        tokenExpiresAt: data.token_expires_at ?? undefined,
      },
      200,
    );
  } catch (err) {
    console.error('canva-status error:', (err as Error)?.message ?? err);
    return jsonResponse({ error: 'status_failed' }, 500);
  }
});

// canva-sync — push the user's imported Canva designs into their brand-coach context.
//
// JWT → user (verified). Summarizes the caller's canva_imported_designs and
// writes that summary into user_knowledge_base (via the update_knowledge_entry
// RPC), so the idea-framework consultant references the user's real Canva
// collateral. No Canva token is needed — it summarizes the already-imported,
// user-curated set. Returns the sync status for the UI.
//   POST {}  →  { coachUpdated: boolean, count: number, category: string|null }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { syncCanvaContextToKb } from '../_shared/canvaClient.ts';

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

    const result = await syncCanvaContextToKb(admin, user.id);
    return jsonResponse(result, 200);
  } catch (err) {
    console.error('canva-sync error:', (err as Error)?.message ?? err);
    return jsonResponse({ error: 'sync_failed' }, 500);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// reparent-anon-run — carry an anonymous /v5 run into a real account.
//
// A guest /v5 run stores everything under an anonymous auth user. When that
// person signs in to (or turns out to already have) a real account, the anon
// rows are invisible to it (task #31 "amnesia"). This function moves them.
//
// SECURITY MODEL — proof of BOTH identities, nothing trusted from the body:
//   * Authorization header = the REAL account's JWT (the freshly signed-in
//     session). Must verify and must NOT be anonymous.
//   * body.anonToken = the OLD anonymous session's JWT. Must verify and MUST
//     be anonymous. Holding a valid token for it proves the caller owned
//     that session — you cannot reparent data you never controlled.
// The actual move runs in the SECURITY DEFINER SQL fn reparent_anon_user_data
// (service-role only), which handles the unique-constraint edge cases.
// Afterwards the anon auth user is deleted (best-effort) so the same session
// cannot be replayed and orphaned auth rows do not accumulate.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const verifier = createClient(supabaseUrl, anonKey)

    // ── Identity 1: the real account (Authorization header). ──
    const realJwt = (req.headers.get('Authorization') ?? '').replace(/^[Bb]earer\s+/, '').trim()
    if (!realJwt) return jsonResponse({ error: 'Unauthorized' }, 401)
    const { data: { user: realUser } } = await verifier.auth.getUser(realJwt)
    if (!realUser) return jsonResponse({ error: 'Unauthorized' }, 401)
    if (realUser.is_anonymous) {
      return jsonResponse({ error: 'Target session must be a real (non-anonymous) account.' }, 403)
    }

    // ── Identity 2: the anonymous session being absorbed (body). ──
    const body = await req.json().catch(() => ({}))
    const anonToken = typeof body?.anonToken === 'string' ? body.anonToken.trim() : ''
    if (!anonToken) return jsonResponse({ error: 'Missing anonToken.' }, 400)
    const { data: { user: anonUser } } = await verifier.auth.getUser(anonToken)
    if (!anonUser) return jsonResponse({ error: 'Anonymous session invalid or expired.' }, 400)
    if (!anonUser.is_anonymous) {
      return jsonResponse({ error: 'anonToken must belong to an anonymous session.' }, 403)
    }
    if (anonUser.id === realUser.id) return jsonResponse({ moved: {}, note: 'same user' })

    // ── Move the data (service role → SECURITY DEFINER fn). ──
    const service = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: summary, error } = await service.rpc('reparent_anon_user_data', {
      p_from: anonUser.id,
      p_to: realUser.id,
    })
    if (error) {
      console.error('[reparent-anon-run] rpc failed:', error.message)
      return jsonResponse({ error: 'Could not carry the run over. Please try again.' }, 500)
    }

    // ── Best-effort cleanup: retire the drained anonymous auth user. ──
    try {
      await service.auth.admin.deleteUser(anonUser.id)
    } catch (e) {
      console.error('[reparent-anon-run] anon cleanup failed (non-fatal):', e)
    }

    // Shape-only logging — no emails/content.
    console.log('[reparent-anon-run] moved', { tables: Object.keys(summary ?? {}).length })
    return jsonResponse({ moved: summary ?? {} })
  } catch (error) {
    console.error('[reparent-anon-run] error:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})

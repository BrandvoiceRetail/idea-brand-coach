// canva-oauth-start — mint OAuth state + PKCE, return the Canva authorize URL.
//
// JWT → user (verified). The caller's Origin is validated against
// CANVA_ALLOWED_RETURN_ORIGINS, the post-callback return_url is derived from it,
// a random state + PKCE verifier are persisted server-side (service role,
// 10-min expiry), and only the authorize URL is returned. The code_verifier
// NEVER reaches the browser.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  generateCodeVerifier,
  deriveCodeChallenge,
  generateState,
  buildAuthorizeUrl,
  DEFAULT_CANVA_SCOPES,
} from '../_shared/canva.ts';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Parse the comma-separated allowlist of permitted return origins. */
function allowedOrigins(): string[] {
  return (Deno.env.get('CANVA_ALLOWED_RETURN_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/** Restrict the return path to an app-relative path (no open-redirect via path). */
function sanitizeReturnPath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/v1/integrations';
  }
  return raw;
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

    const origin = req.headers.get('Origin') ?? '';
    if (!allowedOrigins().includes(origin)) {
      return jsonResponse({ error: 'origin_not_allowed' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const returnPath = sanitizeReturnPath(body?.returnPath);
    const returnUrl = `${origin}${returnPath}`;

    const clientId = Deno.env.get('CANVA_CLIENT_ID');
    const redirectUri = Deno.env.get('CANVA_REDIRECT_URI');
    if (!clientId || !redirectUri) {
      console.error('canva-oauth-start: missing CANVA_CLIENT_ID / CANVA_REDIRECT_URI');
      return jsonResponse({ error: 'integration_not_configured' }, 500);
    }

    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await deriveCodeChallenge(codeVerifier);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { error } = await admin.from('canva_oauth_states').insert({
      state,
      user_id: user.id,
      code_verifier: codeVerifier,
      return_url: returnUrl,
      expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
    });
    if (error) {
      console.error('canva-oauth-start insert error:', error.message);
      return jsonResponse({ error: 'failed_to_start' }, 500);
    }

    const url = buildAuthorizeUrl({
      clientId,
      redirectUri,
      scope: DEFAULT_CANVA_SCOPES,
      state,
      codeChallenge,
    });

    return jsonResponse({ url }, 200);
  } catch (err) {
    console.error('canva-oauth-start error:', (err as Error)?.message ?? err);
    return jsonResponse({ error: 'failed_to_start' }, 500);
  }
});

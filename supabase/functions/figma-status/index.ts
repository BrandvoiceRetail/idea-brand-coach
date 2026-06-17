/**
 * figma-status — returns the caller's Figma connection status + recent imports.
 *
 * Never returns tokens. Reads are done with the service role (the connection
 * table is service-role-only), scoped to the authenticated user's id.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient, getAuthedUserId, jsonResponse } from '../_shared/edge-auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return jsonResponse({ error: 'Authentication required' }, 401);

    const service = getServiceClient();

    const { data: conn } = await service
      .from('figma_connections')
      .select('figma_user_id, figma_handle, figma_email, scope, expires_at, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: imports } = await service
      .from('figma_imports')
      .select('id, file_key, file_name, thumbnail_url, last_modified, palette, typography, components, pages, summary, created_at, updated_at')
      .eq('user_id', userId)
      // Order by updated_at so a re-imported file surfaces at the top with a fresh date.
      .order('updated_at', { ascending: false })
      .limit(20);

    return jsonResponse({
      connected: !!conn,
      connection: conn
        ? {
            figmaUserId: conn.figma_user_id,
            handle: conn.figma_handle,
            email: conn.figma_email,
            scope: conn.scope,
            connectedAt: conn.created_at,
            expiresAt: conn.expires_at,
          }
        : null,
      imports: imports ?? [],
    });
  } catch (error) {
    console.error('[figma-status] error:', error);
    return jsonResponse({ error: 'Could not load Figma status' }, 500);
  }
});

/**
 * figma-disconnect — removes the caller's Figma connection (deletes tokens).
 *
 * Imported design data in figma_imports and the coach's visual_identity KB entry
 * are intentionally kept (they are the user's brand data, not Figma credentials).
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
    const { error } = await service.from('figma_connections').delete().eq('user_id', userId);
    if (error) {
      console.error('[figma-disconnect] error:', error);
      return jsonResponse({ error: 'Could not disconnect Figma' }, 500);
    }

    return jsonResponse({ disconnected: true });
  } catch (error) {
    console.error('[figma-disconnect] error:', error);
    return jsonResponse({ error: 'Unexpected error disconnecting Figma' }, 500);
  }
});

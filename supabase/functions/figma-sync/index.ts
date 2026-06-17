/**
 * figma-sync — pulls a connected user's Figma file and ingests its design data.
 *
 * Flow: resolve file key -> load connection -> refresh token if expiring ->
 * fetch file -> extract palette/typography/components -> upsert figma_imports ->
 * write a readable "visual_identity" summary into user_knowledge_base so the
 * brand coach (idea-framework-consultant-claude) references the user's real
 * visual brand. All scoped to auth.uid().
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient, getAuthedUserId, jsonResponse } from '../_shared/edge-auth.ts';
import {
  getFile,
  refreshAccessToken,
  encryptToken,
  decryptToken,
  FigmaApiError,
} from '../_shared/figma.ts';
import {
  extractDesign,
  buildDesignSummary,
  parseFigmaFileKey,
  type FigmaFileResponse,
} from '../_shared/figma-extract.ts';

const REFRESH_BUFFER_MS = 60_000; // refresh if the token expires within 60s

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return jsonResponse({ error: 'Authentication required' }, 401);

    const body = await req.json().catch(() => ({}));
    const rawFile = typeof body?.fileUrlOrKey === 'string' ? body.fileUrlOrKey : '';
    const brandId = typeof body?.brandId === 'string' && body.brandId ? body.brandId : null;

    const fileKey = parseFigmaFileKey(rawFile);
    if (!fileKey) {
      return jsonResponse({ error: 'Enter a valid Figma file URL or key' }, 400);
    }

    const service = getServiceClient();
    const { data: conn } = await service
      .from('figma_connections')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (!conn) {
      return jsonResponse({ error: 'Connect your Figma account first', code: 'not_connected' }, 400);
    }

    const encKey = Deno.env.get('FIGMA_TOKEN_ENC_KEY');
    let accessToken = await decryptToken(conn.access_token, encKey);

    // Refresh the access token if it is missing or about to expire.
    const expiresMs = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
    const needsRefresh = !!conn.refresh_token && (!expiresMs || expiresMs - Date.now() < REFRESH_BUFFER_MS);
    if (needsRefresh) {
      const clientId = Deno.env.get('FIGMA_CLIENT_ID');
      const clientSecret = Deno.env.get('FIGMA_CLIENT_SECRET');
      if (clientId && clientSecret) {
        try {
          const refreshToken = await decryptToken(conn.refresh_token as string, encKey);
          const refreshed = await refreshAccessToken({ clientId, clientSecret, refreshToken });
          accessToken = refreshed.access_token;
          await service
            .from('figma_connections')
            .update({
              access_token: await encryptToken(refreshed.access_token, encKey),
              refresh_token: refreshed.refresh_token
                ? await encryptToken(refreshed.refresh_token, encKey)
                : conn.refresh_token,
              expires_at: refreshed.expires_in
                ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
                : null,
            })
            .eq('user_id', userId);
        } catch (e) {
          // Don't log the raw error object — log a message only.
          console.warn('[figma-sync] token refresh failed, using existing token:', e instanceof Error ? e.message : 'unknown');
        }
      }
    }

    // Fetch + extract.
    const fileJson = (await getFile(accessToken, fileKey)) as FigmaFileResponse;
    const design = extractDesign(fileJson);
    const summary = buildDesignSummary(design);

    // Persist the structured import (one row per file, latest wins).
    const { data: imported, error: importError } = await service
      .from('figma_imports')
      .upsert(
        {
          user_id: userId,
          brand_id: brandId,
          file_key: fileKey,
          file_name: design.fileName,
          thumbnail_url: design.thumbnailUrl ?? null,
          last_modified: design.lastModified ?? null,
          palette: design.palette,
          typography: design.typography,
          components: design.components,
          pages: design.pages,
          summary,
        },
        { onConflict: 'user_id,file_key' },
      )
      .select('id, file_key, file_name, thumbnail_url, last_modified, palette, typography, components, pages, summary, created_at, updated_at')
      .single();

    if (importError) {
      console.error('[figma-sync] failed to store import:', importError);
      return jsonResponse({ error: 'Could not save the imported design data' }, 500);
    }

    // Feed the brand coach: a versioned "visual_identity" KB entry it already reads.
    // Best-effort — a KB write failure should not fail the import.
    const { error: kbError } = await service.rpc('update_knowledge_entry', {
      p_user_id: userId,
      p_field_identifier: 'figma_visual_identity',
      p_category: 'visual_identity',
      p_new_content: summary,
      p_new_structured_data: {
        fileKey,
        fileName: design.fileName,
        palette: design.palette,
        typography: design.typography,
        components: design.components,
        pages: design.pages,
      },
      p_new_metadata: { source: 'figma', file_key: fileKey },
    });
    if (kbError) console.warn('[figma-sync] coach KB update failed:', kbError);

    return jsonResponse({ import: imported, coachUpdated: !kbError });
  } catch (error) {
    if (error instanceof FigmaApiError) {
      console.error('[figma-sync] Figma error:', error.status, error.body);
      if (error.status === 403 || error.status === 404) {
        return jsonResponse(
          { error: 'No access to that Figma file. Check the URL, or that your Figma account can open it.', code: 'file_forbidden' },
          400,
        );
      }
      if (error.status === 401) {
        return jsonResponse(
          { error: 'Your Figma connection expired. Please reconnect.', code: 'reauth_required' },
          401,
        );
      }
      return jsonResponse({ error: 'Figma request failed. Please try again.' }, 502);
    }
    console.error('[figma-sync] error:', error);
    return jsonResponse({ error: 'Unexpected error importing from Figma' }, 500);
  }
});

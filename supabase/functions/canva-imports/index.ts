// canva-imports — manage the user's imported Canva designs (no tokens here).
//
// JWT → user (verified). Service-role CRUD against canva_imported_designs:
//   { action: 'list' }                          → { designs: ImportedDesign[] }
//   { action: 'add', design: {...} }            → { design: ImportedDesign }
//   { action: 'remove', designId }              → { removed: true }
// The frontend reaches this table ONLY through this function, keeping the
// generated types.ts untouched. user_id is always the verified caller.

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

interface ImportedDesignRow {
  id: string;
  canva_design_id: string;
  title: string | null;
  thumbnail_url: string | null;
  edit_url: string | null;
  view_url: string | null;
  imported_at: string;
}

function toImportedDesign(row: ImportedDesignRow) {
  return {
    id: row.id,
    canvaDesignId: row.canva_design_id,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    editUrl: row.edit_url,
    viewUrl: row.view_url,
    importedAt: row.imported_at,
  };
}

const SELECT_COLUMNS =
  'id, canva_design_id, title, thumbnail_url, edit_url, view_url, imported_at';

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

    const body = await req.json().catch(() => ({}));
    const action = asString(body?.action);

    if (action === 'list') {
      const { data, error } = await admin
        .from('canva_imported_designs')
        .select(SELECT_COLUMNS)
        .eq('user_id', user.id)
        .order('imported_at', { ascending: false });
      if (error) {
        console.error('canva-imports list error:', error.message);
        return jsonResponse({ error: 'imports_failed' }, 500);
      }
      return jsonResponse(
        { designs: (data as ImportedDesignRow[]).map(toImportedDesign) },
        200,
      );
    }

    if (action === 'add') {
      const design = asRecord(body?.design);
      const canvaDesignId = asString(design?.id);
      if (!canvaDesignId) {
        return jsonResponse({ error: 'design_id_required' }, 400);
      }
      const { data, error } = await admin
        .from('canva_imported_designs')
        .upsert(
          {
            user_id: user.id,
            canva_design_id: canvaDesignId,
            title: asString(design?.title),
            thumbnail_url: asString(design?.thumbnailUrl),
            edit_url: asString(design?.editUrl),
            view_url: asString(design?.viewUrl),
          },
          { onConflict: 'user_id,canva_design_id' },
        )
        .select(SELECT_COLUMNS)
        .single();
      if (error) {
        console.error('canva-imports add error:', error.message);
        return jsonResponse({ error: 'imports_failed' }, 500);
      }
      // Keep the coach's context in sync with the imported set (best-effort).
      const sync = await syncCanvaContextToKb(admin, user.id).catch(() => null);
      return jsonResponse(
        { design: toImportedDesign(data as ImportedDesignRow), coachUpdated: sync?.coachUpdated ?? false },
        200,
      );
    }

    if (action === 'remove') {
      const designId = asString(body?.designId);
      if (!designId) {
        return jsonResponse({ error: 'design_id_required' }, 400);
      }
      const { error } = await admin
        .from('canva_imported_designs')
        .delete()
        .eq('user_id', user.id)
        .eq('canva_design_id', designId);
      if (error) {
        console.error('canva-imports remove error:', error.message);
        return jsonResponse({ error: 'imports_failed' }, 500);
      }
      // Re-summarize the (now smaller) imported set into the coach's context.
      const sync = await syncCanvaContextToKb(admin, user.id).catch(() => null);
      return jsonResponse({ removed: true, coachUpdated: sync?.coachUpdated ?? false }, 200);
    }

    return jsonResponse({ error: 'invalid_action' }, 400);
  } catch (err) {
    console.error('canva-imports error:', (err as Error)?.message ?? err);
    return jsonResponse({ error: 'imports_failed' }, 500);
  }
});

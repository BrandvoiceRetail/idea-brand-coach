import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthedUserId, getServiceClient, jsonResponse } from '../_shared/edge-auth.ts';
import {
  AVATAR_LINKED_TABLES,
  EMAIL_LINKED_TABLES,
  EXPORT_ONLY_TABLES,
  PROFILE_TABLE,
  PRODUCT_LINKED_TABLES,
  STORAGE_BUCKETS,
  USER_ID_TABLES,
  getAvatarIds,
  getProductIds,
  listStoragePaths,
  selectAllRows,
  selectAllRowsIn,
} from '../_shared/gdprData.ts';

/**
 * gdpr-export — right of access + data portability (GDPR Art. 15 / Art. 20).
 *
 * Returns EVERYTHING the platform stores about the authenticated caller as one
 * machine-readable JSON document: the auth identity, every row across the GDPR
 * table registry (direct, avatar-linked, product-linked, and email-keyed
 * capture tables), and the paths of their stored files. Table reads run
 * service-role because several capture stores (leads, feedback_events) are
 * deliberately not client-readable — but every row returned is filtered to the
 * caller's own identity, so this widens nothing.
 *
 * Auth: verify_jwt=true at the platform + in-function getAuthedUserId — the
 * export is only ever of the CALLER's data (no target-user parameter, so no
 * IDOR surface). Each export is logged to gdpr_requests (Art. 12 accounting).
 *
 * Request:  POST {} (empty body)
 * Response: { export: {...} } — see `payload` below.
 */

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const userId = await getAuthedUserId(req);
  if (!userId) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  const service = getServiceClient();

  try {
    const { data: authUser, error: authErr } = await service.auth.admin.getUserById(userId);
    if (authErr || !authUser?.user) {
      return jsonResponse({ error: 'Could not resolve account' }, 500);
    }
    const email = authUser.user.email ?? null;

    const tables: Record<string, Record<string, unknown>[]> = {};
    // Tables that errored (live schema drift) — reported, never silently dropped.
    const unavailable: Record<string, string> = {};

    const collect = async (table: string, fetch: () => Promise<Record<string, unknown>[]>) => {
      try {
        const rows = await fetch();
        if (rows.length > 0) tables[table] = rows;
      } catch (err) {
        unavailable[table] = err instanceof Error ? err.message : String(err);
      }
    };

    const avatarIds = await getAvatarIds(service, userId).catch(() => [] as string[]);
    const productIds = await getProductIds(service, userId).catch(() => [] as string[]);

    await collect(PROFILE_TABLE, () => selectAllRows(service, PROFILE_TABLE, 'id', userId));
    for (const table of [...USER_ID_TABLES, ...EXPORT_ONLY_TABLES]) {
      await collect(table, () => selectAllRows(service, table, 'user_id', userId));
    }
    for (const table of AVATAR_LINKED_TABLES) {
      if (avatarIds.length === 0) break;
      await collect(table, () => selectAllRowsIn(service, table, 'avatar_id', avatarIds));
    }
    for (const table of PRODUCT_LINKED_TABLES) {
      if (productIds.length === 0) break;
      await collect(table, () => selectAllRowsIn(service, table, 'product_id', productIds));
    }
    if (email) {
      for (const { table, column } of EMAIL_LINKED_TABLES) {
        await collect(table, () => selectAllRows(service, table, column, email));
      }
    }

    const storage: Record<string, string[]> = {};
    for (const bucket of STORAGE_BUCKETS) {
      try {
        const paths = await listStoragePaths(service, bucket, userId);
        if (paths.length > 0) storage[bucket] = paths;
      } catch (err) {
        unavailable[`storage:${bucket}`] = err instanceof Error ? err.message : String(err);
      }
    }

    const payload = {
      format: 'idea-brand-coach-gdpr-export/v1',
      exported_at: new Date().toISOString(),
      account: {
        id: authUser.user.id,
        email,
        created_at: authUser.user.created_at,
        last_sign_in_at: authUser.user.last_sign_in_at ?? null,
        user_metadata: authUser.user.user_metadata ?? {},
      },
      tables,
      storage,
      // Non-empty only when live schema drifted from the registry — the export
      // is then PARTIAL and says so, rather than pretending to be complete.
      unavailable,
    };

    await service.from('gdpr_requests').insert({
      user_id: userId,
      request_type: 'export',
      status: Object.keys(unavailable).length > 0 ? 'failed' : 'completed',
      detail: {
        table_count: Object.keys(tables).length,
        unavailable: Object.keys(unavailable),
      },
    });

    return jsonResponse({ export: payload });
  } catch (err) {
    console.error('[gdpr-export] failed:', err);
    return jsonResponse({ error: 'Export failed. Please try again or contact support.' }, 500);
  }
});

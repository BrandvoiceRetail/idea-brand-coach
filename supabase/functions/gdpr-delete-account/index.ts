import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthedUserId, getServiceClient, jsonResponse } from '../_shared/edge-auth.ts';
import {
  AVATAR_LINKED_TABLES,
  EMAIL_LINKED_TABLES,
  PROFILE_TABLE,
  PRODUCT_LINKED_TABLES,
  STORAGE_BUCKETS,
  USER_ID_TABLES,
  getAvatarIds,
  getProductIds,
  listStoragePaths,
} from '../_shared/gdprData.ts';

/**
 * gdpr-delete-account — right to erasure (GDPR Art. 17), self-service.
 *
 * Deletes EVERYTHING the platform stores about the authenticated caller:
 * storage objects, every row across the GDPR table registry (including the
 * capture tables whose user_id has no FK and would otherwise survive), then
 * the auth user itself (which cascades whatever remains). External processors:
 * best-effort Stripe subscription cancel + PostHog person deletion, tallied in
 * the request log either way so unfinished external steps surface as manual work.
 *
 * SAFETY ORDER: the auth user is deleted LAST and ONLY if every table/storage
 * step succeeded — a partial failure must never strand rows that can no longer
 * be reached through the (now deleted) account.
 *
 * Auth: verify_jwt=true + in-function getAuthedUserId; the caller can only
 * erase THEMSELVES. The body must carry { confirm: "DELETE" } as a deliberate
 * second step (the UI requires typing it).
 *
 * Request:  POST { confirm: "DELETE" }
 * Response: { deleted: true, tally } | { error, tally } (500, nothing final happened)
 */

interface Tally {
  tables: Record<string, number>;
  storage: Record<string, number>;
  failures: Record<string, string>;
  external: Record<string, string>;
}

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

  let body: { confirm?: string } = {};
  try {
    body = await req.json();
  } catch {
    // fall through — the confirm check below rejects
  }
  if (body.confirm !== 'DELETE') {
    return jsonResponse({ error: 'Confirmation required: send { "confirm": "DELETE" }' }, 400);
  }

  const service = getServiceClient();
  const tally: Tally = { tables: {}, storage: {}, failures: {}, external: {} };

  try {
    const { data: authUser } = await service.auth.admin.getUserById(userId);
    const email = authUser?.user?.email ?? null;

    // Link keys + Stripe ids must be read BEFORE their tables are deleted.
    const avatarIds = await getAvatarIds(service, userId).catch(() => [] as string[]);
    const productIds = await getProductIds(service, userId).catch(() => [] as string[]);
    const { data: subRows } = await service
      .from('user_subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', userId);

    // 1) Storage objects ({userId}/… in every bucket).
    for (const bucket of STORAGE_BUCKETS) {
      try {
        const paths = await listStoragePaths(service, bucket, userId);
        if (paths.length > 0) {
          const { error } = await service.storage.from(bucket).remove(paths);
          if (error) throw new Error(error.message);
        }
        tally.storage[bucket] = paths.length;
      } catch (err) {
        // A missing bucket is a no-op, not a failure (workbooks may not exist
        // in every environment).
        const message = err instanceof Error ? err.message : String(err);
        if (/bucket.*not.*found/i.test(message)) {
          tally.storage[bucket] = 0;
        } else {
          tally.failures[`storage:${bucket}`] = message;
        }
      }
    }

    const deleteWhere = async (table: string, column: string, value: string | string[]) => {
      try {
        let query = service.from(table).delete({ count: 'exact' });
        query = Array.isArray(value) ? query.in(column, value) : query.eq(column, value);
        const { count, error } = await query;
        if (error) throw new Error(error.message);
        tally.tables[table] = (tally.tables[table] ?? 0) + (count ?? 0);
      } catch (err) {
        tally.failures[table] = err instanceof Error ? err.message : String(err);
      }
    };

    // 2) Rows linked through products / avatars (no direct user_id).
    if (productIds.length > 0) {
      for (const table of PRODUCT_LINKED_TABLES) await deleteWhere(table, 'product_id', productIds);
    }
    if (avatarIds.length > 0) {
      for (const table of AVATAR_LINKED_TABLES) await deleteWhere(table, 'avatar_id', avatarIds);
    }

    // 3) Direct user_id tables (child-first order from the registry) + profile.
    for (const table of USER_ID_TABLES) await deleteWhere(table, 'user_id', userId);
    await deleteWhere(PROFILE_TABLE, 'id', userId);

    // 4) Email-keyed capture stores (leads, beta_testers).
    if (email) {
      for (const { table, column } of EMAIL_LINKED_TABLES) await deleteWhere(table, column, email);
    }

    // 5) External processors — best-effort, never blocks erasure; the outcome
    // lands in the request log so a failure becomes a tracked manual step.
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const subIds = (subRows ?? [])
      .map((r: { stripe_subscription_id: string | null }) => r.stripe_subscription_id)
      .filter((id: string | null): id is string => Boolean(id));
    if (stripeKey && subIds.length > 0) {
      for (const subId of subIds) {
        try {
          const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${stripeKey}` },
          });
          tally.external[`stripe:${subId}`] = res.ok ? 'cancelled' : `HTTP ${res.status}`;
        } catch (err) {
          tally.external[`stripe:${subId}`] = err instanceof Error ? err.message : String(err);
        }
      }
    } else if (subIds.length > 0) {
      tally.external.stripe = 'MANUAL: no STRIPE_SECRET_KEY in env; cancel subscription in dashboard';
    }

    const posthogKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY');
    const posthogProject = Deno.env.get('POSTHOG_PROJECT_ID');
    const posthogHost = Deno.env.get('POSTHOG_HOST') ?? 'https://eu.i.posthog.com';
    if (posthogKey && posthogProject) {
      try {
        // The app identifies users by their Supabase UUID; find that person and
        // delete them WITH their events.
        const apiHost = posthogHost.replace('//eu.i.', '//eu.').replace('//us.i.', '//us.');
        const lookup = await fetch(
          `${apiHost}/api/projects/${posthogProject}/persons/?distinct_id=${encodeURIComponent(userId)}`,
          { headers: { Authorization: `Bearer ${posthogKey}` } },
        );
        const found = lookup.ok ? await lookup.json() : null;
        const personId = found?.results?.[0]?.id;
        if (personId) {
          const del = await fetch(
            `${apiHost}/api/projects/${posthogProject}/persons/${personId}/?delete_events=true`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${posthogKey}` } },
          );
          tally.external.posthog = del.ok ? 'person + events deleted' : `HTTP ${del.status}`;
        } else {
          tally.external.posthog = 'no identified person found';
        }
      } catch (err) {
        tally.external.posthog = err instanceof Error ? err.message : String(err);
      }
    } else {
      tally.external.posthog =
        'MANUAL: POSTHOG_PERSONAL_API_KEY/POSTHOG_PROJECT_ID unset; delete person in PostHog UI';
    }

    // 6) Point of no return — only when every table/storage step succeeded.
    if (Object.keys(tally.failures).length > 0) {
      await service.from('gdpr_requests').insert({
        user_id: userId,
        request_type: 'erasure',
        status: 'failed',
        detail: tally as unknown as Record<string, unknown>,
      });
      return jsonResponse(
        { error: 'Some data could not be deleted; your account was NOT removed. Please retry or contact support.', tally },
        500,
      );
    }

    const { error: deleteUserError } = await service.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      await service.from('gdpr_requests').insert({
        user_id: userId,
        request_type: 'erasure',
        status: 'failed',
        detail: { ...tally, auth_delete_error: deleteUserError.message } as unknown as Record<string, unknown>,
      });
      return jsonResponse({ error: 'Account deletion failed at the final step. Please contact support.', tally }, 500);
    }

    // Accountability log survives on purpose (user_id here is NOT an FK).
    await service.from('gdpr_requests').insert({
      user_id: userId,
      request_type: 'erasure',
      status: 'completed',
      detail: tally as unknown as Record<string, unknown>,
    });

    return jsonResponse({ deleted: true, tally });
  } catch (err) {
    console.error('[gdpr-delete-account] failed:', err);
    return jsonResponse({ error: 'Deletion failed. Your account was not removed.', tally }, 500);
  }
});

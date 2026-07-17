/**
 * gdprData — the single registry of WHERE a user's personal data lives,
 * shared by the gdpr-export (Art. 15/20) and gdpr-delete-account (Art. 17)
 * edge functions. When a new user-data table ships, add it here — an
 * unlisted table means incomplete exports AND leaked rows after erasure.
 *
 * Derived from the 2026-07-08 GDPR personal-data inventory (all 56 live
 * tables; see docs/compliance/ROPA.md). Link-column choices mirror the
 * generated types, not guesses.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

/** Tables keyed directly by a `user_id` column (deleted child-first). */
export const USER_ID_TABLES: string[] = [
  // children before parents (FK safety even where CASCADE exists);
  // session_id referrers (decision_triggers, feedback_events) before chat_sessions
  'chat_messages',        // → chat_sessions
  'decision_triggers',    // session_id → chat_sessions
  'feedback_events',      // session_id → chat_sessions; user FK is SET NULL — must delete, not orphan
  'chat_sessions',
  'coach_asset_events',   // → coach_assets
  'coach_assets',
  'expert_corrections',   // Expert Intelligence Loop capture (admin-only; user_id FK CASCADEs, deleted explicitly too)
  'scrape_job_items',     // → scrape_jobs
  'scrape_jobs',
  'avatar_build_state',
  'beta_comments',        // user_id has NO FK — survives auth deletion without this
  'beta_feedback',        // user_id has NO FK — survives auth deletion without this
  'brand_asset_audits',
  'business_facts',
  'campaign_metrics',
  'campaigns',
  'canva_imported_designs',
  'canva_oauth_states',
  'canva_connections',
  'content_generation_jobs',
  'credit_ledger',
  'credit_wallets',
  'diagnostic_submissions',
  'email_steps',
  'email_sequences',
  'evidence_snapshots',
  'figma_imports',
  'figma_oauth_state',
  'figma_connections',
  'idea_framework_submissions',
  'marketing_audits',
  'signatures',
  'uploaded_documents',
  'user_diagnostic_results',
  'user_knowledge_chunks',
  'user_knowledge_base',
  'user_memories',
  'user_products',        // AFTER user_product_reviews (product-linked phase runs first)
  'user_subscriptions',
  'artifacts',
  'avatars',              // last of the user_id set: everything avatar-linked first
  'brands',
];

/** Tables linked to the user only through their avatars (`avatar_id`). */
export const AVATAR_LINKED_TABLES: string[] = [
  'avatar_field_values',
  'brand_asset_competitive_insights', // → brand_assets(asset_id); delete before brand_assets
  'brand_defense_alerts',
  'brand_tests',
  'competitor_assets',
  'trust_gap_snapshots',
  'brand_assets',
];

/** Tables linked through the user's products (`product_id`). */
export const PRODUCT_LINKED_TABLES: string[] = ['user_product_reviews'];

/** Tables keyed by the account email (anonymous-capture stores, no user_id FK). */
export const EMAIL_LINKED_TABLES: Array<{ table: string; column: string }> = [
  { table: 'leads', column: 'email' },
  { table: 'beta_testers', column: 'email' },
];

/** `profiles` is keyed by `id` (= auth.users.id), not `user_id`. */
export const PROFILE_TABLE = 'profiles';

/**
 * Export-only tables: included in the Art. 15 export but NEVER bulk-deleted.
 * - user_consents: cascades with the auth user; the ledger stays intact until then.
 * - gdpr_requests: the accountability log (Art. 5(2)) — survives erasure by design.
 */
export const EXPORT_ONLY_TABLES: string[] = ['user_consents', 'gdpr_requests'];

/** Storage buckets holding user objects under a `{userId}/…` prefix. */
export const STORAGE_BUCKETS: string[] = ['documents', 'brand-assets', 'workbooks'];

const PAGE_SIZE = 1000;

/** Fetch ALL rows matching `column = value` (paginated past PostgREST's cap). */
export async function selectAllRows(
  client: SupabaseClient,
  table: string,
  column: string,
  value: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq(column, value)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/** Fetch ALL rows whose `column` is in `values` (chunked + paginated). */
export async function selectAllRowsIn(
  client: SupabaseClient,
  table: string,
  column: string,
  values: string[],
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < values.length; i += 100) {
    const chunk = values.slice(i, i + 100);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await client
        .from(table)
        .select('*')
        .in(column, chunk)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

/** The user's avatar ids (link key for AVATAR_LINKED_TABLES). */
export async function getAvatarIds(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client.from('avatars').select('id').eq('user_id', userId);
  if (error) throw new Error(`avatars: ${error.message}`);
  return (data ?? []).map((r: { id: string }) => r.id);
}

/** The user's product ids (link key for PRODUCT_LINKED_TABLES). */
export async function getProductIds(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client.from('user_products').select('id').eq('user_id', userId);
  if (error) throw new Error(`user_products: ${error.message}`);
  return (data ?? []).map((r: { id: string }) => r.id);
}

/** Recursively list every object path under `prefix` in a bucket. */
export async function listStoragePaths(
  client: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`storage ${bucket}/${prefix}: ${error.message}`);
  for (const entry of data ?? []) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      // Folder placeholder — recurse.
      paths.push(...(await listStoragePaths(client, bucket, full)));
    } else {
      paths.push(full);
    }
  }
  return paths;
}

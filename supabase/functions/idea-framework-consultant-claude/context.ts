/**
 * Context retrieval for the Claude edge function.
 * Retrieves the user's structured knowledge base from Supabase.
 *
 * 2026-06-11: semantic search (pgvector + OpenAI query embeddings) removed —
 * user_knowledge_chunks is empty since the diagnostic-embeddings sync was
 * retired, and the app is Anthropic-only. Structured KB reads + the memory
 * snapshot (memory-context.ts) are the retrieval surfaces.
 *
 * 2026-06-17 (multi-avatar Phase 3): KB retrieval is now AVATAR-AWARE and
 * SCOPE-AUTHORITATIVE. After an avatar switch the coach must NOT recall the
 * previous avatar's context. The query returns brand-shared rows
 * (scope='brand') UNION the current avatar's rows (scope='avatar' AND
 * avatar_id = current), excluding other avatars' rows. When no avatar is
 * resolved, only brand-shared rows are returned (no bleed by construction).
 * The `scope` column is authoritative — we do NOT re-derive scope from the
 * category at retrieval time (the backfill already stamped it). See
 * docs/v2/architecture/MULTI_AVATAR_DESIGN.md §2.2/§2.3.
 *
 * 2026-06-18 (multi-avatar M2): the avatar anchor is now a SET, not a single
 * id. The avatar tier returns rows for ANY avatar in the explicit set
 * (scope='avatar' AND avatar_id = ANY(set)) via a `.in('avatar_id', set)`
 * filter. retrieveUserContext accepts string[] | string | null — the array is
 * the canonical shape; the single-string/null forms are a thin shim for legacy
 * callers and are normalized to a set internally. The bleed firewall is
 * unchanged: retrieval anchors on the explicit set passed by the caller, never
 * a global mutable pointer, so an empty/invalid set yields brand-only rows.
 */

import { getFieldLabel } from './fields.ts';

/**
 * KB categories that are AVATAR-scoped (re-scope on an avatar switch).
 * Everything else (canvas, copy, diagnostic, visual_identity, …) is
 * BRAND-shared. This constant mirrors the backfill + contextResolver.ts and
 * documents the policy — but retrieval filters on the `scope` column, which is
 * authoritative (the backfill stamped it from this same category set).
 */
export const AVATAR_SCOPED_CATEGORIES = new Set(['avatar', 'insights']);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Minimal shape of a KB row this retrieval surface reads. */
interface KbRow {
  field_identifier: string;
  category?: string | null;
  content: string;
  subcategory?: string | null;
  updated_at?: string | null;
}

/** Result of an awaited PostgREST query for KB rows. */
interface KbQueryResult {
  data: KbRow[] | null;
  error: unknown;
}

/**
 * Minimal chained-builder surface this module uses. Each filter returns the
 * builder; the builder is a thenable resolving to a KbQueryResult. Typed
 * narrowly (not the full supabase-js client) to avoid `any` while staying
 * decoupled from the SDK version.
 */
interface KbQueryBuilder extends PromiseLike<KbQueryResult> {
  select(columns: string): KbQueryBuilder;
  eq(column: string, value: unknown): KbQueryBuilder;
  is(column: string, value: unknown): KbQueryBuilder;
  in(column: string, values: readonly unknown[]): KbQueryBuilder;
  not(column: string, op: string, value: unknown): KbQueryBuilder;
  gt(column: string, value: unknown): KbQueryBuilder;
  order(column: string, opts?: { ascending?: boolean }): KbQueryBuilder;
  limit(n: number): KbQueryBuilder;
}

interface SupabaseLike {
  from(table: string): KbQueryBuilder;
}

/** Reject anything that is not a well-formed UUID before it touches a query. */
function asUuidOrNull(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

/**
 * Normalize the avatar anchor into a validated, de-duplicated UUID set.
 *
 * Accepts the canonical array shape or the thin single-string/null shim.
 * Invalid members are dropped (no bleed); an empty result means brand-only.
 */
function toValidatedAvatarSet(
  avatarIds: string[] | string | null | undefined
): string[] {
  const raw = Array.isArray(avatarIds)
    ? avatarIds
    : avatarIds == null
      ? []
      : [avatarIds];
  const seen = new Set<string>();
  for (const candidate of raw) {
    const valid = asUuidOrNull(candidate);
    if (valid) seen.add(valid);
  }
  return [...seen];
}

/** Merge two row sets by recency (updated_at desc), most-recent first. */
function mergeByRecency(a: KbRow[], b: KbRow[]): KbRow[] {
  return [...a, ...b].sort((x, y) => {
    const tx = x?.updated_at ? Date.parse(x.updated_at) : 0;
    const ty = y?.updated_at ? Date.parse(y.updated_at) : 0;
    return ty - tx;
  });
}

/**
 * Retrieve user's structured knowledge base context from Supabase.
 *
 * Scope-authoritative two-tier read: brand rows (scope='brand') are always
 * returned; avatar rows (scope='avatar' AND avatar_id = ANY(set)) are returned
 * for every avatar in the explicit set. Other avatars' rows are excluded.
 *
 * The avatar anchor is a SET (string[]). A single string or null is accepted
 * as a thin shim for legacy callers and normalized to a set internally; an
 * empty/invalid set yields brand-only rows (no bleed).
 */
export async function retrieveUserContext(
  supabaseClient: SupabaseLike,
  userId: string,
  avatarIds: string[] | string | null,
  _query: string,
  minimal: boolean = false
): Promise<string> {
  try {
    const avSet = toValidatedAvatarSet(avatarIds);
    console.log(
      `[Context] Fetching knowledge for user (${minimal ? 'minimal' : 'full'}):`,
      userId,
      `avatars:`,
      avSet.length > 0 ? avSet.join(',') : 'none'
    );

    // updated_at is always selected so the two tiers can be merged by recency.
    // category is always selected so the byCategory grouping labels the avatar
    // tier (CUSTOMER AVATAR / CUSTOMER INSIGHTS) even on the minimal path —
    // otherwise both tiers collapse into one undifferentiated 'GENERAL' block.
    const selectFields = minimal
      ? 'field_identifier, category, content, updated_at'
      : 'field_identifier, category, content, subcategory, updated_at';

    // Independent per-tier budgets so brand recency can't starve avatar
    // context in the `minimal` path (design §2.3 / H2).
    const perTierLimit = minimal ? 6 : 40;

    // Base builder shared by both tiers — same user_id + currency + content
    // discipline. Two typed queries (no `.or()` string interpolation → no
    // PostgREST filter injection, design §2.3 / H1).
    const base = () =>
      supabaseClient
        .from('user_knowledge_base')
        .select(selectFields)
        .eq('user_id', userId)
        .eq('is_current', true)
        .not('content', 'is', null)
        .gt('content', '')
        .order('updated_at', { ascending: false })
        .limit(perTierLimit);

    // BRAND tier — always visible (scope='brand', avatar_id IS NULL).
    const brandQuery = base().eq('scope', 'brand').is('avatar_id', null);

    // AVATAR tier — rows for ANY avatar in the explicit set
    // (scope='avatar' AND avatar_id = ANY(set)); skipped entirely when the set
    // is empty (empty/invalid set → brand-only, no bleed).
    const avatarQuery = avSet.length > 0
      ? base().eq('scope', 'avatar').in('avatar_id', avSet)
      : null;

    const [brandRes, avatarRes] = await Promise.all<KbQueryResult>([
      brandQuery,
      avatarQuery ?? Promise.resolve({ data: [], error: null }),
    ]);

    if (brandRes.error) {
      console.error('[Context] Error fetching brand knowledge:', brandRes.error);
      return '';
    }
    if (avatarRes.error) {
      console.error('[Context] Error fetching avatar knowledge:', avatarRes.error);
      return '';
    }

    const entries = mergeByRecency(brandRes.data || [], avatarRes.data || []);

    if (entries.length === 0) {
      console.log('[Context] No knowledge base entries found');
      return '';
    }

    console.log(
      `[Context] Found ${entries.length} knowledge entries (brand: ${brandRes.data?.length || 0}, avatar: ${avatarRes.data?.length || 0})`
    );

    const byCategory: Record<string, KbRow[]> = {};
    entries.forEach((entry: KbRow) => {
      const cat = entry.category || 'general';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(entry);
    });

    const categoryLabels: Record<string, string> = {
      insights: 'CUSTOMER INSIGHTS (from Interactive Insight Module)',
      canvas: 'BRAND CANVAS',
      avatar: 'CUSTOMER AVATAR',
      diagnostic: 'BRAND DIAGNOSTIC',
      copy: 'BRAND COPY',
      visual_identity: 'VISUAL IDENTITY (from Figma)',
    };

    const contextParts: string[] = ['USER BRAND KNOWLEDGE BASE:'];
    for (const [category, categoryEntries] of Object.entries(byCategory)) {
      const label = categoryLabels[category] || category.toUpperCase();
      contextParts.push(`\n${label}:`);
      categoryEntries.forEach((entry: KbRow) => {
        const fieldLabel = getFieldLabel(entry.field_identifier, category);
        contextParts.push(`- ${fieldLabel}: ${entry.content}`);
      });
    }

    const context = contextParts.join('\n');
    console.log(`[Context] Generated context (${context.length} chars)`);
    return context;
  } catch (error) {
    console.error('[Context] Error:', error);
    return '';
  }
}

/**
 * Retrieve all relevant context for the current message.
 *
 * Threads the resolved avatar SET into the two-tier KB read so retrieval is
 * scoped to the brand + the explicit avatar set only. `avatarIds` is the
 * canonical shape; `avatarId` is a thin shim kept for legacy callers and is
 * merged into the set.
 */
export async function retrieveAllContext(
  supabaseClient: SupabaseLike,
  userId: string,
  message: string,
  options: {
    needsFullContext: boolean;
    hasUploadedDocuments: boolean;
    avatarIds?: string[] | null;
    avatarId?: string | null;
  }
): Promise<{
  userKnowledgeContext: string;
}> {
  const startTime = Date.now();
  const avatarAnchor: string[] = [
    ...(options.avatarIds ?? []),
    ...(options.avatarId ? [options.avatarId] : []),
  ];
  const knowledge = await retrieveUserContext(
    supabaseClient,
    userId,
    avatarAnchor,
    message,
    !options.needsFullContext
  );
  console.log(`[Context] Retrieval (${options.needsFullContext ? 'full' : 'minimal'}) took ${Date.now() - startTime}ms`);

  return { userKnowledgeContext: knowledge };
}

/**
 * Layer 1 (service) — read-back of the caller's stored review evidence, over the RLS-bound client.
 *
 * The connector could previously only ever see the 2-3 citations a generator chose to surface; there
 * was no way to answer "show me all the review quotes". `listEvidence` is that read: it flattens the
 * caller's own `evidence_snapshots.reviews` (RLS-scoped to auth.uid()) into paginated verbatim rows.
 * Reads only — never writes, never resolves-and-folds like contextResolver. Verbatim by construction:
 * it returns the stored review bodies unchanged.
 */
import { getUserSupabase } from '../supabaseUser.js';
import { MCP_RESPONSE_LIST_EVIDENCE_SNAPSHOT_SCAN } from './contextBudgets.js';

const TABLE = 'evidence_snapshots';

export class EvidenceListError extends Error {}

/** One verbatim review quote with its provenance. */
export interface EvidenceQuote {
  body: string;
  rating: number | null;
  reviewer: string | null;
  source: string;
  snapshot_id: string;
  created_at: string;
}

export interface ListEvidenceArgs {
  /** Scope to one avatar's evidence plus brand-level (avatar_id null); omit for everything. */
  avatarId?: string;
  /** Page size (already clamped by the caller to the MCP_RESPONSE ceiling). */
  limit: number;
  /** Offset into the flattened, newest-first quote list. */
  offset: number;
}

export interface ListEvidenceResult {
  quotes: EvidenceQuote[];
  /** Total quotes across the bounded snapshot scan (not necessarily the whole history). */
  total: number;
  /** True when the scan hit its ceiling, so `total` under-counts the full history. */
  scanTruncated: boolean;
}

/** Narrow one element of a snapshot's `reviews` jsonb to the stored review shape. */
function asReview(v: unknown): { body: string; rating: number | null; reviewer: string | null } | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const body = typeof o.body === 'string' ? o.body : '';
  if (!body.trim()) return null;
  return {
    body,
    rating: typeof o.rating === 'number' ? o.rating : null,
    reviewer: typeof o.reviewer === 'string' ? o.reviewer : null,
  };
}

/**
 * List the caller's stored review quotes, newest snapshot first, paginated. RLS restricts rows to
 * the authenticated caller; an avatarId also admits brand-level (avatar_id null) snapshots, matching
 * how the resolver treats a brand-level artifact as visible to an avatar-scoped read.
 */
export async function listEvidence(args: ListEvidenceArgs): Promise<ListEvidenceResult> {
  const supabase = getUserSupabase();
  let query = supabase
    .from(TABLE)
    .select('id, source, reviews, created_at, avatar_id')
    .order('created_at', { ascending: false })
    .limit(MCP_RESPONSE_LIST_EVIDENCE_SNAPSHOT_SCAN);
  if (args.avatarId) query = query.or(`avatar_id.eq.${args.avatarId},avatar_id.is.null`);

  const { data, error } = await query;
  if (error) throw new EvidenceListError(error.message);

  const rows = (data ?? []) as Array<{ id: string; source: string; reviews: unknown; created_at: string }>;
  const scanTruncated = rows.length >= MCP_RESPONSE_LIST_EVIDENCE_SNAPSHOT_SCAN;

  const flat: EvidenceQuote[] = [];
  for (const row of rows) {
    const reviews = Array.isArray(row.reviews) ? row.reviews : [];
    for (const raw of reviews) {
      const r = asReview(raw);
      if (!r) continue;
      flat.push({ ...r, source: row.source, snapshot_id: row.id, created_at: row.created_at });
    }
  }

  return {
    quotes: flat.slice(args.offset, args.offset + args.limit),
    total: flat.length,
    scanTruncated,
  };
}

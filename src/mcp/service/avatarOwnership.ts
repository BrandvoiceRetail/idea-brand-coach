/**
 * Layer 1 (service) — avatar-ownership authorization, the per-call defense-in-depth seam.
 *
 * P1 made `avatars.brand_id` NOT NULL and `profiles.current_avatar_id` ownership-checked,
 * but the MCP tools that accept an `avatar_id` previously passed it UNVALIDATED into the
 * RLS-bound client. RLS already scopes `avatars` to `auth.uid()`, so a foreign avatar_id
 * resolves to zero rows — but that silently degrades to a brand-level (avatar_id NULL)
 * write instead of an explicit refusal, and never surfaces the avatar's `brand_id` that
 * the two-tier KB scope needs. This helper closes both gaps:
 *
 *   - `requireOwnedAvatar(avatarId)` — looks the avatar up via the JWT-bound client (RLS
 *     enforces ownership) and returns its `brand_id`, or a ready-to-return `CallToolResult`
 *     denial when the avatar is absent/foreign. gateWrite-shaped `{ denied, brandId }` so a
 *     retrofit is two lines at each call site, matching `gateWrite()`.
 *   - `resolveBrandId()` — resolves the CALLER's brand server-side (never caller-supplied),
 *     for lifecycle tools that stamp `brand_id` (create_avatar) or default the funnel avatar.
 *
 * Ownership is enforced by RLS on the read, not by trusting any caller-supplied id. The
 * brand is read from the avatar row (or the caller's single brand), never accepted as input.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getUserSupabase } from '../supabaseUser.js';

/** Raised when the caller's brand cannot be resolved (lifecycle tools need a brand spine). */
export class AvatarOwnershipError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AvatarOwnershipError';
  }
}

/** A ready-to-return denial for an avatar the caller does not own / does not exist. */
function avatarDenied(avatarId: string): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text:
          `Denied: avatar ${avatarId} was not found for the authenticated caller. ` +
          'Pass an avatar_id you own (see list_avatars), or omit it for the brand-level scope.',
      },
    ],
    structuredContent: { available: false, ok: false, note: 'avatar not owned' },
    isError: true,
  };
}

/**
 * A ready-to-return denial for an avatar SET that is not wholly owned by the caller.
 * Generic by design (MF-5 posture): never names which member failed nor leaks a raw DB
 * message — a foreign/absent member and a cross-brand mix both reduce to "not owned".
 */
function avatarSetDenied(): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text:
          'Denied: one or more avatars in the set were not found for the authenticated caller, ' +
          'or the set spans more than one brand. Pass avatar_ids you own that share one brand (see list_avatars).',
      },
    ],
    structuredContent: { available: false, ok: false, note: 'avatar not owned' },
    isError: true,
  };
}

/**
 * A ready-to-return denial for a DB error during the ownership check. Generic by design:
 * the raw Postgres message is never surfaced to the caller (MF-5 redaction posture) — only
 * logged server-side at the call site if needed. Mirrors `avatarDenied`'s shape.
 */
function ownershipCheckFailed(): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: 'Could not verify avatar ownership right now. Please retry.',
      },
    ],
    structuredContent: { available: false, ok: false, note: 'ownership check failed' },
    isError: true,
  };
}

/**
 * Confirm the caller owns `avatarId` and return its `brand_id`.
 *
 * gateWrite-shaped: `{ denied, brandId }`. When `avatarId` is null/undefined this is the
 * brand-level scope — no check, no denial, `brandId: null` (the caller's tool already
 * accepts the no-avatar chain). On a present-but-foreign/absent avatar, `denied` is a
 * `CallToolResult` the tool returns verbatim and `brandId` is null. RLS on the SELECT is
 * what actually enforces ownership; this converts the silent empty read into a refusal and
 * surfaces the avatar's brand for downstream brand-tier scoping.
 *
 * NEVER throws: a DB error returns a generic `ownershipCheckFailed()` denial (no raw
 * Postgres message), so the five raw-retrofit call sites that invoke this OUTSIDE a
 * try/catch cannot leak DB error text via the SDK's error wrapper (MF-5 redaction posture).
 */
export async function requireOwnedAvatar(
  avatarId: string | null | undefined,
): Promise<{ denied: CallToolResult | null; brandId: string | null }> {
  if (avatarId == null) return { denied: null, brandId: null };

  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from('avatars')
    .select('id, brand_id')
    .eq('id', avatarId)
    .maybeSingle();

  if (error) return { denied: ownershipCheckFailed(), brandId: null };
  if (!data) return { denied: avatarDenied(avatarId), brandId: null };

  return { denied: null, brandId: (data as { brand_id: string }).brand_id };
}

/**
 * Confirm the caller owns EVERY avatar in `avatarIds` and that they all share ONE brand,
 * returning that shared `brand_id`.
 *
 * gateWrite-shaped: `{ denied, brandId }`, mirroring `requireOwnedAvatar`. RLS on the
 * `IN`-set SELECT enforces ownership: any foreign/absent member is simply absent from the
 * returned rows, so a row-count mismatch is the foreign-member signal. A set that resolves
 * to more than one distinct `brand_id` is also denied — the context set is a single-brand
 * retrieval anchor (the RPC re-enforces ownership server-side too). Denials are generic
 * (MF-5: no per-member detail, no raw DB message); a DB error returns `ownershipCheckFailed()`.
 * NEVER throws.
 */
export async function requireOwnedAvatarSet(
  avatarIds: string[],
): Promise<{ denied: CallToolResult | null; brandId: string | null }> {
  if (avatarIds.length === 0) return { denied: avatarSetDenied(), brandId: null };

  // Dedupe so a repeated id can't inflate the row count past the distinct request.
  const ids = Array.from(new Set(avatarIds));

  const supabase = getUserSupabase();
  const { data, error } = await supabase.from('avatars').select('id, brand_id').in('id', ids);

  if (error) return { denied: ownershipCheckFailed(), brandId: null };

  const rows = (data as Array<{ id: string; brand_id: string }> | null) ?? [];
  // Any missing member (RLS-filtered or absent) → not wholly owned.
  if (rows.length !== ids.length) return { denied: avatarSetDenied(), brandId: null };

  const brandIds = new Set(rows.map((r) => r.brand_id));
  if (brandIds.size !== 1) return { denied: avatarSetDenied(), brandId: null };

  return { denied: null, brandId: rows[0].brand_id };
}

/**
 * Resolve the authenticated caller's brand id, server-side (never caller-supplied).
 *
 * The brand spine is one brand per user (P1 `uq_brands_user_id`), so this reads the
 * caller's single `brands` row over the RLS-bound client. Lifecycle/funnel tools call this
 * to stamp `brand_id` rather than trusting any input.
 * @throws AvatarOwnershipError when the caller has no brand yet (the SPA seeds it).
 */
export async function resolveBrandId(): Promise<string> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from('brands')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AvatarOwnershipError(`failed to resolve caller brand: ${error.message}`, error);
  }
  if (!data) {
    throw new AvatarOwnershipError('no brand found for the authenticated caller');
  }
  return (data as { id: string }).id;
}

/**
 * Resolve the brand's funnel-default (primary) avatar id, or `null` if none is pinned.
 * Used by the funnel-audit tools to default `avatar_id` to `brands.primary_avatar_id`
 * (locked #7) WITHOUT touching the coach current-avatar pointer.
 */
export async function resolvePrimaryAvatarId(brandId: string): Promise<string | null> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from('brands')
    .select('primary_avatar_id')
    .eq('id', brandId)
    .maybeSingle();

  if (error) {
    throw new AvatarOwnershipError(`failed to resolve primary avatar: ${error.message}`, error);
  }
  return (data as { primary_avatar_id: string | null } | null)?.primary_avatar_id ?? null;
}

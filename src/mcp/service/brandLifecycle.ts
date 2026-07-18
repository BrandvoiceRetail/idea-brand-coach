/**
 * Layer 1 (service) — brand bootstrap over the RLS-bound user client.
 *
 * The gateway resolves `brand_id` server-side (avatarOwnership.resolveBrandId), but a `brands`
 * row is only ever created LAZILY by specific SPA flows (SupabaseBrandService.getOrCreateDefaultBrand)
 * — never on signup/login. So an authenticated MCP-only caller can hold an app account (auth.users)
 * yet have no `brands` row, which makes create_avatar / upsert_funnel_touchpoint / the whole
 * diagnostic fail with "no brand found for the authenticated caller". `ensureBrand` closes that gap:
 * it guarantees the caller's single brand row exists (idempotent), so onboarding can proceed.
 *
 * Scope (locked): it does NOT create the account — app signup owns auth (the JWT must already be
 * valid to reach here) — and it does NOT seed avatars or context. The coach captures the avatar and
 * the owner-intent conversationally. Brand-row only.
 *
 * Caller-RLS insert only: the `brands` INSERT policy is `WITH CHECK (auth.uid() = user_id)` and we
 * never set `primary_avatar_id` on create, so this passes over the JWT-bound client with zero new
 * grants (no service-role client exists in this gateway, by design).
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { getUserSupabase } from '../supabaseUser.js';
import { getIdentity } from '../context/identity.js';

const BRANDS_TABLE = 'brands';
const BRAND_COLS = 'id, name, description, industry, created_at, updated_at';

/** Default brand name when the caller supplies none — mirrors the SPA's getOrCreateDefaultBrand. */
const DEFAULT_BRAND_NAME = 'My Brand';

/** Raised when the brand-bootstrap DB call fails. */
export class BrandLifecycleError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'BrandLifecycleError';
  }
}

/** A persisted brand row, the onboarding-relevant columns. */
export interface BrandRow {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  created_at: string;
  updated_at: string;
}

function requireUserId(): string {
  const { userId } = getIdentity();
  if (!userId) throw new BrandLifecycleError('no authenticated user id in scope');
  return userId;
}

/** Read the caller's single brand row (RLS-scoped), or null when none exists yet. */
async function readCallerBrand(): Promise<BrandRow | null> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from(BRANDS_TABLE)
    .select(BRAND_COLS)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new BrandLifecycleError(`failed to read caller brand: ${error.message}`, error);
  }
  return (data as BrandRow | null) ?? null;
}

/**
 * Ensure the authenticated caller has a brand row, creating it if missing.
 *
 * Idempotent: a caller who already has a brand gets it back untouched (`created: false`); a
 * brand-less caller gets a fresh row (`created: true`). Only `user_id` + `name` are written — no
 * avatar/context seed (locked: brand-row only). Race-safe against `uq_brands_user_id`: a concurrent
 * double-create (23505) degrades to a re-read of the winning row rather than a hard error.
 */
export async function ensureBrand(name?: string): Promise<{ brand: BrandRow; created: boolean }> {
  const existing = await readCallerBrand();
  if (existing) return { brand: existing, created: false };

  const supabase = getUserSupabase();
  const userId = requireUserId();
  const brandName = name?.trim() || DEFAULT_BRAND_NAME;

  const { data, error } = await supabase
    .from(BRANDS_TABLE)
    .insert({ user_id: userId, name: brandName })
    .select(BRAND_COLS)
    .single();

  if (error) {
    // uq_brands_user_id violation → another writer created the brand first; return theirs.
    if ((error as PostgrestError).code === '23505') {
      const raced = await readCallerBrand();
      if (raced) return { brand: raced, created: false };
    }
    throw new BrandLifecycleError(`failed to create brand: ${error.message}`, error);
  }
  if (!data) {
    throw new BrandLifecycleError('failed to create brand: no row returned');
  }
  return { brand: data as BrandRow, created: true };
}

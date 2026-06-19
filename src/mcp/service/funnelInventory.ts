/**
 * Layer 1 (service) — funnel inventory + per-avatar audit overlay (§4.4).
 *
 * The funnel is BRAND-LEVEL: `brand_assets` rows are the touchpoint inventory (one CURRENT
 * row per (brand_id, touchpoint_id), avatar_id NULL). Per-avatar scoring is an OVERLAY in
 * `brand_asset_audits`, written through the `save_asset_audit_atomic` RPC (self-supersede →
 * insert → repoint per (brand_asset, avatar), P1). The funnel NEVER reads or writes the coach
 * current-avatar pointer; an audit's avatar is explicit (or defaults to brands.primary_avatar_id
 * at the tool layer, locked #7).
 *
 * brand_id is resolved server-side (avatarOwnership.resolveBrandId) and stamped here; the §9
 * sync trigger also reconciles brand_id from any set avatar, but inventory rows are avatar_id
 * NULL so brand_id is the authoritative key.
 */
import { getUserSupabase } from '../supabaseUser.js';

const BRAND_ASSETS_TABLE = 'brand_assets';
const AUDITS_TABLE = 'brand_asset_audits';

/** Raised when a funnel DB call fails. */
export class FunnelInventoryError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'FunnelInventoryError';
  }
}

/** A brand-level funnel inventory row (the touchpoint), lifecycle-relevant columns. */
export interface FunnelTouchpoint {
  id: string;
  brand_id: string;
  touchpoint_id: string;
  stage: string;
  context_description: string;
  status: string;
  overall_score: number | null;
  created_at: string;
}

const TOUCHPOINT_COLS =
  'id, brand_id, touchpoint_id, stage, context_description, status, overall_score, created_at';

/** A per-avatar audit overlay row. */
export interface FunnelAuditRow {
  id: string;
  brand_asset_id: string;
  avatar_id: string;
  brand_id: string;
  overall_score: number | null;
  audit_result: unknown;
  grounding: string;
  created_at: string;
}

const AUDIT_COLS =
  'id, brand_asset_id, avatar_id, brand_id, overall_score, audit_result, grounding, created_at';

/** List the brand's CURRENT funnel inventory (avatar-agnostic), by stage then touchpoint. */
export async function listInventory(brandId: string): Promise<FunnelTouchpoint[]> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from(BRAND_ASSETS_TABLE)
    .select(TOUCHPOINT_COLS)
    .eq('brand_id', brandId)
    .is('superseded_by', null)
    .order('stage', { ascending: true })
    .order('touchpoint_id', { ascending: true });

  if (error) {
    throw new FunnelInventoryError(`failed to list funnel inventory: ${error.message}`, error);
  }
  return (data as FunnelTouchpoint[] | null) ?? [];
}

export interface UpsertTouchpointInput {
  brandId: string;
  touchpointId: string;
  stage: string;
  contextDescription: string;
  status?: string;
}

/**
 * Create or update one brand-level touchpoint (avatar_id NULL). Updates the CURRENT row in
 * place when (brand_id, touchpoint_id) already exists — brand-level inventory is single-owner,
 * so an in-place update keeps the one-current-row invariant (uq_brand_assets_current_per_touchpoint)
 * without a supersede chain. Inserts a fresh CURRENT row otherwise.
 */
export async function upsertTouchpoint(input: UpsertTouchpointInput): Promise<FunnelTouchpoint> {
  const supabase = getUserSupabase();

  const { data: existing, error: readError } = await supabase
    .from(BRAND_ASSETS_TABLE)
    .select('id')
    .eq('brand_id', input.brandId)
    .eq('touchpoint_id', input.touchpointId)
    .is('superseded_by', null)
    .maybeSingle();

  if (readError) {
    throw new FunnelInventoryError(`failed to read funnel touchpoint: ${readError.message}`, readError);
  }

  const patch: Record<string, unknown> = {
    stage: input.stage,
    context_description: input.contextDescription,
    updated_at: new Date().toISOString(),
  };
  if (input.status) patch.status = input.status;

  if (existing) {
    return updateCurrentTouchpoint(supabase, (existing as { id: string }).id, patch);
  }

  const { data, error } = await supabase
    .from(BRAND_ASSETS_TABLE)
    .insert({
      brand_id: input.brandId,
      avatar_id: null,
      touchpoint_id: input.touchpointId,
      stage: input.stage,
      context_description: input.contextDescription,
      status: input.status ?? 'pending',
    })
    .select(TOUCHPOINT_COLS)
    .single();

  if (!error && data) return data as FunnelTouchpoint;

  // TOCTOU: a concurrent call may have inserted the CURRENT row between our read and this
  // insert, colliding on uq_brand_assets_current_per_touchpoint (Postgres 23505). Recover by
  // re-reading the now-present CURRENT row and applying our patch in place, so concurrent
  // upserts converge instead of surfacing a generic insert error.
  if (error?.code === '23505') {
    const { data: raced, error: reReadError } = await supabase
      .from(BRAND_ASSETS_TABLE)
      .select('id')
      .eq('brand_id', input.brandId)
      .eq('touchpoint_id', input.touchpointId)
      .is('superseded_by', null)
      .maybeSingle();
    if (!reReadError && raced) {
      return updateCurrentTouchpoint(supabase, (raced as { id: string }).id, patch);
    }
  }

  throw new FunnelInventoryError(`failed to insert funnel touchpoint: ${error?.message ?? 'no row returned'}`, error);
}

/** Apply a patch to the CURRENT touchpoint row by id, returning the updated row. */
async function updateCurrentTouchpoint(
  supabase: ReturnType<typeof getUserSupabase>,
  rowId: string,
  patch: Record<string, unknown>,
): Promise<FunnelTouchpoint> {
  const { data, error } = await supabase
    .from(BRAND_ASSETS_TABLE)
    .update(patch)
    .eq('id', rowId)
    .select(TOUCHPOINT_COLS)
    .single();
  if (error || !data) {
    throw new FunnelInventoryError(`failed to update funnel touchpoint: ${error?.message ?? 'no row returned'}`, error);
  }
  return data as FunnelTouchpoint;
}

export interface RunAuditInput {
  brandAssetId: string;
  avatarId: string;
  overallScore?: number | null;
  auditResult?: unknown;
  grounding?: string;
  evidenceRefs?: unknown[];
}

/**
 * Score one inventory touchpoint for one avatar via the `save_asset_audit_atomic` RPC.
 * The RPC verifies asset+avatar ownership, same-brand coupling, and supersedes the prior
 * overlay row atomically. Returns the new CURRENT overlay row.
 */
export async function runAudit(input: RunAuditInput): Promise<FunnelAuditRow> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .rpc('save_asset_audit_atomic', {
      p_brand_asset_id: input.brandAssetId,
      p_avatar_id: input.avatarId,
      p_overall_score: input.overallScore ?? null,
      p_audit_result: input.auditResult ?? null,
      p_grounding: input.grounding ?? 'inference',
      p_evidence_refs: input.evidenceRefs ?? [],
    })
    .single();

  if (error || !data) {
    throw new FunnelInventoryError(`failed to record funnel audit: ${error?.message ?? 'no row returned'}`, error);
  }
  return data as FunnelAuditRow;
}

/**
 * Read the CURRENT per-avatar audit overlay for a brand's inventory. With `avatarId` set,
 * only that avatar's overlays; the inventory join keeps it brand-scoped via RLS on both tables.
 */
export async function getAudits(brandId: string, avatarId: string): Promise<FunnelAuditRow[]> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from(AUDITS_TABLE)
    .select(AUDIT_COLS)
    .eq('brand_id', brandId)
    .eq('avatar_id', avatarId)
    .is('superseded_by', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new FunnelInventoryError(`failed to read funnel audits: ${error.message}`, error);
  }
  return (data as FunnelAuditRow[] | null) ?? [];
}

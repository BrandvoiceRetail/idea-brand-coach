/**
 * Layer 1 (service) — avatar lifecycle over the RLS-bound user client.
 *
 * The CRUD spine the lifecycle tools (create_avatar / list_avatars / get_avatar /
 * record_avatar_build) wrap. Every write runs on the JWT-bound client so RLS scopes
 * rows to `auth.uid()`; `brand_id` is resolved SERVER-SIDE (avatarOwnership.resolveBrandId)
 * and stamped here — never accepted from a caller. The coach current-avatar pointer is
 * NOT touched here: that is the `set_current_avatar` RPC's sole write path (P1), called
 * separately so the MCP holds no session state.
 */
import { getUserSupabase } from '../supabaseUser.js';
import { getIdentity } from '../context/identity.js';
import { resolveBrandId } from './avatarOwnership.js';

const AVATARS_TABLE = 'avatars';
const BUILD_STATE_TABLE = 'avatar_build_state';

/** Raised when a lifecycle DB call fails. */
export class AvatarLifecycleError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AvatarLifecycleError';
  }
}

/** A persisted avatar row, the lifecycle-relevant columns. */
export interface AvatarRow {
  id: string;
  brand_id: string;
  name: string;
  description: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

const AVATAR_COLS = 'id, brand_id, name, description, is_primary, created_at, updated_at';

/** Demographic/psychographic JSON the caller may supply at creation. */
export interface CreateAvatarInput {
  name: string;
  description?: string | null;
  demographics?: unknown;
  psychographics?: unknown;
  buyingBehavior?: unknown;
  voiceOfCustomer?: string | null;
}

function requireUserId(): string {
  const { userId } = getIdentity();
  if (!userId) throw new AvatarLifecycleError('no authenticated user id in scope');
  return userId;
}

/**
 * Create an avatar under the caller's brand. `brand_id` is resolved server-side; the
 * §9 sync trigger also reconciles it, but we set it explicitly so the row is valid even
 * pre-trigger. `is_primary` is intentionally NOT set here (use set_primary_avatar).
 */
export async function createAvatar(input: CreateAvatarInput): Promise<AvatarRow> {
  const supabase = getUserSupabase();
  const userId = requireUserId();
  const brandId = await resolveBrandId();

  const { data, error } = await supabase
    .from(AVATARS_TABLE)
    .insert({
      user_id: userId,
      brand_id: brandId,
      name: input.name,
      description: input.description ?? null,
      demographics: input.demographics ?? null,
      psychographics: input.psychographics ?? null,
      buying_behavior: input.buyingBehavior ?? null,
      voice_of_customer: input.voiceOfCustomer ?? null,
    })
    .select(AVATAR_COLS)
    .single();

  if (error || !data) {
    throw new AvatarLifecycleError(`failed to create avatar: ${error?.message ?? 'no row returned'}`, error);
  }
  return data as AvatarRow;
}

/** Partial-update fields for an existing avatar (only provided keys are written). */
export interface UpdateAvatarInput {
  name?: string;
  description?: string | null;
  demographics?: unknown;
  psychographics?: unknown;
  buyingBehavior?: unknown;
  voiceOfCustomer?: string | null;
}

/**
 * Enrich/edit an existing avatar's content fields. Only the keys present in `patch`
 * are written (partial update) — so the coach can flesh out a placeholder avatar
 * instead of creating duplicates. Ownership is verified by `requireOwnedAvatar` at the
 * tool layer before this runs; RLS re-checks on update. `updated_at` is bumped so the
 * edited avatar sorts to the top of list_avatars. Throws if nothing to update or the
 * row isn't the caller's / doesn't exist.
 */
export async function updateAvatar(avatarId: string, patch: UpdateAvatarInput): Promise<AvatarRow> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.demographics !== undefined) update.demographics = patch.demographics;
  if (patch.psychographics !== undefined) update.psychographics = patch.psychographics;
  if (patch.buyingBehavior !== undefined) update.buying_behavior = patch.buyingBehavior;
  if (patch.voiceOfCustomer !== undefined) update.voice_of_customer = patch.voiceOfCustomer;
  if (Object.keys(update).length === 0) {
    throw new AvatarLifecycleError('no fields to update');
  }
  update.updated_at = new Date().toISOString();

  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from(AVATARS_TABLE)
    .update(update)
    .eq('id', avatarId)
    .select(AVATAR_COLS)
    .maybeSingle();

  if (error) throw new AvatarLifecycleError(`failed to update avatar: ${error.message}`, error);
  if (!data) throw new AvatarLifecycleError('avatar not found or not owned');
  return data as AvatarRow;
}

/** Count rows in an avatar-scoped table for one avatar (RLS-scoped to the caller). */
async function countAvatarRefs(table: string, avatarId: string): Promise<number> {
  const supabase = getUserSupabase();
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('avatar_id', avatarId);
  if (error) throw new AvatarLifecycleError(`failed to count ${table}: ${error.message}`, error);
  return count ?? 0;
}

export interface DeleteAvatarResult {
  deleted: boolean;
  avatarId: string;
  name: string | null;
  /** Real work that would be CASCADE-removed with the avatar. */
  dependents: { brandAssets: number; brandTests: number; diagnostics: number };
  /** True when the delete was refused because dependents exist and force was not set. */
  refusedForDependents: boolean;
}

/**
 * Delete an avatar (RLS-scoped). Deleting an avatar CASCADE-removes its funnel pieces
 * (brand_assets), split-tests (brand_tests), diagnostics, KB, audits, etc., and SET-NULLs
 * the brand primary / coach current pointers. So we refuse when the avatar has real work
 * (pieces/tests/diagnostics) unless `force` is set — this makes clearing empty placeholder
 * avatars safe while preventing accidental loss of a worked-on avatar. Ownership is verified
 * by requireOwnedAvatar at the tool layer; RLS re-checks on delete.
 */
export async function deleteAvatar(avatarId: string, force = false): Promise<DeleteAvatarResult> {
  const existing = await getAvatar(avatarId);
  if (!existing) throw new AvatarLifecycleError('avatar not found or not owned');

  const [brandAssets, brandTests, diagnostics] = await Promise.all([
    countAvatarRefs('brand_assets', avatarId),
    countAvatarRefs('brand_tests', avatarId),
    countAvatarRefs('diagnostic_submissions', avatarId),
  ]);
  const dependents = { brandAssets, brandTests, diagnostics };
  const hasWork = brandAssets + brandTests + diagnostics > 0;

  if (hasWork && !force) {
    return { deleted: false, avatarId, name: existing.name, dependents, refusedForDependents: true };
  }

  const supabase = getUserSupabase();
  const { error } = await supabase.from(AVATARS_TABLE).delete().eq('id', avatarId);
  if (error) throw new AvatarLifecycleError(`failed to delete avatar: ${error.message}`, error);
  return { deleted: true, avatarId, name: existing.name, dependents, refusedForDependents: false };
}

/** List the caller's avatars under their brand, newest-updated first. */
export async function listAvatars(): Promise<AvatarRow[]> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from(AVATARS_TABLE)
    .select(AVATAR_COLS)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new AvatarLifecycleError(`failed to list avatars: ${error.message}`, error);
  }
  return (data as AvatarRow[] | null) ?? [];
}

/** Read one avatar by id (RLS-scoped), or `null` if it isn't the caller's / absent. */
export async function getAvatar(avatarId: string): Promise<AvatarRow | null> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from(AVATARS_TABLE)
    .select(AVATAR_COLS)
    .eq('id', avatarId)
    .maybeSingle();

  if (error) {
    throw new AvatarLifecycleError(`failed to read avatar: ${error.message}`, error);
  }
  return (data as AvatarRow | null) ?? null;
}

/** A persisted avatar_build_state row. */
export interface BuildStateRow {
  avatar_id: string;
  stages_done: string[];
  status: string;
  approved_at: string | null;
  updated_at: string;
}

export interface RecordBuildInput {
  avatarId: string;
  stagesDone?: string[];
  status?: 'draft' | 'built' | 'approved';
}

/**
 * Upsert the per-avatar forensic build state (S1→S4 progress + approval). The caller's
 * ownership of `avatarId` is verified by `requireOwnedAvatar` at the tool layer before
 * this runs; RLS re-checks ownership via the avatars join on insert/update.
 * `approved_at` is stamped when status flips to 'approved'.
 */
export async function recordBuildState(input: RecordBuildInput): Promise<BuildStateRow> {
  const supabase = getUserSupabase();
  const userId = requireUserId();

  const row: Record<string, unknown> = {
    avatar_id: input.avatarId,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (input.stagesDone) row.stages_done = input.stagesDone;
  if (input.status) {
    row.status = input.status;
    if (input.status === 'approved') row.approved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from(BUILD_STATE_TABLE)
    .upsert(row, { onConflict: 'avatar_id' })
    .select('avatar_id, stages_done, status, approved_at, updated_at')
    .single();

  if (error || !data) {
    throw new AvatarLifecycleError(`failed to record build state: ${error?.message ?? 'no row returned'}`, error);
  }
  return data as BuildStateRow;
}

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

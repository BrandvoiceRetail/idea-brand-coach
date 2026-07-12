/**
 * v5ScopeService — resolves the brand + avatar scope the /v5 build theatre runs in.
 *
 * WHY: the forensic build chain (useForensicAvatarBuild → ForensicBuildService)
 * persists stage artifacts via `save_artifact_atomic`, which requires a REAL
 * avatar row with a NOT-NULL `brand_id` (P1) — the hook no-ops on a null
 * avatarId. `fixService.generateBrief` needs the same real avatar id. So /v5
 * ensures exactly one brand + one working avatar exist for the (possibly
 * anonymous) user, creating the minimum honest rows when absent and reusing
 * what is already there for returning users (re-runs supersede artifacts by
 * design; manually-locked avatar fields are protected by the DB trigger).
 *
 * All reads/writes are RLS-scoped to the caller. No user content is invented:
 * the placeholder names are structural labels, not claims about the customer.
 */

import { supabase } from '@/integrations/supabase/client';

export interface V5Scope {
  brandId: string;
  avatarId: string;
}

const DEFAULT_BRAND_NAME = 'My brand';
const DEFAULT_AVATAR_NAME = 'Your customer';

/**
 * Ensure the signed-in (or anonymous) user has a brand + avatar to build
 * against. Reuses the oldest brand and the most recent avatar when present.
 * @throws when there is no authenticated session or a write fails.
 */
export async function ensureV5Scope(): Promise<V5Scope> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No session, sign in first.');

  // ── Brand (one per user; oldest wins, matching SupabaseAvatarService) ──────
  const { data: brand, error: brandReadErr } = await supabase
    .from('brands')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (brandReadErr) throw brandReadErr;

  let brandId = brand?.id ?? null;
  if (!brandId) {
    const { data: created, error: brandErr } = await supabase
      .from('brands')
      .insert({ user_id: user.id, name: DEFAULT_BRAND_NAME })
      .select('id')
      .single();
    if (brandErr) throw brandErr;
    brandId = created.id;
  }

  // ── Avatar (reuse the newest; else create the working row) ─────────────────
  const { data: avatar, error: avatarReadErr } = await supabase
    .from('avatars')
    .select('id')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (avatarReadErr) throw avatarReadErr;

  let avatarId = avatar?.id ?? null;
  if (!avatarId) {
    const { data: created, error: avatarErr } = await supabase
      .from('avatars')
      .insert({ user_id: user.id, brand_id: brandId, name: DEFAULT_AVATAR_NAME })
      .select('id')
      .single();
    if (avatarErr) throw avatarErr;
    avatarId = created.id;
  }

  return { brandId, avatarId };
}

/**
 * Ensure there is a session, signing in anonymously when there is none.
 * Anonymous sign-ins are ENABLED on this project; the later save step converts
 * the anonymous user to a permanent one via `updateUser({ email })`.
 */
export async function ensureSession(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

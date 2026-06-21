/**
 * SupabaseUserProfileService
 * Implements IUserProfileService for Supabase backend
 */

import { supabase } from '@/integrations/supabase/client';
import { IUserProfileService } from './interfaces/IUserProfileService';
import { UserProfile, UserProfileUpdate } from '@/types/profile';

export class SupabaseUserProfileService implements IUserProfileService {
  async getProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      created_at: data.created_at,
      updated_at: data.updated_at,
      latest_diagnostic_data: data.latest_diagnostic_data,
      latest_diagnostic_score: data.latest_diagnostic_score,
      diagnostic_completed_at: data.diagnostic_completed_at,
    };
  }

  async updateProfile(updates: UserProfileUpdate): Promise<UserProfile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      created_at: data.created_at,
      updated_at: data.updated_at,
      latest_diagnostic_data: data.latest_diagnostic_data,
      latest_diagnostic_score: data.latest_diagnostic_score,
      diagnostic_completed_at: data.diagnostic_completed_at,
    };
  }

  async createProfile(userId: string, email: string, fullName?: string): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email,
        full_name: fullName || null,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async hasDiagnostic(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('profiles')
      .select('latest_diagnostic_score')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data?.latest_diagnostic_score !== null && data?.latest_diagnostic_score !== undefined;
  }

  /**
   * Set the current coach avatar via the ownership-checked `set_current_avatar`
   * RPC. The RPC (SECURITY INVOKER) verifies ownership server-side and updates
   * `profiles.current_avatar_id`; it RAISEs `avatar_not_owned` otherwise, which
   * surfaces here as a thrown error for the caller to roll back + toast.
   */
  async setCurrentAvatarRPC(avatarId: string): Promise<void> {
    const { error } = await supabase.rpc('set_current_avatar', { p_avatar_id: avatarId });
    if (error) throw error;
  }

  /**
   * Read counterpart of {@link setCurrentAvatarRPC}. Reads
   * `profiles.current_avatar_id` for the authenticated user (RLS-scoped to self).
   */
  async getCurrentAvatarId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('current_avatar_id')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data?.current_avatar_id ?? null;
  }

  /**
   * Set the active context avatar SET via the ownership-checked
   * `set_context_avatars` RPC (multi-avatar set model). SECURITY INVOKER; the
   * RPC ownership-checks every member and RAISEs `avatar_not_owned` /
   * `empty_avatar_set`, which surface here as thrown errors for the caller to
   * roll back + toast.
   */
  async setContextAvatarsRPC(avatarIds: string[]): Promise<void> {
    const { error } = await supabase.rpc('set_context_avatars', { p_avatar_ids: avatarIds });
    if (error) throw error;
  }

  /**
   * Read counterpart of {@link setContextAvatarsRPC}. Reads
   * `profiles.context_avatar_ids` for the authenticated user (RLS-scoped to
   * self). Returns `[]` when unauthenticated or no set is stored.
   *
   * `context_avatar_ids` is live in the DB but not yet in the regenerated
   * `types.ts`, so the row is read untyped and the column narrowed via a guard
   * (never `any`).
   */
  async getContextAvatarIds(): Promise<string[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('context_avatar_ids')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    return toStringArray((data as Record<string, unknown> | null)?.context_avatar_ids);
  }

  /**
   * Mark an avatar as the brand's primary (the star) via the ownership-checked
   * `set_primary_avatar` RPC (P1). SECURITY INVOKER; verifies ownership + brand
   * server-side and RAISEs otherwise, surfacing here as a thrown error.
   */
  async setPrimaryAvatarRPC(avatarId: string): Promise<void> {
    const { error } = await supabase.rpc('set_primary_avatar', { p_avatar_id: avatarId });
    if (error) throw error;
  }
}

/** Narrow an unknown PostgREST value to a `string[]` (uuid[] columns). */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

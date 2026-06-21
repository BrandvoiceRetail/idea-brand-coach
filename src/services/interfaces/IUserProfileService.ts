/**
 * IUserProfileService Interface
 * Contract for user profile operations
 */

import { UserProfile, UserProfileUpdate } from '@/types/profile';

export interface IUserProfileService {
  /**
   * Get the current authenticated user's profile
   */
  getProfile(): Promise<UserProfile | null>;

  /**
   * Update the current authenticated user's profile
   */
  updateProfile(updates: UserProfileUpdate): Promise<UserProfile>;

  /**
   * Create a new user profile (usually called by database trigger)
   */
  createProfile(userId: string, email: string, fullName?: string): Promise<UserProfile>;

  /**
   * Check if user has completed diagnostic
   */
  hasDiagnostic(): Promise<boolean>;

  /**
   * Set the current coach avatar (UI default mirror) via the ownership-checked
   * `set_current_avatar` RPC (multi-avatar design §2.2/§3.3). This is the ONLY
   * write path for `profiles.current_avatar_id` — no direct PostgREST UPDATE.
   * Rejects (throws) if the avatar is not owned by the caller.
   *
   * @param avatarId - ID of the avatar to make current
   */
  setCurrentAvatarRPC(avatarId: string): Promise<void>;

  /**
   * Read the current coach avatar pointer (`profiles.current_avatar_id`) for the
   * authenticated user. The read counterpart of {@link setCurrentAvatarRPC} so
   * the AvatarContext startup-priority read goes through the service layer
   * rather than a raw PostgREST query. Returns `null` when unauthenticated or no
   * pointer is set.
   */
  getCurrentAvatarId(): Promise<string | null>;

  /**
   * Set the active context avatar SET via the ownership-checked
   * `set_context_avatars` RPC (multi-avatar set model). The RPC verifies every
   * member is owned by the caller, then writes `profiles.context_avatar_ids`;
   * it RAISEs `avatar_not_owned` / `empty_avatar_set` otherwise, which surface
   * here as a thrown error for the caller to roll back + toast. This is the
   * SET-aware counterpart of {@link setCurrentAvatarRPC}.
   *
   * @param avatarIds - the avatars that make up the active context set
   */
  setContextAvatarsRPC(avatarIds: string[]): Promise<void>;

  /**
   * Read the profile-default context avatar SET (`profiles.context_avatar_ids`)
   * for the authenticated user. The read counterpart of
   * {@link setContextAvatarsRPC}; the AvatarContext startup-priority read uses
   * it before falling back to localStorage / the single-id seed. Returns `[]`
   * when unauthenticated or no set is stored.
   */
  getContextAvatarIds(): Promise<string[]>;

  /**
   * Mark an avatar as the brand's primary (the star) via the ownership-checked
   * `set_primary_avatar` RPC (P1). The RPC clears the prior primary and sets the
   * new one in one tx, mirroring `brands.primary_avatar_id`. Rejects (throws) if
   * the avatar is not owned by the caller or has no brand.
   *
   * @param avatarId - ID of the avatar to make primary
   */
  setPrimaryAvatarRPC(avatarId: string): Promise<void>;
}

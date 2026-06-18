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
}

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
}

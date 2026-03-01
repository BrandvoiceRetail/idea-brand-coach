/**
 * IAvatarService Interface
 * Contract for avatar operations
 */

import { Avatar, AvatarCreate, AvatarUpdate, AvatarTemplate } from '@/types/avatar';

export interface IAvatarService {
  /**
   * Get all avatars for the current authenticated user
   */
  getAvatars(): Promise<Avatar[]>;

  /**
   * Get a specific avatar by ID
   */
  getAvatar(id: string): Promise<Avatar | null>;

  /**
   * Create a new avatar for the current authenticated user
   */
  createAvatar(data: AvatarCreate): Promise<Avatar>;

  /**
   * Update an existing avatar
   */
  updateAvatar(id: string, data: AvatarUpdate): Promise<Avatar>;

  /**
   * Delete an avatar by ID
   */
  deleteAvatar(id: string): Promise<void>;

  /**
   * Get available avatar templates
   */
  getAvatarTemplates(): Promise<AvatarTemplate[]>;
}

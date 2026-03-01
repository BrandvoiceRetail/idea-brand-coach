/**
 * IAvatarService Interface
 *
 * Abstract contract for customer avatar CRUD operations.
 * This abstraction allows us to switch out implementations as downstream
 * dependencies evolve (e.g., migrating from Supabase to a different backend,
 * API changes, or testing with mocks) without impacting application code.
 *
 * Current implementation:
 * - SupabaseAvatarService: Persists to Supabase with RLS policies
 */

import { Avatar, AvatarCreate, AvatarUpdate } from '@/types/avatar';

export interface IAvatarService {
  /**
   * Create a new avatar for the current user.
   * If no name is provided in the avatar data, generates a unique name.
   *
   * @param avatar - Avatar creation data
   * @returns Promise resolving to the created avatar
   * @throws Error if avatar cannot be created (e.g., network failure, auth issues)
   */
  create(avatar: AvatarCreate): Promise<Avatar>;

  /**
   * Retrieve all avatars for the current user.
   * Results are ordered by updated_at timestamp (newest first).
   *
   * @returns Promise resolving to array of avatars
   * @throws Error if avatars cannot be retrieved
   */
  getAll(): Promise<Avatar[]>;

  /**
   * Retrieve a single avatar by ID.
   * Only returns the avatar if it belongs to the current user (via RLS).
   *
   * @param id - Avatar ID
   * @returns Promise resolving to the avatar or null if not found
   * @throws Error if avatar cannot be retrieved
   */
  getById(id: string): Promise<Avatar | null>;

  /**
   * Update an existing avatar.
   * Only fields provided in the update object will be modified.
   *
   * @param id - Avatar ID
   * @param update - Avatar update data
   * @returns Promise resolving to the updated avatar
   * @throws Error if avatar cannot be updated (e.g., not found, permission denied)
   */
  update(id: string, update: AvatarUpdate): Promise<Avatar>;

  /**
   * Delete an avatar by ID.
   * Only deletes if the avatar belongs to the current user (via RLS).
   *
   * @param id - Avatar ID
   * @returns Promise resolving when avatar is deleted
   * @throws Error if avatar cannot be deleted (e.g., not found, permission denied)
   */
  delete(id: string): Promise<void>;

  /**
   * Duplicate an existing avatar with a new unique name.
   * Creates a copy of all avatar data including demographics, psychographics, and buying behavior.
   *
   * @param id - Avatar ID to duplicate
   * @param newName - Optional custom name for the duplicate (if not provided, generates unique name)
   * @returns Promise resolving to the duplicated avatar
   * @throws Error if avatar cannot be duplicated (e.g., source not found, creation failed)
   */
  duplicate(id: string, newName?: string): Promise<Avatar>;

  /**
   * Generate a unique avatar name that doesn't conflict with existing avatars.
   * Creates names in the format 'Avatar 1', 'Avatar 2', etc.
   *
   * @param baseName - Optional base name to use (defaults to 'Avatar')
   * @returns Promise resolving to a unique avatar name
   * @throws Error if unique name cannot be generated
   */
  generateUniqueName(baseName?: string): Promise<string>;

  /**
   * Retrieve all pre-defined avatar templates.
   * Templates include personas like 'Weekend Warrior', 'Budget Conscious', etc.
   *
   * @returns Promise resolving to array of template avatars
   * @throws Error if templates cannot be retrieved
   */
  getTemplates(): Promise<Avatar[]>;
}

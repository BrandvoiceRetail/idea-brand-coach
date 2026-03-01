/**
 * Avatar Repository Interface
 *
 * Defines the contract for avatar data persistence.
 * Implementations may use Supabase, localStorage, or in-memory storage.
 */

import { Avatar } from '../entities/Avatar';
import { AvatarId, BrandId } from '../../shared/types';

export interface IAvatarRepository {
  create(avatar: Avatar): Promise<Avatar>;
  findById(id: AvatarId): Promise<Avatar | null>;
  findByBrandId(brandId: BrandId): Promise<Avatar[]>;
  update(avatar: Avatar): Promise<Avatar>;
  delete(id: AvatarId): Promise<void>;
}

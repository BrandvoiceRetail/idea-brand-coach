/**
 * Brand Repository Interface
 *
 * Defines the contract for brand data persistence.
 * Implementations may use Supabase, localStorage, or in-memory storage.
 */

import { Brand } from '../entities/Brand';
import { BrandId, UserId } from '../../shared/types';

export interface IBrandRepository {
  create(brand: Brand): Promise<Brand>;
  findById(id: BrandId): Promise<Brand | null>;
  findByUserId(userId: UserId): Promise<Brand[]>;
  update(brand: Brand): Promise<Brand>;
  delete(id: BrandId): Promise<void>;
}

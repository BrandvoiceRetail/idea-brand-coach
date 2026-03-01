/**
 * Create Brand Use Case
 *
 * Handles brand creation workflow: validates input, creates entity, persists.
 */

import { Brand, BrandProps } from '../../domain/entities/Brand';
import { IBrandRepository } from '../../domain/repositories/IBrandRepository';
import { Result, success, failure, UserId } from '../../shared/types';

export interface CreateBrandInput {
  userId: UserId;
  name: string;
  vision?: string;
  mission?: string;
  values?: string[];
  positioning?: string;
}

export class CreateBrandUseCase {
  constructor(private readonly brandRepository: IBrandRepository) {}

  async execute(input: CreateBrandInput): Promise<Result<Brand>> {
    const now = new Date();
    const id = crypto.randomUUID();

    const brandProps: BrandProps = {
      id,
      userId: input.userId,
      name: input.name,
      vision: input.vision,
      mission: input.mission,
      values: input.values,
      positioning: input.positioning,
      createdAt: now,
      updatedAt: now,
    };

    const brandResult = Brand.create(brandProps);
    if (!brandResult.success || !brandResult.data) {
      return failure(brandResult.error || 'Failed to create brand');
    }

    try {
      const persisted = await this.brandRepository.create(brandResult.data);
      return success(persisted);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return failure(`Failed to persist brand: ${message}`);
    }
  }
}

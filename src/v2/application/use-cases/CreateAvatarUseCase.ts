/**
 * Create Avatar Use Case
 *
 * Handles avatar creation with brand association.
 * Validates brand exists before creating avatar.
 */

import { Avatar, AvatarProps } from '../../domain/entities/Avatar';
import { IBrandRepository } from '../../domain/repositories/IBrandRepository';
import { IAvatarRepository } from '../../domain/repositories/IAvatarRepository';
import { Demographics, DemographicsProps } from '../../domain/value-objects/Demographics';
import { Psychographics, PsychographicsProps } from '../../domain/value-objects/Psychographics';
import { Result, success, failure, BrandId } from '../../shared/types';

export interface CreateAvatarInput {
  brandId: BrandId;
  name: string;
  demographics: DemographicsProps;
  psychographics: PsychographicsProps;
  painPoints: string[];
  goals: string[];
}

export class CreateAvatarUseCase {
  constructor(
    private readonly avatarRepository: IAvatarRepository,
    private readonly brandRepository: IBrandRepository,
  ) {}

  async execute(input: CreateAvatarInput): Promise<Result<Avatar>> {
    // Verify brand exists
    const brand = await this.brandRepository.findById(input.brandId);
    if (!brand) {
      return failure(`Brand with id "${input.brandId}" not found`);
    }

    // Create value objects
    const demographicsResult = Demographics.create(input.demographics);
    if (!demographicsResult.success || !demographicsResult.data) {
      return failure(`Demographics validation failed: ${demographicsResult.error}`);
    }

    const psychographicsResult = Psychographics.create(input.psychographics);
    if (!psychographicsResult.success || !psychographicsResult.data) {
      return failure(`Psychographics validation failed: ${psychographicsResult.error}`);
    }

    // Create avatar entity
    const id = crypto.randomUUID();
    const avatarProps: AvatarProps = {
      id,
      brandId: input.brandId,
      name: input.name,
      demographics: demographicsResult.data,
      psychographics: psychographicsResult.data,
      painPoints: input.painPoints,
      goals: input.goals,
    };

    const avatarResult = Avatar.create(avatarProps);
    if (!avatarResult.success || !avatarResult.data) {
      return failure(avatarResult.error || 'Failed to create avatar');
    }

    try {
      const persisted = await this.avatarRepository.create(avatarResult.data);
      return success(persisted);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return failure(`Failed to persist avatar: ${message}`);
    }
  }
}

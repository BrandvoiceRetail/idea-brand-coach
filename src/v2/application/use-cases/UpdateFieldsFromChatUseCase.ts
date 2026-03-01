/**
 * Update Fields From Chat Use Case
 *
 * Extracts structured field updates from chat messages and applies them
 * to the appropriate avatar or brand entity.
 */

import { Avatar } from '../../domain/entities/Avatar';
import { Brand } from '../../domain/entities/Brand';
import { IAvatarRepository } from '../../domain/repositories/IAvatarRepository';
import { IBrandRepository } from '../../domain/repositories/IBrandRepository';
import { Demographics, DemographicsProps } from '../../domain/value-objects/Demographics';
import { Psychographics, PsychographicsProps } from '../../domain/value-objects/Psychographics';
import { Result, success, failure, AvatarId, BrandId } from '../../shared/types';

export interface FieldUpdate {
  field: string;
  value: unknown;
}

export interface UpdateFieldsInput {
  entityType: 'brand' | 'avatar';
  entityId: BrandId | AvatarId;
  fields: FieldUpdate[];
}

export interface UpdateFieldsOutput {
  updatedFields: string[];
  failedFields: Array<{ field: string; reason: string }>;
}

export class UpdateFieldsFromChatUseCase {
  constructor(
    private readonly brandRepository: IBrandRepository,
    private readonly avatarRepository: IAvatarRepository,
  ) {}

  async execute(input: UpdateFieldsInput): Promise<Result<UpdateFieldsOutput>> {
    if (input.entityType === 'brand') {
      return this.updateBrandFields(input.entityId, input.fields);
    }
    return this.updateAvatarFields(input.entityId, input.fields);
  }

  private async updateBrandFields(
    brandId: BrandId,
    fields: FieldUpdate[],
  ): Promise<Result<UpdateFieldsOutput>> {
    const brand = await this.brandRepository.findById(brandId);
    if (!brand) {
      return failure(`Brand with id "${brandId}" not found`);
    }

    const output: UpdateFieldsOutput = { updatedFields: [], failedFields: [] };

    for (const { field, value } of fields) {
      const result = this.applyBrandField(brand, field, value);
      if (result.success) {
        output.updatedFields.push(field);
      } else {
        output.failedFields.push({ field, reason: result.error || 'Unknown error' });
      }
    }

    if (output.updatedFields.length > 0) {
      try {
        await this.brandRepository.update(brand);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return failure(`Failed to persist brand updates: ${message}`);
      }
    }

    return success(output);
  }

  private applyBrandField(brand: Brand, field: string, value: unknown): Result<void> {
    switch (field) {
      case 'name':
        return brand.updateName(value as string);
      case 'vision':
        return brand.updateVision(value as string);
      case 'mission':
        return brand.updateMission(value as string);
      case 'positioning':
        return brand.updatePositioning(value as string);
      case 'values':
        if (Array.isArray(value)) {
          for (const v of value) {
            const result = brand.addValue(v as string);
            if (!result.success) return result;
          }
          return success(undefined);
        }
        return failure('values must be an array');
      default:
        return failure(`Unknown brand field: ${field}`);
    }
  }

  private async updateAvatarFields(
    avatarId: AvatarId,
    fields: FieldUpdate[],
  ): Promise<Result<UpdateFieldsOutput>> {
    const avatar = await this.avatarRepository.findById(avatarId);
    if (!avatar) {
      return failure(`Avatar with id "${avatarId}" not found`);
    }

    const output: UpdateFieldsOutput = { updatedFields: [], failedFields: [] };

    for (const { field, value } of fields) {
      const result = this.applyAvatarField(avatar, field, value);
      if (result.success) {
        output.updatedFields.push(field);
      } else {
        output.failedFields.push({ field, reason: result.error || 'Unknown error' });
      }
    }

    if (output.updatedFields.length > 0) {
      try {
        await this.avatarRepository.update(avatar);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return failure(`Failed to persist avatar updates: ${message}`);
      }
    }

    return success(output);
  }

  private applyAvatarField(avatar: Avatar, field: string, value: unknown): Result<void> {
    switch (field) {
      case 'name':
        return avatar.updateName(value as string);
      case 'demographics': {
        const demoResult = Demographics.create(value as DemographicsProps);
        if (!demoResult.success || !demoResult.data) {
          return failure(demoResult.error || 'Invalid demographics');
        }
        return avatar.updateDemographics(demoResult.data);
      }
      case 'psychographics': {
        const psychResult = Psychographics.create(value as PsychographicsProps);
        if (!psychResult.success || !psychResult.data) {
          return failure(psychResult.error || 'Invalid psychographics');
        }
        return avatar.updatePsychographics(psychResult.data);
      }
      case 'painPoints':
        if (Array.isArray(value)) {
          for (const p of value) {
            const result = avatar.addPainPoint(p as string);
            if (!result.success) return result;
          }
          return success(undefined);
        }
        return failure('painPoints must be an array');
      case 'goals':
        if (Array.isArray(value)) {
          for (const g of value) {
            const result = avatar.addGoal(g as string);
            if (!result.success) return result;
          }
          return success(undefined);
        }
        return failure('goals must be an array');
      default:
        return failure(`Unknown avatar field: ${field}`);
    }
  }
}

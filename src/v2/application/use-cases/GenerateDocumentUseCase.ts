/**
 * Generate Document Use Case
 *
 * Creates brand strategy documents from brand and avatar data.
 * Assembles the content from domain entities into structured document output.
 */

import { IBrandRepository } from '../../domain/repositories/IBrandRepository';
import { IAvatarRepository } from '../../domain/repositories/IAvatarRepository';
import { Result, success, failure, BrandId } from '../../shared/types';

export type DocumentType = 'brand-summary' | 'avatar-profile' | 'brand-strategy';

export interface GenerateDocumentInput {
  brandId: BrandId;
  documentType: DocumentType;
}

export interface GeneratedDocument {
  title: string;
  documentType: DocumentType;
  content: string;
  generatedAt: Date;
}

export class GenerateDocumentUseCase {
  constructor(
    private readonly brandRepository: IBrandRepository,
    private readonly avatarRepository: IAvatarRepository,
  ) {}

  async execute(input: GenerateDocumentInput): Promise<Result<GeneratedDocument>> {
    const brand = await this.brandRepository.findById(input.brandId);
    if (!brand) {
      return failure(`Brand with id "${input.brandId}" not found`);
    }

    const avatars = await this.avatarRepository.findByBrandId(input.brandId);

    switch (input.documentType) {
      case 'brand-summary':
        return success(this.generateBrandSummary(brand, avatars.length));

      case 'avatar-profile':
        if (avatars.length === 0) {
          return failure('No avatars found for this brand. Create at least one avatar first.');
        }
        return success(this.generateAvatarProfile(brand, avatars));

      case 'brand-strategy':
        return success(this.generateBrandStrategy(brand, avatars));

      default:
        return failure(`Unknown document type: ${input.documentType}`);
    }
  }

  private generateBrandSummary(
    brand: ReturnType<typeof Object.create>,
    avatarCount: number,
  ): GeneratedDocument {
    const brandData = brand.toPlainObject();
    const sections: string[] = [];

    sections.push(`# Brand Summary: ${brandData.name}`);
    sections.push('');

    if (brandData.vision) {
      sections.push(`## Vision`);
      sections.push(brandData.vision);
      sections.push('');
    }

    if (brandData.mission) {
      sections.push(`## Mission`);
      sections.push(brandData.mission);
      sections.push('');
    }

    if (brandData.values && brandData.values.length > 0) {
      sections.push(`## Core Values`);
      brandData.values.forEach((v: string) => sections.push(`- ${v}`));
      sections.push('');
    }

    if (brandData.positioning) {
      sections.push(`## Positioning`);
      sections.push(brandData.positioning);
      sections.push('');
    }

    sections.push(`## Overview`);
    sections.push(`- Target Avatars: ${avatarCount}`);
    sections.push(`- Created: ${brandData.createdAt.toISOString()}`);

    return {
      title: `${brandData.name} - Brand Summary`,
      documentType: 'brand-summary',
      content: sections.join('\n'),
      generatedAt: new Date(),
    };
  }

  private generateAvatarProfile(
    brand: ReturnType<typeof Object.create>,
    avatars: Array<ReturnType<typeof Object.create>>,
  ): GeneratedDocument {
    const brandData = brand.toPlainObject();
    const sections: string[] = [];

    sections.push(`# Avatar Profiles: ${brandData.name}`);
    sections.push('');

    for (const avatar of avatars) {
      const avatarData = avatar.toPlainObject();
      sections.push(`## ${avatarData.name}`);
      sections.push('');

      const demo = avatarData.demographics.toPlainObject
        ? avatarData.demographics.toPlainObject()
        : avatarData.demographics;

      sections.push(`### Demographics`);
      sections.push(`- Age: ${demo.ageMin}-${demo.ageMax}`);
      if (demo.gender) sections.push(`- Gender: ${demo.gender}`);
      if (demo.income) sections.push(`- Income: ${demo.income}`);
      if (demo.location) sections.push(`- Location: ${demo.location}`);
      if (demo.education) sections.push(`- Education: ${demo.education}`);
      if (demo.occupation) sections.push(`- Occupation: ${demo.occupation}`);
      sections.push('');

      const psycho = avatarData.psychographics.toPlainObject
        ? avatarData.psychographics.toPlainObject()
        : avatarData.psychographics;

      sections.push(`### Psychographics`);
      if (psycho.values?.length > 0) {
        sections.push(`**Values:** ${psycho.values.join(', ')}`);
      }
      if (psycho.interests?.length > 0) {
        sections.push(`**Interests:** ${psycho.interests.join(', ')}`);
      }
      if (psycho.lifestyle?.length > 0) {
        sections.push(`**Lifestyle:** ${psycho.lifestyle.join(', ')}`);
      }
      sections.push('');

      if (avatarData.painPoints.length > 0) {
        sections.push(`### Pain Points`);
        avatarData.painPoints.forEach((p: string) => sections.push(`- ${p}`));
        sections.push('');
      }

      if (avatarData.goals.length > 0) {
        sections.push(`### Goals`);
        avatarData.goals.forEach((g: string) => sections.push(`- ${g}`));
        sections.push('');
      }
    }

    return {
      title: `${brandData.name} - Avatar Profiles`,
      documentType: 'avatar-profile',
      content: sections.join('\n'),
      generatedAt: new Date(),
    };
  }

  private generateBrandStrategy(
    brand: ReturnType<typeof Object.create>,
    avatars: Array<ReturnType<typeof Object.create>>,
  ): GeneratedDocument {
    const brandData = brand.toPlainObject();
    const sections: string[] = [];

    sections.push(`# Brand Strategy: ${brandData.name}`);
    sections.push('');

    sections.push(`## Brand Foundation`);
    if (brandData.vision) sections.push(`**Vision:** ${brandData.vision}`);
    if (brandData.mission) sections.push(`**Mission:** ${brandData.mission}`);
    if (brandData.positioning) sections.push(`**Positioning:** ${brandData.positioning}`);
    sections.push('');

    if (brandData.values && brandData.values.length > 0) {
      sections.push(`## Core Values`);
      brandData.values.forEach((v: string) => sections.push(`- ${v}`));
      sections.push('');
    }

    sections.push(`## Target Audience`);
    if (avatars.length === 0) {
      sections.push('No target avatars defined yet.');
    } else {
      for (const avatar of avatars) {
        const avatarData = avatar.toPlainObject();
        sections.push(`### ${avatarData.name}`);

        const demo = avatarData.demographics.toPlainObject
          ? avatarData.demographics.toPlainObject()
          : avatarData.demographics;

        sections.push(`- Age Range: ${demo.ageMin}-${demo.ageMax}`);
        if (avatarData.painPoints.length > 0) {
          sections.push(`- Key Pain Points: ${avatarData.painPoints.slice(0, 3).join(', ')}`);
        }
        if (avatarData.goals.length > 0) {
          sections.push(`- Primary Goals: ${avatarData.goals.slice(0, 3).join(', ')}`);
        }
        sections.push('');
      }
    }

    return {
      title: `${brandData.name} - Brand Strategy`,
      documentType: 'brand-strategy',
      content: sections.join('\n'),
      generatedAt: new Date(),
    };
  }
}

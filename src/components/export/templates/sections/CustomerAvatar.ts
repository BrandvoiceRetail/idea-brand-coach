/**
 * Customer Avatar Section Template
 *
 * Generates the Customer Avatar Profile section.
 */

import type { AggregatedData } from '../formatters/DataAggregator';
import type { BrandData } from '@/contexts/BrandContext';
import * as md from '../formatters/MarkdownFormatter';

export function generateCustomerAvatar(
  data: AggregatedData,
  brandData: BrandData
): string {
  let content = '';

  // Main section heading
  content += md.heading('Customer Avatar Profile', 2);

  const hasAvatarData = brandData.avatar.completed ||
    Object.values(brandData.avatar.demographics).some(v => Boolean(v)) ||
    Object.values(brandData.avatar.psychographics).some(v =>
      Array.isArray(v) ? v.length > 0 : Boolean(v)
    );

  if (!hasAvatarData) {
    content += md.paragraph(
      md.italic('Complete the Avatar Builder to create a detailed customer profile.')
    );
    content += md.horizontalRule();
    return content;
  }

  // Demographics
  content += generateDemographics(brandData);

  // Psychographics
  content += generatePsychographics(brandData);

  // Pain Points & Goals
  content += generatePainPointsAndGoals(brandData);

  // Preferred Channels
  if (brandData.avatar.preferredChannels.length > 0) {
    content += md.heading('Preferred Communication Channels', 3);
    content += md.unorderedList(brandData.avatar.preferredChannels);
  }

  content += md.horizontalRule();

  return content;
}

/**
 * Generate demographics subsection
 */
function generateDemographics(brandData: BrandData): string {
  let content = '';
  const demo = brandData.avatar.demographics;

  const hasData = Object.values(demo).some(v => Boolean(v));
  if (!hasData) return '';

  content += md.heading('Demographics', 3);

  const items: string[] = [];
  if (demo.age) items.push(md.keyValue('Age', demo.age));
  if (demo.gender && demo.gender !== 'prefer-not-to-say') {
    items.push(md.keyValue('Gender', demo.gender));
  }
  if (demo.income) items.push(md.keyValue('Income', demo.income));
  if (demo.location) items.push(md.keyValue('Location', demo.location));
  if (demo.occupation) items.push(md.keyValue('Occupation', demo.occupation));

  if (items.length > 0) {
    content += items.join('\n') + '\n\n';
  }

  return content;
}

/**
 * Generate psychographics subsection
 */
function generatePsychographics(brandData: BrandData): string {
  let content = '';
  const psycho = brandData.avatar.psychographics;

  const hasData = psycho.interests.length > 0 ||
    psycho.values.length > 0 ||
    psycho.lifestyle ||
    psycho.personality.length > 0;

  if (!hasData) return '';

  content += md.heading('Psychographics', 3);

  if (psycho.values.length > 0) {
    content += md.paragraph(md.bold('Values'));
    content += md.unorderedList(psycho.values);
  }

  if (psycho.interests.length > 0) {
    content += md.paragraph(md.bold('Interests'));
    content += md.unorderedList(psycho.interests);
  }

  if (psycho.lifestyle) {
    content += md.paragraph(md.bold('Lifestyle'));
    content += md.paragraph(psycho.lifestyle);
  }

  if (psycho.personality.length > 0) {
    content += md.paragraph(md.bold('Personality Traits'));
    content += md.unorderedList(psycho.personality);
  }

  return content;
}

/**
 * Generate pain points and goals subsection
 */
function generatePainPointsAndGoals(brandData: BrandData): string {
  let content = '';

  const hasPainPoints = brandData.avatar.painPoints.length > 0;
  const hasGoals = brandData.avatar.goals.length > 0;

  if (!hasPainPoints && !hasGoals) return '';

  content += md.heading('Pain Points & Goals', 3);

  if (hasPainPoints) {
    content += md.paragraph(md.bold('Pain Points'));
    content += md.unorderedList(brandData.avatar.painPoints);
  }

  if (hasGoals) {
    content += md.paragraph(md.bold('Goals & Aspirations'));
    content += md.unorderedList(brandData.avatar.goals);
  }

  return content;
}

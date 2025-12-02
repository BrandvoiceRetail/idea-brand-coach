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

  const hasAvatarData = data.avatar.length > 0;

  if (!hasAvatarData) {
    content += md.paragraph(
      md.italic('Complete the Avatar Builder to create a detailed customer profile.')
    );
    content += md.horizontalRule();
    return content;
  }

  // Demographics
  content += generateDemographics(data);

  // Psychographics
  content += generatePsychographics(data);

  // Pain Points & Goals
  content += generatePainPointsAndGoals(data);

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
function generateDemographics(data: AggregatedData): string {
  let content = '';

  const getAvatarField = (fieldId: string): string => {
    const entry = data.avatar.find(e => e.fieldIdentifier === fieldId || e.fieldIdentifier.includes(fieldId));
    return entry?.content || '';
  };

  const age = getAvatarField('age') || getAvatarField('demographics_age');
  const gender = getAvatarField('gender') || getAvatarField('demographics_gender');
  const income = getAvatarField('income') || getAvatarField('demographics_income');
  const location = getAvatarField('location') || getAvatarField('demographics_location');
  const occupation = getAvatarField('occupation') || getAvatarField('demographics_occupation');

  const hasData = age || gender || income || location || occupation;
  if (!hasData) return '';

  content += md.heading('Demographics', 3);

  const items: string[] = [];
  if (age) items.push(md.keyValue('Age', age));
  if (gender && gender !== 'prefer-not-to-say') {
    items.push(md.keyValue('Gender', gender));
  }
  if (income) items.push(md.keyValue('Income', income));
  if (location) items.push(md.keyValue('Location', location));
  if (occupation) items.push(md.keyValue('Occupation', occupation));

  if (items.length > 0) {
    content += items.join('\n') + '\n\n';
  }

  return content;
}

/**
 * Generate psychographics subsection
 */
function generatePsychographics(data: AggregatedData): string {
  let content = '';

  const getArrayField = (fieldId: string): string[] => {
    const entry = data.avatar.find(e => e.fieldIdentifier === fieldId || e.fieldIdentifier.includes(fieldId));
    if (!entry) return [];
    try {
      return JSON.parse(entry.content);
    } catch {
      return entry.content.split(/[\n,]/).map(v => v.trim()).filter(v => v);
    }
  };

  const getTextField = (fieldId: string): string => {
    const entry = data.avatar.find(e => e.fieldIdentifier === fieldId || e.fieldIdentifier.includes(fieldId));
    return entry?.content || '';
  };

  const values = getArrayField('psychographics_values') || getArrayField('values');
  const interests = getArrayField('psychographics_interests') || getArrayField('interests');
  const lifestyle = getTextField('psychographics_lifestyle') || getTextField('lifestyle');
  const personality = getArrayField('psychographics_personality') || getArrayField('personality');

  const hasData = values.length > 0 || interests.length > 0 || lifestyle || personality.length > 0;
  if (!hasData) return '';

  content += md.heading('Psychographics', 3);

  if (values.length > 0) {
    content += md.paragraph(md.bold('Values'));
    content += md.unorderedList(values);
  }

  if (interests.length > 0) {
    content += md.paragraph(md.bold('Interests'));
    content += md.unorderedList(interests);
  }

  if (lifestyle) {
    content += md.paragraph(md.bold('Lifestyle'));
    content += md.paragraph(lifestyle);
  }

  if (personality.length > 0) {
    content += md.paragraph(md.bold('Personality Traits'));
    content += md.unorderedList(personality);
  }

  return content;
}

/**
 * Generate pain points and goals subsection
 */
function generatePainPointsAndGoals(data: AggregatedData): string {
  let content = '';

  const getArrayField = (fieldId: string): string[] => {
    const entry = data.avatar.find(e => e.fieldIdentifier === fieldId || e.fieldIdentifier.includes(fieldId));
    if (!entry) return [];
    try {
      return JSON.parse(entry.content);
    } catch {
      return entry.content.split(/[\n,]/).map(v => v.trim()).filter(v => v);
    }
  };

  const painPoints = getArrayField('pain_points') || getArrayField('painPoints');
  const goals = getArrayField('goals');

  const hasPainPoints = painPoints.length > 0;
  const hasGoals = goals.length > 0;

  if (!hasPainPoints && !hasGoals) return '';

  content += md.heading('Pain Points & Goals', 3);

  if (hasPainPoints) {
    content += md.paragraph(md.bold('Pain Points'));
    content += md.unorderedList(painPoints);
  }

  if (hasGoals) {
    content += md.paragraph(md.bold('Goals & Aspirations'));
    content += md.unorderedList(goals);
  }

  return content;
}

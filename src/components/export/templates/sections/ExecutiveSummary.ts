/**
 * Executive Summary Section Template
 *
 * Generates the executive summary section of the brand strategy export.
 */

import type { AggregatedData } from '../formatters/DataAggregator';
import type { BrandData } from '@/contexts/BrandContext';
import * as md from '../formatters/MarkdownFormatter';

export function generateExecutiveSummary(
  data: AggregatedData,
  brandData: BrandData
): string {
  let content = '';

  // Section heading
  content += md.heading('Executive Summary', 2);

  // Brand Overview subsection
  content += md.heading('Brand Overview', 3);

  const overviewMetadata: Record<string, string> = {
    'Company': brandData.userInfo.company || 'Not specified',
    'Industry': brandData.userInfo.industry || 'Not specified',
    'Strategy Completion': `${calculateOverallCompletion(data)}%`,
    'Last Updated': md.formatDate(data.metadata.lastUpdated),
  };

  content += md.metadataBlock(overviewMetadata);

  // Key Strategic Pillars subsection
  content += md.heading('Key Strategic Pillars', 3);

  if (brandData.brandCanvas.brandPurpose) {
    content += md.paragraph(
      `${md.bold('Purpose')}: ${brandData.brandCanvas.brandPurpose}`
    );
  }

  if (brandData.brandCanvas.brandVision) {
    content += md.paragraph(
      `${md.bold('Vision')}: ${brandData.brandCanvas.brandVision}`
    );
  }

  if (brandData.brandCanvas.brandMission) {
    content += md.paragraph(
      `${md.bold('Mission')}: ${brandData.brandCanvas.brandMission}`
    );
  }

  // Quick Reference subsection
  content += md.heading('Quick Reference', 3);

  const quickRefItems: string[] = [];

  // Target Customer
  const targetCustomer = generateTargetCustomerSummary(brandData);
  if (targetCustomer) {
    quickRefItems.push(`${md.bold('Target Customer')}: ${targetCustomer}`);
  }

  // Unique Value
  if (brandData.distinctive.uniqueValue) {
    quickRefItems.push(
      `${md.bold('Unique Value')}: ${brandData.distinctive.uniqueValue}`
    );
  }

  // Brand Voice
  if (brandData.brandCanvas.brandVoice) {
    quickRefItems.push(
      `${md.bold('Brand Voice')}: ${brandData.brandCanvas.brandVoice}`
    );
  }

  if (quickRefItems.length > 0) {
    content += md.unorderedList(quickRefItems);
  } else {
    content += md.paragraph(
      md.italic('Complete your brand strategy to see quick reference information here.')
    );
  }

  content += md.horizontalRule();

  return content;
}

/**
 * Calculate overall completion percentage
 */
function calculateOverallCompletion(data: AggregatedData): number {
  const stats = Object.values(data.metadata.completionStats);
  if (stats.length === 0) return 0;
  return Math.round(stats.reduce((sum, val) => sum + val, 0) / stats.length);
}

/**
 * Generate target customer summary from avatar data
 */
function generateTargetCustomerSummary(brandData: BrandData): string {
  const demo = brandData.avatar.demographics;
  const psycho = brandData.avatar.psychographics;

  const parts: string[] = [];

  if (demo.age) parts.push(demo.age);
  if (demo.gender && demo.gender !== 'prefer-not-to-say') parts.push(demo.gender);
  if (demo.occupation) parts.push(demo.occupation);
  if (psycho.lifestyle) parts.push(`${psycho.lifestyle} lifestyle`);

  return parts.length > 0 ? parts.join(', ') : '';
}

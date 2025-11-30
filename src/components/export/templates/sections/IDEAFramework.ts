/**
 * IDEA Framework Section Template
 *
 * Generates the IDEA Strategic Brand Framework section.
 */

import type { AggregatedData } from '../formatters/DataAggregator';
import type { BrandData } from '@/contexts/BrandContext';
import * as md from '../formatters/MarkdownFormatter';

export function generateIDEAFramework(
  data: AggregatedData,
  brandData: BrandData
): string {
  let content = '';

  // Main section heading
  content += md.heading('IDEA Strategic Brand Framework', 2);

  // Insight-Driven Foundation
  content += generateInsightSection(brandData);

  // Distinctive Positioning
  content += generateDistinctiveSection(brandData);

  // Empathetic Connection
  content += generateEmpathySection(brandData);

  // Authentic Values
  content += generateAuthenticSection(brandData);

  content += md.horizontalRule();

  return content;
}

/**
 * Generate Insight-Driven section
 */
function generateInsightSection(brandData: BrandData): string {
  let content = '';

  content += md.heading('Insight-Driven Foundation', 3);

  if (brandData.insight.marketInsight) {
    content += md.paragraph(md.bold('Market Insight'));
    content += md.paragraph(brandData.insight.marketInsight);
  }

  if (brandData.insight.consumerInsight) {
    content += md.paragraph(md.bold('Consumer Insight'));
    content += md.paragraph(brandData.insight.consumerInsight);
  }

  if (brandData.insight.brandPurpose) {
    content += md.paragraph(md.bold('Brand Purpose'));
    content += md.paragraph(brandData.insight.brandPurpose);
  }

  if (!brandData.insight.completed && !brandData.insight.marketInsight &&
      !brandData.insight.consumerInsight && !brandData.insight.brandPurpose) {
    content += md.paragraph(
      md.italic('Complete the Insight module in the IDEA Framework to populate this section.')
    );
  }

  return content;
}

/**
 * Generate Distinctive Positioning section
 */
function generateDistinctiveSection(brandData: BrandData): string {
  let content = '';

  content += md.heading('Distinctive Positioning', 3);

  if (brandData.distinctive.uniqueValue) {
    content += md.paragraph(md.bold('Unique Value'));
    content += md.paragraph(brandData.distinctive.uniqueValue);
  }

  if (brandData.distinctive.positioning) {
    content += md.paragraph(md.bold('Market Positioning'));
    content += md.paragraph(brandData.distinctive.positioning);
  }

  if (brandData.distinctive.differentiators.length > 0) {
    content += md.paragraph(md.bold('Key Differentiators'));
    content += md.unorderedList(brandData.distinctive.differentiators);
  }

  if (!brandData.distinctive.completed && !brandData.distinctive.uniqueValue &&
      !brandData.distinctive.positioning && brandData.distinctive.differentiators.length === 0) {
    content += md.paragraph(
      md.italic('Complete the Distinctive module in the IDEA Framework to populate this section.')
    );
  }

  return content;
}

/**
 * Generate Empathetic Connection section
 */
function generateEmpathySection(brandData: BrandData): string {
  let content = '';

  content += md.heading('Empathetic Connection', 3);

  if (brandData.empathy.emotionalConnection) {
    content += md.paragraph(md.bold('Emotional Connection'));
    content += md.paragraph(brandData.empathy.emotionalConnection);
  }

  if (brandData.empathy.brandPersonality) {
    content += md.paragraph(md.bold('Brand Personality'));
    content += md.paragraph(brandData.empathy.brandPersonality);
  }

  if (brandData.empathy.customerNeeds.length > 0) {
    content += md.paragraph(md.bold('Customer Needs Addressed'));
    content += md.unorderedList(brandData.empathy.customerNeeds);
  }

  if (!brandData.empathy.completed && !brandData.empathy.emotionalConnection &&
      !brandData.empathy.brandPersonality && brandData.empathy.customerNeeds.length === 0) {
    content += md.paragraph(
      md.italic('Complete the Empathy module in the IDEA Framework to populate this section.')
    );
  }

  return content;
}

/**
 * Generate Authentic Values section
 */
function generateAuthenticSection(brandData: BrandData): string {
  let content = '';

  content += md.heading('Authentic Values', 3);

  if (brandData.authentic.brandValues.length > 0) {
    content += md.paragraph(md.bold('Core Values'));
    content += md.unorderedList(brandData.authentic.brandValues);
  }

  if (brandData.authentic.brandStory) {
    content += md.paragraph(md.bold('Brand Story'));
    content += md.paragraph(brandData.authentic.brandStory);
  }

  if (brandData.authentic.brandPromise) {
    content += md.paragraph(md.bold('Brand Promise'));
    content += md.paragraph(brandData.authentic.brandPromise);
  }

  if (!brandData.authentic.completed && brandData.authentic.brandValues.length === 0 &&
      !brandData.authentic.brandStory && !brandData.authentic.brandPromise) {
    content += md.paragraph(
      md.italic('Complete the Authentic module in the IDEA Framework to populate this section.')
    );
  }

  return content;
}

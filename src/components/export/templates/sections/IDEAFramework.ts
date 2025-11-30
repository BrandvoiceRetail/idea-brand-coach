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
  content += generateInsightSection(data);

  // Distinctive Positioning
  content += generateDistinctiveSection(data);

  // Empathetic Connection
  content += generateEmpathySection(data);

  // Authentic Values
  content += generateAuthenticSection(data);

  content += md.horizontalRule();

  return content;
}

/**
 * Generate Insight-Driven section
 */
function generateInsightSection(data: AggregatedData): string {
  let content = '';

  content += md.heading('Insight-Driven Foundation', 3);

  const getInsightField = (fieldId: string): string => {
    const entry = data.ideaFramework.insight.find(e => e.fieldIdentifier === fieldId);
    return entry?.content || '';
  };

  const marketInsight = getInsightField('insight_market');
  const consumerInsight = getInsightField('insight_consumer');
  const brandPurpose = getInsightField('insight_purpose');

  if (marketInsight) {
    content += md.paragraph(md.bold('Market Insight'));
    content += md.paragraph(marketInsight);
  }

  if (consumerInsight) {
    content += md.paragraph(md.bold('Consumer Insight'));
    content += md.paragraph(consumerInsight);
  }

  if (brandPurpose) {
    content += md.paragraph(md.bold('Brand Purpose'));
    content += md.paragraph(brandPurpose);
  }

  if (!marketInsight && !consumerInsight && !brandPurpose) {
    content += md.paragraph(
      md.italic('Complete the Insight module in the IDEA Framework to populate this section.')
    );
  }

  return content;
}

/**
 * Generate Distinctive Positioning section
 */
function generateDistinctiveSection(data: AggregatedData): string {
  let content = '';

  content += md.heading('Distinctive Positioning', 3);

  const getDistinctiveField = (fieldId: string): string => {
    const entry = data.ideaFramework.distinctive.find(e => e.fieldIdentifier === fieldId);
    return entry?.content || '';
  };

  const uniqueValue = getDistinctiveField('distinctive_value');
  const positioning = getDistinctiveField('distinctive_positioning');

  // Try to get differentiators as array
  const diffEntry = data.ideaFramework.distinctive.find(e => e.fieldIdentifier.includes('differentiator'));
  let differentiators: string[] = [];
  if (diffEntry) {
    try {
      differentiators = JSON.parse(diffEntry.content);
    } catch {
      differentiators = diffEntry.content.split(/[\n,]/).map(v => v.trim()).filter(v => v);
    }
  }

  if (uniqueValue) {
    content += md.paragraph(md.bold('Unique Value'));
    content += md.paragraph(uniqueValue);
  }

  if (positioning) {
    content += md.paragraph(md.bold('Market Positioning'));
    content += md.paragraph(positioning);
  }

  if (differentiators.length > 0) {
    content += md.paragraph(md.bold('Key Differentiators'));
    content += md.unorderedList(differentiators);
  }

  if (!uniqueValue && !positioning && differentiators.length === 0) {
    content += md.paragraph(
      md.italic('Complete the Distinctive module in the IDEA Framework to populate this section.')
    );
  }

  return content;
}

/**
 * Generate Empathetic Connection section
 */
function generateEmpathySection(data: AggregatedData): string {
  let content = '';

  content += md.heading('Empathetic Connection', 3);

  const getEmpathyField = (fieldId: string): string => {
    const entry = data.ideaFramework.empathy.find(e => e.fieldIdentifier === fieldId);
    return entry?.content || '';
  };

  const emotionalConnection = getEmpathyField('empathy_connection');
  const brandPersonality = getEmpathyField('empathy_personality') || getEmpathyField('empathy_brand_personality');

  // Try to get customer needs as array
  const needsEntry = data.ideaFramework.empathy.find(e => e.fieldIdentifier.includes('needs') || e.fieldIdentifier.includes('customer'));
  let customerNeeds: string[] = [];
  if (needsEntry) {
    try {
      customerNeeds = JSON.parse(needsEntry.content);
    } catch {
      customerNeeds = needsEntry.content.split(/[\n,]/).map(v => v.trim()).filter(v => v);
    }
  }

  if (emotionalConnection) {
    content += md.paragraph(md.bold('Emotional Connection'));
    content += md.paragraph(emotionalConnection);
  }

  if (brandPersonality) {
    content += md.paragraph(md.bold('Brand Personality'));
    content += md.paragraph(brandPersonality);
  }

  if (customerNeeds.length > 0) {
    content += md.paragraph(md.bold('Customer Needs Addressed'));
    content += md.unorderedList(customerNeeds);
  }

  if (!emotionalConnection && !brandPersonality && customerNeeds.length === 0) {
    content += md.paragraph(
      md.italic('Complete the Empathy module in the IDEA Framework to populate this section.')
    );
  }

  return content;
}

/**
 * Generate Authentic Values section
 */
function generateAuthenticSection(data: AggregatedData): string {
  let content = '';

  content += md.heading('Authentic Values', 3);

  const getAuthenticField = (fieldId: string): string => {
    const entry = data.ideaFramework.authentic.find(e => e.fieldIdentifier === fieldId);
    return entry?.content || '';
  };

  // Try to get brand values as array
  const valuesEntry = data.ideaFramework.authentic.find(e => e.fieldIdentifier.includes('values'));
  let brandValues: string[] = [];
  if (valuesEntry) {
    try {
      brandValues = JSON.parse(valuesEntry.content);
    } catch {
      brandValues = valuesEntry.content.split(/[\n,]/).map(v => v.trim()).filter(v => v);
    }
  }

  const brandStory = getAuthenticField('authentic_story');
  const brandPromise = getAuthenticField('authentic_promise') || getAuthenticField('authentic_brand_promise');

  if (brandValues.length > 0) {
    content += md.paragraph(md.bold('Core Values'));
    content += md.unorderedList(brandValues);
  }

  if (brandStory) {
    content += md.paragraph(md.bold('Brand Story'));
    content += md.paragraph(brandStory);
  }

  if (brandPromise) {
    content += md.paragraph(md.bold('Brand Promise'));
    content += md.paragraph(brandPromise);
  }

  if (brandValues.length === 0 && !brandStory && !brandPromise) {
    content += md.paragraph(
      md.italic('Complete the Authentic module in the IDEA Framework to populate this section.')
    );
  }

  return content;
}

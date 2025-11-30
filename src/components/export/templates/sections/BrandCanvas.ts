/**
 * Brand Canvas Section Template
 *
 * Generates the Brand Canvas Strategy section with all 8 canvas elements.
 */

import type { AggregatedData } from '../formatters/DataAggregator';
import type { BrandData } from '@/contexts/BrandContext';
import * as md from '../formatters/MarkdownFormatter';

export function generateBrandCanvas(
  data: AggregatedData,
  brandData: BrandData
): string {
  let content = '';

  // Main section heading
  content += md.heading('Brand Canvas Strategy', 2);

  const canvas = brandData.brandCanvas;

  // Brand Purpose
  content += md.heading('Brand Purpose', 3);
  if (canvas.brandPurpose) {
    content += md.paragraph(canvas.brandPurpose);
  } else {
    content += md.paragraph(md.italic('Not yet defined'));
  }

  // Brand Vision
  content += md.heading('Brand Vision', 3);
  if (canvas.brandVision) {
    content += md.paragraph(canvas.brandVision);
  } else {
    content += md.paragraph(md.italic('Not yet defined'));
  }

  // Brand Mission
  content += md.heading('Brand Mission', 3);
  if (canvas.brandMission) {
    content += md.paragraph(canvas.brandMission);
  } else {
    content += md.paragraph(md.italic('Not yet defined'));
  }

  // Brand Values
  content += md.heading('Brand Values', 3);
  if (canvas.brandValues.length > 0) {
    content += md.unorderedList(canvas.brandValues);
  } else {
    content += md.paragraph(md.italic('Not yet defined'));
  }

  // Positioning Statement
  content += md.heading('Positioning Statement', 3);
  if (canvas.positioningStatement) {
    content += md.paragraph(canvas.positioningStatement);
  } else {
    content += md.paragraph(md.italic('Not yet defined'));
  }

  // Value Proposition
  content += md.heading('Value Proposition', 3);
  if (canvas.valueProposition) {
    content += md.paragraph(canvas.valueProposition);
  } else {
    content += md.paragraph(md.italic('Not yet defined'));
  }

  // Brand Personality
  content += md.heading('Brand Personality', 3);
  if (canvas.brandPersonality.length > 0) {
    content += md.unorderedList(canvas.brandPersonality);
  } else {
    content += md.paragraph(md.italic('Not yet defined'));
  }

  // Brand Voice
  content += md.heading('Brand Voice', 3);
  if (canvas.brandVoice) {
    content += md.paragraph(canvas.brandVoice);
  } else {
    content += md.paragraph(md.italic('Not yet defined'));
  }

  content += md.horizontalRule();

  return content;
}

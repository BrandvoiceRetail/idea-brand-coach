/**
 * IDEA Framework Section Template
 *
 * Generates the IDEA Strategic Brand Framework section by pulling from the
 * entire user knowledge base and classifying entries into I, D, E, A categories.
 */

import type { AggregatedData } from '../formatters/DataAggregator';
import type { BrandData } from '@/contexts/BrandContext';
import type { ClassifiedEntry, ClassifiedConversation, IDEACategory } from '../formatters/IDEAClassifier';
import * as md from '../formatters/MarkdownFormatter';

export function generateIDEAFramework(
  data: AggregatedData,
  brandData: BrandData
): string {
  let content = '';

  // Main section heading
  content += md.heading('IDEA Strategic Brand Framework', 2);

  content += md.paragraph(
    'The IDEA Strategic Brand Framework is a comprehensive methodology for building brands that ' +
    'convert browsers into buyers and customers into advocates. Unlike traditional branding approaches ' +
    'that focus on logos and colors, IDEA addresses the strategic foundations that drive real business results.'
  );

  content += md.paragraph(
    'The framework consists of four interconnected pillars: ' +
    md.bold('I') + 'nsight-Driven Foundation (understanding your market through data and research), ' +
    md.bold('D') + 'istinctive Positioning (carving out your unique space in the market), ' +
    md.bold('E') + 'mpathetic Connection (building deep emotional bonds with customers), and ' +
    md.bold('A') + 'uthentic Values (operating from genuine truth and consistency).'
  );

  content += md.paragraph(
    'The following sections present your brand strategy organized through the IDEA lens, ' +
    'drawing from your knowledge base entries, brand canvas, Avatar 2.0 profiles, and Brand Coach conversations.'
  );

  content += md.horizontalRule();

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
 * Synthesize classified entries into a narrative paragraph
 * Instead of listing raw entries, creates a flowing description that incorporates the data
 */
function synthesizeInsightNarrative(
  entries: ClassifiedEntry[],
  conversations: ClassifiedConversation[]
): string {
  if (entries.length === 0 && conversations.length === 0) return '';

  let content = '';

  // Extract meaningful content from entries
  const entryData: Record<string, string[]> = {};
  for (const { entry } of entries) {
    const category = entry.category || 'general';
    if (!entryData[category]) entryData[category] = [];
    if (entry.content && entry.content.trim().length > 2) {
      entryData[category].push(entry.content.trim());
    }
  }

  // Extract key points from conversations
  const conversationInsights: string[] = [];
  for (const { assistantMessage } of conversations.slice(0, 3)) {
    // Extract first substantive sentence from assistant responses
    const sentences = assistantMessage.content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length > 0) {
      conversationInsights.push(sentences[0].trim());
    }
  }

  // Build narrative based on available data
  if (entryData['avatar'] && entryData['avatar'].length > 0) {
    content += md.paragraph(
      'Based on the customer research and avatar development work, key market insights include an understanding of ' +
      'buyer behavior patterns such as ' + entryData['avatar'].slice(0, 3).join(', ') + '. ' +
      'These behavioral insights inform how the brand approaches market positioning and customer communication.'
    );
  }

  if (entryData['diagnostic'] && entryData['diagnostic'].length > 0) {
    content += md.paragraph(
      'The brand diagnostic revealed important foundational insights: ' +
      entryData['diagnostic'].slice(0, 3).join('. ') + '. ' +
      'These findings provide the data-driven foundation for strategic brand decisions.'
    );
  }

  if (entryData['canvas'] && entryData['canvas'].length > 0) {
    content += md.paragraph(
      'Strategic brand canvas elements contributing to market insight include: ' +
      entryData['canvas'].slice(0, 3).join(', ') + '.'
    );
  }

  if (conversationInsights.length > 0) {
    content += md.paragraph(
      'Through strategic Brand Coach conversations, additional insights emerged: ' +
      conversationInsights.slice(0, 2).join('. ') + '.'
    );
  }

  return content;
}

/**
 * Synthesize distinctive positioning narrative
 */
function synthesizeDistinctiveNarrative(
  entries: ClassifiedEntry[],
  conversations: ClassifiedConversation[]
): string {
  if (entries.length === 0 && conversations.length === 0) return '';

  let content = '';

  // Collect all distinctive-related content
  const positioningElements: string[] = [];
  const valueProps: string[] = [];

  for (const { entry } of entries) {
    const fieldLower = entry.fieldIdentifier.toLowerCase();
    const contentTrimmed = entry.content.trim();

    if (contentTrimmed.length < 3) continue;

    if (fieldLower.includes('positioning') || fieldLower.includes('position')) {
      positioningElements.push(contentTrimmed);
    } else if (fieldLower.includes('value') || fieldLower.includes('unique') || fieldLower.includes('differentiator')) {
      valueProps.push(contentTrimmed);
    } else {
      positioningElements.push(contentTrimmed);
    }
  }

  if (valueProps.length > 0 || positioningElements.length > 0) {
    const allElements = [...valueProps, ...positioningElements];
    content += md.paragraph(
      'The brand\'s distinctive positioning is built on several key differentiators. ' +
      allElements.slice(0, 4).map(e => e.length > 100 ? e.substring(0, 100) + '...' : e).join('. ') + '. ' +
      'These elements combine to create a unique market position that competitors cannot easily replicate.'
    );
  }

  // Add conversation insights
  if (conversations.length > 0) {
    const insights = conversations.slice(0, 2).map(c => {
      const sentences = c.assistantMessage.content.split(/[.!?]+/).filter(s => s.trim().length > 20);
      return sentences[0]?.trim() || '';
    }).filter(s => s);

    if (insights.length > 0) {
      content += md.paragraph(
        'Strategic discussions with Brand Coach helped refine this positioning: ' +
        insights.join('. ') + '.'
      );
    }
  }

  return content;
}

/**
 * Synthesize empathy narrative
 */
function synthesizeEmpathyNarrative(
  entries: ClassifiedEntry[],
  conversations: ClassifiedConversation[]
): string {
  if (entries.length === 0 && conversations.length === 0) return '';

  let content = '';

  // Categorize empathy-related content
  const painPoints: string[] = [];
  const desires: string[] = [];
  const psychology: string[] = [];
  const general: string[] = [];

  for (const { entry } of entries) {
    const fieldLower = entry.fieldIdentifier.toLowerCase();
    const contentTrimmed = entry.content.trim();

    if (contentTrimmed.length < 3) continue;

    if (fieldLower.includes('pain') || fieldLower.includes('frustrat') || fieldLower.includes('fear')) {
      painPoints.push(contentTrimmed);
    } else if (fieldLower.includes('desire') || fieldLower.includes('goal') || fieldLower.includes('aspir')) {
      desires.push(contentTrimmed);
    } else if (fieldLower.includes('psychology') || fieldLower.includes('trigger') || fieldLower.includes('value')) {
      psychology.push(contentTrimmed);
    } else {
      general.push(contentTrimmed);
    }
  }

  // Build narrative
  if (painPoints.length > 0 || desires.length > 0 || psychology.length > 0 || general.length > 0) {
    let narrative = 'The brand demonstrates deep empathetic understanding of its target customers. ';

    if (painPoints.length > 0) {
      narrative += 'Key customer pain points include: ' + painPoints.slice(0, 2).join(', ') + '. ';
    }

    if (desires.length > 0) {
      narrative += 'Customer aspirations center around: ' + desires.slice(0, 2).join(', ') + '. ';
    }

    if (psychology.length > 0) {
      narrative += 'Psychological drivers influencing purchase decisions include: ' + psychology.slice(0, 2).join(', ') + '. ';
    }

    if (general.length > 0 && painPoints.length === 0 && desires.length === 0) {
      narrative += 'Key customer understanding includes: ' + general.slice(0, 3).join(', ') + '. ';
    }

    content += md.paragraph(narrative);
  }

  // Add conversation insights
  if (conversations.length > 0) {
    const insights = conversations.slice(0, 2).map(c => {
      const sentences = c.assistantMessage.content.split(/[.!?]+/).filter(s => s.trim().length > 20);
      return sentences[0]?.trim() || '';
    }).filter(s => s);

    if (insights.length > 0) {
      content += md.paragraph(
        'Brand Coach conversations deepened this customer understanding: ' +
        insights.join('. ') + '.'
      );
    }
  }

  return content;
}

/**
 * Synthesize authentic values narrative
 */
function synthesizeAuthenticNarrative(
  entries: ClassifiedEntry[],
  conversations: ClassifiedConversation[]
): string {
  if (entries.length === 0 && conversations.length === 0) return '';

  let content = '';

  // Categorize authenticity-related content
  const values: string[] = [];
  const mission: string[] = [];
  const story: string[] = [];
  const voice: string[] = [];
  const general: string[] = [];

  for (const { entry } of entries) {
    const fieldLower = entry.fieldIdentifier.toLowerCase();
    const contentTrimmed = entry.content.trim();

    if (contentTrimmed.length < 3) continue;

    if (fieldLower.includes('value')) {
      values.push(contentTrimmed);
    } else if (fieldLower.includes('mission') || fieldLower.includes('purpose') || fieldLower.includes('vision')) {
      mission.push(contentTrimmed);
    } else if (fieldLower.includes('story') || fieldLower.includes('heritage') || fieldLower.includes('history')) {
      story.push(contentTrimmed);
    } else if (fieldLower.includes('voice') || fieldLower.includes('personality') || fieldLower.includes('tone')) {
      voice.push(contentTrimmed);
    } else {
      general.push(contentTrimmed);
    }
  }

  // Build narrative
  let hasContent = false;

  if (mission.length > 0) {
    content += md.paragraph(
      'The brand\'s authentic foundation begins with a clear sense of purpose: ' +
      mission.slice(0, 2).map(m => m.length > 150 ? m.substring(0, 150) + '...' : m).join('. ') + '.'
    );
    hasContent = true;
  }

  if (values.length > 0) {
    content += md.paragraph(
      'Core brand values that guide all decisions and communications include: ' +
      values.slice(0, 3).join(', ') + '. These values ensure consistency across all customer touchpoints.'
    );
    hasContent = true;
  }

  if (voice.length > 0) {
    content += md.paragraph(
      'The brand expresses its authenticity through a distinctive voice: ' +
      voice.slice(0, 2).join(', ') + '.'
    );
    hasContent = true;
  }

  if (story.length > 0) {
    content += md.paragraph(
      'The brand story that builds trust and connection: ' +
      story.slice(0, 1).map(s => s.length > 200 ? s.substring(0, 200) + '...' : s).join(' ') + '.'
    );
    hasContent = true;
  }

  if (!hasContent && general.length > 0) {
    content += md.paragraph(
      'Brand authenticity is expressed through: ' +
      general.slice(0, 3).join(', ') + '.'
    );
  }

  // Add conversation insights
  if (conversations.length > 0) {
    const insights = conversations.slice(0, 2).map(c => {
      const sentences = c.assistantMessage.content.split(/[.!?]+/).filter(s => s.trim().length > 20);
      return sentences[0]?.trim() || '';
    }).filter(s => s);

    if (insights.length > 0) {
      content += md.paragraph(
        'Strategic Brand Coach discussions helped articulate this authentic identity: ' +
        insights.join('. ') + '.'
      );
    }
  }

  return content;
}

/**
 * Convert field identifier to readable label
 */
function formatFieldLabel(fieldIdentifier: string): string {
  // Remove common prefixes
  let label = fieldIdentifier
    .replace(/^canvas_/, '')
    .replace(/^avatar_/, '')
    .replace(/^diagnostic_/, '')
    .replace(/^insight_/, '')
    .replace(/^distinctive_/, '')
    .replace(/^empathy_/, '')
    .replace(/^authentic_/, '');

  // Convert snake_case to Title Case
  label = label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return label;
}

/**
 * Format category to readable label
 */
function formatCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'avatar': 'Avatar 2.0 Profile',
    'canvas': 'Brand Canvas',
    'diagnostic': 'Brand Diagnostic',
    'insights': 'IDEA Insights',
    'copy': 'Brand Copy',
  };
  return labels[category] || category;
}

/**
 * Generate Insight-Driven section
 */
function generateInsightSection(data: AggregatedData): string {
  let content = '';

  content += md.heading('I - Insight-Driven Foundation', 3);

  // Comprehensive framework description
  content += md.paragraph(
    'The Insight-Driven Foundation is the bedrock of the IDEA Strategic Brand Framework. ' +
    'Great brands are built on deep understanding—not assumptions. This pillar emphasizes ' +
    'the critical importance of grounding every brand decision in real data, market research, ' +
    'and genuine customer understanding.'
  );

  content += md.paragraph(
    'An insight-driven brand continuously seeks to understand: What does the market truly need? ' +
    'What gaps exist that competitors have overlooked? What are the unspoken desires and frustrations ' +
    'of your target audience? These insights become the foundation for positioning, messaging, ' +
    'and product development decisions that resonate authentically with your market.'
  );

  content += md.paragraph(
    md.bold('Key Elements:') + ' Market research and competitive analysis, consumer behavior insights, ' +
    'data-driven decision making, trend identification, and opportunity gap analysis.'
  );

  // Get classified entries for Insight
  const insightEntries = data.ideaClassification.insight;
  const insightConversations = data.conversationClassification.insight;

  // Also check legacy field-based entries
  const legacyInsights = data.ideaFramework.insight;

  const hasContent = insightEntries.length > 0 || legacyInsights.length > 0 || insightConversations.length > 0;

  if (hasContent) {
    content += md.heading('Your Brand\'s Insight Foundation', 4);
    // Generate synthesized narrative from all available data
    content += synthesizeInsightNarrative(insightEntries, insightConversations);
  } else {
    content += md.paragraph(
      md.italic('No insight-related content found yet. Complete your brand diagnostic, ' +
        'build your customer avatar, or chat with Brand Coach about your market and customers.')
    );
  }

  return content;
}

/**
 * Generate Distinctive Positioning section
 */
function generateDistinctiveSection(data: AggregatedData): string {
  let content = '';

  content += md.heading('D - Distinctive Positioning', 3);

  // Comprehensive framework description
  content += md.paragraph(
    'Distinctive Positioning is about carving out a unique space in the market that only your brand can own. ' +
    'In a world of infinite choices and shrinking attention spans, being "good" is not enough—you must be ' +
    'memorably different. This pillar focuses on identifying and articulating what makes your brand ' +
    'irreplaceable in the minds of your customers.'
  );

  content += md.paragraph(
    'True distinctiveness goes beyond surface-level differentiation like price or features. It requires ' +
    'understanding your unique strengths, the specific problems only you can solve, and the value you ' +
    'deliver that competitors cannot replicate. Your positioning statement becomes the strategic anchor ' +
    'that guides all brand communications and helps customers instantly understand why you are their best choice.'
  );

  content += md.paragraph(
    md.bold('Key Elements:') + ' Unique value proposition, competitive differentiation, market positioning, ' +
    'brand promise, category leadership strategy, and ownable brand territory.'
  );

  // Get classified entries for Distinctive
  const distinctiveEntries = data.ideaClassification.distinctive;
  const distinctiveConversations = data.conversationClassification.distinctive;

  // Also check legacy field-based entries
  const legacyDistinctive = data.ideaFramework.distinctive;

  const hasContent = distinctiveEntries.length > 0 || legacyDistinctive.length > 0 || distinctiveConversations.length > 0;

  if (hasContent) {
    content += md.heading('Your Brand\'s Distinctive Position', 4);
    // Generate synthesized narrative from all available data
    content += synthesizeDistinctiveNarrative(distinctiveEntries, distinctiveConversations);
  } else {
    content += md.paragraph(
      md.italic('No differentiation content found yet. Define your value proposition in the Brand Canvas, ' +
        'or discuss your competitive advantages with Brand Coach.')
    );
  }

  return content;
}

/**
 * Generate Empathetic Connection section
 */
function generateEmpathySection(data: AggregatedData): string {
  let content = '';

  content += md.heading('E - Empathetic Connection', 3);

  // Comprehensive framework description
  content += md.paragraph(
    'Empathetic Connection is the emotional bridge between your brand and your customers. ' +
    'People don\'t just buy products—they buy solutions to their problems, fulfillment of their desires, ' +
    'and relief from their frustrations. This pillar emphasizes the importance of truly understanding ' +
    'your customers at a deep psychological level, beyond demographics and surface preferences.'
  );

  content += md.paragraph(
    'An empathetic brand understands the customer journey from awareness to advocacy. It recognizes ' +
    'the fears that hold customers back, the aspirations that drive them forward, and the emotional ' +
    'triggers that influence their decisions. By speaking to these deeper motivations, your brand ' +
    'creates meaningful connections that transcend transactional relationships and build lasting loyalty.'
  );

  content += md.paragraph(
    md.bold('Key Elements:') + ' Customer psychology and emotional drivers, pain points and frustrations, ' +
    'desires and aspirations, customer journey mapping, emotional triggers, and brand personality alignment.'
  );

  // Get classified entries for Empathy
  const empathyEntries = data.ideaClassification.empathy;
  const empathyConversations = data.conversationClassification.empathy;

  // Also check legacy field-based entries
  const legacyEmpathy = data.ideaFramework.empathy;

  const hasContent = empathyEntries.length > 0 || legacyEmpathy.length > 0 || empathyConversations.length > 0;

  if (hasContent) {
    content += md.heading('Your Brand\'s Customer Connection', 4);
    // Generate synthesized narrative from all available data
    content += synthesizeEmpathyNarrative(empathyEntries, empathyConversations);
  } else {
    content += md.paragraph(
      md.italic('No empathy-related content found yet. Complete your Avatar 2.0 profile ' +
        'with customer psychology, pain points, and emotional triggers.')
    );
  }

  return content;
}

/**
 * Generate Authentic Values section
 */
function generateAuthenticSection(data: AggregatedData): string {
  let content = '';

  content += md.heading('A - Authentic Values', 3);

  // Comprehensive framework description
  content += md.paragraph(
    'Authentic Values represent the soul of your brand—the genuine beliefs, principles, and story ' +
    'that make your brand real and trustworthy. In an era of skeptical consumers and transparent ' +
    'marketplaces, authenticity is not optional—it\'s essential. This pillar ensures your brand ' +
    'communicates and operates from a place of genuine truth rather than manufactured messaging.'
  );

  content += md.paragraph(
    'Authenticity builds trust, and trust builds brands. Your brand story, core values, mission, ' +
    'and vision must align with your actual business practices and customer experiences. When there\'s ' +
    'alignment between what you say and what you do, customers become advocates. When there\'s misalignment, ' +
    'even the best marketing cannot save your brand from erosion of trust.'
  );

  content += md.paragraph(
    md.bold('Key Elements:') + ' Brand purpose and "why," core values and principles, brand story and heritage, ' +
    'mission and vision statements, brand voice and personality, and consistent brand behavior across all touchpoints.'
  );

  // Get classified entries for Authentic
  const authenticEntries = data.ideaClassification.authentic;
  const authenticConversations = data.conversationClassification.authentic;

  // Also check legacy field-based entries
  const legacyAuthentic = data.ideaFramework.authentic;

  const hasContent = authenticEntries.length > 0 || legacyAuthentic.length > 0 || authenticConversations.length > 0;

  if (hasContent) {
    content += md.heading('Your Brand\'s Authentic Identity', 4);
    // Generate synthesized narrative from all available data
    content += synthesizeAuthenticNarrative(authenticEntries, authenticConversations);
  } else {
    content += md.paragraph(
      md.italic('No authenticity content found yet. Define your brand purpose, values, ' +
        'mission, vision, and brand story in the Brand Canvas.')
    );
  }

  return content;
}

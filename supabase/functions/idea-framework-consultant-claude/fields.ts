/**
 * Brand field definitions shared between OpenAI and Claude edge functions.
 * Re-exports from the original fields module to maintain a single source of truth.
 *
 * Note: Deno edge functions can't import across function directories,
 * so this is a copy. Keep in sync with ../idea-framework-consultant/fields.ts
 */

export const ALL_FIELDS_MAP: Record<string, {
  title: string;
  pillar: string;
  fields: Array<{ id: string; label: string; type: string; helpText: string }>;
}> = {
  BRAND_FOUNDATION: {
    title: 'Brand Foundation',
    pillar: 'foundation',
    fields: [
      { id: 'brandPurpose', label: 'Brand Purpose', type: 'textarea', helpText: 'Why does your brand exist beyond making money?' },
      { id: 'brandVision', label: 'Brand Vision', type: 'textarea', helpText: 'What future do you want to create?' },
      { id: 'brandMission', label: 'Brand Mission', type: 'textarea', helpText: 'How will you achieve your vision?' },
    ]
  },
  BRAND_VALUES: {
    title: 'Brand Values',
    pillar: 'foundation',
    fields: [
      { id: 'brandValues', label: 'Core Values', type: 'array', helpText: 'Fundamental beliefs and principles guiding your brand' },
      { id: 'brandStory', label: 'Brand Story', type: 'textarea', helpText: 'The narrative connecting your past, present, and future' },
      { id: 'brandPromise', label: 'Brand Promise', type: 'textarea', helpText: 'The commitment you make to customers every time' },
    ]
  },
  CUSTOMER_AVATAR: {
    title: 'Customer Avatar',
    pillar: 'insight',
    fields: [
      { id: 'demographics', label: 'Demographics', type: 'textarea', helpText: 'Age, gender, income, location, occupation' },
      { id: 'psychographics', label: 'Psychographics', type: 'textarea', helpText: 'Interests, values, lifestyle, personality traits' },
      { id: 'painPoints', label: 'Pain Points', type: 'array', helpText: 'Challenges or frustrations they face' },
      { id: 'goals', label: 'Goals & Aspirations', type: 'array', helpText: 'Outcomes and desires that motivate them' },
    ]
  },
  MARKET_INSIGHT: {
    title: 'Market Insight',
    pillar: 'insight',
    fields: [
      { id: 'marketInsight', label: 'Market Analysis', type: 'textarea', helpText: 'Trends, gaps, and opportunities in your market' },
      { id: 'consumerInsight', label: 'Consumer Behavior', type: 'textarea', helpText: 'What drives customer decisions and behaviors' },
    ]
  },
  BUYER_INTENT: {
    title: 'Buyer Intent',
    pillar: 'insight',
    fields: [
      { id: 'functionalIntent', label: 'Functional Intent', type: 'textarea', helpText: 'What practical problem are they solving?' },
      { id: 'emotionalIntent', label: 'Emotional Intent', type: 'textarea', helpText: 'How do they want to feel?' },
      { id: 'identityIntent', label: 'Identity Intent', type: 'textarea', helpText: 'Who do they want to become?' },
      { id: 'socialIntent', label: 'Social Intent', type: 'textarea', helpText: 'How do they want to be perceived?' },
    ]
  },
  POSITIONING: {
    title: 'Brand Positioning',
    pillar: 'distinctive',
    fields: [
      { id: 'positioningStatement', label: 'Positioning Statement', type: 'textarea', helpText: 'How you want to be perceived vs. competitors' },
      { id: 'uniqueValue', label: 'Unique Value Proposition', type: 'textarea', helpText: 'The specific value only you can deliver' },
      { id: 'differentiators', label: 'Key Differentiators', type: 'array', helpText: 'Advantages that distinguish you in the market' },
    ]
  },
  BRAND_PERSONALITY: {
    title: 'Brand Personality & Voice',
    pillar: 'distinctive',
    fields: [
      { id: 'brandPersonality', label: 'Personality Traits', type: 'array', helpText: 'Human characteristics defining your brand character' },
      { id: 'brandVoice', label: 'Brand Voice', type: 'textarea', helpText: 'How your brand communicates (tone, style, language)' },
      { id: 'brandArchetype', label: 'Brand Archetype', type: 'text', helpText: 'Universal character pattern your brand embodies' },
    ]
  },
  EMOTIONAL_CONNECTION: {
    title: 'Emotional Connection',
    pillar: 'empathy',
    fields: [
      { id: 'emotionalConnection', label: 'Emotional Hook', type: 'textarea', helpText: 'The primary emotion you want to evoke' },
      { id: 'emotionalTriggers', label: 'Emotional Triggers', type: 'array', helpText: 'Specific triggers that activate emotional responses' },
      { id: 'customerNeeds', label: 'Deep Customer Needs', type: 'array', helpText: 'Fundamental human needs your brand addresses' },
    ]
  },
  CUSTOMER_EXPERIENCE: {
    title: 'Customer Experience',
    pillar: 'empathy',
    fields: [
      { id: 'customerJourney', label: 'Customer Journey', type: 'textarea', helpText: 'Key touchpoints from awareness to advocacy' },
      { id: 'experiencePillars', label: 'Experience Pillars', type: 'array', helpText: 'Core elements shaping customer interactions' },
      { id: 'preferredChannels', label: 'Preferred Channels', type: 'array', helpText: 'Platforms and channels your audience prefers' },
    ]
  },
  BRAND_AUTHORITY: {
    title: 'Brand Authority',
    pillar: 'authentic',
    fields: [
      { id: 'expertise', label: 'Areas of Expertise', type: 'array', helpText: 'Domains where you have deep knowledge and credibility' },
      { id: 'credibilityMarkers', label: 'Credibility Markers', type: 'array', helpText: 'Evidence that validates your expertise' },
      { id: 'thoughtLeadership', label: 'Thought Leadership', type: 'textarea', helpText: 'Unique perspectives you bring to your industry' },
    ]
  },
  BRAND_AUTHENTICITY: {
    title: 'Brand Authenticity',
    pillar: 'authentic',
    fields: [
      { id: 'authenticityPrinciples', label: 'Authenticity Principles', type: 'array', helpText: 'Core truths that make your brand real and believable' },
      { id: 'transparency', label: 'Transparency Commitment', type: 'textarea', helpText: 'Your approach to open, honest communication' },
      { id: 'socialProof', label: 'Social Proof', type: 'array', helpText: 'Evidence you deliver on your promises' },
      { id: 'brandConsistency', label: 'Brand Consistency', type: 'textarea', helpText: 'Strategy for maintaining coherence across touchpoints' },
    ]
  },
};

/**
 * Human-readable labels for field identifiers from interactive modules.
 */
export const FIELD_LABELS: Record<string, string> = {
  'insight_buyer_intent': 'Buyer Intent (what customers search for)',
  'insight_buyer_motivation': 'Buyer Motivation (psychological drivers)',
  'insight_shopper_type': 'Shopper Type (behavioral category)',
  'insight_demographics': 'Relevant Demographics',
  'insight_search_terms': 'Search Terms Analyzed',
  'insight_industry': 'Industry/Niche',
  'insight_intent_analysis': 'AI Intent Analysis',
  'empathy_emotional_triggers': 'Emotional Triggers',
  'empathy_trigger_responses': 'Trigger Assessment Responses',
  'empathy_trigger_profile': 'Emotional Trigger Profile',
  'empathy_assessment_completed': 'Assessment Status',
  'canvas_brand_purpose': 'Brand Purpose',
  'canvas_brand_vision': 'Brand Vision',
  'canvas_brand_mission': 'Brand Mission',
  'canvas_brand_values': 'Brand Values',
  'canvas_positioning_statement': 'Positioning Statement',
  'canvas_value_proposition': 'Value Proposition',
  'canvas_brand_personality': 'Brand Personality',
  'canvas_brand_voice': 'Brand Voice',
};

/**
 * Build tiered field context (compact summary + detail for current chapter).
 */
export function buildTieredFieldContext(
  currentFieldValues: Record<string, unknown>,
  currentChapterKey?: string
): string {
  let totalFields = 0;
  let totalFilled = 0;
  const chapterSummaries: string[] = [];

  for (const [chapterKey, chapter] of Object.entries(ALL_FIELDS_MAP)) {
    const chapterFilled: string[] = [];
    const chapterEmpty: string[] = [];

    for (const field of chapter.fields) {
      totalFields++;
      const value = currentFieldValues[field.id];
      const hasValue = value !== undefined && value !== null && String(value).trim() !== '' && value !== '[]';
      if (hasValue) {
        totalFilled++;
        const displayValue = Array.isArray(value)
          ? (value as string[]).slice(0, 3).join(', ') + (value.length > 3 ? '...' : '')
          : String(value).substring(0, 80) + (String(value).length > 80 ? '...' : '');
        chapterFilled.push(`  ✓ ${field.label}: ${displayValue}`);
      } else {
        chapterEmpty.push(`  ○ ${field.label}`);
      }
    }

    if (chapterKey === currentChapterKey) {
      chapterSummaries.push(`\n${chapter.title} (CURRENT FOCUS — ${chapterFilled.length}/${chapter.fields.length} filled):`);
      if (chapterFilled.length > 0) chapterSummaries.push(...chapterFilled);
      if (chapterEmpty.length > 0) chapterSummaries.push(...chapterEmpty);
    } else {
      chapterSummaries.push(`${chapter.title}: ${chapterFilled.length}/${chapter.fields.length} filled`);
    }
  }

  return [
    `BRAND PROFILE: ${totalFilled} of ${totalFields} fields captured.`,
    ...chapterSummaries,
    '\nGuide conversation toward empty fields in the current chapter. Don\'t re-ask for captured information.',
  ].join('\n');
}

/**
 * Get human-readable label for a field identifier.
 */
export function getFieldLabel(fieldIdentifier: string, category: string): string {
  if (FIELD_LABELS[fieldIdentifier]) {
    return FIELD_LABELS[fieldIdentifier];
  }
  return fieldIdentifier
    .replace(`${category}_`, '')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Brand field definitions and extraction tools.
 * Contains the 35-field map, tiered context builder, and OpenAI tool definitions.
 */

/**
 * Comprehensive map of ALL 35 brand fields across 11 chapters.
 * Used for proactive extraction during conversations and document processing.
 * Structure: chapterKey -> { title, pillar, fields[] }
 */
export const ALL_FIELDS_MAP: Record<string, { title: string; pillar: string; fields: Array<{ id: string; label: string; type: string; helpText: string }> }> = {
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
 * Human-readable labels for field identifiers
 * Maps semantic field names to descriptive labels for AI context
 */
export const FIELD_LABELS: Record<string, string> = {
  // Insight fields (from Interactive Insight Module)
  'insight_buyer_intent': 'Buyer Intent (what customers search for)',
  'insight_buyer_motivation': 'Buyer Motivation (psychological drivers)',
  'insight_shopper_type': 'Shopper Type (behavioral category)',
  'insight_demographics': 'Relevant Demographics',
  'insight_search_terms': 'Search Terms Analyzed',
  'insight_industry': 'Industry/Niche',
  'insight_intent_analysis': 'AI Intent Analysis',

  // Empathy fields (emotional triggers)
  'empathy_emotional_triggers': 'Emotional Triggers',
  'empathy_trigger_responses': 'Trigger Assessment Responses',
  'empathy_trigger_profile': 'Emotional Trigger Profile',
  'empathy_assessment_completed': 'Assessment Status',

  // Canvas fields
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
 * Get a flat list of all field IDs with their labels for extraction prompts
 */
export function getAllFieldsList(): string {
  const lines: string[] = [];
  for (const [, chapter] of Object.entries(ALL_FIELDS_MAP)) {
    lines.push(`\n${chapter.title}:`);
    for (const field of chapter.fields) {
      lines.push(`  - ${field.id}: ${field.label} (${field.helpText})`);
    }
  }
  return lines.join('\n');
}

/**
 * Build a tiered field state context that sends only relevant information.
 *
 * Tier 1 (always): Compact summary — "15 of 35 fields captured."
 * Tier 2 (current chapter): Full field labels + value previews for focused chapter
 * Other chapters get only filled/empty counts, not full listings.
 *
 * This reduces per-turn context from ~2000 tokens (all 35 fields) to ~300 tokens.
 */
export function buildTieredFieldContext(
  currentFieldValues: Record<string, unknown>,
  currentChapterKey?: string
): string {
  // Count totals across all chapters
  let totalFields = 0;
  let totalFilled = 0;

  // Per-chapter summaries
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

    // Tier 2: Full details for current chapter
    if (chapterKey === currentChapterKey) {
      chapterSummaries.push(`\n${chapter.title} (CURRENT FOCUS — ${chapterFilled.length}/${chapter.fields.length} filled):`);
      if (chapterFilled.length > 0) chapterSummaries.push(...chapterFilled);
      if (chapterEmpty.length > 0) chapterSummaries.push(...chapterEmpty);
    } else {
      // Other chapters: one-line summary only
      chapterSummaries.push(`${chapter.title}: ${chapterFilled.length}/${chapter.fields.length} filled`);
    }
  }

  // Tier 1: Compact summary
  const lines: string[] = [
    `BRAND PROFILE: ${totalFilled} of ${totalFields} fields captured.`,
    ...chapterSummaries,
    '\nGuide conversation toward empty fields in the current chapter. Don\'t re-ask for captured information.',
  ];

  return lines.join('\n');
}

/**
 * @deprecated Use buildTieredFieldContext instead
 */
export function buildFieldStateContext(
  currentFieldValues: Record<string, unknown>,
  fieldLabels: Record<string, string>,
  fieldsToCapture: string[]
): string {
  // Delegate to tiered context with no chapter focus (backward compat)
  return buildTieredFieldContext(currentFieldValues);
}

/**
 * Build the OpenAI tool definition for structured field extraction.
 * Uses tool calling instead of prompt-based delimiters for reliable extraction.
 */
export function buildExtractionTool(extractionFields?: string[], scopeChapterKey?: string): object {
  // When a chapter is focused, only list that chapter's fields in detail.
  // This reduces the tool description from ~35 field descriptions (~1200 tokens)
  // to ~3-6 field descriptions (~200 tokens) + a one-line fallback note.
  let fieldDescriptions: string;
  let allFieldIds: string[];

  if (scopeChapterKey && ALL_FIELDS_MAP[scopeChapterKey]) {
    const focusedChapter = ALL_FIELDS_MAP[scopeChapterKey];
    const focusedDescriptions = focusedChapter.fields
      .map(f => `  - ${f.id} (${f.type}): ${f.label} — ${f.helpText}`)
      .join('\n');

    // Collect all other field IDs for the fallback note
    const otherFieldIds = Object.entries(ALL_FIELDS_MAP)
      .filter(([key]) => key !== scopeChapterKey)
      .flatMap(([, ch]) => ch.fields.map(f => f.id));

    fieldDescriptions = `Current chapter — ${focusedChapter.title}:\n${focusedDescriptions}\n\nOther field IDs (extract if mentioned): ${otherFieldIds.join(', ')}`;
    allFieldIds = [...focusedChapter.fields.map(f => f.id), ...otherFieldIds];
  } else {
    // No chapter focus: list all fields (used for document extraction / comprehensive mode)
    const validFields = extractionFields && extractionFields.length > 0
      ? extractionFields
      : Object.values(ALL_FIELDS_MAP).flatMap(ch => ch.fields.map(f => f.id));

    fieldDescriptions = validFields.map(fieldId => {
      for (const chapter of Object.values(ALL_FIELDS_MAP)) {
        const field = chapter.fields.find(f => f.id === fieldId);
        if (field) return `  - ${field.id} (${field.type}): ${field.label} — ${field.helpText}`;
      }
      return `  - ${fieldId}`;
    }).join('\n');
    allFieldIds = validFields;
  }

  return {
    type: "function",
    function: {
      name: "extract_brand_fields",
      description: `Extract brand field values detected in the user's message. Call this whenever the user shares information that maps to any brand field. Valid fields:\n${fieldDescriptions}`,
      parameters: {
        type: "object",
        properties: {
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                identifier: { type: "string", description: "The field ID from the valid fields list" },
                value: {
                  description: "The extracted value — string for text/textarea fields, array of strings for array fields",
                },
                confidence: { type: "number", description: "Confidence score: 0.90+ for direct statements, 0.85+ for documents, 0.70+ for strong inferences" },
                source: { type: "string", enum: ["user_stated", "user_confirmed", "inferred_strong", "document"] },
                context: { type: "string", description: "Brief explanation of why this was extracted" }
              },
              required: ["identifier", "value", "confidence", "source"]
            }
          }
        },
        required: ["fields"]
      }
    }
  };
}

/**
 * Build a brief extraction instruction for the system prompt.
 * The heavy lifting is done by the tool definition; this just tells the model when to use it.
 */
export function buildExtractionPrompt(extractionFields?: string[], hasDocumentContext?: boolean): string {
  let prompt = `
FIELD EXTRACTION — PROACTIVE AND AGGRESSIVE:
You MUST call extract_brand_fields whenever the user shares ANY information that could map to a brand field, even partially or indirectly. The user sees green badges for extracted fields, which builds trust and shows progress. Err on the side of extracting.
- Extract from EVERY message where relevant information appears — do NOT skip messages
- If the user says "I want X" or "my brand is about Y", that likely maps to brandPurpose, brandVision, brandMission, or brandValues — extract it immediately
- If the user describes their customers, extract demographics, psychographics, painPoints, or goals
- For array fields, pass an array of strings as the value
- Use confidence 0.90+ for direct statements, 0.70+ for strong inferences
- Extract MULTIPLE fields per turn when multiple are discussed
- Do not wait for perfect phrasing — if the user mentions something even loosely relevant, extract it with appropriate confidence
- ALWAYS mention in your text response which fields you extracted, e.g. "I captured that as your Brand Purpose"
- CRITICAL: Tool calls are supplementary. You MUST ALWAYS produce a conversational text response IN ADDITION to any tool calls. Never respond with only a tool call and no text. The user sees your text response — if you produce no text, the chat appears empty.`;

  if (hasDocumentContext) {
    prompt += `
- Scan document context for ALL extractable field values (confidence 0.85+, source: "document")
- When extracting from documents, ALWAYS tell the user what you found — summarize which fields were populated and from which parts of their document
- Inform the user which fields were populated from their documents`;
  }

  return prompt;
}

/**
 * Get human-readable label for a field identifier
 */
export function getFieldLabel(fieldIdentifier: string, category: string): string {
  // Check if we have a specific label for this field
  if (FIELD_LABELS[fieldIdentifier]) {
    return FIELD_LABELS[fieldIdentifier];
  }

  // Fall back to formatted field identifier
  return fieldIdentifier
    .replace(`${category}_`, '')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

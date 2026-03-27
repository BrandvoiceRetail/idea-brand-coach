/**
 * Field Suggestion Prompts
 *
 * Static map of fieldId -> natural conversational question prompt.
 * Used by useGhostSuggestion to suggest the next question based on
 * which fields are empty in the current chapter.
 *
 * Covers all 35 fields from ALL_FIELDS_MAP in
 * supabase/functions/idea-framework-consultant/fields.ts.
 */

export const FIELD_SUGGESTION_PROMPTS: Record<string, string> = {
  // ── Brand Foundation ───────────────────────────────────────────────────────
  brandPurpose:
    "What's the deeper reason your brand exists beyond making money?",
  brandVision:
    'What future do you want your brand to help create?',
  brandMission:
    'How does your brand plan to achieve that vision day-to-day?',

  // ── Brand Values ───────────────────────────────────────────────────────────
  brandValues:
    'What core values guide every decision your brand makes?',
  brandStory:
    'What is the origin story behind your brand?',
  brandPromise:
    'What commitment do you make to your customers every single time?',

  // ── Customer Avatar ────────────────────────────────────────────────────────
  demographics:
    'Tell me about your ideal customer — age, location, income, occupation...',
  psychographics:
    "What are your customers' interests, values, and lifestyle?",
  painPoints:
    'What frustrations or challenges do your customers face regularly?',
  goals:
    'What goals and aspirations motivate your ideal customer?',

  // ── Market Insight ─────────────────────────────────────────────────────────
  marketInsight:
    'What trends, gaps, or opportunities do you see in your market right now?',
  consumerInsight:
    'What drives your customers to make purchasing decisions?',

  // ── Buyer Intent ───────────────────────────────────────────────────────────
  functionalIntent:
    'What practical problem are your customers trying to solve?',
  emotionalIntent:
    'How do your customers want to feel when using your product or service?',
  identityIntent:
    'Who do your customers want to become through your brand?',
  socialIntent:
    'How do your customers want to be perceived by others?',

  // ── Brand Positioning ──────────────────────────────────────────────────────
  positioningStatement:
    'How do you want your brand to be perceived compared to competitors?',
  uniqueValue:
    'What specific value can only your brand deliver?',
  differentiators:
    'What key advantages distinguish you from every competitor?',

  // ── Brand Personality & Voice ──────────────────────────────────────────────
  brandPersonality:
    'If your brand were a person, what personality traits would they have?',
  brandVoice:
    'How does your brand communicate — what tone, style, and language?',
  brandArchetype:
    'Which universal character archetype does your brand embody?',

  // ── Emotional Connection ───────────────────────────────────────────────────
  emotionalConnection:
    'What primary emotion do you want your brand to evoke in people?',
  emotionalTriggers:
    'What specific moments or situations trigger an emotional response toward your brand?',
  customerNeeds:
    'What fundamental human needs does your brand address?',

  // ── Customer Experience ────────────────────────────────────────────────────
  customerJourney:
    'Walk me through the key touchpoints from when a customer first discovers you to when they become an advocate.',
  experiencePillars:
    'What are the core elements that shape every customer interaction with your brand?',
  preferredChannels:
    'Which platforms and channels does your audience prefer to engage on?',

  // ── Brand Authority ────────────────────────────────────────────────────────
  expertise:
    'What domains does your brand have deep knowledge and credibility in?',
  credibilityMarkers:
    'What evidence validates your brand\'s expertise — certifications, awards, partnerships?',
  thoughtLeadership:
    'What unique perspectives does your brand bring to the industry?',

  // ── Brand Authenticity ─────────────────────────────────────────────────────
  authenticityPrinciples:
    'What core truths make your brand real and believable?',
  transparency:
    'How does your brand approach open, honest communication with customers?',
  socialProof:
    'What evidence shows you consistently deliver on your promises?',
  brandConsistency:
    'How do you maintain a coherent brand experience across all touchpoints?',
};

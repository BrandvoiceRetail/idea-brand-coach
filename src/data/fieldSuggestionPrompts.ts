/**
 * Field Suggestion Prompts
 *
 * Static map of fieldId -> conversational prompt the USER would type to Trevor.
 * Used by useGhostSuggestion to suggest the next message based on
 * which fields are empty in the current chapter.
 *
 * These must read naturally as things the user says TO Trevor — sharing
 * their brand info, asking for help, or starting a conversation topic.
 *
 * Covers all 35 fields from ALL_FIELDS_MAP in
 * supabase/functions/idea-framework-consultant/fields.ts.
 */

export const FIELD_SUGGESTION_PROMPTS: Record<string, string> = {
  // ── Brand Foundation ───────────────────────────────────────────────────────
  brandPurpose:
    "Help me define my brand's purpose — the deeper reason it exists.",
  brandVision:
    'I want to work on my brand vision — the future I want to create.',
  brandMission:
    "Let's define my brand's mission — how we achieve the vision day-to-day.",

  // ── Brand Values ───────────────────────────────────────────────────────────
  brandValues:
    "I'd like to nail down the core values that guide my brand.",
  brandStory:
    'Let me tell you the origin story behind my brand.',
  brandPromise:
    "Help me articulate my brand's promise to customers.",

  // ── Customer Avatar ────────────────────────────────────────────────────────
  demographics:
    "Let me describe my ideal customer — who they are and where they live.",
  psychographics:
    "I want to map out my customers' interests, values, and lifestyle.",
  painPoints:
    "Let's talk about the frustrations my customers deal with.",
  goals:
    "Help me define what goals and aspirations motivate my customers.",

  // ── Market Insight ─────────────────────────────────────────────────────────
  marketInsight:
    "I want to talk about trends and opportunities I see in my market.",
  consumerInsight:
    "Let's dig into what drives my customers' purchasing decisions.",

  // ── Buyer Intent ───────────────────────────────────────────────────────────
  functionalIntent:
    "Help me define the practical problem my customers are trying to solve.",
  emotionalIntent:
    "Let's explore how my customers want to feel when using my product.",
  identityIntent:
    "I want to define who my customers want to become through my brand.",
  socialIntent:
    "Help me understand how my customers want to be perceived by others.",

  // ── Brand Positioning ──────────────────────────────────────────────────────
  positioningStatement:
    "I need help crafting my brand's positioning statement.",
  uniqueValue:
    "Let's define the unique value only my brand can deliver.",
  differentiators:
    "Help me articulate what sets my brand apart from competitors.",

  // ── Brand Personality & Voice ──────────────────────────────────────────────
  brandPersonality:
    "I want to define my brand's personality traits.",
  brandVoice:
    "Help me nail down my brand's tone and communication style.",
  brandArchetype:
    "Let's figure out which archetype best fits my brand.",

  // ── Emotional Connection ───────────────────────────────────────────────────
  emotionalConnection:
    "I want to define the primary emotion my brand should evoke.",
  emotionalTriggers:
    "Let's identify the moments that trigger an emotional response to my brand.",
  customerNeeds:
    "Help me define the fundamental human needs my brand addresses.",

  // ── Customer Experience ────────────────────────────────────────────────────
  customerJourney:
    "I want to map out my customer journey from discovery to advocacy.",
  experiencePillars:
    "Help me define the core pillars of my customer experience.",
  preferredChannels:
    "Let's identify which channels my audience prefers to engage on.",

  // ── Brand Authority ────────────────────────────────────────────────────────
  expertise:
    "I want to define the domains where my brand has deep credibility.",
  credibilityMarkers:
    "Let me share the evidence that validates my brand's expertise.",
  thoughtLeadership:
    "Help me articulate the unique perspectives my brand brings to the industry.",

  // ── Brand Authenticity ─────────────────────────────────────────────────────
  authenticityPrinciples:
    "Let's define the core truths that make my brand authentic.",
  transparency:
    "I want to talk about how my brand approaches honest communication.",
  socialProof:
    "Help me gather the proof that I consistently deliver on my promises.",
  brandConsistency:
    "Let's work on how to maintain a coherent brand across all touchpoints.",
};

/**
 * Field-specific question banks for guiding conversational brand coaching
 * These questions help Trevor focus on one aspect at a time
 */

export const FIELD_QUESTIONS: Record<string, string[]> = {
  // Brand Foundations (Core)
  brandPurpose: [
    "What problem keeps you up at night that your business solves?",
    "If money wasn't a factor, why would your business still exist?",
    "What change do you want to see in your customers' lives?",
    "Tell me about a time when your work made a real difference for someone.",
    "What frustrates you most about your industry that you're trying to fix?"
  ],

  brandVision: [
    "Where do you see your industry in 10 years?",
    "What future are you building toward?",
    "How will the world be different if you succeed?",
    "What does wild success look like for your brand?",
    "If you could wave a magic wand, what would your business become?"
  ],

  brandMission: [
    "What do you do every day to move toward your vision?",
    "How would you explain your business to a 10-year-old?",
    "What's the one thing you refuse to compromise on?",
    "What promise do you make to every customer?",
    "How do you measure if you're succeeding in your mission?"
  ],

  coreValues: [
    "What beliefs guide every decision you make?",
    "What would make you turn down a profitable opportunity?",
    "How do you want employees to describe working for you?",
    "What values do you share with your best customers?",
    "What principles would you defend even if they hurt profits?"
  ],

  brandPersonality: [
    "If your brand was a person at a party, how would they act?",
    "What three words do customers use to describe you?",
    "Are you more Apple or Microsoft? Nike or Adidas? Why?",
    "What tone do you use when talking to customers?",
    "How do you want people to feel after interacting with your brand?"
  ],

  // Avatar Domain (Customer Understanding)
  targetDemographics: [
    "Who's your most profitable customer right now?",
    "What age group makes up most of your sales?",
    "Where do your best customers typically live?",
    "What's their typical income or budget range?",
    "What life stage are they in?"
  ],

  targetPsychographics: [
    "What do your customers value most in life?",
    "What are they worried about at 2am?",
    "What magazines or websites do they read regularly?",
    "What beliefs do they hold strongly?",
    "How do they spend their free time?"
  ],

  customerPains: [
    "What specific problem led them to search for you?",
    "What have they already tried that didn't work?",
    "What's the real cost of not solving this problem?",
    "What objections do they raise before buying?",
    "What almost stops them from purchasing?"
  ],

  customerGains: [
    "What transformation are they hoping for?",
    "How will their life improve after buying from you?",
    "What will they be able to do that they can't now?",
    "What emotional payoff are they seeking?",
    "What success story do they want to tell?"
  ],

  buyingJourney: [
    "How do customers first discover you exist?",
    "What triggers them to start looking for a solution?",
    "Who else do they consider before choosing you?",
    "What finally convinces them to buy?",
    "How do they feel immediately after purchasing?"
  ],

  // Diagnostic Domain (Assessment)
  competitivePosition: [
    "Who do customers compare you to most often?",
    "What do competitors do that you refuse to copy?",
    "Where are you clearly winning against competition?",
    "What unique advantage do only you have?",
    "Why do customers choose you over alternatives?"
  ],

  marketOpportunities: [
    "What trends are reshaping your industry?",
    "What customer need isn't being met well?",
    "Where could you expand with minimal effort?",
    "What adjacent problem could you also solve?",
    "What's changing that creates new possibilities?"
  ],

  brandStrengths: [
    "What do you do better than anyone else?",
    "What capability took years to build?",
    "What do customers rave about most?",
    "What part of your business runs like clockwork?",
    "What asset gives you an unfair advantage?"
  ],

  brandWeaknesses: [
    "What keeps breaking in your business?",
    "Where do you consistently get complaints?",
    "What do competitors do better than you?",
    "What critical skill is your team missing?",
    "What would happen if your key person left?"
  ],

  // Canvas Domain (Business Model)
  valueProposition: [
    "What specific outcome do you guarantee?",
    "How are you 10x better than alternatives?",
    "What do you deliver that no one else can?",
    "Why should someone buy from you today?",
    "What makes your solution a no-brainer?"
  ],

  revenueStreams: [
    "How do customers prefer to pay you?",
    "What would they pay more for?",
    "What additional value could you charge for?",
    "How could you create recurring revenue?",
    "What premium version would some customers want?"
  ],

  customerSegments: [
    "Who gets the most value from your solution?",
    "Which segment is most profitable to serve?",
    "Who refers the most new customers?",
    "What niche could you dominate?",
    "Who desperately needs what you offer?"
  ],

  channels: [
    "Where do your best customers hang out?",
    "How do they prefer to buy?",
    "What channel converts best for you?",
    "Where could you reach more ideal customers?",
    "How do customers want to interact with you?"
  ],

  keyActivities: [
    "What must you do excellently every day?",
    "What activity creates the most value?",
    "What could you stop doing without harm?",
    "What should you outsource or automate?",
    "What activity differentiates you most?"
  ],

  keyResources: [
    "What asset is crucial to your success?",
    "What would be hardest to replace?",
    "What resource gives you an edge?",
    "What IP or knowledge do you own?",
    "What relationship is most valuable?"
  ],

  keyPartners: [
    "Who could help you scale faster?",
    "What partnership would transform your business?",
    "Who already serves your ideal customer?",
    "What capability would you rather partner for?",
    "Who could eliminate a major bottleneck?"
  ],

  costStructure: [
    "What's your biggest expense category?",
    "Where could you reduce costs without losing quality?",
    "What investment would pay for itself quickly?",
    "What fixed cost could become variable?",
    "Where are you overspending for the value received?"
  ]
};

/**
 * Get a contextual question for a specific field
 * @param fieldId The field identifier
 * @param interactionCount How many times we've asked about this field
 * @returns An appropriate question or null if none available
 */
export function getFieldQuestion(
  fieldId: string,
  interactionCount: number = 0
): string | null {
  const questions = FIELD_QUESTIONS[fieldId];
  if (!questions || questions.length === 0) {
    return null;
  }

  // Rotate through questions based on interaction count
  const questionIndex = interactionCount % questions.length;
  return questions[questionIndex];
}

/**
 * Field interaction states for tracking conversation progress
 */
export interface FieldInteractionState {
  fieldId: string;
  interactionCount: number;
  hasInitialResponse: boolean;
  needsClarification: boolean;
  lastInteraction?: Date;
}

/**
 * Determine the appropriate conversation approach based on field state
 */
export function getFieldApproach(state: FieldInteractionState): 'discovery' | 'clarification' | 'confirmation' {
  if (!state.hasInitialResponse) {
    return 'discovery';
  } else if (state.needsClarification || state.interactionCount === 1) {
    return 'clarification';
  } else {
    return 'confirmation';
  }
}
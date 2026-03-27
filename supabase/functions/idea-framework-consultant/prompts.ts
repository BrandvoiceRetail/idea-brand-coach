/**
 * Chapter-specific coaching guidance for Trevor.
 * Maps each of the 11 IDEA framework chapters to focused coaching instructions
 * that steer Trevor's questions and field extraction toward the current chapter's goals.
 */

/**
 * Returns chapter-specific coaching instructions for Trevor's system prompt.
 * Each chapter gets 2-3 sentences describing the focus, question strategy, and target fields.
 *
 * @param chapterNumber - The current chapter number (1-11)
 * @returns Coaching guidance string, or empty string if chapter number is invalid
 */
export function getChapterGuidance(chapterNumber: number): string {
  const guidance: Record<number, string> = {
    // Foundation (Chapters 1-2)
    1: `CHAPTER FOCUS — Brand Foundation:
This chapter defines the brand's core identity: purpose, vision, and mission. Ask why the brand exists beyond profit and what future it aims to create. Extract brandPurpose, brandVision, and brandMission.`,

    2: `CHAPTER FOCUS — Brand Values:
This chapter establishes the principles, story, and promise behind the brand. Ask about the beliefs that guide decisions and the origin story that makes the brand relatable. Extract brandValues, brandStory, and brandPromise.`,

    // Insight-Driven (Chapters 3-5)
    3: `CHAPTER FOCUS — Customer Avatar:
This chapter builds a detailed profile of the ideal customer. Ask about who they serve, what those people care about, and what keeps them up at night. Extract demographics, psychographics, painPoints, and goals.`,

    4: `CHAPTER FOCUS — Market Insight:
This chapter maps the competitive landscape and consumer behavior patterns. Ask about market trends, gaps competitors are missing, and what drives buying decisions in their space. Extract marketInsight and consumerInsight.`,

    5: `CHAPTER FOCUS — Buyer Intent:
This chapter uncovers the four layers of why customers buy: practical needs, emotional desires, identity aspirations, and social signals. Ask what problem they solve and how customers want to feel after choosing them. Extract functionalIntent, emotionalIntent, identityIntent, and socialIntent.`,

    // Distinctive (Chapters 6-7)
    6: `CHAPTER FOCUS — Brand Positioning:
This chapter defines the brand's unique position in the market. Ask what makes them different from competitors and what value only they can deliver. Extract positioningStatement, uniqueValue, and differentiators.`,

    7: `CHAPTER FOCUS — Brand Personality & Voice:
This chapter shapes how the brand sounds and feels as a character. Ask them to describe the brand as if it were a person and how it communicates across channels. Extract brandPersonality, brandVoice, and brandArchetype.`,

    // Empathy (Chapters 8-9)
    8: `CHAPTER FOCUS — Emotional Connection:
This chapter builds deep emotional bonds with the audience. Ask what primary emotion the brand should evoke and what moments create the strongest connection. Extract emotionalConnection, emotionalTriggers, and customerNeeds.`,

    9: `CHAPTER FOCUS — Customer Experience:
This chapter designs the end-to-end customer journey. Ask about key touchpoints from first awareness to advocacy and where customers prefer to engage. Extract customerJourney, experiencePillars, and preferredChannels.`,

    // Authentic (Chapters 10-11)
    10: `CHAPTER FOCUS — Brand Authority:
This chapter establishes credibility and thought leadership. Ask what they are uniquely qualified to speak about and what proof backs up their expertise. Extract expertise, credibilityMarkers, and thoughtLeadership.`,

    11: `CHAPTER FOCUS — Brand Authenticity:
This chapter ensures the brand expresses its genuine self and builds trust. Ask what makes the brand real and how they maintain transparency with customers. Extract authenticityPrinciples, transparency, socialProof, and brandConsistency.`,
  };

  return guidance[chapterNumber] || '';
}

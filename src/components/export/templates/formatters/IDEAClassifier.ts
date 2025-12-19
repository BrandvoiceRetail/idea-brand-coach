/**
 * IDEA Framework Classifier
 *
 * Classifies knowledge base entries into IDEA framework categories
 * based on content analysis using keyword matching.
 *
 * IDEA Framework:
 * - I (Insight): Market understanding, consumer insights, research, data-driven decisions
 * - D (Distinctive): Differentiation, unique value, positioning, competitive advantage
 * - E (Empathy): Emotional connection, customer understanding, pain points, journey
 * - A (Authentic): Brand values, story, authenticity, trust, transparency
 */

import type { KnowledgeEntry } from '@/lib/knowledge-base/interfaces';
import type { ChatMessage } from '@/types/chat';

export type IDEACategory = 'insight' | 'distinctive' | 'empathy' | 'authentic';

export interface ClassifiedEntry {
  entry: KnowledgeEntry;
  category: IDEACategory;
  confidence: number;
  matchedKeywords: string[];
}

export interface ClassifiedConversation {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  category: IDEACategory;
  confidence: number;
  matchedKeywords: string[];
  sessionTitle?: string;
}

export interface IDEAClassification {
  insight: ClassifiedEntry[];
  distinctive: ClassifiedEntry[];
  empathy: ClassifiedEntry[];
  authentic: ClassifiedEntry[];
  unclassified: KnowledgeEntry[];
}

export interface IDEAConversationClassification {
  insight: ClassifiedConversation[];
  distinctive: ClassifiedConversation[];
  empathy: ClassifiedConversation[];
  authentic: ClassifiedConversation[];
}

/**
 * Keywords and phrases that indicate each IDEA category
 * Weighted by specificity (more specific = higher weight)
 */
const IDEA_KEYWORDS: Record<IDEACategory, Array<{ keyword: string; weight: number }>> = {
  insight: [
    // Market research & analysis
    { keyword: 'market research', weight: 3 },
    { keyword: 'market analysis', weight: 3 },
    { keyword: 'market insight', weight: 3 },
    { keyword: 'consumer insight', weight: 3 },
    { keyword: 'customer research', weight: 3 },
    { keyword: 'competitive analysis', weight: 3 },
    { keyword: 'industry trend', weight: 2 },
    { keyword: 'market trend', weight: 2 },
    { keyword: 'data-driven', weight: 2 },
    { keyword: 'research finding', weight: 2 },
    // General insight words
    { keyword: 'market', weight: 1 },
    { keyword: 'research', weight: 1 },
    { keyword: 'analysis', weight: 1 },
    { keyword: 'trend', weight: 1 },
    { keyword: 'statistic', weight: 1 },
    { keyword: 'data', weight: 1 },
    { keyword: 'survey', weight: 1 },
    { keyword: 'study', weight: 1 },
    { keyword: 'finding', weight: 1 },
    { keyword: 'industry', weight: 1 },
    { keyword: 'competition', weight: 1 },
    { keyword: 'competitor', weight: 1 },
    { keyword: 'opportunity', weight: 1 },
    { keyword: 'gap', weight: 1 },
  ],
  distinctive: [
    // Differentiation & positioning
    { keyword: 'unique value proposition', weight: 3 },
    { keyword: 'value proposition', weight: 3 },
    { keyword: 'competitive advantage', weight: 3 },
    { keyword: 'brand positioning', weight: 3 },
    { keyword: 'market positioning', weight: 3 },
    { keyword: 'differentiation', weight: 3 },
    { keyword: 'differentiator', weight: 3 },
    { keyword: 'stand out', weight: 2 },
    { keyword: 'set apart', weight: 2 },
    { keyword: 'unique selling', weight: 2 },
    // General distinctive words
    { keyword: 'unique', weight: 1 },
    { keyword: 'different', weight: 1 },
    { keyword: 'distinctive', weight: 1 },
    { keyword: 'special', weight: 1 },
    { keyword: 'advantage', weight: 1 },
    { keyword: 'superior', weight: 1 },
    { keyword: 'better', weight: 1 },
    { keyword: 'positioning', weight: 1 },
    { keyword: 'niche', weight: 1 },
    { keyword: 'exclusive', weight: 1 },
    { keyword: 'innovative', weight: 1 },
    { keyword: 'proprietary', weight: 1 },
  ],
  empathy: [
    // Emotional connection & understanding
    { keyword: 'customer pain point', weight: 3 },
    { keyword: 'pain point', weight: 3 },
    { keyword: 'emotional connection', weight: 3 },
    { keyword: 'customer journey', weight: 3 },
    { keyword: 'customer experience', weight: 3 },
    { keyword: 'customer need', weight: 3 },
    { keyword: 'customer desire', weight: 3 },
    { keyword: 'customer frustration', weight: 2 },
    { keyword: 'customer goal', weight: 2 },
    { keyword: 'user experience', weight: 2 },
    // General empathy words
    { keyword: 'empathy', weight: 2 },
    { keyword: 'understand', weight: 1 },
    { keyword: 'feel', weight: 1 },
    { keyword: 'emotion', weight: 1 },
    { keyword: 'frustration', weight: 1 },
    { keyword: 'struggle', weight: 1 },
    { keyword: 'challenge', weight: 1 },
    { keyword: 'problem', weight: 1 },
    { keyword: 'need', weight: 1 },
    { keyword: 'want', weight: 1 },
    { keyword: 'desire', weight: 1 },
    { keyword: 'aspiration', weight: 1 },
    { keyword: 'fear', weight: 1 },
    { keyword: 'worry', weight: 1 },
    { keyword: 'concern', weight: 1 },
    { keyword: 'relate', weight: 1 },
    { keyword: 'connect', weight: 1 },
    { keyword: 'resonate', weight: 1 },
  ],
  authentic: [
    // Brand authenticity & values
    { keyword: 'brand value', weight: 3 },
    { keyword: 'core value', weight: 3 },
    { keyword: 'brand story', weight: 3 },
    { keyword: 'brand promise', weight: 3 },
    { keyword: 'brand mission', weight: 3 },
    { keyword: 'brand vision', weight: 3 },
    { keyword: 'brand purpose', weight: 3 },
    { keyword: 'brand identity', weight: 2 },
    { keyword: 'brand voice', weight: 2 },
    { keyword: 'brand personality', weight: 2 },
    { keyword: 'authenticity', weight: 2 },
    // General authentic words
    { keyword: 'authentic', weight: 1 },
    { keyword: 'genuine', weight: 1 },
    { keyword: 'honest', weight: 1 },
    { keyword: 'transparent', weight: 1 },
    { keyword: 'trust', weight: 1 },
    { keyword: 'credible', weight: 1 },
    { keyword: 'reliable', weight: 1 },
    { keyword: 'value', weight: 1 },
    { keyword: 'principle', weight: 1 },
    { keyword: 'belief', weight: 1 },
    { keyword: 'mission', weight: 1 },
    { keyword: 'vision', weight: 1 },
    { keyword: 'purpose', weight: 1 },
    { keyword: 'story', weight: 1 },
    { keyword: 'heritage', weight: 1 },
    { keyword: 'tradition', weight: 1 },
    { keyword: 'integrity', weight: 1 },
  ],
};

/**
 * Field identifier patterns that map to IDEA categories
 */
const FIELD_CATEGORY_MAPPING: Record<string, IDEACategory> = {
  // Direct IDEA module mappings
  'insight_': 'insight',
  'distinctive_': 'distinctive',
  'empathy_': 'empathy',
  'authentic_': 'authentic',

  // Canvas field mappings
  'canvas_brand_purpose': 'authentic',
  'canvas_brand_vision': 'authentic',
  'canvas_brand_mission': 'authentic',
  'canvas_brand_values': 'authentic',
  'canvas_brand_personality': 'empathy',
  'canvas_brand_voice': 'authentic',
  'canvas_positioning_statement': 'distinctive',
  'canvas_value_proposition': 'distinctive',

  // Avatar field mappings
  'avatar_psychology_values': 'empathy',
  'avatar_psychology_fears': 'empathy',
  'avatar_psychology_desires': 'empathy',
  'avatar_psychology_triggers': 'empathy',
  'avatar_buying_behavior': 'insight',
  'avatar_voice': 'empathy',

  // Diagnostic field mappings
  'diagnostic_': 'insight',
};

/**
 * IDEA Framework Classifier
 */
export class IDEAClassifier {
  private minimumConfidence: number;

  constructor(minimumConfidence: number = 0.2) {
    this.minimumConfidence = minimumConfidence;
  }

  /**
   * Classify all knowledge entries into IDEA categories
   */
  classifyEntries(entries: KnowledgeEntry[]): IDEAClassification {
    const result: IDEAClassification = {
      insight: [],
      distinctive: [],
      empathy: [],
      authentic: [],
      unclassified: [],
    };

    for (const entry of entries) {
      // Skip entries without meaningful content
      if (!entry.content || entry.content.trim().length < 10) {
        continue;
      }

      const classification = this.classifyEntry(entry);

      if (classification) {
        result[classification.category].push(classification);
      } else {
        result.unclassified.push(entry);
      }
    }

    // Sort each category by confidence (highest first)
    for (const category of ['insight', 'distinctive', 'empathy', 'authentic'] as IDEACategory[]) {
      result[category].sort((a, b) => b.confidence - a.confidence);
    }

    return result;
  }

  /**
   * Classify a single entry
   */
  private classifyEntry(entry: KnowledgeEntry): ClassifiedEntry | null {
    // First, check field identifier for direct mapping
    const fieldCategory = this.getFieldCategory(entry.fieldIdentifier);

    // Calculate keyword scores for content
    const scores = this.calculateKeywordScores(entry.content);

    // If we have a field mapping, boost that category
    if (fieldCategory && scores[fieldCategory]) {
      scores[fieldCategory].score *= 1.5;
    }

    // Find the highest scoring category
    let bestCategory: IDEACategory | null = null;
    let bestScore = 0;
    let bestKeywords: string[] = [];

    for (const [category, data] of Object.entries(scores) as [IDEACategory, { score: number; keywords: string[] }][]) {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestCategory = category;
        bestKeywords = data.keywords;
      }
    }

    // If we have a field mapping but no keyword matches, use field mapping
    if (!bestCategory && fieldCategory) {
      return {
        entry,
        category: fieldCategory,
        confidence: 0.5, // Medium confidence for field-only match
        matchedKeywords: [],
      };
    }

    // Calculate confidence (normalize score)
    const maxPossibleScore = this.getMaxPossibleScore(entry.content);
    const confidence = maxPossibleScore > 0 ? bestScore / maxPossibleScore : 0;

    if (bestCategory && confidence >= this.minimumConfidence) {
      return {
        entry,
        category: bestCategory,
        confidence: Math.min(1, confidence),
        matchedKeywords: bestKeywords,
      };
    }

    return null;
  }

  /**
   * Get category from field identifier
   */
  private getFieldCategory(fieldIdentifier: string): IDEACategory | null {
    for (const [pattern, category] of Object.entries(FIELD_CATEGORY_MAPPING)) {
      if (fieldIdentifier.startsWith(pattern) || fieldIdentifier === pattern) {
        return category;
      }
    }
    return null;
  }

  /**
   * Calculate keyword scores for each IDEA category
   */
  private calculateKeywordScores(content: string): Record<IDEACategory, { score: number; keywords: string[] }> {
    const lowerContent = content.toLowerCase();
    const scores: Record<IDEACategory, { score: number; keywords: string[] }> = {
      insight: { score: 0, keywords: [] },
      distinctive: { score: 0, keywords: [] },
      empathy: { score: 0, keywords: [] },
      authentic: { score: 0, keywords: [] },
    };

    for (const [category, keywords] of Object.entries(IDEA_KEYWORDS) as [IDEACategory, Array<{ keyword: string; weight: number }>][]) {
      for (const { keyword, weight } of keywords) {
        if (lowerContent.includes(keyword.toLowerCase())) {
          scores[category].score += weight;
          if (!scores[category].keywords.includes(keyword)) {
            scores[category].keywords.push(keyword);
          }
        }
      }
    }

    return scores;
  }

  /**
   * Calculate maximum possible score for normalization
   */
  private getMaxPossibleScore(content: string): number {
    // Use a reasonable max based on content length
    // Longer content has more opportunity for keyword matches
    const wordCount = content.split(/\s+/).length;
    return Math.max(5, Math.min(20, wordCount / 10));
  }

  /**
   * Get summary statistics for classification results
   */
  getSummary(classification: IDEAClassification): {
    insight: number;
    distinctive: number;
    empathy: number;
    authentic: number;
    unclassified: number;
    total: number;
  } {
    return {
      insight: classification.insight.length,
      distinctive: classification.distinctive.length,
      empathy: classification.empathy.length,
      authentic: classification.authentic.length,
      unclassified: classification.unclassified.length,
      total:
        classification.insight.length +
        classification.distinctive.length +
        classification.empathy.length +
        classification.authentic.length +
        classification.unclassified.length,
    };
  }

  /**
   * Classify chat conversations into IDEA categories
   * Looks at user-assistant message pairs and classifies based on combined content
   */
  classifyConversations(
    messages: ChatMessage[],
    sessionTitleMap?: Map<string, string>
  ): IDEAConversationClassification {
    const result: IDEAConversationClassification = {
      insight: [],
      distinctive: [],
      empathy: [],
      authentic: [],
    };

    // Find user-assistant pairs
    for (let i = 0; i < messages.length - 1; i++) {
      const msg = messages[i];
      const nextMsg = messages[i + 1];

      // Only process user-assistant pairs
      if (msg.role !== 'user' || nextMsg.role !== 'assistant') {
        continue;
      }

      // Skip very short exchanges
      if (msg.content.length < 20 || nextMsg.content.length < 50) {
        continue;
      }

      // Combine content for classification
      const combinedContent = `${msg.content} ${nextMsg.content}`;
      const scores = this.calculateKeywordScores(combinedContent);

      // Find the highest scoring category
      let bestCategory: IDEACategory | null = null;
      let bestScore = 0;
      let bestKeywords: string[] = [];

      for (const [category, data] of Object.entries(scores) as [IDEACategory, { score: number; keywords: string[] }][]) {
        if (data.score > bestScore) {
          bestScore = data.score;
          bestCategory = category;
          bestKeywords = data.keywords;
        }
      }

      // Calculate confidence
      const maxPossibleScore = this.getMaxPossibleScore(combinedContent);
      const confidence = maxPossibleScore > 0 ? bestScore / maxPossibleScore : 0;

      // Only include if above threshold
      if (bestCategory && confidence >= this.minimumConfidence) {
        const sessionTitle = msg.session_id && sessionTitleMap
          ? sessionTitleMap.get(msg.session_id)
          : undefined;

        result[bestCategory].push({
          userMessage: msg,
          assistantMessage: nextMsg,
          category: bestCategory,
          confidence: Math.min(1, confidence),
          matchedKeywords: bestKeywords,
          sessionTitle,
        });
      }
    }

    // Sort each category by confidence (highest first)
    for (const category of ['insight', 'distinctive', 'empathy', 'authentic'] as IDEACategory[]) {
      result[category].sort((a, b) => b.confidence - a.confidence);
    }

    return result;
  }

  /**
   * Get summary statistics for conversation classification results
   */
  getConversationSummary(classification: IDEAConversationClassification): {
    insight: number;
    distinctive: number;
    empathy: number;
    authentic: number;
    total: number;
  } {
    return {
      insight: classification.insight.length,
      distinctive: classification.distinctive.length,
      empathy: classification.empathy.length,
      authentic: classification.authentic.length,
      total:
        classification.insight.length +
        classification.distinctive.length +
        classification.empathy.length +
        classification.authentic.length,
    };
  }
}

/**
 * Export singleton instance
 */
export const ideaClassifier = new IDEAClassifier();

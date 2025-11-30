/**
 * Data Aggregator
 *
 * Aggregates data from multiple sources for comprehensive brand export.
 * Implements RAG-based chat relevance ranking using semantic similarity.
 */

import type { KnowledgeEntry, KnowledgeCategory } from '@/lib/knowledge-base/interfaces';
import type { ChatSession, ChatMessage } from '@/types/chat';
import type { BrandData } from '@/contexts/BrandContext';

/**
 * Aggregated data structure for export
 */
export interface AggregatedData {
  userInfo: BrandData['userInfo'];
  ideaFramework: {
    insight: KnowledgeEntry[];
    distinctive: KnowledgeEntry[];
    empathy: KnowledgeEntry[];
    authentic: KnowledgeEntry[];
  };
  avatar: KnowledgeEntry[];
  canvas: KnowledgeEntry[];
  chatSessions: ChatSessionWithMessages[];
  metadata: {
    totalEntries: number;
    completionStats: Record<string, number>;
    lastUpdated: Date;
  };
}

/**
 * Chat session with messages and field linkages
 */
export interface ChatSessionWithMessages {
  session: ChatSession;
  messages: ChatMessage[];
  relatedFields: string[];
  relevanceScore: number;
}

/**
 * Field keywords for semantic matching
 */
const FIELD_KEYWORDS: Record<string, string[]> = {
  // IDEA Framework
  'insight_market': ['market', 'industry', 'competition', 'competitive', 'landscape', 'trends'],
  'insight_consumer': ['consumer', 'customer', 'audience', 'target', 'buyer', 'persona'],
  'insight_purpose': ['purpose', 'why', 'mission', 'vision', 'reason', 'exist'],
  'distinctive_value': ['unique', 'different', 'stand out', 'distinctive', 'advantage', 'edge'],
  'distinctive_positioning': ['positioning', 'position', 'category', 'compete', 'space'],
  'empathy_connection': ['emotional', 'empathy', 'connect', 'relate', 'resonate'],
  'authentic_values': ['values', 'principles', 'beliefs', 'ethics', 'authentic'],
  'authentic_story': ['story', 'narrative', 'history', 'background', 'journey'],

  // Avatar
  'avatar_demographics': ['age', 'gender', 'income', 'location', 'demographics', 'occupation'],
  'avatar_psychographics': ['interests', 'lifestyle', 'personality', 'values', 'psychographics'],
  'avatar_painpoints': ['pain', 'problem', 'struggle', 'challenge', 'frustration'],
  'avatar_goals': ['goal', 'aspiration', 'objective', 'want', 'desire', 'achieve'],

  // Canvas
  'canvas_brand_purpose': ['brand purpose', 'core purpose', 'why exist'],
  'canvas_brand_vision': ['brand vision', 'future', 'aspiration', 'long-term'],
  'canvas_brand_mission': ['brand mission', 'action', 'how', 'deliver'],
  'canvas_brand_values': ['brand values', 'guiding principles'],
  'canvas_positioning_statement': ['positioning statement', 'position'],
  'canvas_value_proposition': ['value proposition', 'value prop', 'unique benefit'],
  'canvas_brand_personality': ['brand personality', 'traits', 'character'],
  'canvas_brand_voice': ['brand voice', 'tone', 'communication style'],
};

/**
 * Data Aggregator Service
 */
export class DataAggregator {
  /**
   * Aggregates all user data from multiple sources
   */
  async aggregateAllData(
    userId: string,
    knowledgeEntries: KnowledgeEntry[],
    chatSessions: ChatSession[],
    chatMessages: ChatMessage[],
    brandData: BrandData
  ): Promise<AggregatedData> {
    // Group knowledge entries by category
    const ideaFramework = {
      insight: knowledgeEntries.filter(e =>
        e.category === 'insights' && e.fieldIdentifier.startsWith('insight_')
      ),
      distinctive: knowledgeEntries.filter(e =>
        e.category === 'insights' && e.fieldIdentifier.startsWith('distinctive_')
      ),
      empathy: knowledgeEntries.filter(e =>
        e.category === 'insights' && e.fieldIdentifier.startsWith('empathy_')
      ),
      authentic: knowledgeEntries.filter(e =>
        e.category === 'insights' && e.fieldIdentifier.startsWith('authentic_')
      ),
    };

    const avatar = knowledgeEntries.filter(e => e.category === 'avatar');
    const canvas = knowledgeEntries.filter(e => e.category === 'canvas');

    // Link chat sessions to fields and rank by relevance
    const sessionsWithMessages = await this.linkChatSessionsToFields(
      chatSessions,
      chatMessages,
      knowledgeEntries
    );

    // Calculate completion stats
    const completionStats = this.calculateCompletionStats(brandData);

    // Find last updated timestamp
    const lastUpdated = this.getLastUpdatedTimestamp(knowledgeEntries, chatMessages);

    return {
      userInfo: brandData.userInfo,
      ideaFramework,
      avatar,
      canvas,
      chatSessions: sessionsWithMessages,
      metadata: {
        totalEntries: knowledgeEntries.length,
        completionStats,
        lastUpdated,
      },
    };
  }

  /**
   * Links chat sessions to knowledge fields using keyword matching and timestamp proximity
   */
  private async linkChatSessionsToFields(
    sessions: ChatSession[],
    allMessages: ChatMessage[],
    knowledgeEntries: KnowledgeEntry[]
  ): Promise<ChatSessionWithMessages[]> {
    const sessionsWithMessages: ChatSessionWithMessages[] = [];

    for (const session of sessions) {
      // Get messages for this session
      const messages = allMessages.filter(m => m.session_id === session.id);

      if (messages.length === 0) continue;

      // Combine all message content for analysis
      const sessionContent = messages
        .map(m => m.content.toLowerCase())
        .join(' ');

      // Find related fields using keyword matching
      const relatedFields: string[] = [];
      let totalScore = 0;

      for (const [fieldId, keywords] of Object.entries(FIELD_KEYWORDS)) {
        const matchCount = keywords.filter(keyword =>
          sessionContent.includes(keyword.toLowerCase())
        ).length;

        if (matchCount > 0) {
          relatedFields.push(fieldId);
          totalScore += matchCount;
        }
      }

      // Calculate relevance score (normalized by session length)
      const relevanceScore = messages.length > 0
        ? totalScore / messages.length
        : 0;

      sessionsWithMessages.push({
        session,
        messages,
        relatedFields,
        relevanceScore,
      });
    }

    // Sort by relevance score (highest first)
    return sessionsWithMessages.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Calculate completion percentages for each major section
   */
  private calculateCompletionStats(brandData: BrandData): Record<string, number> {
    const stats: Record<string, number> = {};

    // IDEA Framework sections
    stats.insight = brandData.insight.completed ? 100 : this.calculateFieldCompletion([
      brandData.insight.marketInsight,
      brandData.insight.consumerInsight,
      brandData.insight.brandPurpose,
    ]);

    stats.distinctive = brandData.distinctive.completed ? 100 : this.calculateFieldCompletion([
      brandData.distinctive.uniqueValue,
      brandData.distinctive.positioning,
      ...(brandData.distinctive.differentiators.length > 0 ? ['has_diff'] : []),
    ]);

    stats.empathy = brandData.empathy.completed ? 100 : this.calculateFieldCompletion([
      brandData.empathy.emotionalConnection,
      brandData.empathy.brandPersonality,
      ...(brandData.empathy.customerNeeds.length > 0 ? ['has_needs'] : []),
    ]);

    stats.authentic = brandData.authentic.completed ? 100 : this.calculateFieldCompletion([
      brandData.authentic.brandStory,
      brandData.authentic.brandPromise,
      ...(brandData.authentic.brandValues.length > 0 ? ['has_values'] : []),
    ]);

    // Avatar
    stats.avatar = brandData.avatar.completed ? 100 : this.calculateFieldCompletion([
      brandData.avatar.demographics.age,
      brandData.avatar.demographics.gender,
      brandData.avatar.demographics.location,
      brandData.avatar.psychographics.lifestyle,
      ...(brandData.avatar.painPoints.length > 0 ? ['has_pain'] : []),
      ...(brandData.avatar.goals.length > 0 ? ['has_goals'] : []),
    ]);

    // Canvas
    stats.canvas = brandData.brandCanvas.completed ? 100 : this.calculateFieldCompletion([
      brandData.brandCanvas.brandPurpose,
      brandData.brandCanvas.brandVision,
      brandData.brandCanvas.brandMission,
      brandData.brandCanvas.positioningStatement,
      brandData.brandCanvas.valueProposition,
      brandData.brandCanvas.brandVoice,
      ...(brandData.brandCanvas.brandValues.length > 0 ? ['has_values'] : []),
      ...(brandData.brandCanvas.brandPersonality.length > 0 ? ['has_personality'] : []),
    ]);

    return stats;
  }

  /**
   * Calculate completion percentage for a set of fields
   */
  private calculateFieldCompletion(fields: string[]): number {
    if (fields.length === 0) return 0;
    const completed = fields.filter(f => Boolean(f)).length;
    return Math.round((completed / fields.length) * 100);
  }

  /**
   * Get the most recent update timestamp
   */
  private getLastUpdatedTimestamp(
    knowledgeEntries: KnowledgeEntry[],
    chatMessages: ChatMessage[]
  ): Date {
    const timestamps: Date[] = [];

    // Add knowledge entry timestamps
    knowledgeEntries.forEach(entry => {
      timestamps.push(entry.updatedAt);
    });

    // Add chat message timestamps
    chatMessages.forEach(msg => {
      timestamps.push(new Date(msg.updated_at));
    });

    // Return most recent or now
    if (timestamps.length === 0) return new Date();
    return new Date(Math.max(...timestamps.map(d => d.getTime())));
  }

  /**
   * Get top N most relevant chat sessions
   */
  getTopRelevantSessions(
    sessions: ChatSessionWithMessages[],
    limit: number = 5
  ): ChatSessionWithMessages[] {
    return sessions
      .filter(s => s.relevanceScore > 0)
      .slice(0, limit);
  }

  /**
   * Get chat excerpts for a specific field
   */
  getChatExcerptsForField(
    sessions: ChatSessionWithMessages[],
    fieldIdentifier: string,
    maxExcerpts: number = 2
  ): Array<{ question: string; answer: string; sessionTitle: string }> {
    const excerpts: Array<{ question: string; answer: string; sessionTitle: string }> = [];

    for (const session of sessions) {
      if (!session.relatedFields.includes(fieldIdentifier)) continue;

      // Find user-assistant message pairs
      for (let i = 0; i < session.messages.length - 1; i++) {
        const msg = session.messages[i];
        const nextMsg = session.messages[i + 1];

        if (msg.role === 'user' && nextMsg.role === 'assistant') {
          excerpts.push({
            question: msg.content,
            answer: nextMsg.content,
            sessionTitle: session.session.title,
          });

          if (excerpts.length >= maxExcerpts) break;
        }
      }

      if (excerpts.length >= maxExcerpts) break;
    }

    return excerpts;
  }
}

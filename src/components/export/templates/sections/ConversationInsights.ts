/**
 * Conversation Insights Section Template
 *
 * Generates the AI Conversation Insights section with top relevant chat excerpts.
 */

import type { AggregatedData, ChatSessionWithMessages } from '../formatters/DataAggregator';
import type { ExportOptions } from '../../MarkdownExportService';
import * as md from '../formatters/MarkdownFormatter';

export function generateConversationInsights(
  data: AggregatedData,
  options: ExportOptions
): string {
  let content = '';

  // Skip if chats not included or no sessions
  if (!options.includeChats || data.chatSessions.length === 0) {
    return '';
  }

  // Main section heading
  content += md.heading('AI Conversation Insights', 2);

  content += md.blockquote(
    'This section highlights the most impactful conversations that shaped your brand strategy. ' +
    'These excerpts were selected using semantic similarity analysis to identify discussions ' +
    'most relevant to your key decisions.'
  );

  // Get top N sessions
  const maxExcerpts = options.maxChatExcerpts || 5;
  const topSessions = data.chatSessions
    .filter(s => s.relevanceScore > 0)
    .slice(0, maxExcerpts);

  if (topSessions.length === 0) {
    content += md.paragraph(
      md.italic('No relevant conversations found. Start chatting with the Brand Coach to get personalized insights!')
    );
    content += md.horizontalRule();
    return content;
  }

  // Generate excerpt for each session
  topSessions.forEach((session, index) => {
    content += generateSessionExcerpt(session, index + 1);
  });

  content += md.horizontalRule();

  return content;
}

/**
 * Generate a single session excerpt
 */
function generateSessionExcerpt(
  session: ChatSessionWithMessages,
  index: number
): string {
  let content = '';

  // Session heading
  content += md.heading(`Strategic Discussion #${index}: "${session.session.title}"`, 3);
  content += md.paragraph(md.italic(md.formatTimestamp(session.session.created_at)));

  // Find the most relevant user-assistant exchange
  const exchange = findMostRelevantExchange(session);

  if (exchange) {
    content += md.paragraph(md.bold('Key Exchange:'));

    // User question
    content += md.blockquote(`${md.bold('You')}: ${md.truncate(exchange.question, 500)}`);

    // Assistant response
    content += md.blockquote(`${md.bold('Brand Coach')}: ${md.truncate(exchange.answer, 500)}`);

    // Impact on strategy
    const impact = determineImpact(session);
    if (impact) {
      content += md.paragraph(md.bold('Impact on Strategy:'));
      content += md.paragraph(impact);
    }
  } else {
    content += md.paragraph(
      md.italic('This conversation explored brand strategy concepts and provided valuable context.')
    );
  }

  content += '\n';

  return content;
}

/**
 * Find the most relevant user-assistant message exchange
 */
function findMostRelevantExchange(
  session: ChatSessionWithMessages
): { question: string; answer: string } | null {
  const messages = session.messages;

  // Look for substantive exchanges (longer messages are likely more detailed)
  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i];
    const nextMsg = messages[i + 1];

    if (msg.role === 'user' && nextMsg.role === 'assistant') {
      // Prefer longer, more detailed exchanges
      if (msg.content.length > 50 && nextMsg.content.length > 100) {
        return {
          question: msg.content,
          answer: nextMsg.content,
        };
      }
    }
  }

  // Fallback to first exchange if no long ones found
  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i];
    const nextMsg = messages[i + 1];

    if (msg.role === 'user' && nextMsg.role === 'assistant') {
      return {
        question: msg.content,
        answer: nextMsg.content,
      };
    }
  }

  return null;
}

/**
 * Determine the impact of this conversation on brand strategy
 */
function determineImpact(session: ChatSessionWithMessages): string {
  const fields = session.relatedFields;

  if (fields.length === 0) {
    return 'This conversation provided general brand strategy guidance.';
  }

  // Map field identifiers to human-readable impacts
  const impactMap: Record<string, string> = {
    'canvas_brand_purpose': 'This conversation helped clarify the Brand Purpose by exploring the core "why" behind the business.',
    'canvas_brand_vision': 'This conversation informed the Brand Vision by discussing long-term aspirations and future impact.',
    'canvas_brand_mission': 'This conversation shaped the Brand Mission by defining actionable steps to fulfill the purpose.',
    'canvas_value_proposition': 'This conversation refined the Value Proposition by identifying unique benefits and competitive advantages.',
    'canvas_positioning_statement': 'This conversation influenced the Positioning Statement by clarifying market position and target audience.',
    'canvas_brand_voice': 'This conversation defined the Brand Voice by exploring tone and communication style.',
    'insight_market': 'This conversation provided Market Insights that informed overall brand strategy.',
    'insight_consumer': 'This conversation deepened Consumer Insights about target audience needs and behaviors.',
    'distinctive_value': 'This conversation helped identify the Unique Value that sets the brand apart.',
    'avatar_demographics': 'This conversation refined the Customer Avatar demographics and target audience profile.',
    'avatar_painpoints': 'This conversation identified key customer pain points that the brand addresses.',
  };

  // Find the most relevant impact
  for (const field of fields) {
    if (impactMap[field]) {
      return impactMap[field];
    }
  }

  return `This conversation informed ${fields.length} aspect(s) of the brand strategy.`;
}

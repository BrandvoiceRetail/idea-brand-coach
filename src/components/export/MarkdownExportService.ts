/**
 * Markdown Export Service
 *
 * Service layer for generating comprehensive markdown exports of brand strategy.
 * Orchestrates data collection and AI-powered document generation.
 *
 * Uses the generate-brand-strategy-document edge function to create
 * professional, client-ready brand strategy documents.
 */

import type { IKnowledgeRepository } from '@/lib/knowledge-base/interfaces';
import type { IChatService } from '@/services/interfaces/IChatService';
import type { BrandData } from '@/contexts/BrandContext';
import { DataAggregator, type AggregatedData } from './templates/formatters/DataAggregator';
import { supabase } from '@/integrations/supabase/client';

/**
 * Export configuration options
 */
export interface ExportOptions {
  /** Include chat conversation excerpts */
  includeChats: boolean;

  /** Maximum number of chat excerpts to include */
  maxChatExcerpts?: number;

  /** Export format: full detailed export or summary */
  format: 'full' | 'summary';
}

/**
 * Export result with metadata
 */
export interface ExportResult {
  /** Success status */
  success: boolean;

  /** Generated markdown content */
  markdown?: string;

  /** Suggested filename for download */
  filename: string;

  /** Export metadata */
  metadata: ExportMetadata;

  /** Error if export failed */
  error?: Error;
}

/**
 * Metadata about the export
 */
export interface ExportMetadata {
  /** Export schema version for future compatibility */
  exportVersion: string;

  /** Timestamp when export was generated */
  generatedAt: Date;

  /** User ID (anonymized in export) */
  userId: string;

  /** Data sources included in export */
  dataSources: {
    knowledgeEntries: number;
    chatSessions: number;
    chatMessages: number;
    completionPercentage: number;
  };
}

/**
 * Current export schema version
 */
export const EXPORT_SCHEMA_VERSION = '2.0.0';

/**
 * Markdown Export Service
 */
export class MarkdownExportService {
  private dataAggregator: DataAggregator;

  constructor(
    private knowledgeRepo: IKnowledgeRepository,
    private chatService: IChatService,
    private brandData: BrandData
  ) {
    this.dataAggregator = new DataAggregator();
  }

  /**
   * Generate comprehensive markdown export using AI
   */
  async generateExport(options: ExportOptions): Promise<ExportResult> {
    try {
      const userId = this.brandData.userInfo.userId;

      if (!userId) {
        throw new Error('User ID is required for export');
      }

      // Collect data from all sources
      const aggregatedData = await this.collectData(userId);

      // Generate markdown content using AI
      const markdown = await this.generateMarkdownWithAI(aggregatedData, options);

      // Create filename
      const filename = this.generateFilename(this.brandData.userInfo.company);

      // Calculate metadata
      const metadata = this.generateMetadata(userId, aggregatedData);

      return {
        success: true,
        markdown,
        filename,
        metadata,
      };
    } catch (error) {
      console.error('Export generation failed:', error);

      return {
        success: false,
        filename: 'brand-strategy-export-error.md',
        metadata: {
          exportVersion: EXPORT_SCHEMA_VERSION,
          generatedAt: new Date(),
          userId: this.brandData.userInfo.userId || 'unknown',
          dataSources: {
            knowledgeEntries: 0,
            chatSessions: 0,
            chatMessages: 0,
            completionPercentage: 0,
          },
        },
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * Collect data from all sources
   */
  private async collectData(userId: string): Promise<AggregatedData> {
    // Collect knowledge base entries
    const knowledgeEntries = await this.knowledgeRepo.getAllUserData(userId);

    // Collect ALL chat sessions and messages (not filtered by chatbot type)
    const { data: chatSessionsData, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (sessionsError) {
      console.error('Failed to fetch chat sessions:', sessionsError);
      throw sessionsError;
    }

    const chatSessions = chatSessionsData || [];
    const allMessages: any[] = [];

    // Get messages for each session
    for (const session of chatSessions) {
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error(`Failed to fetch messages for session ${session.id}:`, messagesError);
        continue;
      }

      allMessages.push(...(messagesData || []));
    }

    console.log('📊 Export data collected:', {
      knowledgeEntries: knowledgeEntries.length,
      chatSessions: chatSessions.length,
      chatMessages: allMessages.length,
    });

    // Aggregate all data
    // Cast chat sessions to expected type (chatbot_type from DB is string but we need ChatbotType)
    const typedChatSessions = chatSessions.map(session => ({
      ...session,
      chatbot_type: session.chatbot_type as import('@/types/chat').ChatbotType
    }));

    return this.dataAggregator.aggregateAllData(
      userId,
      knowledgeEntries,
      typedChatSessions,
      allMessages,
      this.brandData
    );
  }

  /**
   * Generate markdown content using AI edge function
   */
  private async generateMarkdownWithAI(
    data: AggregatedData,
    options: ExportOptions
  ): Promise<string> {
    // Prepare canvas data from knowledge base entries
    const canvasData: Record<string, string> = {};
    for (const entry of data.canvas) {
      const key = entry.fieldIdentifier.replace('canvas_', '');
      canvasData[key] = entry.content;
    }

    // Prepare avatar data from knowledge base entries
    const avatarData: Record<string, string> = {};
    for (const entry of data.avatar) {
      avatarData[entry.fieldIdentifier] = entry.content;
    }

    // Prepare insights data from all IDEA framework entries
    const insightsData: Record<string, string> = {};
    const allInsights = [
      ...data.ideaFramework.insight,
      ...data.ideaFramework.distinctive,
      ...data.ideaFramework.empathy,
      ...data.ideaFramework.authentic,
    ];
    for (const entry of allInsights) {
      insightsData[entry.fieldIdentifier] = entry.content;
    }

    // Prepare chat insights - include recent conversations with full context
    const chatInsights: Array<{ title: string; excerpt: string }> = [];
    if (options.includeChats) {
      // Sort by most recent first, take top sessions regardless of relevance score
      const recentSessions = [...data.chatSessions]
        .sort((a, b) => {
          const aTime = new Date(a.session.updated_at).getTime();
          const bTime = new Date(b.session.updated_at).getTime();
          return bTime - aTime;
        })
        .slice(0, options.maxChatExcerpts || 10);

      for (const session of recentSessions) {
        // Build a comprehensive excerpt from the entire conversation
        const conversationParts: string[] = [];

        // Get all message pairs (user question + assistant response)
        for (let i = 0; i < session.messages.length; i++) {
          const msg = session.messages[i];
          if (msg.role === 'user') {
            conversationParts.push(`User: ${msg.content}`);
          } else if (msg.role === 'assistant') {
            // Truncate very long assistant responses but keep more context
            const content = msg.content.length > 800
              ? msg.content.substring(0, 800) + '...'
              : msg.content;
            conversationParts.push(`Coach: ${content}`);
          }
        }

        if (conversationParts.length > 0) {
          // Join all parts, but limit total length per session
          let excerpt = conversationParts.join('\n\n');
          if (excerpt.length > 3000) {
            excerpt = excerpt.substring(0, 3000) + '\n\n[Conversation truncated...]';
          }

          chatInsights.push({
            title: session.session.title || 'Strategic Conversation',
            excerpt,
          });
        }
      }
    }

    console.log('📝 Chat insights prepared:', {
      sessionsIncluded: chatInsights.length,
      titles: chatInsights.map(c => c.title),
    });

    console.log('📝 Calling AI to generate brand strategy document...');

    // Call the edge function to generate the document
    const { data: response, error } = await supabase.functions.invoke(
      'generate-brand-strategy-document',
      {
        body: {
          companyName: this.brandData.userInfo.company || 'Your Brand',
          canvas: canvasData,
          avatar: avatarData,
          insights: insightsData,
          chatInsights,
        },
      }
    );

    if (error) {
      console.error('AI document generation failed:', error);
      throw new Error(`Failed to generate document: ${error.message}`);
    }

    if (!response?.success || !response?.document) {
      console.error('AI document generation returned invalid response:', response);
      throw new Error(response?.error || 'Failed to generate document');
    }

    console.log('✅ AI document generated successfully');
    return response.document;
  }

  /**
   * Generate markdown content from aggregated data (legacy template-based)
   * @deprecated Use generateMarkdownWithAI instead
   */
  private async generateMarkdownLegacy(
    data: AggregatedData,
    options: ExportOptions
  ): Promise<string> {
    // Import template orchestrator dynamically to avoid circular deps
    const { BrandStrategyTemplate } = await import('./templates/BrandStrategyTemplate');

    const template = new BrandStrategyTemplate(data, this.brandData, options);
    return template.generate();
  }

  /**
   * Generate filename for export
   */
  private generateFilename(companyName: string): string {
    const company = companyName || 'brand-strategy';
    const slug = company
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const date = new Date().toISOString().split('T')[0];
    return `${slug}-brand-strategy-${date}.md`;
  }

  /**
   * Generate export metadata
   */
  private generateMetadata(
    userId: string,
    data: AggregatedData
  ): ExportMetadata {
    const totalKnowledge = data.metadata.totalEntries;
    const totalSessions = data.chatSessions.length;
    const totalMessages = data.chatSessions.reduce(
      (sum, session) => sum + session.messages.length,
      0
    );

    // Calculate overall completion percentage
    const completionStats = Object.values(data.metadata.completionStats);
    const avgCompletion = completionStats.length > 0
      ? Math.round(
          completionStats.reduce((sum, val) => sum + val, 0) / completionStats.length
        )
      : 0;

    return {
      exportVersion: EXPORT_SCHEMA_VERSION,
      generatedAt: new Date(),
      userId,
      dataSources: {
        knowledgeEntries: totalKnowledge,
        chatSessions: totalSessions,
        chatMessages: totalMessages,
        completionPercentage: avgCompletion,
      },
    };
  }

  /**
   * Create downloadable file blob
   */
  createDownloadableFile(markdown: string): Blob {
    return new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  }

  /**
   * Trigger browser download
   */
  downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

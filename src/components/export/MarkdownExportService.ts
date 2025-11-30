/**
 * Markdown Export Service
 *
 * Service layer for generating comprehensive markdown exports of brand strategy.
 * Orchestrates data collection, aggregation, and template rendering.
 */

import type { IKnowledgeRepository } from '@/lib/knowledge-base/interfaces';
import type { IChatService } from '@/services/interfaces/IChatService';
import type { BrandData } from '@/contexts/BrandContext';
import { DataAggregator, type AggregatedData } from './templates/formatters/DataAggregator';

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
export const EXPORT_SCHEMA_VERSION = '1.0.0';

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
   * Generate comprehensive markdown export
   */
  async generateExport(options: ExportOptions): Promise<ExportResult> {
    try {
      const userId = this.brandData.userInfo.userId;

      if (!userId) {
        throw new Error('User ID is required for export');
      }

      // Collect data from all sources
      const aggregatedData = await this.collectData(userId);

      // Generate markdown content
      const markdown = await this.generateMarkdown(aggregatedData, options);

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

    // Collect chat sessions and messages
    const chatSessions = await this.chatService.getSessions();
    const allMessages: any[] = [];

    // Get messages for each session
    for (const session of chatSessions) {
      const messages = await this.chatService.getSessionMessages(session.id);
      allMessages.push(...messages);
    }

    // Aggregate all data
    return this.dataAggregator.aggregateAllData(
      userId,
      knowledgeEntries,
      chatSessions,
      allMessages,
      this.brandData
    );
  }

  /**
   * Generate markdown content from aggregated data
   */
  private async generateMarkdown(
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

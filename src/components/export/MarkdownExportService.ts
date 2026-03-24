/**
 * Markdown Export Service
 *
 * V1: Calls generate-brand-strategy-document (single-pass).
 * V2: Client-side orchestration calling generate-brand-strategy-section per section
 *      with batch ordering and per-section retry.
 */

import type { IKnowledgeRepository } from '@/lib/knowledge-base/interfaces';
import type { IChatService } from '@/services/interfaces/IChatService';
import type { BrandData } from '@/contexts/BrandContext';
import { DataAggregator, type AggregatedData } from './templates/formatters/DataAggregator';
import { supabase } from '@/integrations/supabase/client';

/** Section IDs and their batch ordering — mirrors the edge function's DOCUMENT_SECTIONS */
interface SectionBatchConfig {
  id: string;
  title: string;
  order: number;
  batch: number;
  dependsOn?: string[];
}

const SECTION_BATCHES: SectionBatchConfig[] = [
  { id: 'customer_avatar', title: 'Customer Understanding', order: 2, batch: 1 },
  { id: 'emotional_triggers', title: 'Emotional Triggers', order: 3, batch: 1 },
  { id: 'customer_journey', title: 'Customer Journey', order: 4, batch: 1 },
  { id: 'brand_purpose', title: 'Brand Purpose & Vision', order: 5, batch: 2 },
  { id: 'brand_mission', title: 'Brand Mission & Values', order: 6, batch: 2 },
  { id: 'brand_positioning', title: 'Brand Positioning', order: 7, batch: 2 },
  { id: 'brand_personality', title: 'Brand Personality & Voice', order: 8, batch: 2 },
  { id: 'brand_story', title: 'Brand Story', order: 10, batch: 3 },
  { id: 'messaging_framework', title: 'Messaging Framework', order: 11, batch: 3 },
  { id: 'agentic_commerce', title: 'Agentic Commerce', order: 12, batch: 3 },
  { id: 'brand_essence', title: 'Brand Essence & DNA', order: 9, batch: 98, dependsOn: ['brand_purpose', 'brand_mission', 'brand_positioning', 'brand_personality'] },
  { id: 'implementation', title: 'Implementation Roadmap', order: 13, batch: 97, dependsOn: ['brand_essence'] },
  { id: 'idea_overview', title: 'IDEA Framework Overview', order: 1, batch: 99, dependsOn: ['customer_avatar', 'brand_purpose', 'brand_positioning', 'brand_essence'] },
];

const MAX_SECTION_RETRIES = 3;
const SECTION_RETRY_BASE_MS = 2000;

export interface ExportOptions {
  includeChats: boolean;
  maxChatExcerpts?: number;
  format: 'full' | 'summary';
  version?: 'v1' | 'v2';
  /** Progress callback for section-by-section generation */
  onProgress?: (completed: number, total: number, currentSection: string) => void;
}

export interface ExportResult {
  success: boolean;
  markdown?: string;
  filename: string;
  metadata: ExportMetadata;
  error?: Error;
}

export interface ExportMetadata {
  exportVersion: string;
  generatedAt: Date;
  userId: string;
  dataSources: {
    knowledgeEntries: number;
    chatSessions: number;
    chatMessages: number;
    completionPercentage: number;
  };
}

export const EXPORT_SCHEMA_VERSION = '2.0.0';

export class MarkdownExportService {
  private dataAggregator: DataAggregator;

  constructor(
    private knowledgeRepo: IKnowledgeRepository,
    private chatService: IChatService,
    private brandData: BrandData
  ) {
    this.dataAggregator = new DataAggregator();
  }

  async generateExport(options: ExportOptions): Promise<ExportResult> {
    try {
      const userId = this.brandData.userInfo.userId;
      if (!userId) throw new Error('User ID is required for export');

      const aggregatedData = await this.collectData(userId);
      const useV2 = (options.version ?? 'v2') === 'v2';
      const markdown = useV2
        ? await this.generateMarkdownWithSkills(aggregatedData, options, userId)
        : await this.generateMarkdownWithAI(aggregatedData, options);

      return {
        success: true,
        markdown,
        filename: this.generateFilename(this.brandData.userInfo.company),
        metadata: this.generateMetadata(userId, aggregatedData),
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
          dataSources: { knowledgeEntries: 0, chatSessions: 0, chatMessages: 0, completionPercentage: 0 },
        },
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  private async collectData(userId: string): Promise<AggregatedData> {
    const knowledgeEntries = await this.knowledgeRepo.getAllUserData(userId);

    const { data: chatSessionsData, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (sessionsError) throw sessionsError;

    const chatSessions = chatSessionsData || [];
    const allMessages: any[] = [];

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

    const typedChatSessions = chatSessions.map(session => ({
      ...session,
      chatbot_type: session.chatbot_type as import('@/types/chat').ChatbotType,
      conversation_type: session.conversation_type as import('@/types/chat').ConversationType,
    }));

    return this.dataAggregator.aggregateAllData(userId, knowledgeEntries, typedChatSessions, allMessages, this.brandData);
  }

  /**
   * Prepare shared data for edge function calls.
   * Used by both V1 and V2 paths.
   */
  private prepareEdgeFunctionData(
    data: AggregatedData,
    options: ExportOptions
  ): {
    canvasData: Record<string, string>;
    avatarData: Record<string, string>;
    insightsData: Record<string, string>;
    chatInsights: Array<{ title: string; excerpt: string }>;
  } {
    const canvasData: Record<string, string> = {};
    for (const entry of data.canvas) {
      canvasData[entry.fieldIdentifier.replace('canvas_', '')] = entry.content;
    }

    const avatarData: Record<string, string> = {};
    for (const entry of data.avatar) {
      avatarData[entry.fieldIdentifier] = entry.content;
    }

    const insightsData: Record<string, string> = {};
    for (const entry of [...data.ideaFramework.insight, ...data.ideaFramework.distinctive, ...data.ideaFramework.empathy, ...data.ideaFramework.authentic]) {
      insightsData[entry.fieldIdentifier] = entry.content;
    }

    const chatInsights: Array<{ title: string; excerpt: string }> = [];
    if (options.includeChats) {
      const recentSessions = [...data.chatSessions]
        .sort((a, b) => new Date(b.session.updated_at).getTime() - new Date(a.session.updated_at).getTime())
        .slice(0, options.maxChatExcerpts || 10);

      for (const session of recentSessions) {
        const conversationParts: string[] = [];
        for (const msg of session.messages) {
          if (!msg || typeof msg.role !== 'string' || typeof msg.content !== 'string') continue;
          if (msg.role === 'user') {
            conversationParts.push(`User: ${msg.content}`);
          } else if (msg.role === 'assistant') {
            const content = msg.content.length > 800 ? msg.content.substring(0, 800) + '...' : msg.content;
            conversationParts.push(`Coach: ${content}`);
          }
        }
        if (conversationParts.length > 0) {
          let excerpt = conversationParts.join('\n\n');
          if (excerpt.length > 3000) excerpt = excerpt.substring(0, 3000) + '\n\n[Conversation truncated...]';
          chatInsights.push({ title: session.session.title || 'Strategic Conversation', excerpt });
        }
      }
    }

    return { canvasData, avatarData, insightsData, chatInsights };
  }

  /** V1 single-pass AI generation */
  private async generateMarkdownWithAI(data: AggregatedData, options: ExportOptions): Promise<string> {
    const { canvasData, avatarData, insightsData, chatInsights } = this.prepareEdgeFunctionData(data, options);

    const { data: response, error } = await supabase.functions.invoke('generate-brand-strategy-document', {
      body: {
        companyName: this.brandData.userInfo.company || 'Your Brand',
        canvas: canvasData,
        avatar: avatarData,
        insights: insightsData,
        chatInsights,
      },
    });

    if (error) throw new Error(`Failed to generate document: ${error.message}`);
    if (!response?.success || !response?.document) throw new Error(response?.error || 'Failed to generate document');
    return response.document;
  }

  /** V2 client-side orchestration: calls generate-brand-strategy-section per section with batch ordering */
  private async generateMarkdownWithSkills(data: AggregatedData, options: ExportOptions, userId: string): Promise<string> {
    const { canvasData, avatarData, insightsData, chatInsights } = this.prepareEdgeFunctionData(data, options);
    const avatarFieldValues = await this.collectAvatarFieldValues(userId);
    const companyName = this.brandData.userInfo.company || 'Your Brand';
    const generatedSections: Record<string, string> = {};
    const totalSections = SECTION_BATCHES.length;
    let completedCount = 0;

    // Group by batch
    const batchMap = new Map<number, SectionBatchConfig[]>();
    for (const section of SECTION_BATCHES) {
      if (!batchMap.has(section.batch)) batchMap.set(section.batch, []);
      batchMap.get(section.batch)!.push(section);
    }

    // Process batches in order
    for (const batchNum of [...batchMap.keys()].sort((a, b) => a - b)) {
      const results = await Promise.all(
        batchMap.get(batchNum)!.map(section =>
          this.generateSingleSection(section.id, companyName, avatarFieldValues, canvasData, avatarData, insightsData, chatInsights, generatedSections)
        )
      );
      for (const result of results) {
        generatedSections[result.sectionId] = result.content;
        completedCount++;
        options.onProgress?.(completedCount, totalSections, result.sectionId);
      }
    }

    return this.assembleDocument(companyName, generatedSections);
  }

  /** Call the per-section edge function with exponential backoff retry */
  private async generateSingleSection(
    sectionId: string,
    brandName: string,
    avatarFieldValues: Record<string, string>,
    canvas: Record<string, string>,
    avatar: Record<string, string>,
    insights: Record<string, string>,
    chatInsights: Array<{ title: string; excerpt: string }>,
    previousSections: Record<string, string>
  ): Promise<{ sectionId: string; content: string }> {
    for (let attempt = 0; attempt < MAX_SECTION_RETRIES; attempt++) {
      try {
        const { data: response, error } = await supabase.functions.invoke('generate-brand-strategy-section', {
          body: { sectionId, brandName, avatarFieldValues, canvas, avatar, insights, chatInsights, previousSections },
        });
        if (error) throw new Error(error.message);
        if (!response?.success || !response?.content) throw new Error(response?.error || 'Empty response');
        return { sectionId, content: response.content };
      } catch (err) {
        console.warn(`Section ${sectionId} attempt ${attempt + 1} failed:`, err);
        if (attempt < MAX_SECTION_RETRIES - 1) {
          await new Promise(r => setTimeout(r, SECTION_RETRY_BASE_MS * Math.pow(2, attempt)));
        }
      }
    }

    const title = SECTION_BATCHES.find(s => s.id === sectionId)?.title || sectionId;
    return { sectionId, content: `## ${title}\n\nThis section could not be generated. Please try again later.\n` };
  }

  /** Assemble final document from generated sections in display order */
  private assembleDocument(brandName: string, generatedSections: Record<string, string>): string {
    const generatedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    let document = `# ${brandName} — Brand Strategy Document\n\n*Generated using the IDEA Strategic Brand Framework™*\n*${generatedDate}*\n\n---\n`;

    for (const section of [...SECTION_BATCHES].sort((a, b) => a.order - b.order)) {
      const content = generatedSections[section.id];
      if (content) document += '\n' + content + '\n\n---\n';
    }
    return document;
  }

  /** Collect avatar field values from the V2 chapter workflow */
  private async collectAvatarFieldValues(userId: string): Promise<Record<string, string>> {
    try {
      const { data: avatars, error: avatarError } = await supabase
        .from('avatars')
        .select('id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (avatarError || !avatars?.length) return {};

      const { data: fieldValues, error: fieldError } = await supabase
        .from('avatar_field_values')
        .select('field_id, field_value')
        .eq('avatar_id', avatars[0].id);

      if (fieldError || !fieldValues) return {};

      const result: Record<string, string> = {};
      for (const row of fieldValues) {
        if (row.field_value) result[row.field_id] = row.field_value;
      }
      return result;
    } catch (error) {
      console.error('Failed to collect avatar field values:', error);
      return {};
    }
  }

  private generateFilename(companyName: string): string {
    const slug = (companyName || 'brand-strategy').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${slug}-brand-strategy-${new Date().toISOString().split('T')[0]}.md`;
  }

  private generateMetadata(userId: string, data: AggregatedData): ExportMetadata {
    const completionStats = Object.values(data.metadata.completionStats);
    const avgCompletion = completionStats.length > 0
      ? Math.round(completionStats.reduce((sum, val) => sum + val, 0) / completionStats.length)
      : 0;

    return {
      exportVersion: EXPORT_SCHEMA_VERSION,
      generatedAt: new Date(),
      userId,
      dataSources: {
        knowledgeEntries: data.metadata.totalEntries,
        chatSessions: data.chatSessions.length,
        chatMessages: data.chatSessions.reduce((sum, s) => sum + s.messages.length, 0),
        completionPercentage: avgCompletion,
      },
    };
  }

  createDownloadableFile(markdown: string): Blob {
    return new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  }

  downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

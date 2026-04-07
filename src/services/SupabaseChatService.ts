/**
 * SupabaseChatService
 * Orchestrator implementing IChatService by delegating to focused sub-services.
 *
 * Sub-services:
 * - ChatMessageService: message CRUD
 * - ChatSessionService: session CRUD
 * - ChatTitleService: AI title generation
 * - ChatEdgeFunctionService: auth, document checks, edge function calls
 */

import { IChatService } from './interfaces/IChatService';
import { ChatMessageService } from './chat/ChatMessageService';
import { ChatSessionService } from './chat/ChatSessionService';
import { ChatTitleService } from './chat/ChatTitleService';
import { ChatEdgeFunctionService, CHAT_CONSTANTS } from './chat/ChatEdgeFunctionService';
import { parseSSEStream } from './chat/ChatStreamParser';
import { forceSyncUserData } from '@/lib/knowledge-base/sync-service-instance';
import { supabase } from '@/integrations/supabase/client';
import {
  ChatMessage,
  ChatMessageCreate,
  ChatResponse,
  ChatbotType,
  ChatSession,
  ChatSessionCreate,
  ChatSessionUpdate,
} from '@/types/chat';

export class SupabaseChatService implements IChatService {
  private chatbotType: ChatbotType = 'idea-framework-consultant';
  private currentSessionId: string | undefined;
  private competitiveInsightsContext: string | null = null;

  private messageService = new ChatMessageService();
  private sessionService = new ChatSessionService();
  private titleService = new ChatTitleService();
  private edgeFunctionService = new ChatEdgeFunctionService();

  /**
   * Set competitive analysis context to be included in chat messages.
   */
  setCompetitiveInsightsContext(context: string | null): void {
    this.competitiveInsightsContext = context;
  }

  setChatbotType(chatbotType: ChatbotType): void {
    this.chatbotType = chatbotType;
  }

  setCurrentSession(sessionId: string | undefined): void {
    this.currentSessionId = sessionId;
  }

  getCurrentSessionId(): string | undefined {
    return this.currentSessionId;
  }

  // ==========================================
  // Core messaging
  // ==========================================

  async sendMessage(message: ChatMessageCreate): Promise<ChatResponse> {
    const userId = await this.getUserId();
    const chatbotType = message.chatbot_type || this.chatbotType;
    const sessionId = message.session_id || this.currentSessionId;

    console.log('📤 Sending message:', { userId, chatbotType, messageLength: message.content.length });

    // Sync local data so edge function has latest knowledge base
    await this.syncLocalData(userId);

    // 1. Save user message
    const { data: _userMsg, error: saveError } = await this.messageService.saveMessage({
      user_id: userId,
      role: message.role,
      content: message.content,
      chatbot_type: chatbotType,
      session_id: sessionId,
      chapter_id: message.chapter_id,
      chapter_metadata: message.chapter_metadata,
      metadata: message.metadata,
    });
    if (saveError) throw saveError;

    // 2. Auto-update session title for first message
    if (sessionId) {
      await this.titleService.maybeUpdateSessionTitle(sessionId, message.content);
    }

    // 3. Prepare edge function call
    const recentMessages = await this.getRecentMessages(CHAT_CONSTANTS.RECENT_MESSAGES_COUNT);
    const authSession = await this.edgeFunctionService.getAuthSession();
    const hasUploadedDocuments = await this.edgeFunctionService.checkUploadedDocuments(userId);

    const body = this.edgeFunctionService.buildRequestBody({
      message: message.content,
      chapterContext: message.chapterContext,
      competitiveInsights: this.competitiveInsightsContext,
      metadata: message.metadata,
      hasUploadedDocuments,
      chatHistory: recentMessages.map(msg => ({ role: msg.role, content: msg.content })),
    });

    console.log('📨 Edge function request:', {
      hasUploadedDocuments,
      metadataKeys: Object.keys(body.metadata as Record<string, unknown> || {}),
    });

    // 4. Call edge function
    const responseData = await this.edgeFunctionService.callConsultant(body, authSession.access_token);

    // 5. Handle extracted fields
    const extractedFields = responseData.extractedFields || [];
    if (extractedFields.length > 0) {
      console.log('📝 Extracted fields (tool call):', extractedFields.map(f => f.identifier));
    }

    // 6. Save assistant response
    const { data: assistantMessage, error: assistantError } = await this.messageService.saveMessage({
      user_id: userId,
      role: 'assistant',
      content: responseData.response,
      chatbot_type: chatbotType,
      session_id: sessionId,
      chapter_id: message.chapter_id,
      chapter_metadata: message.chapter_metadata,
      metadata: {
        suggestions: responseData.suggestions,
        sources: responseData.sources,
        extractedFields,
      },
    });
    if (assistantError) throw assistantError;

    // 7. Generate AI title (non-blocking)
    const titlePromise = sessionId
      ? this.titleService
          .generateSessionTitle(sessionId, message.content, responseData.response)
          .then(() => undefined)
          .catch(() => undefined)
      : undefined;

    return {
      message: assistantMessage!,
      suggestions: responseData.suggestions,
      sources: responseData.sources,
      extractedFields,
      titlePromise,
    };
  }

  async sendMessageStreaming(
    message: ChatMessageCreate,
    callbacks: {
      onTextDelta: (delta: string) => void;
      onExtractedFields: (fields: Array<{ identifier: string; value: unknown; confidence: number; source: string; context?: string }>) => void;
      onComplete: (responseId?: string) => void;
      onError: (error: Error) => void;
    }
  ): Promise<void> {
    const userId = await this.getUserId();
    const chatbotType = message.chatbot_type || this.chatbotType;
    const sessionId = message.session_id || this.currentSessionId;

    // Save user message
    const { error: saveError } = await this.messageService.saveMessage({
      user_id: userId,
      role: message.role,
      content: message.content,
      chatbot_type: chatbotType,
      session_id: sessionId,
      chapter_id: message.chapter_id,
      chapter_metadata: message.chapter_metadata,
      metadata: message.metadata,
    });
    if (saveError) throw saveError;

    // Auto-update session title
    if (sessionId) {
      await this.titleService.maybeUpdateSessionTitle(sessionId, message.content);
    }

    // Prepare edge function call
    const authSession = await this.edgeFunctionService.getAuthSession();
    const hasUploadedDocuments = await this.edgeFunctionService.checkUploadedDocuments(userId);

    const chatHistory = (await this.getRecentMessages(CHAT_CONSTANTS.RECENT_MESSAGES_COUNT)).map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const body = this.edgeFunctionService.buildRequestBody({
      message: message.content,
      chapterContext: message.chapterContext,
      competitiveInsights: this.competitiveInsightsContext,
      metadata: message.metadata,
      hasUploadedDocuments,
      chatHistory,
      stream: true,
    });

    // Call streaming edge function
    const response = await this.edgeFunctionService.callConsultantStreaming(
      body,
      authSession.access_token
    );

    // Parse SSE stream
    const reader = response.body!.getReader();
    let streamError = false;
    const result = await parseSSEStream(reader, {
      onTextDelta: callbacks.onTextDelta,
      onExtractedFields: callbacks.onExtractedFields,
      onError: (err) => {
        streamError = true;
        callbacks.onError(err);
      },
    });

    // Don't save an empty assistant message if the stream errored
    if (streamError && !result.fullText.trim()) {
      console.warn('Stream error with no text output — skipping assistant message save');
      return;
    }

    // Fallback: if model produced only tool calls with no text, generate a summary
    let assistantContent = result.fullText;
    if (!assistantContent.trim() && result.extractedFields.length > 0) {
      const fieldNames = result.extractedFields.map(f => f.identifier.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim());
      assistantContent = `I found ${result.extractedFields.length} field${result.extractedFields.length !== 1 ? 's' : ''} from your input: ${fieldNames.join(', ')}. These have been added to your brand profile.`;
      // Push fallback text to the UI so the user sees it
      callbacks.onTextDelta(assistantContent);
    }

    // Don't save empty assistant messages (stream ended without text or fields)
    if (!assistantContent.trim()) {
      console.warn('Stream completed with no text output — skipping assistant message save');
      callbacks.onError(new Error('No response received from consultant'));
      return;
    }

    // Save assistant response
    const { error: assistantSaveError } = await this.messageService.saveMessage({
      user_id: userId,
      role: 'assistant',
      content: assistantContent,
      chatbot_type: chatbotType,
      session_id: sessionId,
      chapter_id: message.chapter_id,
      chapter_metadata: message.chapter_metadata,
      metadata: { extractedFields: result.extractedFields },
    });

    if (assistantSaveError) {
      console.error('[sendMessageStreaming] Failed to save assistant message:', assistantSaveError);
      callbacks.onError(assistantSaveError);
      return;
    }

    // Generate title for new sessions
    if (sessionId) {
      this.titleService
        .generateSessionTitle(sessionId, message.content, result.fullText)
        .catch(() => {});
    }

    callbacks.onComplete(result.responseId);
  }

  // ==========================================
  // Message queries (delegate to messageService)
  // ==========================================

  async getChatHistory(limit: number = CHAT_CONSTANTS.DEFAULT_HISTORY_LIMIT): Promise<ChatMessage[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.messageService.getAllMessages(
      userId,
      this.chatbotType,
      limit,
      this.currentSessionId
    );
    if (error) throw error;
    return data || [];
  }

  async clearChatHistory(): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error('Cannot clear chat history: No active session');
    }
    const userId = await this.getUserId();
    const { error } = await this.messageService.clearMessages(
      userId,
      this.chatbotType,
      this.currentSessionId
    );
    if (error) throw error;
  }

  async getRecentMessages(count: number): Promise<ChatMessage[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.messageService.getRecentMessages(
      userId,
      this.chatbotType,
      count,
      this.currentSessionId
    );
    if (error) throw error;
    return data || [];
  }

  // ==========================================
  // Session management (delegate to sessionService)
  // ==========================================

  async createSession(sessionData?: ChatSessionCreate): Promise<ChatSession> {
    const userId = await this.getUserId();
    const { data, error } = await this.sessionService.createSession(
      userId,
      this.chatbotType,
      sessionData
    );
    if (error) throw error;
    return data!;
  }

  async getSessions(): Promise<ChatSession[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.sessionService.getSessions(userId, this.chatbotType);
    if (error) throw error;
    return data || [];
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const userId = await this.getUserId();
    const { data, error } = await this.sessionService.getSession(sessionId, userId);
    if (error) throw error;
    return data;
  }

  async updateSession(sessionId: string, update: ChatSessionUpdate): Promise<ChatSession> {
    const userId = await this.getUserId();
    const { data, error } = await this.sessionService.updateSession(sessionId, userId, update);
    if (error) throw error;
    return data!;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const userId = await this.getUserId();
    const { error } = await this.sessionService.deleteSession(sessionId, userId);
    if (error) throw error;
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = undefined;
    }
  }

  async getSessionMessages(sessionId: string, limit: number = CHAT_CONSTANTS.DEFAULT_HISTORY_LIMIT): Promise<ChatMessage[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.messageService.getSessionMessages(userId, sessionId, limit);
    if (error) throw error;
    return data || [];
  }

  // ==========================================
  // Title management (delegate to titleService)
  // ==========================================

  async generateSessionTitle(sessionId: string, userMessage: string, assistantResponse: string): Promise<void> {
    await this.titleService.generateSessionTitle(sessionId, userMessage, assistantResponse);
  }

  async regenerateSessionTitle(sessionId: string): Promise<string | null> {
    const { data } = await this.titleService.regenerateSessionTitle(sessionId);
    return data;
  }

  // ==========================================
  // Private helpers
  // ==========================================

  private async getUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return user.id;
  }

  private async syncLocalData(userId: string): Promise<void> {
    console.log('🔄 Syncing local data to Supabase...');
    try {
      await forceSyncUserData(userId);
      console.log('✅ Sync completed');
    } catch (error) {
      console.warn('⚠️ Sync failed, continuing anyway:', error);
    }
  }
}

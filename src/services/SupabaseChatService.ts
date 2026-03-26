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

/**
 * Context object prepared before calling the edge function.
 * Shared by both sendMessage() and sendMessageStreaming().
 */
interface MessageContext {
  userId: string;
  chatbotType: ChatbotType;
  sessionId: string | undefined;
  authToken: string;
  body: Record<string, unknown>;
}

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
    const ctx = await this.prepareMessageContext(message);

    console.log('📤 Sending message:', { userId: ctx.userId, chatbotType: ctx.chatbotType, messageLength: message.content.length });

    // Sync local data so edge function has latest knowledge base
    await this.syncLocalData(ctx.userId);

    console.log('📨 Edge function request:', {
      hasUploadedDocuments: (ctx.body.metadata as Record<string, unknown>)?.hasUploadedDocuments,
      metadataKeys: Object.keys(ctx.body.metadata as Record<string, unknown> || {}),
    });

    // Call edge function
    const responseData = await this.edgeFunctionService.callConsultant(ctx.body, ctx.authToken);

    // Save response ID for chaining
    if (ctx.sessionId && responseData.responseId) {
      await this.edgeFunctionService.saveResponseId(ctx.sessionId, responseData.responseId);
    }

    // Handle extracted fields
    const extractedFields = responseData.extractedFields || [];
    if (extractedFields.length > 0) {
      console.log('📝 Extracted fields (tool call):', extractedFields.map(f => f.identifier));
    }

    // Save assistant response
    const { data: assistantMessage, error: assistantError } = await this.messageService.saveMessage({
      user_id: ctx.userId,
      role: 'assistant',
      content: responseData.response,
      chatbot_type: ctx.chatbotType,
      session_id: ctx.sessionId,
      chapter_id: message.chapter_id,
      chapter_metadata: message.chapter_metadata,
      metadata: {
        suggestions: responseData.suggestions,
        sources: responseData.sources,
        extractedFields,
      },
    });
    if (assistantError) throw assistantError;

    // Generate AI title (non-blocking)
    const titlePromise = ctx.sessionId
      ? this.titleService
          .generateSessionTitle(ctx.sessionId, message.content, responseData.response)
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
    const ctx = await this.prepareMessageContext(message, true);

    // Call streaming edge function
    const response = await this.edgeFunctionService.callConsultantStreaming(
      ctx.body,
      ctx.authToken
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
    await this.messageService.saveMessage({
      user_id: ctx.userId,
      role: 'assistant',
      content: assistantContent,
      chatbot_type: ctx.chatbotType,
      session_id: ctx.sessionId,
      chapter_id: message.chapter_id,
      chapter_metadata: message.chapter_metadata,
      metadata: { extractedFields: result.extractedFields },
    });

    // Save response ID for chaining
    if (ctx.sessionId && result.responseId) {
      await this.edgeFunctionService.saveResponseId(ctx.sessionId, result.responseId);
    }

    // Generate title for new sessions
    if (ctx.sessionId) {
      this.titleService
        .generateSessionTitle(ctx.sessionId, message.content, result.fullText)
        .catch(() => {});
    }

    callbacks.onComplete(result.responseId);
  }

  // ==========================================
  // Message queries (delegate to messageService)
  // ==========================================

  async getChatHistory(limit: number = CHAT_CONSTANTS.DEFAULT_HISTORY_LIMIT): Promise<ChatMessage[]> {
    return this.withUserId((userId) =>
      this.messageService.getAllMessages(userId, this.chatbotType, limit, this.currentSessionId)
    , []);
  }

  async clearChatHistory(): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error('Cannot clear chat history: No active session');
    }
    const sessionId = this.currentSessionId;
    await this.withUserId((userId) =>
      this.messageService.clearMessages(userId, this.chatbotType, sessionId)
    );
  }

  async getRecentMessages(count: number): Promise<ChatMessage[]> {
    return this.withUserId((userId) =>
      this.messageService.getRecentMessages(userId, this.chatbotType, count, this.currentSessionId)
    , []);
  }

  // ==========================================
  // Session management (delegate to sessionService)
  // ==========================================

  async createSession(sessionData?: ChatSessionCreate): Promise<ChatSession> {
    return this.withUserId((userId) =>
      this.sessionService.createSession(userId, this.chatbotType, sessionData)
    );
  }

  async getSessions(): Promise<ChatSession[]> {
    return this.withUserId((userId) =>
      this.sessionService.getSessions(userId, this.chatbotType)
    , []);
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    return this.withUserId((userId) =>
      this.sessionService.getSession(sessionId, userId)
    , null);
  }

  async updateSession(sessionId: string, update: ChatSessionUpdate): Promise<ChatSession> {
    return this.withUserId((userId) =>
      this.sessionService.updateSession(sessionId, userId, update)
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.withUserId((userId) =>
      this.sessionService.deleteSession(sessionId, userId)
    );
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = undefined;
    }
  }

  async getSessionMessages(sessionId: string, limit: number = CHAT_CONSTANTS.DEFAULT_HISTORY_LIMIT): Promise<ChatMessage[]> {
    return this.withUserId((userId) =>
      this.messageService.getSessionMessages(userId, sessionId, limit)
    , []);
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

  /**
   * Delegate to a sub-service method that returns { data, error }.
   * Handles getUserId + error checking + default value in one place.
   *
   * @param operation - Async function receiving userId and returning { data, error }
   * @param defaultValue - Value to return when data is null/undefined (default: throws if null)
   */
  private async withUserId<T>(
    operation: (userId: string) => Promise<{ data: T | null; error: Error | null }>,
    defaultValue?: T
  ): Promise<T> {
    const userId = await this.getUserId();
    const { data, error } = await operation(userId);
    if (error) throw error;
    if (data === null || data === undefined) {
      if (defaultValue !== undefined) return defaultValue;
      return data as T;
    }
    return data;
  }

  /**
   * Prepare shared context for both sendMessage and sendMessageStreaming.
   * Saves the user message, updates session title, and builds the edge function request body.
   *
   * @param message - The chat message to send
   * @param stream - Whether to request streaming response
   * @returns Context object with userId, chatbotType, sessionId, authToken, and request body
   */
  private async prepareMessageContext(message: ChatMessageCreate, stream?: boolean): Promise<MessageContext> {
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

    // Auto-update session title for first message
    if (sessionId) {
      await this.titleService.maybeUpdateSessionTitle(sessionId, message.content);
    }

    // Gather edge function prerequisites in parallel
    const [previousResponseId, authSession, hasUploadedDocuments] = await Promise.all([
      sessionId
        ? this.edgeFunctionService.lookupPreviousResponseId(sessionId)
        : Promise.resolve(undefined),
      this.edgeFunctionService.getAuthSession(),
      this.edgeFunctionService.checkUploadedDocuments(userId),
    ]);

    const chatHistory = !previousResponseId
      ? (await this.getRecentMessages(CHAT_CONSTANTS.RECENT_MESSAGES_COUNT)).map(msg => ({
          role: msg.role,
          content: msg.content,
        }))
      : undefined;

    const body = this.edgeFunctionService.buildRequestBody({
      message: message.content,
      chapterContext: message.chapterContext,
      competitiveInsights: this.competitiveInsightsContext,
      metadata: message.metadata,
      hasUploadedDocuments,
      previousResponseId,
      chatHistory,
      stream,
    });

    return { userId, chatbotType, sessionId, authToken: authSession.access_token, body };
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

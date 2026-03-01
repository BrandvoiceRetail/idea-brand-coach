/**
 * SupabaseChatService
 * Implements IChatService for Supabase backend
 *
 * Orchestrates chat operations by delegating to specialized services:
 * - ChatMessageService: Message CRUD operations
 * - ChatSessionService: Session CRUD operations
 * - ChatTitleService: Title generation
 */

import { supabase } from '@/integrations/supabase/client';
import { IChatService } from './interfaces/IChatService';
import {
  ChatMessage,
  ChatMessageCreate,
  ChatResponse,
  ChatbotType,
  ChatSession,
  ChatSessionCreate,
  ChatSessionUpdate,
} from '@/types/chat';
import { forceSyncUserData } from '@/lib/knowledge-base/sync-service-instance';
import { ChatMessageService } from './chat/ChatMessageService';
import { ChatSessionService } from './chat/ChatSessionService';
import { ChatTitleService } from './chat/ChatTitleService';

export class SupabaseChatService implements IChatService {
  private chatbotType: ChatbotType = 'idea-framework-consultant';
  private currentSessionId: string | undefined;
  private useSystemKB: boolean = true;

  // Injected services
  private messageService: ChatMessageService;
  private sessionService: ChatSessionService;
  private titleService: ChatTitleService;

  constructor(
    messageService?: ChatMessageService,
    sessionService?: ChatSessionService,
    titleService?: ChatTitleService
  ) {
    // Allow dependency injection for testing, otherwise use defaults
    this.messageService = messageService || new ChatMessageService();
    this.sessionService = sessionService || new ChatSessionService();
    this.titleService = titleService || new ChatTitleService();
  }

  /**
   * Set the chatbot type for filtering messages
   */
  setChatbotType(chatbotType: ChatbotType): void {
    this.chatbotType = chatbotType;
  }

  /**
   * Set the current active session for message operations
   */
  setCurrentSession(sessionId: string | undefined): void {
    this.currentSessionId = sessionId;
  }

  /**
   * Get the current active session ID
   */
  getCurrentSessionId(): string | undefined {
    return this.currentSessionId;
  }

  /**
   * Enable/disable System KB integration (uses test function)
   * @deprecated System KB is now always enabled
   */
  setUseSystemKB(enabled: boolean): void {
    // No-op: System KB is always enabled
    console.log('[ChatService] System KB integration: ALWAYS ENABLED');
  }

  /**
   * Check if System KB integration is enabled
   * @deprecated System KB is now always enabled
   */
  getUseSystemKB(): boolean {
    return true; // Always enabled
  }

  /**
   * Get the edge function name for the current chatbot type
   * Always uses the test function with System KB enabled
   */
  private getEdgeFunctionName(): string {
    const functionName = 'idea-framework-consultant-test';
    console.log(`[ChatService] Using edge function: ${functionName} (System KB: enabled)`);
    return functionName;
  }

  /**
   * Get current authenticated user ID
   * @throws Error if user is not authenticated
   */
  private async getUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return user.id;
  }

  async sendMessage(message: ChatMessageCreate): Promise<ChatResponse> {
    const userId = await this.getUserId();
    const chatbotType = message.chatbot_type || this.chatbotType;

    console.log('📤 Sending message:', {
      userId,
      chatbotType,
      messageLength: message.content.length
    });

    // 0. Force sync all local data to Supabase before sending
    console.log('🔄 Syncing local data to Supabase...');
    try {
      await forceSyncUserData(userId);
      console.log('✅ Sync completed');
    } catch (error) {
      console.warn('⚠️ Sync failed, continuing anyway:', error);
    }

    // Use provided session_id or current session
    const sessionId = message.session_id || this.currentSessionId;
    console.log('[sendMessage] Using session_id:', sessionId);

    // 1. Save user message to database (delegate to messageService)
    const userMessageResult = await this.messageService.saveUserMessage(
      userId,
      message.content,
      chatbotType,
      sessionId,
      message.metadata
    );

    if (userMessageResult.error) throw userMessageResult.error;

    // Auto-update session title if this is the first message (delegate to titleService)
    if (sessionId) {
      await this.titleService.maybeUpdateSessionTitle(sessionId, message.content);
    }

    // 2. Get recent chat history for context (delegate to messageService)
    const recentMessages = await this.getRecentMessages(10);

    // 3. Call appropriate Edge Function
    const edgeFunctionName = this.getEdgeFunctionName();
    console.log(`🤖 Calling ${edgeFunctionName} Edge Function...`);

    // Get current session to pass auth token explicitly
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session found');
    }

    const { data: responseData, error: functionError } = await supabase.functions.invoke(
      edgeFunctionName,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          message: message.content,
          chat_history: recentMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
        },
      }
    );

    if (functionError) {
      console.error('❌ Edge Function error:', functionError);
      throw functionError;
    }

    console.log('✅ Received response:', {
      responseLength: responseData?.response?.length || 0,
      hasSuggestions: !!responseData?.suggestions,
      hasSources: !!responseData?.sources,
    });

    // 4. Save assistant response to database (delegate to messageService)
    const assistantMessageResult = await this.messageService.saveAssistantMessage(
      userId,
      responseData.response,
      chatbotType,
      sessionId,
      {
        suggestions: responseData.suggestions,
        sources: responseData.sources,
      }
    );

    if (assistantMessageResult.error) throw assistantMessageResult.error;
    if (!assistantMessageResult.data) throw new Error('Failed to save assistant message');

    // Generate AI title for new sessions (delegate to titleService)
    const titlePromise = sessionId
      ? this.titleService.generateSessionTitle(sessionId, message.content, responseData.response).catch(() => {
          // Silently ignore - title generation is not critical
        })
      : undefined;

    return {
      message: assistantMessageResult.data,
      suggestions: responseData.suggestions,
      sources: responseData.sources,
      titlePromise,
    };
  }

  async getChatHistory(limit: number = 50): Promise<ChatMessage[]> {
    const userId = await this.getUserId();

    // Delegate to messageService
    const result = await this.messageService.getAllMessages(
      userId,
      this.chatbotType,
      limit,
      this.currentSessionId
    );

    if (result.error) throw result.error;
    return result.data || [];
  }

  async clearChatHistory(): Promise<void> {
    const userId = await this.getUserId();

    // SAFETY: Only clear if we have a current session ID
    if (!this.currentSessionId) {
      throw new Error('Cannot clear chat history: No active session');
    }

    console.log('🗑️ Clearing chat history for session:', this.currentSessionId);

    // Delegate to messageService
    const result = await this.messageService.clearMessages(
      userId,
      this.chatbotType,
      this.currentSessionId
    );

    if (result.error) throw result.error;
  }

  async getRecentMessages(count: number): Promise<ChatMessage[]> {
    const userId = await this.getUserId();

    // Delegate to messageService
    const result = await this.messageService.getRecentMessages(
      userId,
      this.chatbotType,
      count,
      this.currentSessionId
    );

    if (result.error) throw result.error;
    return result.data || [];
  }

  // ==========================================
  // Session Management Methods
  // ==========================================

  async createSession(sessionData?: ChatSessionCreate): Promise<ChatSession> {
    const userId = await this.getUserId();

    // Delegate to sessionService
    const result = await this.sessionService.createSession(
      userId,
      this.chatbotType,
      sessionData
    );

    if (result.error) throw result.error;
    if (!result.data) throw new Error('Failed to create session');

    return result.data;
  }

  async getSessions(): Promise<ChatSession[]> {
    const userId = await this.getUserId();

    // Delegate to sessionService
    const result = await this.sessionService.getSessions(userId, this.chatbotType);

    if (result.error) throw result.error;
    return result.data || [];
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const userId = await this.getUserId();

    // Delegate to sessionService
    const result = await this.sessionService.getSession(sessionId, userId);

    if (result.error) throw result.error;
    return result.data;
  }

  async updateSession(sessionId: string, update: ChatSessionUpdate): Promise<ChatSession> {
    const userId = await this.getUserId();

    // Delegate to sessionService
    const result = await this.sessionService.updateSession(sessionId, userId, update);

    if (result.error) throw result.error;
    if (!result.data) throw new Error('Failed to update session');

    return result.data;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const userId = await this.getUserId();

    // Delegate to sessionService
    const result = await this.sessionService.deleteSession(sessionId, userId);

    if (result.error) throw result.error;

    // Clear current session if it was deleted
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = undefined;
    }
  }

  async getSessionMessages(sessionId: string, limit: number = 50): Promise<ChatMessage[]> {
    const userId = await this.getUserId();

    // Delegate to messageService
    const result = await this.messageService.getSessionMessages(userId, sessionId, limit);

    if (result.error) throw result.error;
    return result.data || [];
  }

  async generateSessionTitle(sessionId: string, userMessage: string, assistantResponse: string): Promise<void> {
    // Delegate to titleService
    await this.titleService.generateSessionTitle(sessionId, userMessage, assistantResponse);
  }

  async regenerateSessionTitle(sessionId: string): Promise<string | null> {
    // Delegate to titleService
    const result = await this.titleService.regenerateSessionTitle(sessionId);
    return result.data;
  }
}

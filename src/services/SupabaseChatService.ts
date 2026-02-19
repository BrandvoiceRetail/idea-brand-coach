/**
 * SupabaseChatService
 * Implements IChatService for Supabase backend
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
  ConversationType,
} from '@/types/chat';
import { forceSyncUserData } from '@/lib/knowledge-base/sync-service-instance';

export class SupabaseChatService implements IChatService {
  private chatbotType: ChatbotType = 'idea-framework-consultant';
  private currentSessionId: string | undefined;
  private useSystemKB: boolean = true;

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
    // This ensures the edge function has access to all user knowledge base data
    console.log('🔄 Syncing local data to Supabase...');
    try {
      await forceSyncUserData(userId);
      console.log('✅ Sync completed');
    } catch (error) {
      console.warn('⚠️ Sync failed, continuing anyway:', error);
      // Continue even if sync fails - offline data will be used
    }

    // Use provided session_id or current session
    const sessionId = message.session_id || this.currentSessionId;
    console.log('[sendMessage] Using session_id:', sessionId, '(from message:', message.session_id, ', current:', this.currentSessionId, ')');

    // 1. Save user message to database
    const { data: userMessage, error: saveError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        role: message.role,
        content: message.content,
        chatbot_type: chatbotType,
        session_id: sessionId,
        metadata: message.metadata,
      })
      .select()
      .single();

    if (saveError) throw saveError;

    // Auto-update session title if this is the first message
    if (sessionId) {
      await this.maybeUpdateSessionTitle(sessionId, message.content);
    }

    // 2. Get recent chat history for context
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

    // 4. Save assistant response to database
    const { data: assistantMessage, error: assistantError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        role: 'assistant',
        content: responseData.response,
        chatbot_type: chatbotType,
        session_id: sessionId,
        metadata: {
          suggestions: responseData.suggestions,
          sources: responseData.sources,
        },
      })
      .select()
      .single();

    if (assistantError) throw assistantError;

    // Generate AI title for new sessions (return promise for cache invalidation)
    const titlePromise = sessionId
      ? this.generateSessionTitle(sessionId, message.content, responseData.response).catch(() => {
          // Silently ignore - title generation is not critical
        })
      : undefined;

    return {
      message: {
        id: assistantMessage.id,
        user_id: assistantMessage.user_id,
        role: assistantMessage.role as 'assistant',
        content: assistantMessage.content,
        chatbot_type: assistantMessage.chatbot_type as ChatbotType,
        metadata: (assistantMessage.metadata as Record<string, any>) || {},
        created_at: assistantMessage.created_at,
        updated_at: assistantMessage.updated_at,
      },
      suggestions: responseData.suggestions,
      sources: responseData.sources,
      titlePromise,
    };
  }

  async getChatHistory(limit: number = 50): Promise<ChatMessage[]> {
    const userId = await this.getUserId();

    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('chatbot_type', this.chatbotType);

    // Filter by session if set
    if (this.currentSessionId) {
      query = query.eq('session_id', this.currentSessionId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return data.map(item => this.mapMessageFromDb(item));
  }

  async clearChatHistory(): Promise<void> {
    const userId = await this.getUserId();

    // SAFETY: Only clear if we have a current session ID
    // This prevents accidentally clearing all messages across all sessions
    if (!this.currentSessionId) {
      throw new Error('Cannot clear chat history: No active session');
    }

    console.log('🗑️ Clearing chat history for session:', this.currentSessionId);

    // First, get count of messages to be deleted for verification
    const { count: beforeCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('chatbot_type', this.chatbotType)
      .eq('session_id', this.currentSessionId);

    console.log(`📊 Found ${beforeCount || 0} messages to delete`);

    // Delete messages
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', userId)
      .eq('chatbot_type', this.chatbotType)
      .eq('session_id', this.currentSessionId);

    if (error) {
      console.error('❌ Delete failed:', error);
      throw error;
    }

    // Verify deletion
    const { count: afterCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('chatbot_type', this.chatbotType)
      .eq('session_id', this.currentSessionId);

    console.log(`✅ Delete successful! Deleted ${beforeCount || 0} messages. Remaining: ${afterCount || 0}`);

    if (afterCount && afterCount > 0) {
      console.warn('⚠️ Warning: Some messages may not have been deleted');
    }
  }

  async getRecentMessages(count: number): Promise<ChatMessage[]> {
    const userId = await this.getUserId();

    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('chatbot_type', this.chatbotType);

    // Filter by session if set
    if (this.currentSessionId) {
      query = query.eq('session_id', this.currentSessionId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(count);

    if (error) throw error;

    // Reverse to get chronological order
    return data.reverse().map(item => this.mapMessageFromDb(item));
  }

  // ==========================================
  // Session Management Methods
  // ==========================================

  async createSession(sessionData?: ChatSessionCreate): Promise<ChatSession> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        chatbot_type: sessionData?.chatbot_type || this.chatbotType,
        title: sessionData?.title || 'New Chat',
        conversation_type: sessionData?.conversation_type || 'general',
        field_id: sessionData?.field_id,
        field_label: sessionData?.field_label,
        page_context: sessionData?.page_context,
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapSessionFromDb(data);
  }

  async getSessions(): Promise<ChatSession[]> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('chatbot_type', this.chatbotType)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return data.map(item => this.mapSessionFromDb(item));
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.mapSessionFromDb(data);
  }

  async updateSession(sessionId: string, update: ChatSessionUpdate): Promise<ChatSession> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('chat_sessions')
      .update({
        title: update.title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return this.mapSessionFromDb(data);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const userId = await this.getUserId();

    // Messages will be cascade deleted due to FK constraint
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) throw error;

    // Clear current session if it was deleted
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = undefined;
    }
  }

  async getSessionMessages(sessionId: string, limit: number = 50): Promise<ChatMessage[]> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return data.map(item => this.mapMessageFromDb(item));
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  /**
   * Auto-update session title based on first user message
   * Uses a placeholder initially, then generates AI title after response
   */
  private async maybeUpdateSessionTitle(sessionId: string, content: string): Promise<void> {
    try {
      console.log('[maybeUpdateSessionTitle] Checking session:', sessionId);
      // Check if session still has default title
      const session = await this.getSession(sessionId);
      console.log('[maybeUpdateSessionTitle] Session found:', session?.title);

      if (!session || session.title !== 'New Chat') {
        console.log('[maybeUpdateSessionTitle] Skipping - title already set or session not found');
        return;
      }

      // Set a temporary title from first ~40 chars while AI generates better one
      const tempTitle = content.length > 40
        ? content.substring(0, 37) + '...'
        : content;

      console.log('[maybeUpdateSessionTitle] Setting temp title:', tempTitle);
      await this.updateSession(sessionId, { title: tempTitle });
    } catch (error) {
      console.warn('Failed to auto-update session title:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Regenerate session title based on entire conversation history
   * Used when user wants to update title to reflect evolved conversation
   */
  async regenerateSessionTitle(sessionId: string): Promise<string | null> {
    try {
      const messages = await this.getSessionMessages(sessionId, 20);
      if (messages.length === 0) return null;

      // Build conversation summary for title generation
      const conversationSummary = messages
        .slice(-6) // Use last 6 messages for context
        .map(m => `${m.role}: ${m.content.substring(0, 200)}`)
        .join('\n');

      // Get auth session
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) return null;

      // Call edge function to generate title
      const { data, error } = await supabase.functions.invoke('generate-session-title', {
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: {
          user_message: conversationSummary,
          assistant_response: '', // Empty since we're using full conversation
          regenerate: true, // Flag to indicate full conversation context
        },
      });

      if (error) {
        console.warn('Failed to regenerate AI title:', error);
        return null;
      }

      if (data?.title) {
        await this.updateSession(sessionId, { title: data.title });
        console.log('✅ Regenerated session title:', data.title);
        return data.title;
      }

      return null;
    } catch (error) {
      console.warn('Failed to regenerate session title:', error);
      return null;
    }
  }

  /**
   * Generate an AI-powered session title after first exchange
   */
  async generateSessionTitle(sessionId: string, userMessage: string, assistantResponse: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return;

      // Only generate title on first exchange (2 messages = user + assistant)
      // This prevents overwriting manually renamed sessions
      const messages = await this.getSessionMessages(sessionId, 3);
      if (messages.length > 2) {
        console.log('[generateSessionTitle] Skipping - not first exchange (has', messages.length, 'messages)');
        return;
      }

      // Get current session to pass auth token
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) return;

      // Call edge function to generate title
      const { data, error } = await supabase.functions.invoke('generate-session-title', {
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: {
          user_message: userMessage,
          assistant_response: assistantResponse.substring(0, 500), // Limit context size
        },
      });

      if (error) {
        console.warn('Failed to generate AI title:', error);
        return;
      }

      if (data?.title) {
        await this.updateSession(sessionId, { title: data.title });
        console.log('✅ Generated session title:', data.title);
      }
    } catch (error) {
      console.warn('Failed to generate session title:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Map database row to ChatMessage
   */
  private mapMessageFromDb(item: Record<string, unknown>): ChatMessage {
    return {
      id: item.id as string,
      user_id: item.user_id as string,
      session_id: item.session_id as string | undefined,
      role: item.role as 'user' | 'assistant' | 'system',
      content: item.content as string,
      chatbot_type: item.chatbot_type as ChatbotType,
      metadata: (item.metadata as Record<string, unknown>) || {},
      created_at: item.created_at as string,
      updated_at: item.updated_at as string,
    };
  }

  /**
   * Map database row to ChatSession
   */
  private mapSessionFromDb(item: Record<string, unknown>): ChatSession {
    return {
      id: item.id as string,
      user_id: item.user_id as string,
      chatbot_type: item.chatbot_type as ChatbotType,
      title: item.title as string,
      conversation_type: (item.conversation_type as ConversationType) || 'general',
      field_id: item.field_id as string | undefined,
      field_label: item.field_label as string | undefined,
      page_context: item.page_context as string | undefined,
      created_at: item.created_at as string,
      updated_at: item.updated_at as string,
    };
  }
}

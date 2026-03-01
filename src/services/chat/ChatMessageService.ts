/**
 * ChatMessageService
 * Handles CRUD operations for chat messages in Supabase
 *
 * This service provides a focused interface for message persistence,
 * extracted from SupabaseChatService to improve maintainability and testability.
 */

import { supabase } from '@/integrations/supabase/client';
import { ChatMessage, ChatbotType } from '@/types/chat';

/**
 * Parameters for saving a message to the database
 */
export interface SaveMessageParams {
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  chatbot_type: ChatbotType;
  session_id?: string;
  metadata?: Record<string, any>;
}

/**
 * Result type for message operations
 */
export interface MessageResult<T> {
  data: T | null;
  error: Error | null;
}

export class ChatMessageService {
  /**
   * Save a message to the database.
   * Can be used for user, assistant, or system messages.
   *
   * @param params - Message parameters including user_id, role, content, chatbot_type, etc.
   * @returns Promise resolving to MessageResult with saved message or error
   */
  async saveMessage(params: SaveMessageParams): Promise<MessageResult<ChatMessage>> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: params.user_id,
        role: params.role,
        content: params.content,
        chatbot_type: params.chatbot_type,
        session_id: params.session_id,
        metadata: params.metadata,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error as Error };
    }

    return {
      data: this.mapMessageFromDb(data),
      error: null,
    };
  }

  /**
   * Save a user message to the database.
   * Convenience method for saving user messages.
   *
   * @param userId - ID of the user sending the message
   * @param content - Message content text
   * @param chatbotType - Type of chatbot ('idea-framework-consultant')
   * @param sessionId - Optional ID of the chat session
   * @param metadata - Optional metadata object for the message
   * @returns Promise resolving to MessageResult with saved message or error
   */
  async saveUserMessage(
    userId: string,
    content: string,
    chatbotType: ChatbotType,
    sessionId?: string,
    metadata?: Record<string, any>
  ): Promise<MessageResult<ChatMessage>> {
    return this.saveMessage({
      user_id: userId,
      role: 'user',
      content,
      chatbot_type: chatbotType,
      session_id: sessionId,
      metadata,
    });
  }

  /**
   * Save an assistant message to the database.
   * Convenience method for saving assistant responses.
   *
   * @param userId - ID of the user receiving the response
   * @param content - Assistant response text
   * @param chatbotType - Type of chatbot ('idea-framework-consultant')
   * @param sessionId - Optional ID of the chat session
   * @param metadata - Optional metadata object (e.g., sources, suggestions)
   * @returns Promise resolving to MessageResult with saved message or error
   */
  async saveAssistantMessage(
    userId: string,
    content: string,
    chatbotType: ChatbotType,
    sessionId?: string,
    metadata?: Record<string, any>
  ): Promise<MessageResult<ChatMessage>> {
    return this.saveMessage({
      user_id: userId,
      role: 'assistant',
      content,
      chatbot_type: chatbotType,
      session_id: sessionId,
      metadata,
    });
  }

  /**
   * Get recent messages for context building.
   * Fetches in descending order (most recent first) then reverses to
   * return messages in chronological order (oldest first).
   *
   * @param userId - ID of the user who owns the messages
   * @param chatbotType - Type of chatbot to filter by
   * @param count - Number of recent messages to retrieve
   * @param sessionId - Optional session ID to filter messages
   * @returns Promise resolving to MessageResult with array of messages or error
   */
  async getRecentMessages(
    userId: string,
    chatbotType: ChatbotType,
    count: number,
    sessionId?: string
  ): Promise<MessageResult<ChatMessage[]>> {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('chatbot_type', chatbotType);

    // Filter by session if provided
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(count);

    if (error) {
      return { data: null, error: error as Error };
    }

    // Reverse to get chronological order (oldest first)
    const messages = data.reverse().map(item => this.mapMessageFromDb(item));

    return { data: messages, error: null };
  }

  /**
   * Get all messages for a specific session.
   * Returns messages in chronological order (oldest first).
   *
   * @param userId - ID of the user who owns the messages
   * @param sessionId - ID of the session to retrieve messages from
   * @param limit - Maximum number of messages to retrieve (default: 50)
   * @returns Promise resolving to MessageResult with array of messages or error
   */
  async getSessionMessages(
    userId: string,
    sessionId: string,
    limit: number = 50
  ): Promise<MessageResult<ChatMessage[]>> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      return { data: null, error: error as Error };
    }

    const messages = data.map(item => this.mapMessageFromDb(item));

    return { data: messages, error: null };
  }

  /**
   * Get all messages for a user with optional filters.
   * Returns messages in chronological order (oldest first).
   *
   * @param userId - ID of the user who owns the messages
   * @param chatbotType - Type of chatbot to filter by
   * @param limit - Maximum number of messages to retrieve (default: 50)
   * @param sessionId - Optional session ID to filter messages
   * @returns Promise resolving to MessageResult with array of messages or error
   */
  async getAllMessages(
    userId: string,
    chatbotType: ChatbotType,
    limit: number = 50,
    sessionId?: string
  ): Promise<MessageResult<ChatMessage[]>> {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('chatbot_type', chatbotType);

    // Filter by session if provided
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      return { data: null, error: error as Error };
    }

    const messages = data.map(item => this.mapMessageFromDb(item));

    return { data: messages, error: null };
  }

  /**
   * Clear all messages for a specific session.
   * SAFETY: Requires sessionId to prevent accidental deletion of all messages.
   *
   * @param userId - ID of the user who owns the messages
   * @param chatbotType - Type of chatbot to filter by
   * @param sessionId - ID of the session to clear messages from (required for safety)
   * @returns Promise resolving to MessageResult with count of deleted messages or error
   */
  async clearMessages(
    userId: string,
    chatbotType: ChatbotType,
    sessionId: string
  ): Promise<MessageResult<number>> {
    if (!sessionId) {
      return {
        data: null,
        error: new Error('Cannot clear messages: sessionId is required'),
      };
    }

    console.log('🗑️ Clearing chat history for session:', sessionId);

    // First, get count of messages to be deleted for verification
    const { count: beforeCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('chatbot_type', chatbotType)
      .eq('session_id', sessionId);

    console.log(`📊 Found ${beforeCount || 0} messages to delete`);

    // Delete messages
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', userId)
      .eq('chatbot_type', chatbotType)
      .eq('session_id', sessionId);

    if (error) {
      console.error('❌ Delete failed:', error);
      return { data: null, error: error as Error };
    }

    // Verify deletion
    const { count: afterCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('chatbot_type', chatbotType)
      .eq('session_id', sessionId);

    console.log(
      `✅ Delete successful! Deleted ${beforeCount || 0} messages. Remaining: ${afterCount || 0}`
    );

    if (afterCount && afterCount > 0) {
      console.warn('⚠️ Warning: Some messages may not have been deleted');
    }

    return { data: beforeCount || 0, error: null };
  }

  /**
   * Map database row to ChatMessage type.
   * Private helper method for type conversion.
   *
   * @param item - Raw database row object
   * @returns Typed ChatMessage object
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
}

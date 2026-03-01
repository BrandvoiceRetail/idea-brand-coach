/**
 * ChatSessionService
 * Handles CRUD operations for chat sessions in Supabase
 *
 * This service provides a focused interface for session persistence,
 * extracted from SupabaseChatService to improve maintainability and testability.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  ChatSession,
  ChatSessionCreate,
  ChatSessionUpdate,
  ChatbotType,
  ConversationType,
} from '@/types/chat';

/**
 * Result type for session operations
 */
export interface SessionResult<T> {
  data: T | null;
  error: Error | null;
}

export class ChatSessionService {
  /**
   * Create a new chat session.
   *
   * @param userId - ID of the user creating the session
   * @param chatbotType - Type of chatbot for the session
   * @param sessionData - Optional session creation data (title, conversation_type, field context)
   * @returns Promise resolving to SessionResult with created session or error
   */
  async createSession(
    userId: string,
    chatbotType: ChatbotType,
    sessionData?: ChatSessionCreate
  ): Promise<SessionResult<ChatSession>> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        chatbot_type: sessionData?.chatbot_type || chatbotType,
        title: sessionData?.title || 'New Chat',
        conversation_type: sessionData?.conversation_type || 'general',
        field_id: sessionData?.field_id,
        field_label: sessionData?.field_label,
        page_context: sessionData?.page_context,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error as Error };
    }

    return {
      data: this.mapSessionFromDb(data),
      error: null,
    };
  }

  /**
   * Get all chat sessions for a user and chatbot type.
   * Returns sessions ordered by update time (newest first).
   *
   * @param userId - ID of the user who owns the sessions
   * @param chatbotType - Type of chatbot to filter by
   * @returns Promise resolving to SessionResult with array of sessions or error
   */
  async getSessions(
    userId: string,
    chatbotType: ChatbotType
  ): Promise<SessionResult<ChatSession[]>> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('chatbot_type', chatbotType)
      .order('updated_at', { ascending: false });

    if (error) {
      return { data: null, error: error as Error };
    }

    const sessions = data.map(item => this.mapSessionFromDb(item));

    return { data: sessions, error: null };
  }

  /**
   * Get a single session by ID.
   * Returns null if session not found or doesn't belong to user.
   *
   * @param sessionId - ID of the session to retrieve
   * @param userId - ID of the user who owns the session
   * @returns Promise resolving to SessionResult with session or null if not found
   */
  async getSession(
    sessionId: string,
    userId: string
  ): Promise<SessionResult<ChatSession>> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error) {
      // PGRST116 is the "not found" error code from PostgREST
      if (error.code === 'PGRST116') {
        return { data: null, error: null };
      }
      return { data: null, error: error as Error };
    }

    return {
      data: this.mapSessionFromDb(data),
      error: null,
    };
  }

  /**
   * Update a chat session (e.g., rename title).
   * Automatically updates the updated_at timestamp.
   *
   * @param sessionId - ID of the session to update
   * @param userId - ID of the user who owns the session
   * @param update - Update data (currently supports title)
   * @returns Promise resolving to SessionResult with updated session or error
   */
  async updateSession(
    sessionId: string,
    userId: string,
    update: ChatSessionUpdate
  ): Promise<SessionResult<ChatSession>> {
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

    if (error) {
      return { data: null, error: error as Error };
    }

    return {
      data: this.mapSessionFromDb(data),
      error: null,
    };
  }

  /**
   * Delete a chat session and all its messages.
   * Messages will be cascade deleted due to FK constraint.
   *
   * @param sessionId - ID of the session to delete
   * @param userId - ID of the user who owns the session
   * @returns Promise resolving to SessionResult when session is deleted or error
   */
  async deleteSession(
    sessionId: string,
    userId: string
  ): Promise<SessionResult<void>> {
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) {
      return { data: null, error: error as Error };
    }

    return { data: undefined, error: null };
  }

  /**
   * Map database row to ChatSession type.
   * Private helper method for type conversion.
   *
   * @param item - Raw database row object
   * @returns Typed ChatSession object
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

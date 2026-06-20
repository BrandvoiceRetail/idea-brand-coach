/**
 * ChatSessionService
 * Handles CRUD operations for chat sessions in Supabase
 *
 * This service provides a focused interface for session persistence,
 * extracted from SupabaseChatService to improve maintainability and testability.
 */

import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { getPostHogDistinctId } from '@/lib/posthogClient';
import {
  ChatSession,
  ChatSessionCreate,
  ChatSessionUpdate,
  ChatbotType,
  ConversationType,
} from '@/types/chat';
import type { ChapterId, ChapterMetadata } from '@/types/chapter';

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
   * When `avatarId` is supplied the session is stamped with it (the retrieval
   * anchor — multi-avatar design §2.1) and the avatar's `brand_id` is resolved
   * server-side and denormalized onto the thread. The avatar is taken as an
   * explicit argument (not from `sessionData`) so callers can't desync the
   * thread from the active avatar.
   *
   * @param userId - ID of the user creating the session
   * @param chatbotType - Type of chatbot for the session
   * @param sessionData - Optional session creation data (title, conversation_type, field context)
   * @param avatarId - Avatar to scope the thread to (optional → brand-level thread)
   * @returns Promise resolving to SessionResult with created session or error
   */
  async createSession(
    userId: string,
    chatbotType: ChatbotType,
    sessionData?: ChatSessionCreate,
    avatarId?: string
  ): Promise<SessionResult<ChatSession>> {
    // Resolve the avatar's brand so the thread carries both scope columns.
    let brandId: string | null = null;
    if (avatarId) {
      const resolved = await this.resolveBrandId(avatarId, userId);
      if (resolved.error) {
        return { data: null, error: resolved.error };
      }
      brandId = resolved.brandId;
    }

    // posthog_distinct_id threads this conversation back to the user's PostHog funnel +
    // replay (parity with feedback_events); avatar_id/brand_id carry the two-tier scope.
    const row = {
      user_id: userId,
      avatar_id: avatarId ?? null,
      brand_id: brandId,
      chatbot_type: sessionData?.chatbot_type || chatbotType,
      title: sessionData?.title || 'New Chat',
      conversation_type: sessionData?.conversation_type || 'general',
      field_id: sessionData?.field_id,
      field_label: sessionData?.field_label,
      page_context: sessionData?.page_context,
      chapter_id: sessionData?.chapter_id,
      chapter_metadata: sessionData?.chapter_metadata,
      posthog_distinct_id: getPostHogDistinctId(),
    };
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert(row as unknown as TablesInsert<'chat_sessions'>)
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
   * Ensure an open thread exists for the given avatar and return it.
   * Picks the most-recently-updated existing session for the avatar, or creates
   * a fresh one. This is the session-follows-avatar contract (design §4.1):
   * switching to an avatar lands the user on that avatar's conversation.
   *
   * @param userId - ID of the user
   * @param chatbotType - Type of chatbot
   * @param avatarId - Avatar to find/create a thread for
   * @returns Promise resolving to SessionResult with the existing-or-new session
   */
  async ensureSessionForAvatar(
    userId: string,
    chatbotType: ChatbotType,
    avatarId: string
  ): Promise<SessionResult<ChatSession>> {
    const { data: existing, error: listError } = await this.getSessions(
      userId,
      chatbotType,
      avatarId
    );
    if (listError) {
      return { data: null, error: listError };
    }

    // Prefer the most recent general thread for this avatar (getSessions is
    // already ordered newest-first); skip field-scoped threads.
    const openThread = existing?.find((s) => s.conversation_type === 'general');
    if (openThread) {
      return { data: openThread, error: null };
    }

    return this.createSession(userId, chatbotType, undefined, avatarId);
  }

  /**
   * Resolve an avatar's brand_id, verifying the avatar belongs to the user.
   * `avatars.brand_id` is NOT NULL (P1), so a found row always has a brand.
   */
  private async resolveBrandId(
    avatarId: string,
    userId: string
  ): Promise<{ brandId: string | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('avatars')
      .select('brand_id')
      .eq('id', avatarId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return { brandId: null, error: error as Error };
    }
    if (!data) {
      return { brandId: null, error: new Error('Avatar not found for current user') };
    }
    return { brandId: data.brand_id, error: null };
  }

  /**
   * Get all chat sessions for a user and chatbot type.
   * Returns sessions ordered by update time (newest first).
   *
   * When `avatarId` is supplied, sessions are scoped to that avatar (the
   * session-follows-avatar contract, design §4.1). Omitting it (or passing
   * `undefined`) returns all of the user's threads for the chatbot type.
   *
   * @param userId - ID of the user who owns the sessions
   * @param chatbotType - Type of chatbot to filter by
   * @param avatarId - Optional avatar to scope sessions to
   * @returns Promise resolving to SessionResult with array of sessions or error
   */
  async getSessions(
    userId: string,
    chatbotType: ChatbotType,
    avatarId?: string
  ): Promise<SessionResult<ChatSession[]>> {
    let query = supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('chatbot_type', chatbotType);

    if (avatarId) {
      query = query.eq('avatar_id', avatarId);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

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
    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (update.title !== undefined) updateData.title = update.title;
    if (update.chapter_id !== undefined) updateData.chapter_id = update.chapter_id;
    if (update.chapter_metadata !== undefined) updateData.chapter_metadata = update.chapter_metadata;

    const { data, error } = await supabase
      .from('chat_sessions')
      .update(updateData)
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
      avatar_id: (item.avatar_id as string | null) ?? null,
      brand_id: (item.brand_id as string | null) ?? null,
      chatbot_type: item.chatbot_type as ChatbotType,
      title: item.title as string,
      conversation_type: (item.conversation_type as ConversationType) || 'general',
      field_id: item.field_id as string | undefined,
      field_label: item.field_label as string | undefined,
      page_context: item.page_context as string | undefined,
      chapter_id: item.chapter_id as ChapterId | undefined,
      chapter_metadata: item.chapter_metadata as ChapterMetadata | undefined,
      created_at: item.created_at as string,
      updated_at: item.updated_at as string,
    };
  }
}

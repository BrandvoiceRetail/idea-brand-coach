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
import type { ChapterId, ChapterMetadata } from '@/types/chapter';
import type { TablesInsert } from '@/integrations/supabase/types';

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
    avatarId?: string,
    contextAvatarIds?: string[]
  ): Promise<SessionResult<ChatSession>> {
    // Resolve the avatar's brand so the thread carries both scope columns. The
    // focus avatar (avatar_id) seeds brand resolution + back-compat; the set
    // (context_avatar_ids) is the per-thread retrieval anchor (set model).
    let brandId: string | null = null;
    if (avatarId) {
      const resolved = await this.resolveBrandId(avatarId, userId);
      if (resolved.error) {
        return { data: null, error: resolved.error };
      }
      brandId = resolved.brandId;
    }

    // Build the row loosely (sidesteps per-field jsonb/Json friction on
    // chapter_metadata) then assert the generated insert type at the call site.
    // `context_avatar_ids` is now present in the regenerated `types.ts`.
    const insertRow: Record<string, unknown> = {
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
    };
    // Stamp the set when given; the DB backfill default is ARRAY[avatar_id], so
    // single-avatar callers that omit it still land a sane anchor.
    if (contextAvatarIds && contextAvatarIds.length > 0) {
      insertRow.context_avatar_ids = contextAvatarIds;
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert(insertRow as TablesInsert<'chat_sessions'>)
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
   * Ensure an open thread exists for the given avatar and return it. Thin
   * single-id shim over {@link ensureSessionForContext} (set model): a single
   * avatar is just the one-member context set, with itself as the focus.
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
    return this.ensureSessionForContext(userId, chatbotType, [avatarId]);
  }

  /**
   * Ensure an open thread exists for the active context SET and return it (set
   * model). Finds the most-recent general thread whose `context_avatar_ids`
   * EQUALS the set (order-insensitive); else creates one stamping
   * `context_avatar_ids = avatarIds`, `avatar_id = avatarIds[0]` (the focus, for
   * back-compat + brand resolution). This is the session-follows-context anchor:
   * switching the set lands the user on that set's conversation.
   *
   * @param userId - ID of the user
   * @param chatbotType - Type of chatbot
   * @param avatarIds - the active context set (non-empty; ids[0] is the focus)
   * @returns Promise resolving to SessionResult with the existing-or-new session
   */
  async ensureSessionForContext(
    userId: string,
    chatbotType: ChatbotType,
    avatarIds: string[]
  ): Promise<SessionResult<ChatSession>> {
    if (avatarIds.length === 0) {
      return { data: null, error: new Error('empty_avatar_set') };
    }
    const focusAvatarId = avatarIds[0];
    const wantKey = sortedSetKey(avatarIds);

    // Candidate general threads for the focus avatar (newest-first), reading the
    // untyped `context_avatar_ids` column so the set can be matched
    // order-insensitively. `context_avatar_ids` is live but not yet in the
    // generated types, so the rows are read untyped and narrowed via a guard.
    const { data: rows, error: listError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('chatbot_type', chatbotType)
      .eq('avatar_id', focusAvatarId)
      .eq('conversation_type', 'general')
      .order('updated_at', { ascending: false });

    if (listError) {
      return { data: null, error: listError as Error };
    }

    const match = (rows ?? []).find(
      (row) => sortedSetKey(readContextAvatarIds(row, focusAvatarId)) === wantKey
    );
    if (match) {
      return { data: this.mapSessionFromDb(match), error: null };
    }

    return this.createSession(userId, chatbotType, undefined, focusAvatarId, avatarIds);
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

/**
 * Order-insensitive identity key for an avatar set: dedupe → sort → join. Two
 * sets with the same members in any order collapse to the same key.
 */
function sortedSetKey(ids: readonly string[]): string {
  return [...new Set(ids)].sort().join(',');
}

/**
 * Read a row's `context_avatar_ids` (live but not yet in the generated types),
 * narrowing the untyped value to a `string[]`. Falls back to the row's single
 * `avatar_id` (the DB backfill default ARRAY[avatar_id]) when the column is
 * absent/empty, so legacy single-avatar rows compare correctly.
 */
function readContextAvatarIds(row: Record<string, unknown>, fallbackAvatarId: string): string[] {
  const raw = row.context_avatar_ids;
  if (Array.isArray(raw)) {
    const ids = raw.filter((v): v is string => typeof v === 'string');
    if (ids.length > 0) return ids;
  }
  return [fallbackAvatarId];
}

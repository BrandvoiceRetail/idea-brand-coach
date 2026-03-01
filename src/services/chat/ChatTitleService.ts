/**
 * ChatTitleService
 * Handles chat session title generation and updates
 *
 * This service provides a focused interface for title generation,
 * extracted from SupabaseChatService to improve maintainability and testability.
 */

import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types/chat';

/**
 * Result type for title operations
 */
export interface TitleResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Parameters for edge function title generation
 */
interface GenerateTitleParams {
  user_message: string;
  assistant_response: string;
  regenerate?: boolean;
}

export class ChatTitleService {
  /**
   * Maybe update session title if it's still the default "New Chat".
   * Sets a temporary title from the first message content while AI generates a better one.
   *
   * @param sessionId - ID of the session to potentially update
   * @param content - Content of the first message to use as temp title
   * @returns Promise resolving to TitleResult when update is complete (or skipped)
   */
  async maybeUpdateSessionTitle(sessionId: string, content: string): Promise<TitleResult<void>> {
    try {
      console.log('[maybeUpdateSessionTitle] Checking session:', sessionId);

      // Check if session still has default title
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('title')
        .eq('id', sessionId)
        .single();

      if (sessionError) {
        console.warn('[maybeUpdateSessionTitle] Error fetching session:', sessionError);
        return { data: null, error: sessionError as Error };
      }

      console.log('[maybeUpdateSessionTitle] Session found:', session?.title);

      if (!session || session.title !== 'New Chat') {
        console.log('[maybeUpdateSessionTitle] Skipping - title already set or session not found');
        return { data: undefined, error: null };
      }

      // Set a temporary title from first ~40 chars while AI generates better one
      const tempTitle = content.length > 40 ? content.substring(0, 37) + '...' : content;

      console.log('[maybeUpdateSessionTitle] Setting temp title:', tempTitle);

      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({
          title: tempTitle,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) {
        console.warn('[maybeUpdateSessionTitle] Error updating title:', updateError);
        return { data: null, error: updateError as Error };
      }

      return { data: undefined, error: null };
    } catch (error) {
      console.warn('Failed to auto-update session title:', error);
      // Don't throw - this is not critical
      return { data: null, error: error as Error };
    }
  }

  /**
   * Generate an AI-powered title for a session based on the first exchange.
   * Only generates for sessions with 2 or fewer messages (first exchange).
   * This prevents overwriting manually renamed sessions.
   *
   * @param sessionId - ID of the session to generate title for
   * @param userMessage - Content of the user's first message
   * @param assistantResponse - Content of the assistant's first response
   * @returns Promise resolving to TitleResult with generated title or null if skipped/failed
   */
  async generateSessionTitle(
    sessionId: string,
    userMessage: string,
    assistantResponse: string
  ): Promise<TitleResult<string>> {
    try {
      // Verify session exists
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        console.warn('[generateSessionTitle] Session not found:', sessionError);
        return { data: null, error: sessionError as Error };
      }

      // Only generate title on first exchange (2 messages = user + assistant)
      // This prevents overwriting manually renamed sessions
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .limit(3);

      if (count && count > 2) {
        console.log('[generateSessionTitle] Skipping - not first exchange (has', count, 'messages)');
        return { data: null, error: null };
      }

      // Get auth session for edge function call
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (!authSession) {
        console.warn('[generateSessionTitle] No auth session found');
        return { data: null, error: new Error('No auth session found') };
      }

      // Call edge function to generate title
      const { data, error } = await supabase.functions.invoke('generate-session-title', {
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: {
          user_message: userMessage,
          assistant_response: assistantResponse.substring(0, 500), // Limit context size
        } as GenerateTitleParams,
      });

      if (error) {
        console.warn('Failed to generate AI title:', error);
        return { data: null, error: error as Error };
      }

      if (data?.title) {
        const { error: updateError } = await supabase
          .from('chat_sessions')
          .update({
            title: data.title,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);

        if (updateError) {
          console.warn('[generateSessionTitle] Error updating title:', updateError);
          return { data: null, error: updateError as Error };
        }

        console.log('✅ Generated session title:', data.title);
        return { data: data.title, error: null };
      }

      return { data: null, error: null };
    } catch (error) {
      console.warn('Failed to generate session title:', error);
      // Don't throw - this is not critical
      return { data: null, error: error as Error };
    }
  }

  /**
   * Regenerate session title based on entire conversation history.
   * Used when user wants to update title to reflect evolved conversation.
   *
   * @param sessionId - ID of the session to regenerate title for
   * @returns Promise resolving to TitleResult with new title or null if generation failed
   */
  async regenerateSessionTitle(sessionId: string): Promise<TitleResult<string>> {
    try {
      // Get recent messages from the session
      const { data: messages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(20);

      if (messagesError) {
        console.warn('[regenerateSessionTitle] Error fetching messages:', messagesError);
        return { data: null, error: messagesError as Error };
      }

      if (!messages || messages.length === 0) {
        console.log('[regenerateSessionTitle] No messages found for session');
        return { data: null, error: null };
      }

      // Build conversation summary for title generation
      // Use last 6 messages for context
      const conversationSummary = messages
        .slice(-6)
        .map((m) => `${m.role}: ${(m.content as string).substring(0, 200)}`)
        .join('\n');

      // Get auth session for edge function call
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (!authSession) {
        console.warn('[regenerateSessionTitle] No auth session found');
        return { data: null, error: new Error('No auth session found') };
      }

      // Call edge function to generate title
      const { data, error } = await supabase.functions.invoke('generate-session-title', {
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: {
          user_message: conversationSummary,
          assistant_response: '', // Empty since we're using full conversation
          regenerate: true, // Flag to indicate full conversation context
        } as GenerateTitleParams,
      });

      if (error) {
        console.warn('Failed to regenerate AI title:', error);
        return { data: null, error: error as Error };
      }

      if (data?.title) {
        const { error: updateError } = await supabase
          .from('chat_sessions')
          .update({
            title: data.title,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);

        if (updateError) {
          console.warn('[regenerateSessionTitle] Error updating title:', updateError);
          return { data: null, error: updateError as Error };
        }

        console.log('✅ Regenerated session title:', data.title);
        return { data: data.title, error: null };
      }

      return { data: null, error: null };
    } catch (error) {
      console.warn('Failed to regenerate session title:', error);
      return { data: null, error: error as Error };
    }
  }
}

/**
 * SupabaseChatService
 * Implements IChatService for Supabase backend
 */

import { supabase } from '@/integrations/supabase/client';
import { IChatService } from './interfaces/IChatService';
import { ChatMessage, ChatMessageCreate, ChatResponse } from '@/types/chat';

export class SupabaseChatService implements IChatService {
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
    console.log('📤 Sending message to Brand Coach:', { userId, messageLength: message.content.length });

    // 1. Save user message to database
    const { data: userMessage, error: saveError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        role: message.role,
        content: message.content,
        metadata: message.metadata,
      })
      .select()
      .single();

    if (saveError) throw saveError;

    // 2. Get recent chat history for context
    const recentMessages = await this.getRecentMessages(10);

    // 3. Call brand-coach-gpt Edge Function with RAG
    console.log('🤖 Calling brand-coach-gpt Edge Function...');

    // Get current session to pass auth token explicitly
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session found');
    }

    const { data: responseData, error: functionError } = await supabase.functions.invoke(
      'brand-coach-gpt',
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

    console.log('✅ Received response from Brand Coach:', {
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
        metadata: {
          suggestions: responseData.suggestions,
          sources: responseData.sources,
        },
      })
      .select()
      .single();

    if (assistantError) throw assistantError;

    return {
      message: {
        id: assistantMessage.id,
        user_id: assistantMessage.user_id,
        role: assistantMessage.role as 'assistant',
        content: assistantMessage.content,
        metadata: (assistantMessage.metadata as Record<string, any>) || {},
        created_at: assistantMessage.created_at,
        updated_at: assistantMessage.updated_at,
      },
      suggestions: responseData.suggestions,
      sources: responseData.sources,
    };
  }

  async getChatHistory(limit: number = 50): Promise<ChatMessage[]> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      user_id: item.user_id,
      role: item.role as 'user' | 'assistant' | 'system',
      content: item.content,
      metadata: (item.metadata as Record<string, any>) || {},
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }

  async clearChatHistory(): Promise<void> {
    const userId = await this.getUserId();

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }

  async getRecentMessages(count: number): Promise<ChatMessage[]> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(count);

    if (error) throw error;

    // Reverse to get chronological order
    return data.reverse().map(item => ({
      id: item.id,
      user_id: item.user_id,
      role: item.role as 'user' | 'assistant' | 'system',
      content: item.content,
      metadata: (item.metadata as Record<string, any>) || {},
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }
}

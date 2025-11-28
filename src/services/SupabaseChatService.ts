/**
 * SupabaseChatService
 * Implements IChatService for Supabase backend
 */

import { supabase } from '@/integrations/supabase/client';
import { IChatService } from './interfaces/IChatService';
import { ChatMessage, ChatMessageCreate, ChatResponse, ChatbotType } from '@/types/chat';
import { forceSyncUserData } from '@/lib/knowledge-base/sync-service-instance';

export class SupabaseChatService implements IChatService {
  private chatbotType: ChatbotType = 'brand-coach';

  /**
   * Set the chatbot type for filtering messages
   */
  setChatbotType(chatbotType: ChatbotType): void {
    this.chatbotType = chatbotType;
  }

  /**
   * Get the edge function name for the current chatbot type
   */
  private getEdgeFunctionName(): string {
    return this.chatbotType === 'idea-framework-consultant'
      ? 'idea-framework-consultant'
      : 'brand-coach-gpt';
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

    // 1. Save user message to database
    const { data: userMessage, error: saveError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        role: message.role,
        content: message.content,
        chatbot_type: chatbotType,
        metadata: message.metadata,
      })
      .select()
      .single();

    if (saveError) throw saveError;

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
        chatbot_type: assistantMessage.chatbot_type as ChatbotType,
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
      .eq('chatbot_type', this.chatbotType)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      user_id: item.user_id,
      role: item.role as 'user' | 'assistant' | 'system',
      content: item.content,
      chatbot_type: item.chatbot_type as ChatbotType,
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
      .eq('user_id', userId)
      .eq('chatbot_type', this.chatbotType);

    if (error) throw error;
  }

  async getRecentMessages(count: number): Promise<ChatMessage[]> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('chatbot_type', this.chatbotType)
      .order('created_at', { ascending: false })
      .limit(count);

    if (error) throw error;

    // Reverse to get chronological order
    return data.reverse().map(item => ({
      id: item.id,
      user_id: item.user_id,
      role: item.role as 'user' | 'assistant' | 'system',
      content: item.content,
      chatbot_type: item.chatbot_type as ChatbotType,
      metadata: (item.metadata as Record<string, any>) || {},
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }
}

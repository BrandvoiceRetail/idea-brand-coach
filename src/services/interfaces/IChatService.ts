/**
 * IChatService Interface
 * Contract for chat operations with Brand Coach
 */

import { ChatMessage, ChatMessageCreate, ChatResponse } from '@/types/chat';

export interface IChatService {
  /**
   * Send a message to Brand Coach and get response
   * Calls the brand-coach-gpt Edge Function with RAG
   */
  sendMessage(message: ChatMessageCreate): Promise<ChatResponse>;

  /**
   * Get chat history for the authenticated user
   * Ordered by created_at ascending
   */
  getChatHistory(limit?: number): Promise<ChatMessage[]>;

  /**
   * Clear all chat messages for the authenticated user
   */
  clearChatHistory(): Promise<void>;

  /**
   * Get the last N messages for context
   */
  getRecentMessages(count: number): Promise<ChatMessage[]>;
}

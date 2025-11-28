/**
 * IChatService Interface
 *
 * Abstract contract for chat operations with Brand Coach.
 * This abstraction allows us to switch out implementations as downstream
 * dependencies evolve (e.g., migrating from Supabase to a different backend,
 * API changes, or testing with mocks) without impacting application code.
 *
 * Current implementation:
 * - SupabaseChatService: Persists to Supabase, calls Edge Function with RAG
 *
 * Supports multiple chatbot types:
 * - brand-coach: General brand consulting with RAG
 * - idea-framework-consultant: IDEA Framework specialist
 */

import { ChatMessage, ChatMessageCreate, ChatResponse, ChatbotType } from '@/types/chat';

export interface IChatService {
  /**
   * Set the chatbot type for this service instance.
   * Filters all operations to only this chatbot's messages.
   *
   * @param chatbotType - Type of chatbot ('brand-coach' or 'idea-framework-consultant')
   */
  setChatbotType(chatbotType: ChatbotType): void;
  /**
   * Send a message to Brand Coach and receive an AI-generated response.
   *
   * @param message - The message to send (user input)
   * @returns Promise resolving to the assistant's response with optional suggestions and sources
   * @throws Error if the message cannot be sent (e.g., network failure, auth issues)
   */
  sendMessage(message: ChatMessageCreate): Promise<ChatResponse>;

  /**
   * Retrieve chat conversation history.
   *
   * @param limit - Maximum number of messages to retrieve (default: 50)
   * @returns Promise resolving to array of messages ordered by creation time (oldest first)
   * @throws Error if history cannot be retrieved
   */
  getChatHistory(limit?: number): Promise<ChatMessage[]>;

  /**
   * Clear all chat messages from the conversation history.
   *
   * @returns Promise resolving when history is cleared
   * @throws Error if clear operation fails
   */
  clearChatHistory(): Promise<void>;

  /**
   * Retrieve the most recent N messages for context building.
   *
   * @param count - Number of recent messages to retrieve
   * @returns Promise resolving to array of messages ordered chronologically
   * @throws Error if messages cannot be retrieved
   */
  getRecentMessages(count: number): Promise<ChatMessage[]>;
}

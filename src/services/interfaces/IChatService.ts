/**
 * IChatService Interface
 *
 * Abstract contract for chat operations with IDEA Framework Consultant.
 * This abstraction allows us to switch out implementations as downstream
 * dependencies evolve (e.g., migrating from Supabase to a different backend,
 * API changes, or testing with mocks) without impacting application code.
 *
 * Current implementation:
 * - SupabaseChatService: Persists to Supabase, calls Edge Function with RAG
 * - idea-framework-consultant: IDEA Framework specialist with RAG
 */

import {
  ChatMessage,
  ChatMessageCreate,
  ChatResponse,
  ChatbotType,
  ChatSession,
  ChatSessionCreate,
  ChatSessionUpdate,
} from '@/types/chat';

export interface IChatService {
  /**
   * Set the chatbot type for this service instance.
   * Filters all operations to only this chatbot's messages.
   *
   * @param chatbotType - Type of chatbot ('idea-framework-consultant')
   */
  setChatbotType(chatbotType: ChatbotType): void;
  /**
   * Send a message to IDEA Framework Consultant and receive an AI-generated response.
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

  // ==========================================
  // Session Management Methods
  // ==========================================

  /**
   * Set the current active session for message operations.
   *
   * @param sessionId - ID of the session to use, or undefined to clear
   */
  setCurrentSession(sessionId: string | undefined): void;

  /**
   * Get the current active session ID.
   *
   * @returns The current session ID or undefined if none set
   */
  getCurrentSessionId(): string | undefined;

  /**
   * Create a new chat session.
   *
   * @param session - Session creation data
   * @returns Promise resolving to the created session
   * @throws Error if session cannot be created
   */
  createSession(session?: ChatSessionCreate): Promise<ChatSession>;

  /**
   * Get all chat sessions for the current user and chatbot type.
   *
   * @returns Promise resolving to array of sessions ordered by update time (newest first)
   * @throws Error if sessions cannot be retrieved
   */
  getSessions(): Promise<ChatSession[]>;

  /**
   * Get a single session by ID.
   *
   * @param sessionId - ID of the session to retrieve
   * @returns Promise resolving to the session or null if not found
   * @throws Error if session cannot be retrieved
   */
  getSession(sessionId: string): Promise<ChatSession | null>;

  /**
   * Update a chat session (e.g., rename title).
   *
   * @param sessionId - ID of the session to update
   * @param update - Update data
   * @returns Promise resolving to the updated session
   * @throws Error if session cannot be updated
   */
  updateSession(sessionId: string, update: ChatSessionUpdate): Promise<ChatSession>;

  /**
   * Delete a chat session and all its messages.
   *
   * @param sessionId - ID of the session to delete
   * @returns Promise resolving when session is deleted
   * @throws Error if session cannot be deleted
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * Get chat history for a specific session.
   *
   * @param sessionId - ID of the session
   * @param limit - Maximum number of messages to retrieve
   * @returns Promise resolving to array of messages
   * @throws Error if messages cannot be retrieved
   */
  getSessionMessages(sessionId: string, limit?: number): Promise<ChatMessage[]>;

  /**
   * Generate an AI-powered session title based on first exchange.
   *
   * @param sessionId - ID of the session to update
   * @param userMessage - The user's first message
   * @param assistantResponse - The assistant's response
   */
  generateSessionTitle(sessionId: string, userMessage: string, assistantResponse: string): Promise<void>;

  /**
   * Regenerate session title based on entire conversation history.
   * Used when user wants to update title to reflect evolved conversation.
   *
   * @param sessionId - ID of the session to update
   * @returns The new title, or null if generation failed
   */
  regenerateSessionTitle(sessionId: string): Promise<string | null>;
}

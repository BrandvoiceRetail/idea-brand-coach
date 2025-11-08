/**
 * Chat Types
 * Type definitions for Brand Coach Chat feature
 */

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageCreate {
  role: ChatRole;
  content: string;
  metadata?: Record<string, any>;
}

export interface ChatMessageUpdate {
  content?: string;
  metadata?: Record<string, any>;
}

export interface ChatResponse {
  message: ChatMessage;
  suggestions?: string[];
  sources?: string[];
}

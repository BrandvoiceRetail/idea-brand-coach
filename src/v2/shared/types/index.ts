/**
 * Shared types used across the v2 domain layer.
 */

/** Result type for operations that can fail with a domain error */
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

export function failure<T>(error: string): Result<T> {
  return { success: false, error };
}

/** Chat message type reused from v1 for avatar chat history */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/** Unique identifier branded type for type safety */
export type BrandId = string;
export type AvatarId = string;
export type UserId = string;

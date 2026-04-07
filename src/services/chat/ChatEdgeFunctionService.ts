/**
 * ChatEdgeFunctionService
 * Handles edge function interactions for the chat system.
 * Consolidates duplicated auth, document check, request building,
 * and edge function invocation logic from SupabaseChatService.
 */

import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

/** Constants used across chat edge function operations */
export const CHAT_CONSTANTS = {
  RECENT_MESSAGES_COUNT: 10,
  DEFAULT_HISTORY_LIMIT: 50,
  TITLE_MESSAGE_THRESHOLD: 2,
  TITLE_CONTEXT_LIMIT: 500,
  CONVERSATION_SUMMARY_MESSAGES: 6,
  EDGE_FUNCTION_CONSULTANT: 'idea-framework-consultant-claude',
  EDGE_FUNCTION_TITLE: 'generate-session-title',
} as const;

/** Shape returned by the consultant edge function (non-streaming) */
export interface EdgeFunctionResponse {
  response: string;
  suggestions?: string[];
  sources?: string[];
  extractedFields?: Array<{
    identifier: string;
    value: unknown;
    confidence: number;
    source: string;
    context?: string;
  }>;
  responseId?: string;
}

/** Parameters for building a consultant request body */
export interface ConsultantRequestParams {
  message: string;
  chapterContext?: unknown;
  competitiveInsights: string | null;
  metadata?: Record<string, unknown>;
  hasUploadedDocuments: boolean;
  chatHistory?: Array<{ role: string; content: string }>;
  stream?: boolean;
}

export class ChatEdgeFunctionService {
  /**
   * Get the current authenticated Supabase session.
   * @throws Error if no active session
   */
  async getAuthSession(): Promise<Session> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session found');
    }
    return session;
  }

  /**
   * Check whether the user has uploaded any documents.
   */
  async checkUploadedDocuments(userId: string): Promise<boolean> {
    try {
      const { data: uploadedDocs } = await supabase
        .from('uploaded_documents')
        .select('id, openai_file_id')
        .eq('user_id', userId)
        .limit(1);

      const hasDocuments = (uploadedDocs && uploadedDocs.length > 0) || false;
      console.log('📄 Document check:', {
        hasDocuments,
        documentCount: uploadedDocs?.length || 0,
        hasOpenAIFileId: uploadedDocs?.[0]?.openai_file_id ? true : false,
      });
      return hasDocuments;
    } catch (error) {
      console.warn('Failed to check for uploaded documents:', error);
      return false;
    }
  }

  /**
   * Build the request body for the consultant edge function.
   * Claude version: no previousResponseId or useResponsesApi — conversation
   * history is always sent explicitly via chat_history.
   */
  buildRequestBody(params: ConsultantRequestParams): Record<string, unknown> {
    const body: Record<string, unknown> = {
      message: params.message,
      chapterContext: params.chapterContext,
      competitiveInsights: params.competitiveInsights,
      metadata: {
        ...params.metadata,
        hasUploadedDocuments: params.hasUploadedDocuments,
      },
    };

    if (params.stream) {
      body.stream = true;
    }

    if (params.chatHistory) {
      body.chat_history = params.chatHistory;
    }

    return body;
  }

  /**
   * Call the consultant edge function (non-streaming).
   */
  async callConsultant(
    body: Record<string, unknown>,
    authToken: string
  ): Promise<EdgeFunctionResponse> {
    const { data, error } = await supabase.functions.invoke(
      CHAT_CONSTANTS.EDGE_FUNCTION_CONSULTANT,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        body,
      }
    );

    if (error) {
      // supabase.functions.invoke wraps HTTP errors — extract the response body for debugging
      let errorBody: string | undefined;
      try {
        if (error.context?.body) {
          const reader = error.context.body.getReader?.();
          if (reader) {
            const { value } = await reader.read();
            errorBody = new TextDecoder().decode(value);
          }
        }
      } catch {
        // ignore body read failure
      }
      console.error('❌ Edge Function error:', {
        message: error.message,
        name: error.name,
        status: error.context?.status,
        responseBody: errorBody,
      });
      throw new Error(
        errorBody
          ? `Edge function error (${error.context?.status}): ${errorBody}`
          : error.message
      );
    }

    console.log('✅ Received response:', {
      responseLength: data?.response?.length || 0,
      hasSuggestions: !!data?.suggestions,
      hasSources: !!data?.sources,
    });

    return data as EdgeFunctionResponse;
  }

  /**
   * Call the consultant edge function for streaming via raw fetch.
   * Returns the raw Response for SSE parsing.
   */
  async callConsultantStreaming(
    body: Record<string, unknown>,
    authToken: string
  ): Promise<Response> {
    const supabaseUrl =
      import.meta.env.VITE_SUPABASE_URL ?? 'https://ecdrxtbclxfpkknasmrw.supabase.co';
    const url = `${supabaseUrl}/functions/v1/${CHAT_CONSTANTS.EDGE_FUNCTION_CONSULTANT}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjZHJ4dGJjbHhmcGtrbmFzbXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5ODE5ODYsImV4cCI6MjA2OTU1Nzk4Nn0.yPlOSq4l4PMD9RlchTBeXs5EBmzggGQGp7A8B3qGAAk',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge function error: ${response.status} - ${errorText}`);
    }

    return response;
  }
}

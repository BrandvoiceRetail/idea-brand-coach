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
  EDGE_FUNCTION_CONSULTANT: 'idea-framework-consultant',
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
  previousResponseId?: string;
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
   * Look up the previous OpenAI response ID for conversation chaining.
   */
  async lookupPreviousResponseId(sessionId: string): Promise<string | undefined> {
    try {
      const { data: sessionData } = await supabase
        .from('chat_sessions')
        .select('openai_response_id')
        .eq('id', sessionId)
        .single();

      const responseId = sessionData?.openai_response_id || undefined;
      if (responseId) {
        console.log('🔗 Chaining conversation via previous_response_id:', responseId);
      }
      return responseId;
    } catch (error) {
      console.warn('Failed to look up previous response ID:', error);
      return undefined;
    }
  }

  /**
   * Build the request body for the consultant edge function.
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
      useResponsesApi: true,
      previousResponseId: params.previousResponseId,
    };

    if (params.stream) {
      body.stream = true;
    }

    // Only send chat_history when not chaining (first message or no previous response)
    if (!params.previousResponseId && params.chatHistory) {
      body.chat_history = params.chatHistory;
    }

    return body;
  }

  /**
   * Save the response ID on the session for conversation chaining.
   */
  async saveResponseId(sessionId: string, responseId: string): Promise<void> {
    console.log('💾 Saving response ID for conversation chaining:', responseId);
    const { error } = await supabase
      .from('chat_sessions')
      .update({ openai_response_id: responseId })
      .eq('id', sessionId);

    if (error) {
      console.warn('Failed to save response ID:', error);
    }
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
      console.error('❌ Edge Function error:', error);
      throw error;
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
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
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

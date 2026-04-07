/**
 * IDEA Framework Consultant — Claude Agent SDK Edition
 *
 * Replaces the OpenAI-based idea-framework-consultant with Anthropic Claude.
 * Uses Claude Messages API with streaming, tool use, and prompt caching.
 *
 * Key differences from OpenAI version:
 * - Native tool loop (Claude handles tool results internally within a single request)
 * - Prompt caching via cache_control markers (90% discount on cached tokens)
 * - XML-tagged system prompt (Claude's preferred format)
 * - No previous_response_id — conversation history always sent explicitly
 * - No OpenAI vector store search (Phase 2 migrates to pgvector)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { generateSystemPrompt } from './prompt.ts';
import { buildAgentTools } from './tools.ts';
import { buildTieredFieldContext } from './fields.ts';
import { retrieveAllContext } from './context.ts';
import { createStreamTranslator } from './stream.ts';

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
if (!anthropicApiKey) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    let supabaseClient = null;

    if (authHeader) {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      if (user) {
        userId = user.id;
        console.log('[Auth] User:', userId);
      }
    }

    // ── Parse request ────────────────────────────────────────────────────
    const {
      message,
      context,
      chat_history,
      metadata,
      chapterContext,
      isFirstMessage,
      stream: streamRequested,
    } = await req.json();

    const messageImages = metadata?.images || [];
    const hasUploadedDocuments = (metadata?.userDocuments?.length > 0) || metadata?.hasUploadedDocuments === true;
    const isFirst = isFirstMessage === true || !chat_history || chat_history.length === 0;
    const startTime = Date.now();

    console.log('[Request]', {
      messageLength: message?.length,
      chatHistoryLength: chat_history?.length || 0,
      hasImages: messageImages.length > 0,
      hasChapterContext: !!chapterContext,
      isFirstMessage: isFirst,
      hasUploadedDocuments,
      stream: !!streamRequested,
    });

    // ── Context retrieval ────────────────────────────────────────────────
    const useComprehensiveMode = chapterContext?.comprehensiveMode === true;
    const isSimpleGreeting = message?.toLowerCase().match(
      /^(hi|hello|hey|good\s+(morning|afternoon|evening))[\s!.?]*$/i
    );
    const isShortMessage = (message?.length || 0) < 50;
    const needsFullContext = !isSimpleGreeting && (!isShortMessage || useComprehensiveMode || hasUploadedDocuments);

    let userKnowledgeContext = '';
    let semanticContext = '';

    if (userId && supabaseClient) {
      const ctxResult = await retrieveAllContext(supabaseClient, userId, message, {
        needsFullContext,
        hasUploadedDocuments,
      });
      userKnowledgeContext = ctxResult.userKnowledgeContext;
      semanticContext = ctxResult.semanticContext;
    }

    // ── System prompt ────────────────────────────────────────────────────
    const extractionFields = chapterContext?.fieldsToCapture || chapterContext?.extractionFields;
    const focusedField = chapterContext?.focusedField
      ? chapterContext.currentFieldDetails
      : undefined;

    const systemPrompt = generateSystemPrompt({
      extractionFields,
      focusedField,
      isFirstMessage: isFirst,
      hasUploadedDocuments,
      comprehensiveMode: useComprehensiveMode,
    });

    // ── Build user message with context ──────────────────────────────────
    const contextParts: string[] = [];

    // Stable context first (benefits from prompt caching)
    if (userKnowledgeContext) contextParts.push(userKnowledgeContext);
    if (context) contextParts.push(`ADDITIONAL CONTEXT:\n${context}`);
    if (semanticContext) contextParts.push(semanticContext);

    // Field state (per-turn, last)
    if (chapterContext?.currentFieldValues) {
      contextParts.push(buildTieredFieldContext(
        chapterContext.currentFieldValues,
        chapterContext.currentChapterKey
      ));
    }

    let userPrompt = message;
    if (contextParts.length > 0 || messageImages.length > 0) {
      let suffix = `\n\n---\n\nQUESTION: ${message}\n\nIMPORTANT: Use ALL the context information above to provide personalized, specific advice.`;
      if (messageImages.length > 0) {
        suffix += `\n\nVISUAL ANALYSIS: The user has provided ${messageImages.length} image(s) for analysis. Analyze in context of their brand strategy.`;
      }
      userPrompt = contextParts.length > 0
        ? `${contextParts.join('\n\n---\n\n')}${suffix}`
        : message + suffix;
    }

    // ── Build Claude messages array ──────────────────────────────────────
    const messages: Array<{ role: string; content: unknown }> = [];

    // Chat history
    if (chat_history && Array.isArray(chat_history)) {
      const historyLimit = useComprehensiveMode ? 10 : 5;
      const recentHistory = chat_history.slice(-historyLimit);
      messages.push(...recentHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })));
    }

    // Current user message (with images if present)
    if (messageImages.length > 0) {
      const contentBlocks: any[] = [];
      // Images first, then text (Claude's recommended order)
      for (const img of messageImages) {
        contentBlocks.push({
          type: 'image',
          source: { type: 'url', url: img.url },
        });
      }
      contentBlocks.push({ type: 'text', text: userPrompt });
      messages.push({ role: 'user', content: contentBlocks });
    } else {
      messages.push({ role: 'user', content: userPrompt });
    }

    // ── Build tools ──────────────────────────────────────────────────────
    const hasActiveExtraction = (extractionFields && extractionFields.length > 0) || hasUploadedDocuments;
    const scopeChapterKey = chapterContext?.currentChapterKey;
    const tools = buildAgentTools(extractionFields, scopeChapterKey, hasActiveExtraction);

    // ── Token budget ─────────────────────────────────────────────────────
    const conversationalTokens = hasUploadedDocuments ? 2500 : (hasActiveExtraction ? 1500 : 800);
    const maxTokens = useComprehensiveMode ? 4000 : conversationalTokens;

    // ── Build Claude API request ─────────────────────────────────────────
    const requestBody: Record<string, unknown> = {
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      // System prompt with cache_control for prompt caching
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
      temperature: 0.7,
    };

    if (tools.length > 0) {
      // Mark tools for caching too (they're stable per-chapter)
      requestBody.tools = tools.map((tool, i) => ({
        ...tool,
        ...(i === tools.length - 1 ? { cache_control: { type: 'ephemeral' } } : {}),
      }));
      requestBody.tool_choice = { type: 'auto' };
    }

    console.log(`[Claude] Starting request. Model: ${CLAUDE_MODEL}, max_tokens: ${maxTokens}, tools: ${tools.length}, stream: ${!!streamRequested}`);

    // ── Streaming path ───────────────────────────────────────────────────
    if (streamRequested) {
      requestBody.stream = true;

      const claudeResponse = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!claudeResponse.ok) {
        const errorBody = await claudeResponse.text();
        console.error('[Claude] API error:', claudeResponse.status, errorBody.substring(0, 500));

        // Return a streaming error so the client handles it gracefully
        const encoder = new TextEncoder();
        const errorStream = new ReadableStream({
          start(controller) {
            const errorMessage = claudeResponse.status === 429
              ? 'The AI service is currently rate limited. Please try again in a moment.'
              : 'I\'m sorry, something went wrong. Please try again.';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', delta: errorMessage })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
          },
        });

        return new Response(errorStream, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      }

      // Translate Claude's stream to client protocol
      const clientStream = createStreamTranslator(claudeResponse, startTime);

      return new Response(clientStream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // ── Non-streaming path ───────────────────────────────────────────────
    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!claudeResponse.ok) {
      const errorBody = await claudeResponse.text();
      console.error('[Claude] API error:', claudeResponse.status, errorBody.substring(0, 500));
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const data = await claudeResponse.json();
    const elapsed = Date.now() - startTime;

    // Extract text and tool results from response
    let responseText = '';
    let extractedFields: any[] = [];

    for (const block of data.content || []) {
      if (block.type === 'text') {
        responseText += block.text;
      } else if (block.type === 'tool_use' && block.name === 'extract_brand_fields') {
        extractedFields = block.input?.fields || [];
      }
    }

    // Log usage
    if (data.usage) {
      const u = data.usage;
      console.log(`[Usage] Input: ${u.input_tokens} (cache_read: ${u.cache_read_input_tokens || 0}), Output: ${u.output_tokens}`);
    }
    console.log(`[Claude] Response in ${elapsed}ms. Text: ${responseText.length} chars, Fields: ${extractedFields.length}`);

    return new Response(
      JSON.stringify({
        response: responseText,
        extractedFields,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Fatal]', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

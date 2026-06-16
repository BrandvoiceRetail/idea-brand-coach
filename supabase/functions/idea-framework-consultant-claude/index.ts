/**
 * IDEA Framework Consultant — Claude Agent SDK Edition
 *
 * Claude Messages API with streaming, tool use, persistent memory and
 * prompt caching.
 *
 * Cache layout (4 ephemeral breakpoints, render order tools → system → messages):
 *   BP1  static system block — Trevor persona + memory/extraction policy.
 *        Shared across ALL users per (mode, extraction, documents, memory)
 *        variant; also caches the tools array rendered ahead of it.
 *   BP2  per-user system block — knowledge base + product context + memory
 *        snapshot + session context. Stable within a session.
 *   BP3  last history message — multi-turn incremental reuse.
 *   BP4  last tool_result during memory-loop iterations (moved each
 *        iteration by loop.ts).
 * Per-turn content (field state, the question itself) stays uncached in the
 * final user message.
 *
 * Memory: the memory_20250818 tool (authenticated users only) backed by the
 * user_memories table via _shared/memory.ts. Common-path reads are free —
 * the snapshot is injected into BP2; writes run through the agentic loop in
 * loop.ts. Kill switch: set the MEMORY_TOOL_ENABLED function secret to
 * 'false' to restore pre-memory behavior without a redeploy.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { generateSystemPrompt, buildSessionContext } from './prompt.ts';
import { buildAgentTools } from './tools.ts';
import { buildTieredFieldContext } from './fields.ts';
import { retrieveAllContext } from './context.ts';
import { buildMemorySnapshot } from './memory-context.ts';
import { buildDecisionTriggerSnapshot } from './decision-trigger-context.ts';
import { runAgenticLoop, runNonStreamingLoop } from './loop.ts';

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
if (!anthropicApiKey) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MEMORY_TOOL_ENABLED = Deno.env.get('MEMORY_TOOL_ENABLED') !== 'false';

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
      productContext,
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

    const memoryEnabled = MEMORY_TOOL_ENABLED && !!userId && !!supabaseClient;

    let userKnowledgeContext = '';
    let memorySnapshot = '';
    let decisionTriggerSnapshot = '';

    if (userId && supabaseClient) {
      const [ctxResult, snapshot, triggerSnapshot] = await Promise.all([
        retrieveAllContext(supabaseClient, userId, message, {
          needsFullContext,
          hasUploadedDocuments,
        }),
        memoryEnabled ? buildMemorySnapshot(supabaseClient, userId) : Promise.resolve(''),
        // One indexed lookup, runs alongside the other context reads (no added latency).
        buildDecisionTriggerSnapshot(supabaseClient, userId),
      ]);
      userKnowledgeContext = ctxResult.userKnowledgeContext;
      memorySnapshot = snapshot;
      decisionTriggerSnapshot = triggerSnapshot;
    }

    // ── Static system block (BP1 — shared across users per variant) ─────
    const extractionFields = chapterContext?.fieldsToCapture || chapterContext?.extractionFields;
    const focusedField = chapterContext?.focusedField
      ? chapterContext.currentFieldDetails
      : undefined;

    const systemPrompt = generateSystemPrompt({
      extractionFields,
      hasUploadedDocuments,
      comprehensiveMode: useComprehensiveMode,
      memoryEnabled,
    });

    // ── Per-user system block (BP2 — stable within a session) ───────────
    const perUserParts: string[] = [];
    if (userKnowledgeContext) perUserParts.push(userKnowledgeContext);
    if (productContext) perUserParts.push(`THE FOUNDER'S OWN PRODUCT (from their live Amazon listing):\n${productContext}`);
    if (decisionTriggerSnapshot) perUserParts.push(decisionTriggerSnapshot);
    if (memorySnapshot) perUserParts.push(memorySnapshot);

    const sessionContext = buildSessionContext({
      focusedField,
      isFirstMessage: isFirst,
      comprehensiveMode: useComprehensiveMode,
    });
    if (sessionContext) perUserParts.push(sessionContext);

    const perUserBlock = perUserParts.join('\n\n---\n\n');

    // ── Per-turn user message (uncached) ─────────────────────────────────
    const perTurnParts: string[] = [];
    if (context) perTurnParts.push(`ADDITIONAL CONTEXT:\n${context}`);
    if (chapterContext?.currentFieldValues) {
      perTurnParts.push(buildTieredFieldContext(
        chapterContext.currentFieldValues,
        chapterContext.currentChapterKey
      ));
    }

    let userPrompt = message;
    if (perTurnParts.length > 0 || messageImages.length > 0) {
      let suffix = `\n\n---\n\nQUESTION: ${message}\n\nIMPORTANT: Use the founder context in your system prompt and the context above to provide personalized, specific advice.`;
      if (messageImages.length > 0) {
        suffix += `\n\nVISUAL ANALYSIS: The user has provided ${messageImages.length} image(s) for analysis. Analyze in context of their brand strategy.`;
      }
      userPrompt = perTurnParts.length > 0
        ? `${perTurnParts.join('\n\n---\n\n')}${suffix}`
        : message + suffix;
    }

    // ── Build Claude messages array ──────────────────────────────────────
    const messages: Array<{ role: string; content: unknown }> = [];

    // Chat history — BP3 rides the last history message so the shared
    // conversation prefix is reused across turns.
    if (chat_history && Array.isArray(chat_history)) {
      const historyLimit = useComprehensiveMode ? 10 : 5;
      const recentHistory = chat_history.slice(-historyLimit);
      recentHistory.forEach((msg: { role: string; content: unknown }, i: number) => {
        const isLastHistory = i === recentHistory.length - 1;
        const canBlockify = typeof msg.content === 'string' && msg.content.length > 0;
        messages.push({
          role: msg.role,
          content: isLastHistory && canBlockify
            ? [{ type: 'text', text: msg.content, cache_control: { type: 'ephemeral' } }]
            : msg.content,
        });
      });
    }

    // Current user message (with images if present)
    if (messageImages.length > 0) {
      const contentBlocks: Array<Record<string, unknown>> = [];
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
    const tools: Array<Record<string, unknown>> = [
      ...(memoryEnabled ? [{ type: 'memory_20250818', name: 'memory' }] : []),
      ...buildAgentTools(extractionFields, scopeChapterKey, hasActiveExtraction),
    ];

    // ── Token budget ─────────────────────────────────────────────────────
    // Memory floor: a single `create` writing a ~2KB file consumes ~700
    // output tokens of tool-input JSON — 800 risks max_tokens truncation
    // mid-tool-call (treated as terminal, no continuation).
    let conversationalTokens = hasUploadedDocuments ? 2500 : (hasActiveExtraction ? 1500 : 800);
    if (memoryEnabled) conversationalTokens = Math.max(conversationalTokens, 1500);
    const maxTokens = useComprehensiveMode ? 4000 : conversationalTokens;

    // ── Build Claude API request ─────────────────────────────────────────
    const systemBlocks: Array<Record<string, unknown>> = [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }, // BP1 (also caches tools)
      },
    ];
    if (perUserBlock) {
      systemBlocks.push({
        type: 'text',
        text: `<founder-context>\n${perUserBlock}\n</founder-context>`,
        cache_control: { type: 'ephemeral' }, // BP2
      });
    }

    const requestBody: Record<string, unknown> = {
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemBlocks,
      temperature: 0.7,
    };

    if (tools.length > 0) {
      // No per-tool cache_control: tools render ahead of system, so BP1
      // already caches them; a tools breakpoint would waste one of the four.
      requestBody.tools = tools;
      requestBody.tool_choice = { type: 'auto' };
    }

    console.log(`[Claude] Starting request. Model: ${CLAUDE_MODEL}, max_tokens: ${maxTokens}, tools: ${tools.length}, memory: ${memoryEnabled}, stream: ${!!streamRequested}`);

    const loopConfig = {
      apiKey: anthropicApiKey,
      apiUrl: CLAUDE_API_URL,
      requestBody,
      messages,
      supabaseClient,
      userId,
      startTime,
    };

    // ── Streaming path ───────────────────────────────────────────────────
    if (streamRequested) {
      return new Response(runAgenticLoop(loopConfig), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // ── Non-streaming path ───────────────────────────────────────────────
    const { responseText, extractedFields } = await runNonStreamingLoop(loopConfig);
    const elapsed = Date.now() - startTime;
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

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
import { getServiceClient } from "../_shared/edge-auth.ts";
import { meterAndDebit } from "../_shared/meter.ts";

import { generateSystemPrompt, buildSessionContext } from './prompt.ts';
import { buildAgentTools } from './tools.ts';
import { MCP_TOOL_DEFS } from './mcpTools.ts';
import { buildTieredFieldContext } from './fields.ts';
import { retrieveAllContext } from './context.ts';
import { buildMemorySnapshot } from './memory-context.ts';
import { runAgenticLoop, runNonStreamingLoop } from './loop.ts';
import { computeToolLoopActive } from './registry.ts';
import { resolveCountry } from './telemetry.ts';

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
if (!anthropicApiKey) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MEMORY_TOOL_ENABLED = Deno.env.get('MEMORY_TOOL_ENABLED') !== 'false';
// Global KILL-SWITCH for the MCP tool loop (default OFF). Per-user rollout is the
// PostHog flag `coach-mcp-tool-loop`, evaluated in the SPA and forwarded as the
// request body's `tool_loop` boolean. The effective gate (computeToolLoopActive,
// applied per-request below) = env-kill-switch AND per-user-flag AND authenticated.
// OFF keeps the original hardcoded memory+extraction branches (byte-identical rollback).
const TOOL_LOOP_ENV = Deno.env.get('CONSULTANT_TOOL_LOOP_ENABLED') === 'true';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Injection guard: any body-supplied avatar_id must be a well-formed UUID
// before it touches a query (multi-avatar Phase 3, design §2.3 / H1).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuidOrNull = (v: unknown): string | null =>
  typeof v === 'string' && UUID_RE.test(v) ? v : null;

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
    // Caller's JWT, forwarded to the MCP host by MCP-backed tools (Phase 2). Never logged.
    let jwt: string | null = null;

    if (authHeader) {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      // Anchored extraction (matches the MCP host's identity.ts). A malformed
      // header yields no token → treated as unauthenticated.
      const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1] ?? null;
      jwt = token;
      if (token) {
        const { data: { user } } = await supabaseClient.auth.getUser(token);
        if (user) {
          userId = user.id;
          console.log('[Auth] User:', userId);
        }
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
      tool_loop,
      avatar_id,
    } = await req.json();

    const messageImages = metadata?.images || [];
    const hasUploadedDocuments = (metadata?.userDocuments?.length > 0) || metadata?.hasUploadedDocuments === true;
    const isFirst = isFirstMessage === true || !chat_history || chat_history.length === 0;
    const startTime = Date.now();

    // Effective MCP tool-loop gate: env kill-switch AND the per-user PostHog flag
    // (forwarded as `tool_loop`) AND an authenticated caller. Drives both whether
    // MCP tools are advertised and whether the loop dispatches through the registry.
    const toolLoopActive = computeToolLoopActive({
      envEnabled: TOOL_LOOP_ENV,
      requestToolLoop: tool_loop === true,
      authenticated: !!userId,
    });

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

    if (userId && supabaseClient) {
      // ── Avatar resolution (avatar-aware retrieval, Phase 3) ─────────────
      // Only runs for an authenticated caller — a body-supplied avatar_id is
      // never used to query without a verified session (security C2).
      // Effective avatar = validated body avatar_id ELSE profiles
      // .current_avatar_id (so retrieval re-scopes correctly even before the
      // SPA wires avatar_id into the chat body in Phase 4).
      // brand_id is intentionally NOT resolved here: KB is user_id-keyed (one
      // brand per user) and brand rows are already bounded by user_id +
      // scope='brand', so brand_id is not needed in the retrieval WHERE on this
      // base (design MAP §4.1). Avoiding the lookup removes a serial round-trip
      // on the hot path of every authenticated chat turn.
      let avatarId: string | null = asUuidOrNull(avatar_id ?? metadata?.avatar_id);
      try {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('current_avatar_id')
          .eq('id', userId)
          .maybeSingle();
        if (!avatarId) avatarId = asUuidOrNull(profile?.current_avatar_id);
      } catch (e) {
        // Non-fatal: fall back to brand-only retrieval (avatarId stays as-is).
        console.error('[Context] Avatar resolution failed:', e);
      }
      console.log('[Context] Effective scope', { avatar: avatarId ?? 'none' });

      const [ctxResult, snapshot] = await Promise.all([
        retrieveAllContext(supabaseClient, userId, message, {
          needsFullContext,
          hasUploadedDocuments,
          avatarId,
        }),
        memoryEnabled ? buildMemorySnapshot(supabaseClient, userId) : Promise.resolve(''),
      ]);
      userKnowledgeContext = ctxResult.userKnowledgeContext;
      memorySnapshot = snapshot;
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
      // MCP-backed tools (ADR Phase 2) — advertised only when the effective gate
      // holds (env kill-switch + per-user PostHog flag + authenticated caller; the
      // MCP host scopes them to the forwarded JWT).
      ...(toolLoopActive ? MCP_TOOL_DEFS : []),
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

    console.log(`[Claude] Starting request. Model: ${CLAUDE_MODEL}, max_tokens: ${maxTokens}, tools: ${tools.length}, memory: ${memoryEnabled}, toolLoop: ${toolLoopActive} (env: ${TOOL_LOOP_ENV}), stream: ${!!streamRequested}`);

    const loopConfig = {
      apiKey: anthropicApiKey,
      apiUrl: CLAUDE_API_URL,
      requestBody,
      messages,
      supabaseClient,
      userId,
      jwt,
      startTime,
      toolLoopEnabled: toolLoopActive,
      model: CLAUDE_MODEL,
      // Best-effort caller geo for per-country latency slicing (telemetry only).
      country: resolveCountry(req),
      // Meter the whole turn's token usage once at completion (records always; debits; never throws).
      meter: (usage: { input_tokens: number; output_tokens: number }) => {
        if (userId) return meterAndDebit(getServiceClient(), { userId, op: 'coach_turn', model: CLAUDE_MODEL, usage });
      },
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
    // Full detail server-side only; the caller gets a generic message (no
    // information disclosure — error.message can carry internal hosts/paths).
    console.error('[Fatal]', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

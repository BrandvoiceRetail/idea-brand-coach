import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { retrieveUserContext, retrieveSemanticContext, retrieveVectorStoreContext } from "./rag.ts";
import { buildTieredFieldContext, buildExtractionTool } from "./fields.ts";
import { generateConversationalTrevorPrompt, generateTrevorSystemPrompt, generateFollowUpSuggestions } from "./prompts.ts";
import { buildChatCompletionsImageContent, buildResponsesApiImageContent, buildImageAnalysisSuffix } from "./image-handler.ts";
import { buildStreamingResponse } from "./stream-builder.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
if (!openAIApiKey) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      console.error('OpenAI API key not found');
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured. Please contact administrator.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ─── Auth ───
    const authHeader = req.headers.get('authorization');
    console.log('Auth header present:', !!authHeader);

    let userId: string | null = null;
    let supabaseClient: ReturnType<typeof createClient> | null = null;

    if (authHeader) {
      supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      console.log('getUser result:', { hasUser: !!user, userId: user?.id, authError });

      if (user) {
        userId = user.id;
        console.log('Authenticated user:', userId);

        // Ensure user has vector stores (create if first time)
        console.log("Ensuring user KB exists...");
        const ensureKbResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/ensure-user-kb`,
          { method: "POST", headers: { "Authorization": authHeader, "Content-Type": "application/json" } }
        );

        if (!ensureKbResponse.ok) {
          const errorText = await ensureKbResponse.text();
          console.error("Failed to ensure user KB:", ensureKbResponse.status, errorText);
        } else {
          const kbResult = await ensureKbResponse.json();
          console.log("User KB status:", kbResult.exists ? "already exists" : "created");
        }
      }
    }

    // ─── Parse request ───
    const { message, context, chat_history, metadata, chapterContext, isFirstMessage, useResponsesApi, previousResponseId, stream: streamRequested } = await req.json();
    const messageImages = metadata?.images || [];
    const userDocuments = metadata?.userDocuments || [];
    const hasUploadedDocuments = userDocuments.length > 0 || metadata?.hasUploadedDocuments === true;

    const startTime = Date.now();
    const isFirst = isFirstMessage === true || !chat_history || chat_history.length === 0;

    console.log('IDEA Framework Consultant request:', {
      message,
      hasManualContext: !!context,
      hasChatHistory: !!chat_history,
      chatHistoryLength: chat_history?.length || 0,
      hasImages: messageImages.length > 0,
      imageCount: messageImages.length,
      hasChapterContext: !!chapterContext,
      chapterContext,
      isFirstMessage: isFirst,
      hasUploadedDocuments,
      userDocumentsCount: userDocuments.length,
      userId
    });

    // ─── Retrieve context (RAG) ───
    const useComprehensiveMode = chapterContext?.comprehensiveMode === true;
    const isSimpleGreeting = message.toLowerCase().match(/^(hi|hello|hey|good\s+(morning|afternoon|evening))[\s!.?]*$/i);
    const isShortMessage = message.length < 50;
    const needsFullContext = !isSimpleGreeting && (!isShortMessage || useComprehensiveMode || hasUploadedDocuments);

    let userKnowledgeContext = '';
    let semanticContext = '';
    let vectorStoreContext = '';
    let sources: string[] = [];

    if (userId && supabaseClient) {
      if (needsFullContext) {
        console.log('[Performance] Full context retrieval for complex query');
        console.log('[Document Retrieval] Triggering vector store search due to:', {
          isShortMessage, useComprehensiveMode, hasUploadedDocuments, needsFullContext
        });
        const ctxStartTime = Date.now();

        const [knowledgeResult, semanticResult, vectorStoreResult] = await Promise.all([
          retrieveUserContext(supabaseClient as unknown as Record<string, unknown>, userId, message),
          retrieveSemanticContext(supabaseClient as unknown as Record<string, unknown>, userId, message),
          retrieveVectorStoreContext(supabaseClient as unknown as Record<string, unknown>, userId, message)
        ]);

        userKnowledgeContext = knowledgeResult;
        semanticContext = semanticResult.content;
        vectorStoreContext = vectorStoreResult;
        sources = semanticResult.sources;
        console.log(`[Performance] Full context retrieval took ${Date.now() - ctxStartTime}ms`);
      } else {
        console.log('[Performance] Minimal context retrieval for conversational query');
        const ctxStartTime = Date.now();
        userKnowledgeContext = await retrieveUserContext(supabaseClient as unknown as Record<string, unknown>, userId, message, true);
        console.log(`[Performance] Minimal context retrieval took ${Date.now() - ctxStartTime}ms`);
      }

      console.log('Context retrieval complete:', {
        mode: needsFullContext ? 'full' : 'minimal',
        hasKnowledgeContext: !!userKnowledgeContext,
        knowledgeContextLength: userKnowledgeContext.length,
        hasSemanticContext: !!semanticContext,
        semanticContextLength: semanticContext.length,
        hasVectorStoreContext: !!vectorStoreContext,
        vectorStoreContextLength: vectorStoreContext.length,
        sourcesCount: sources.length
      });
    }

    // ─── Build prompt (prompts.ts) ───
    const extractionFields = chapterContext?.fieldsToCapture || chapterContext?.extractionFields;
    const focusedField = chapterContext?.focusedField;
    const currentFieldDetails = chapterContext?.currentFieldDetails;

    if (extractionFields && extractionFields.length > 0) {
      console.log(`[Field Extraction] Active with ${extractionFields.length} fields: ${extractionFields.join(', ')}`);
    }
    if (focusedField) {
      console.log(`[Focused Field] Active on field: ${focusedField}`);
    }
    if (isFirst) {
      console.log('[First Message] Trevor introduction protocol active');
    }

    const hasDocuments = hasUploadedDocuments || !!vectorStoreContext;
    const systemPrompt = useComprehensiveMode
      ? generateTrevorSystemPrompt(extractionFields, isFirst, hasDocuments)
      : generateConversationalTrevorPrompt(extractionFields, currentFieldDetails, isFirst, hasDocuments);

    // ─── Build user prompt with context ───
    let userPrompt = message;
    const contextParts: string[] = [];

    // 1. Knowledge base context (changes rarely -- good cache candidate)
    if (userKnowledgeContext) contextParts.push(userKnowledgeContext);
    // 2. Manually provided context (semi-static)
    if (context) contextParts.push(`ADDITIONAL CONTEXT:\n${context}`);
    // 3. Retrieved document context (changes per-query)
    if (semanticContext) contextParts.push(semanticContext);
    if (vectorStoreContext) contextParts.push(vectorStoreContext);
    // 4. Field state context (changes per-turn)
    if (chapterContext?.currentFieldValues) {
      contextParts.push(buildTieredFieldContext(chapterContext.currentFieldValues, chapterContext.currentChapterKey));
    }

    if (contextParts.length > 0 || messageImages.length > 0) {
      let promptSuffix = `\n\n---\n\nQUESTION: ${message}\n\nIMPORTANT: Use ALL the context information above to provide personalized, specific advice. Reference their actual brand information, uploaded documents, and previous inputs when relevant.`;

      if (messageImages.length > 0) {
        promptSuffix += buildImageAnalysisSuffix(messageImages.length);
      }

      userPrompt = contextParts.length > 0
        ? `${contextParts.join('\n\n---\n\n')}${promptSuffix}`
        : message + promptSuffix;
    }

    console.log('Making OpenAI API request with model: gpt-4.1-2025-04-14');
    console.log('Context summary:', {
      hasKnowledgeContext: !!userKnowledgeContext,
      hasSemanticContext: !!semanticContext,
      hasManualContext: !!context,
      totalContextParts: contextParts.length,
      totalPromptLength: userPrompt.length
    });

    // ─── Call OpenAI ───
    try {
      // Build messages array (Chat Completions path)
      const messages: Array<{ role: string; content: unknown }> = [
        { role: 'system', content: systemPrompt }
      ];

      if (chat_history && Array.isArray(chat_history)) {
        const historyLimit = useComprehensiveMode ? 10 : 5;
        const recentHistory = chat_history.slice(-historyLimit);
        messages.push(...recentHistory.map((msg: Record<string, string>) => ({
          role: msg.role,
          content: msg.content
        })));
        console.log(`Added ${recentHistory.length} messages from chat history (limit: ${historyLimit})`);
      }

      // Add current user message (with images if present)
      if (messageImages.length > 0) {
        messages.push({ role: 'user', content: buildChatCompletionsImageContent(userPrompt, messageImages) });
        console.log(`Added ${messageImages.length} images to user message for GPT-4 Vision analysis`);
      } else {
        messages.push({ role: 'user', content: userPrompt });
      }

      // Token limits
      const comprehensiveModeForTokens = chapterContext?.comprehensiveMode === true;
      const hasActiveExtraction = (extractionFields && extractionFields.length > 0) || hasDocuments;
      const conversationalTokens = hasDocuments ? 2500 : (hasActiveExtraction ? 1500 : 800);
      const maxTokens = comprehensiveModeForTokens ? 4000 : conversationalTokens;

      // Build extraction tool (fields.ts)
      const scopeChapterKey = chapterContext?.currentChapterKey;
      const extractionTool = hasActiveExtraction
        ? buildExtractionTool(extractionFields, scopeChapterKey)
        : null;

      console.log(`[Performance] Starting OpenAI API call (max_tokens: ${maxTokens}, tools: ${hasActiveExtraction ? 'extract_brand_fields' : 'none'}, api: ${useResponsesApi ? 'responses' : 'completions'}, stream: ${!!streamRequested})`);
      console.log('[Request State]', {
        promptLength: userPrompt.length,
        systemPromptLength: systemPrompt.length,
        chatHistoryLength: chat_history?.length || 0,
        previousResponseId: previousResponseId || 'none',
        hasUploadedDocuments,
        comprehensiveMode: useComprehensiveMode,
        isFirstMessage: isFirst,
      });
      const openAIStartTime = Date.now();

      let consultantResponse: string;
      let extractedFields: Array<{ identifier: string; value: unknown; confidence: number; source: string; context?: string }> = [];
      let responseId: string | undefined;

      if (useResponsesApi) {
        // ─── Responses API path ───
        const responsesTools: object[] = [];
        if (extractionTool) {
          const toolDef = (extractionTool as Record<string, Record<string, unknown>>).function;
          responsesTools.push({
            type: "function",
            name: toolDef.name,
            description: toolDef.description,
            parameters: toolDef.parameters,
            strict: false,
          });
        }

        // Build input array
        const inputItems: Array<{ role: string; content: unknown }> = [];
        if (!previousResponseId && chat_history && Array.isArray(chat_history)) {
          const historyLimit = useComprehensiveMode ? 10 : 5;
          const recentHistory = chat_history.slice(-historyLimit);
          inputItems.push(...recentHistory.map((msg: Record<string, string>) => ({
            role: msg.role,
            content: msg.content
          })));
        }
        // Current user message
        if (messageImages.length > 0) {
          inputItems.push({ role: 'user', content: buildResponsesApiImageContent(userPrompt, messageImages) });
        } else {
          inputItems.push({ role: 'user', content: userPrompt });
        }

        const responsesBody: Record<string, unknown> = {
          model: 'gpt-4.1-2025-04-14',
          instructions: systemPrompt,
          input: inputItems,
          temperature: 0.7,
          max_output_tokens: maxTokens,
          store: true,
        };

        if (previousResponseId) {
          responsesBody.previous_response_id = previousResponseId;
          console.log(`[Conversations] Chaining to previous response: ${previousResponseId}`);
        }

        if (responsesTools.length > 0) {
          responsesBody.tools = responsesTools;
          responsesBody.tool_choice = "auto";
          responsesBody.parallel_tool_calls = true;
        }

        /** Check whether an OpenAI error indicates a stale conversation chain. */
        const isStaleChainError = (status: number, body: string): boolean =>
          status === 400 && (body.includes('pending') || body.includes('tool') || body.includes('previous_response_id'));

        /** Strip chaining fields so the next request starts a fresh conversation turn. */
        const retryWithoutChaining = (): void => {
          console.warn('[Conversations] Stale chain detected — retrying without previous_response_id');
          delete responsesBody.previous_response_id;
          if (chat_history && Array.isArray(chat_history)) {
            const historyLimit = useComprehensiveMode ? 10 : 5;
            const recentHistory = chat_history.slice(-historyLimit);
            (responsesBody.input as Array<{ role: string; content: unknown }>) = [
              ...recentHistory.map((msg: Record<string, string>) => ({ role: msg.role, content: msg.content })),
              ...(responsesBody.input as Array<{ role: string; content: unknown }>).slice(-1),
            ];
          }
        };

        // ─── Streaming SSE path (stream-builder.ts) ───
        if (streamRequested) {
          responsesBody.stream = true;
          console.log(`[Streaming] Starting stream request. previousResponseId: ${previousResponseId || 'none'}, tools: ${responsesTools.length}, inputItems: ${(responsesBody.input as unknown[]).length}`);

          let openAIResponse = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(responsesBody)
          });

          // Retry without chaining if previous response has unresolved tool calls
          if (!openAIResponse.ok && previousResponseId) {
            const errorBody = await openAIResponse.text();
            console.error('[Streaming] First attempt failed:', {
              status: openAIResponse.status, previousResponseId,
              errorBody: errorBody.substring(0, 500),
              inputItemCount: (responsesBody.input as unknown[])?.length,
            });
            if (isStaleChainError(openAIResponse.status, errorBody)) {
              retryWithoutChaining();
              responsesBody.stream = true;
              openAIResponse = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(responsesBody)
              });
            } else {
              throw new Error(`OpenAI Responses API error: ${openAIResponse.status} - ${errorBody}`);
            }
          }

          if (!openAIResponse.ok) {
            const errorBody = await openAIResponse.text();
            console.error('[Streaming] Final attempt failed:', {
              status: openAIResponse.status,
              errorBody: errorBody.substring(0, 500),
              hadPreviousResponseId: !!previousResponseId,
              inputItemCount: (responsesBody.input as unknown[])?.length,
              promptLength: userPrompt.length,
            });
            throw new Error(`OpenAI Responses API error: ${openAIResponse.status} - ${errorBody}`);
          }

          const stream = buildStreamingResponse({ openAIResponse, startTime });

          return new Response(stream, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            }
          });
        }

        // ─── Non-streaming Responses API path ───
        let response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(responsesBody)
        });

        if (!response.ok && previousResponseId) {
          const errorBody = await response.text();
          console.error('[Responses API] First attempt failed:', {
            status: response.status, previousResponseId,
            errorBody: errorBody.substring(0, 500),
            inputItemCount: (responsesBody.input as unknown[])?.length,
            hasTools: !!(responsesBody.tools as unknown[])?.length,
          });
          if (isStaleChainError(response.status, errorBody)) {
            retryWithoutChaining();
            response = await fetch('https://api.openai.com/v1/responses', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(responsesBody)
            });
          } else {
            throw new Error(`OpenAI Responses API error: ${response.status} - ${errorBody}`);
          }
        }

        if (!response.ok) {
          const errorBody = await response.text();
          console.error('[Responses API] Final attempt failed:', {
            status: response.status,
            errorBody: errorBody.substring(0, 500),
            hadPreviousResponseId: !!previousResponseId,
            inputItemCount: (responsesBody.input as unknown[])?.length,
            promptLength: userPrompt.length,
          });
          throw new Error(`OpenAI Responses API error: ${response.status} - ${errorBody}`);
        }

        const data = await response.json();
        const openAITime = Date.now() - openAIStartTime;
        console.log(`[Performance] Responses API response received in ${openAITime}ms`);

        responseId = data.id;
        if (responseId) console.log(`[Conversations] Response ID: ${responseId}`);

        // Parse Responses API output
        consultantResponse = '';
        for (const item of (data.output || [])) {
          if (item.type === 'message' && item.role === 'assistant') {
            for (const part of (item.content || [])) {
              if (part.type === 'output_text') {
                consultantResponse += part.text;
              }
            }
          } else if (item.type === 'function_call' && item.name === 'extract_brand_fields') {
            try {
              const args = JSON.parse(item.arguments);
              extractedFields = args.fields || [];
              console.log(`[Field Extraction] Responses API extracted ${extractedFields.length} fields:`, extractedFields.map((f: { identifier: string }) => f.identifier).join(', '));
            } catch (e) {
              console.error('[Field Extraction] Failed to parse function call arguments:', e);
            }
          }
        }

        if (data.usage) {
          const cached = data.usage.prompt_tokens_details?.cached_tokens || 0;
          console.log(`[Usage] Input: ${data.usage.input_tokens} (cached: ${cached}), Output: ${data.usage.output_tokens}`);
        }

        if (data.status === 'incomplete') {
          console.warn('Response incomplete');
          consultantResponse += '\n[Response may be incomplete]';
        }
      } else {
        // ─── Chat Completions API path (legacy) ───
        const requestBody: Record<string, unknown> = {
          model: 'gpt-4.1-2025-04-14',
          messages,
          temperature: 0.7,
          max_tokens: maxTokens
        };

        if (extractionTool) {
          requestBody.tools = [extractionTool];
          requestBody.tool_choice = "auto";
          requestBody.parallel_tool_calls = true;
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error('OpenAI API error response:', errorBody);
          throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
        }

        const data = await response.json();
        const openAITime = Date.now() - openAIStartTime;
        console.log(`[Performance] OpenAI API response received in ${openAITime}ms`);

        consultantResponse = data.choices[0].message.content || '';
        const finishReason = data.choices[0].finish_reason;

        if (finishReason === 'length') {
          console.warn('Response truncated due to token limit');
          consultantResponse += '\n[Response may be incomplete]';
        } else {
          console.log(`Response completed normally (finish_reason: ${finishReason})`);
        }

        const toolCalls = data.choices[0].message.tool_calls || [];
        for (const toolCall of toolCalls) {
          if (toolCall.function?.name === 'extract_brand_fields') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              extractedFields = args.fields || [];
              console.log(`[Field Extraction] Tool call extracted ${extractedFields.length} fields:`, extractedFields.map((f: { identifier: string }) => f.identifier).join(', '));
            } catch (e) {
              console.error('[Field Extraction] Failed to parse tool call arguments:', e);
            }
          }
        }

        if (toolCalls.length === 0 && hasActiveExtraction) {
          console.log('[Field Extraction] No tool call made — model did not detect extractable information');
        }
      }

      console.log('IDEA Framework consultation completed successfully');

      const suggestions = comprehensiveModeForTokens
        ? generateFollowUpSuggestions(message, consultantResponse)
        : [];

      if (suggestions.length > 0) {
        console.log(`Generated ${suggestions.length} follow-up suggestions`);
      }

      const totalTime = Date.now() - startTime;
      console.log(`[Performance] Total response time: ${totalTime}ms (mode: ${comprehensiveModeForTokens ? 'comprehensive' : 'conversational'})`);

      return new Response(JSON.stringify({
        response: consultantResponse,
        extractedFields,
        suggestions,
        sources,
        responseId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (apiError) {
      console.error('[FATAL] OpenAI API error:', {
        message: (apiError as Error)?.message,
        name: (apiError as Error)?.name,
        stack: (apiError as Error)?.stack?.split('\n').slice(0, 5).join('\n'),
      });
      throw apiError;
    }
  } catch (error) {
    const errorDetails = {
      message: (error as Error)?.message || String(error),
      name: (error as Error)?.name,
      stack: (error as Error)?.stack?.split('\n').slice(0, 5).join('\n'),
    };
    console.error('[FATAL] idea-framework-consultant unhandled error:', JSON.stringify(errorDetails));
    return new Response(JSON.stringify({
      error: `Consultation failed: ${(error as Error).message}`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

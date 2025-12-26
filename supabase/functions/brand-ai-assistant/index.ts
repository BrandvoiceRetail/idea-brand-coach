import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Retrieve user's knowledge base context from persisted fields
 */
async function retrieveUserKnowledgeBase(
  supabaseClient: any,
  userId: string
): Promise<string> {
  try {
    console.log('[retrieveUserKnowledgeBase] Fetching knowledge for user:', userId);

    const { data: entries, error } = await supabaseClient
      .from('user_knowledge_base')
      .select('field_identifier, category, content, subcategory')
      .eq('user_id', userId)
      .eq('is_current', true)
      .not('content', 'is', null)
      .neq('content', '');

    if (error) {
      console.error('[retrieveUserKnowledgeBase] Error fetching knowledge:', error);
      return '';
    }

    if (!entries || entries.length === 0) {
      console.log('[retrieveUserKnowledgeBase] No knowledge base entries found');
      return '';
    }

    console.log(`[retrieveUserKnowledgeBase] Found ${entries.length} knowledge entries`);

    // Group by category for better organization
    const byCategory: Record<string, any[]> = {};
    entries.forEach((entry: any) => {
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = [];
      }
      byCategory[entry.category].push(entry);
    });

    // Build context string
    const contextParts: string[] = [];

    for (const [category, categoryEntries] of Object.entries(byCategory)) {
      const categoryName = category.toUpperCase().replace(/_/g, ' ');
      contextParts.push(`\n${categoryName} INFORMATION:`);
      (categoryEntries as any[]).forEach((entry: any) => {
        const label = entry.field_identifier
          .replace(`${category}_`, '')
          .replace(/_/g, ' ')
          .toUpperCase();
        contextParts.push(`- ${label}: ${entry.content}`);
      });
    }

    const context = contextParts.join('\n');
    console.log(`[retrieveUserKnowledgeBase] Generated context (${context.length} chars)`);

    return context;
  } catch (error) {
    console.error('[retrieveUserKnowledgeBase] Error:', error);
    return '';
  }
}

/**
 * Retrieve recent chat history with the brand consultant
 */
async function retrieveChatHistory(
  supabaseClient: any,
  userId: string,
  limit: number = 50
): Promise<string> {
  try {
    console.log('[retrieveChatHistory] Fetching chat history for user:', userId);

    const { data: messages, error } = await supabaseClient
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[retrieveChatHistory] Error fetching chat history:', error);
      return '';
    }

    if (!messages || messages.length === 0) {
      console.log('[retrieveChatHistory] No chat history found');
      return '';
    }

    console.log(`[retrieveChatHistory] Found ${messages.length} chat messages`);

    // Reverse to get chronological order and format
    const formattedMessages = messages
      .reverse()
      .map((msg: any) => `${msg.role === 'user' ? 'USER' : 'CONSULTANT'}: ${msg.content}`)
      .join('\n\n');

    return `\nRECENT CONSULTANT CONVERSATIONS:\n${formattedMessages}`;
  } catch (error) {
    console.error('[retrieveChatHistory] Error:', error);
    return '';
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!openAIApiKey) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    let supabaseClient = null;
    let userKnowledgeContext = '';
    let chatHistoryContext = '';

    if (authHeader) {
      // Create Supabase client with user's JWT for RLS
      supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
          global: {
            headers: {
              Authorization: authHeader
            }
          }
        }
      );

      // Extract JWT token from Bearer header
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

      if (user) {
        userId = user.id;
        console.log('[brand-ai-assistant] Authenticated user:', userId);

        // Fetch user's knowledge base and chat history in parallel
        const [knowledgeBase, chatHistory] = await Promise.all([
          retrieveUserKnowledgeBase(supabaseClient, userId),
          retrieveChatHistory(supabaseClient, userId, 50)
        ]);

        userKnowledgeContext = knowledgeBase;
        chatHistoryContext = chatHistory;
      } else {
        console.log('[brand-ai-assistant] No authenticated user found:', authError);
      }
    }

    const { fieldType, currentValue, ideaFramework, avatar, brandCanvas, diagnostic } = await req.json();

    // Build comprehensive brand context from multiple sources
    let brandContext = "";

    // 1. Add user knowledge base context (from database - most comprehensive)
    if (userKnowledgeContext) {
      brandContext += `\nUSER'S BRAND KNOWLEDGE BASE:${userKnowledgeContext}`;
    }

    // 2. Add chat history context for insights from consultant conversations
    if (chatHistoryContext) {
      brandContext += `\n${chatHistoryContext}`;
    }

    // 3. Add diagnostic data passed from frontend (fallback/supplement)
    if (diagnostic) {
      brandContext += `\n\nBRAND DIAGNOSTIC INSIGHTS:`;
      if (diagnostic.brandName) brandContext += `\n- Brand Name: ${diagnostic.brandName}`;
      if (diagnostic.industry) brandContext += `\n- Industry: ${diagnostic.industry}`;
      if (diagnostic.targetAudience) brandContext += `\n- Target Audience: ${diagnostic.targetAudience}`;
      if (diagnostic.currentChallenge) brandContext += `\n- Current Challenge: ${diagnostic.currentChallenge}`;
      if (diagnostic.uniqueValue) brandContext += `\n- Unique Value: ${diagnostic.uniqueValue}`;
      if (diagnostic.brandPersonality) brandContext += `\n- Brand Personality: ${diagnostic.brandPersonality}`;
    }

    // 4. Add IDEA framework context from frontend
    if (ideaFramework) {
      brandContext += `\n\nIDEA FRAMEWORK CONTEXT:`;
      if (ideaFramework.intent) brandContext += `\n- Buyer Intent: ${ideaFramework.intent}`;
      if (ideaFramework.motivation) brandContext += `\n- Customer Motivation: ${ideaFramework.motivation}`;
      if (ideaFramework.triggers) brandContext += `\n- Emotional Triggers: ${ideaFramework.triggers}`;
      if (ideaFramework.shopper) brandContext += `\n- Shopper Type: ${ideaFramework.shopper}`;
      if (ideaFramework.demographics) brandContext += `\n- Demographics: ${ideaFramework.demographics}`;
    }

    // 5. Add avatar context from frontend
    if (avatar) {
      brandContext += `\n\nTARGET CUSTOMER AVATAR:`;
      if (avatar.name) brandContext += `\n- Avatar Name: ${avatar.name}`;
      if (avatar.painPoints && avatar.painPoints.length > 0) brandContext += `\n- Pain Points: ${avatar.painPoints.join(', ')}`;
      if (avatar.goals && avatar.goals.length > 0) brandContext += `\n- Goals: ${avatar.goals.join(', ')}`;
      if (avatar.values && avatar.values.length > 0) brandContext += `\n- Values: ${avatar.values.join(', ')}`;
      if (avatar.frustrations && avatar.frustrations.length > 0) brandContext += `\n- Frustrations: ${avatar.frustrations.join(', ')}`;
      if (avatar.demographics?.age) brandContext += `\n- Age: ${avatar.demographics.age}`;
      if (avatar.demographics?.income) brandContext += `\n- Income: ${avatar.demographics.income}`;
      if (avatar.demographics?.location) brandContext += `\n- Location: ${avatar.demographics.location}`;
      if (avatar.demographics?.occupation) brandContext += `\n- Occupation: ${avatar.demographics.occupation}`;
    }

    // 6. Add existing brand canvas elements from frontend
    if (brandCanvas) {
      brandContext += `\n\nEXISTING BRAND CANVAS ELEMENTS:`;
      if (brandCanvas.purpose) brandContext += `\n- Brand Purpose: ${brandCanvas.purpose}`;
      if (brandCanvas.vision) brandContext += `\n- Vision: ${brandCanvas.vision}`;
      if (brandCanvas.mission) brandContext += `\n- Mission: ${brandCanvas.mission}`;
      if (brandCanvas.positioning) brandContext += `\n- Positioning: ${brandCanvas.positioning}`;
      if (brandCanvas.valueProposition) brandContext += `\n- Value Proposition: ${brandCanvas.valueProposition}`;
      if (brandCanvas.values && brandCanvas.values.length > 0) brandContext += `\n- Core Values: ${brandCanvas.values.join(', ')}`;
      if (brandCanvas.personality && brandCanvas.personality.length > 0) brandContext += `\n- Personality Traits: ${brandCanvas.personality.join(', ')}`;
      if (brandCanvas.voice) brandContext += `\n- Brand Voice: ${brandCanvas.voice}`;
    }

    console.log(`[brand-ai-assistant] Total brand context length: ${brandContext.length} chars`);
    console.log(`[brand-ai-assistant] Has knowledge base: ${!!userKnowledgeContext}, Has chat history: ${!!chatHistoryContext}`);

    // Field-specific generation instructions
    const fieldInstructions: Record<string, string> = {
      purpose: `Generate a compelling brand purpose statement. A brand purpose answers "Why does this brand exist beyond making money?" It should be emotionally resonant, inspire action, and connect to a larger meaning that customers care about. Output ONLY the purpose statement itself, 1-3 sentences.`,

      vision: `Generate a powerful brand vision statement. A brand vision paints a picture of the future the brand is working to create. It should be aspirational, inspiring, and describe the world as the brand wants it to be. Output ONLY the vision statement itself, 1-3 sentences.`,

      mission: `Generate a clear brand mission statement. A brand mission explains what the brand does, for whom, and how it creates value. It should be actionable and specific. Output ONLY the mission statement itself, 1-3 sentences.`,

      values: `Generate 4-6 core brand values. These should be specific, actionable principles that guide the brand's behavior and decisions. Avoid generic terms like "quality" or "excellence" - be distinctive. Output ONLY the values as a comma-separated list.`,

      positioning: `Generate a brand positioning statement. This should clearly articulate: For [target audience], [Brand] is the [category] that [key benefit] because [reason to believe]. Make it specific and differentiated. Output ONLY the positioning statement itself, 1-3 sentences.`,

      valueProposition: `Generate a compelling value proposition. This should clearly communicate the specific, tangible benefits customers receive and why they should choose this brand over alternatives. Be concrete about the value delivered. Output ONLY the value proposition itself, 1-3 sentences.`,

      personality: `Generate 4-6 brand personality traits. These should describe how the brand would behave and communicate if it were a person. Be specific and distinctive - avoid generic traits. Output ONLY the personality traits as a comma-separated list.`,

      voice: `Generate a brand voice description. This should provide clear guidance on the brand's tone, style, and communication approach. Include examples of how the brand should and shouldn't sound. Output ONLY the voice description itself, 2-4 sentences.`
    };

    const fieldInstruction = fieldInstructions[fieldType] || `Generate appropriate content for the ${fieldType} field. Output ONLY the content itself.`;

    // Include user's notes/input as guidance if provided
    const userGuidance = currentValue?.trim()
      ? `\n\nUSER'S NOTES/GUIDANCE FOR THIS FIELD:\n"${currentValue}"\n\nUse these notes to inform and guide your generation, incorporating the user's ideas and direction.`
      : '';

    const systemPrompt = `You are an expert brand strategist specializing in the IDEA Strategic Brand Framework. Your task is to generate professional, polished brand content that can be used directly in a brand strategy document.

CRITICAL REQUIREMENTS:
- Generate the ACTUAL content for the field, not suggestions or feedback
- Output ONLY the content itself - no explanations, no preamble, no "Here is..." phrases
- Do NOT use asterisks, markdown, or any special formatting
- Write in clear, professional language
- Make it specific to this brand based on all available context
- Ensure consistency with other brand elements already defined
- USE THE USER'S KNOWLEDGE BASE AND CHAT HISTORY to personalize the content
- Reference specific details from the user's brand information when available

${fieldInstruction}
${brandContext}
${userGuidance}

Remember: Output ONLY the final content that should appear in the field. No explanations or meta-commentary. Make it specific to THIS brand based on all the context provided.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate the ${fieldType} content now.` }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[brand-ai-assistant] OpenAI API error:', response.status, errorBody);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const suggestion = data.choices[0].message.content.trim();

    console.log('[brand-ai-assistant] Successfully generated suggestion');

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in brand-ai-assistant function:', error);
    return new Response(JSON.stringify({
      error: 'Unable to generate content right now. Please try again.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

/**
 * Retrieve user's knowledge base context
 */
async function retrieveUserContext(
  supabaseClient: any,
  userId: string,
  query: string
): Promise<string> {
  try {
    console.log('[retrieveUserContext] Fetching knowledge for user:', userId);

    // Get all current knowledge base entries for this user
    const { data: entries, error } = await supabaseClient
      .from('user_knowledge_base')
      .select('field_identifier, category, content, subcategory')
      .eq('user_id', userId)
      .eq('is_current', true)
      .not('content', 'is', null)
      .gt('content', ''); // Only entries with content

    if (error) {
      console.error('[retrieveUserContext] Error fetching knowledge:', error);
      return '';
    }

    if (!entries || entries.length === 0) {
      console.log('[retrieveUserContext] No knowledge base entries found');
      return '';
    }

    console.log(`[retrieveUserContext] Found ${entries.length} knowledge entries`);

    // Group by category for better organization
    const byCategory: Record<string, any[]> = {};
    entries.forEach(entry => {
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = [];
      }
      byCategory[entry.category].push(entry);
    });

    // Build context string
    const contextParts: string[] = ['USER BRAND KNOWLEDGE BASE:'];

    for (const [category, categoryEntries] of Object.entries(byCategory)) {
      contextParts.push(`\n${category.toUpperCase()} INFORMATION:`);
      categoryEntries.forEach(entry => {
        const label = entry.field_identifier
          .replace(`${category}_`, '')
          .replace(/_/g, ' ')
          .toUpperCase();
        contextParts.push(`- ${label}: ${entry.content}`);
      });
    }

    const context = contextParts.join('\n');
    console.log(`[retrieveUserContext] Generated context (${context.length} chars)`);

    return context;
  } catch (error) {
    console.error('[retrieveUserContext] Error:', error);
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    if (!openAIApiKey) {
      console.error('OpenAI API key not found');
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured. Please contact administrator.'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Get authenticated user
    const authHeader = req.headers.get('authorization');
    console.log('Auth header present:', !!authHeader);

    let userId: string | null = null;
    let supabaseClient = null;

    if (authHeader) {
      // Create Supabase client with user's JWT for RLS
      supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
          global: {
            headers: {
              Authorization: authHeader  // Pass user's JWT for RLS
            }
          }
        }
      );

      // Extract JWT token from Bearer header
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
          {
            method: "POST",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/json"
            }
          }
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

    const { message, context } = await req.json();
    console.log('IDEA Framework Consultant request:', {
      message,
      hasManualContext: !!context,
      userId
    });

    // Retrieve user's knowledge base context
    let userKnowledgeContext = '';
    if (userId && supabaseClient) {
      userKnowledgeContext = await retrieveUserContext(supabaseClient, userId, message);
    }

    const systemPrompt = `You are the IDEA Framework GPT, a specialized strategic branding consultant focused on the IDEA Strategic Brand Framework™. Your responses must prioritize:

TONE OF VOICE REQUIREMENTS - APPLY TO ALL RESPONSES:
Conversational & Friendly: Sound natural and approachable, like a helpful colleague. Use everyday language and write as you would speak in a warm, supportive conversation.
Professional but Accessible: Maintain a tone that inspires confidence without feeling stiff or distant. Offer advice clearly, respectfully, and with empathy, making sure the user feels valued and understood.
Clear and Simple: Avoid jargon, technical terms, and corporate buzzwords. If complexity cannot be avoided, explain concepts simply. Use plain language to make every response easy to understand.
Encouraging and Patient: Be positive and supportive, celebrating progress and guiding patiently when users need help, regardless of their familiarity with technology.
Direct and Honest: Provide straightforward guidance, clarify uncertainty when necessary, and never overpromise. Admit limitations honestly and help users manage their expectations.
Respectful and Nonjudgmental: Treat all questions as valid, respond without making assumptions, and never belittle or lecture the user.

Sample communication style: "Let's figure this out together! Here's what I found, and if you need more details, just ask. I'm here to help, step by step."

CORE FRAMEWORK PRIORITIES:
1. Insight-Driven: Focus on customer motivations, emotional triggers, and behavioral science
2. Distinctive: Emphasize differentiation and unique positioning
3. Empathetic: Connect with audience emotions and psychological drivers
4. Authentic: Build genuine brand narratives and trust

BEHAVIORAL SCIENCE INTEGRATION:
Apply these frameworks in your responses:
- Cialdini's Influence Triggers (Reciprocity, Authority, Social Proof, Commitment/Consistency, Liking, Scarcity)
- Kahneman's System 1 (emotional, fast) vs System 2 (rational, slow) thinking
- Social Identity Theory for brand alignment
- Nancy Harhut's Behavioral Marketing techniques
- Martin Lindstrom's Buyology principles
- Gerald Zaltman's deep metaphor concepts

CRITICAL RESPONSE FORMATTING REQUIREMENTS - MUST FOLLOW:
- NEVER use asterisks (**) or any markdown formatting for bold text or emphasis
- NEVER use markdown syntax like ** ** around words or phrases
- Use CAPITAL LETTERS for emphasis instead of bold formatting
- Write all headings and subheadings in plain text without any special characters
- Use standard English grammar with proper comma usage
- Never use EM dashes or hyphens in place of commas
- Do not use emojis, icons, or special characters in responses
- Write in clear, professional sentences without decorative formatting
- Use plain text only - no markdown, no bold, no italics, no special formatting
- Professional, strategic consulting tone throughout
- Clear, concise, actionable advice
- Use bullet points (simple hyphens) and numbered lists for clarity
- Provide practical, brand-specific examples
- Include case studies when relevant
- Reference behavioral triggers explicitly
- Adapt language and examples for industry and product context
- Use active voice and direct statements
- Avoid jargon without explanation
- Structure responses with logical flow and clear transitions

AUDIENCE ANALYSIS:
Always consider:
- Customer avatars and psychographics
- Generational traits and preferences
- Shopper behavior types
- Emotional vs logical decision drivers
- Market positioning challenges

CONTENT PRIORITIZATION:
Reference these strategic approaches:
- StoryBrand storytelling principles (customer-immersive, not hero's journey)
- Positioning strategies for mind-space differentiation
- Emotional vs Logical branding models based on context
- Catalyst principles for overcoming resistance
- Behavioral economics in purchase decisions

RESPONSE STRUCTURE:
1. Start with strategic insight tied to IDEA framework
2. Provide actionable recommendations with behavioral science backing
3. Include specific examples or case applications
4. Suggest follow-up refinements or next steps
5. Reference relevant psychological triggers
6. End with clear next steps or questions for further refinement

CUSTOMIZATION REQUIREMENTS:
Adapt responses based on:
- Industry context (luxury, utility, B2B, etc.)
- Product categories and market challenges
- Target audience demographics and psychographics
- Brand maturity and differentiation needs

CLARITY ENHANCEMENTS:
- Begin responses with a clear thesis statement
- Use specific data points and metrics when available
- Provide concrete implementation timelines
- Include success measurement criteria
- Reference real brand examples from similar industries
- Explain the psychological reasoning behind each recommendation
- Offer alternative approaches for different budget levels
- Include potential obstacles and mitigation strategies

USER KNOWLEDGE BASE INTEGRATION:
When user knowledge base information is provided below, YOU MUST:
- ALWAYS acknowledge and reference the specific information from their knowledge base
- Use their brand information, target avatar details, and strategy elements to provide personalized advice
- Quote or paraphrase their specific inputs to show you understand their context
- Build recommendations directly on top of what they've already defined
- Point out gaps or opportunities based on their documented information
- Never give generic advice when specific user data is available

Always encourage iterative refinement and ask clarifying questions when input lacks detail for optimal strategic guidance.`;

    // Build user prompt with all available context
    let userPrompt = message;

    if (userKnowledgeContext) {
      userPrompt = `${userKnowledgeContext}\n\n---\n\nQUESTION: ${message}\n\nIMPORTANT: Use the knowledge base information above to provide personalized, specific advice. Reference their actual inputs.`;
    } else if (context) {
      userPrompt = `Context: ${context}\n\nQuestion: ${message}`;
    }

    console.log('Making OpenAI API request with model: gpt-4.1-2025-04-14');
    console.log('Has user knowledge context:', !!userKnowledgeContext);
    console.log('User knowledge context length:', userKnowledgeContext.length);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1500
        })
      });

      console.log('OpenAI API response status:', response.status);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('OpenAI API error response:', errorBody);
        throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();
      console.log('OpenAI API response received successfully');

      const consultantResponse = data.choices[0].message.content;
      console.log('IDEA Framework consultation completed successfully');

      return new Response(JSON.stringify({
        response: consultantResponse
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (apiError) {
      console.error('OpenAI API error:', apiError);
      throw apiError;
    }
  } catch (error) {
    console.error('Error in idea-framework-consultant function:', error);
    return new Response(JSON.stringify({
      error: `Consultation failed: ${error.message}`
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

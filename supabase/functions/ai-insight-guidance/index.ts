import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AvatarData {
  name?: string;
  demographics: {
    age?: string;
    income?: string;
    location?: string;
    lifestyle?: string;
  };
  psychology: {
    values?: string[];
    fears?: string[];
    desires?: string[];
    triggers?: string[];
  };
  buyingBehavior: {
    intent?: string;
    decisionFactors?: string[];
    shoppingStyle?: string;
    priceConsciousness?: string;
  };
}

/**
 * Retrieve user's Avatar 2.0 data from user_knowledge_base
 */
async function retrieveAvatarData(
  supabaseClient: any,
  userId: string
): Promise<AvatarData> {
  const avatarData: AvatarData = {
    demographics: {},
    psychology: {},
    buyingBehavior: {}
  };

  try {
    console.log('[retrieveAvatarData] Fetching avatar data for user:', userId);

    const { data: entries, error } = await supabaseClient
      .from('user_knowledge_base')
      .select('field_identifier, content')
      .eq('user_id', userId)
      .eq('is_current', true)
      .like('field_identifier', 'avatar_%')
      .not('content', 'is', null)
      .neq('content', '');

    if (error) {
      console.error('[retrieveAvatarData] Error fetching avatar data:', error);
      return avatarData;
    }

    if (!entries || entries.length === 0) {
      console.log('[retrieveAvatarData] No avatar entries found');
      return avatarData;
    }

    console.log(`[retrieveAvatarData] Found ${entries.length} avatar entries`);

    // Parse entries into structured avatar data
    entries.forEach((entry: any) => {
      const { field_identifier, content } = entry;

      // Parse JSON arrays where applicable
      const parseJsonArray = (value: string): string[] => {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };

      switch (field_identifier) {
        case 'avatar_name':
          avatarData.name = content;
          break;
        case 'avatar_demographics_age':
          avatarData.demographics.age = content;
          break;
        case 'avatar_demographics_income':
          avatarData.demographics.income = content;
          break;
        case 'avatar_demographics_location':
          avatarData.demographics.location = content;
          break;
        case 'avatar_demographics_lifestyle':
          avatarData.demographics.lifestyle = content;
          break;
        case 'avatar_psychology_values':
          avatarData.psychology.values = parseJsonArray(content);
          break;
        case 'avatar_psychology_fears':
          avatarData.psychology.fears = parseJsonArray(content);
          break;
        case 'avatar_psychology_desires':
          avatarData.psychology.desires = parseJsonArray(content);
          break;
        case 'avatar_psychology_triggers':
          avatarData.psychology.triggers = parseJsonArray(content);
          break;
        case 'avatar_buying_behavior_intent':
          avatarData.buyingBehavior.intent = content;
          break;
        case 'avatar_buying_behavior_decision_factors':
          avatarData.buyingBehavior.decisionFactors = parseJsonArray(content);
          break;
        case 'avatar_buying_behavior_shopping_style':
          avatarData.buyingBehavior.shoppingStyle = content;
          break;
        case 'avatar_buying_behavior_price_consciousness':
          avatarData.buyingBehavior.priceConsciousness = content;
          break;
      }
    });

    return avatarData;
  } catch (error) {
    console.error('[retrieveAvatarData] Error:', error);
    return avatarData;
  }
}

/**
 * Build dynamic prompts based on Avatar data
 */
function buildDynamicPrompt(stepId: string, avatarData: AvatarData): string {
  const { demographics, psychology, buyingBehavior } = avatarData;
  const avatarName = avatarData.name || 'your target customer';

  // Build context string from available avatar data
  let avatarContext = '';

  if (avatarData.name) {
    avatarContext += `Your customer avatar is "${avatarName}". `;
  }

  if (demographics.age || demographics.income || demographics.location) {
    avatarContext += `Demographics: `;
    const parts = [];
    if (demographics.age) parts.push(`age ${demographics.age}`);
    if (demographics.income) parts.push(`income level ${demographics.income}`);
    if (demographics.location) parts.push(`${demographics.location} area`);
    avatarContext += parts.join(', ') + '. ';
  }

  if (demographics.lifestyle) {
    avatarContext += `Lifestyle: ${demographics.lifestyle}. `;
  }

  if (psychology.values && psychology.values.length > 0) {
    avatarContext += `Core values: ${psychology.values.join(', ')}. `;
  }

  if (psychology.fears && psychology.fears.length > 0) {
    avatarContext += `Primary fears: ${psychology.fears.join(', ')}. `;
  }

  if (psychology.desires && psychology.desires.length > 0) {
    avatarContext += `Deep desires: ${psychology.desires.join(', ')}. `;
  }

  if (psychology.triggers && psychology.triggers.length > 0) {
    avatarContext += `Emotional triggers: ${psychology.triggers.join(', ')}. `;
  }

  if (buyingBehavior.shoppingStyle) {
    avatarContext += `Shopping style: ${buyingBehavior.shoppingStyle}. `;
  }

  if (buyingBehavior.priceConsciousness) {
    avatarContext += `Price sensitivity: ${buyingBehavior.priceConsciousness}. `;
  }

  if (buyingBehavior.decisionFactors && buyingBehavior.decisionFactors.length > 0) {
    avatarContext += `Key decision factors: ${buyingBehavior.decisionFactors.join(', ')}. `;
  }

  // Step-specific dynamic prompts
  const stepPrompts: Record<string, string> = {
    intent: `Generate refined buyer intent content for ${avatarName}. ${avatarContext ? `Based on their profile: ${avatarContext}` : ''}

Focus on:
- What specific problems are they trying to solve?
- What search terms and behaviors indicate their buying readiness?
- What situations trigger their need for solutions like yours?

Write 2-3 paragraphs describing ${avatarName}'s buyer intent that can be used directly in a brand strategy document.`,

    motivation: `Generate refined buyer motivation content for ${avatarName}. ${avatarContext ? `Based on their profile: ${avatarContext}` : ''}

Focus on:
- What deeper psychological needs drive their decisions?
- What subconscious desires influence their choices?
- What aspirations and status needs are they trying to fulfill?
${psychology.fears && psychology.fears.length > 0 ? `- Address how their fears (${psychology.fears.join(', ')}) influence buying behavior.` : ''}
${psychology.desires && psychology.desires.length > 0 ? `- Connect to their desires (${psychology.desires.join(', ')}).` : ''}

Write 2-3 paragraphs describing ${avatarName}'s buyer motivations that can be used directly in a brand strategy document.`,

    triggers: `Generate refined emotional trigger content for ${avatarName}. ${avatarContext ? `Based on their profile: ${avatarContext}` : ''}

Focus on the 7 core emotional triggers and which resonate most:
- Hope, Belonging, Validation, Trust, Relief, Aspiration, Empowerment
${psychology.triggers && psychology.triggers.length > 0 ? `- Build upon their existing triggers: ${psychology.triggers.join(', ')}.` : ''}
${psychology.values && psychology.values.length > 0 ? `- Connect to their core values: ${psychology.values.join(', ')}.` : ''}

Write 2-3 paragraphs identifying the primary emotional triggers for ${avatarName} and how to leverage them in brand messaging.`,

    shopper: `Generate refined shopper type analysis for ${avatarName}. ${avatarContext ? `Based on their profile: ${avatarContext}` : ''}

Categorize using Shopify's research-backed shopper types:
- Cost Sensitive (50%): Price-focused, seeks deals
- Quality Focused (39%): Prioritizes quality over price
- Conscious (9%): Values sustainability and ethics
- Connected (2%): Influenced by social commerce
${buyingBehavior.shoppingStyle ? `- Their shopping style is: ${buyingBehavior.shoppingStyle}.` : ''}
${buyingBehavior.priceConsciousness ? `- Their price sensitivity is: ${buyingBehavior.priceConsciousness}.` : ''}

Write 2-3 paragraphs analyzing ${avatarName}'s shopper type and specific strategies to reach them.`,

    demographics: `Generate refined behavior-driven demographics for ${avatarName}. ${avatarContext ? `Based on their profile: ${avatarContext}` : ''}

Focus on demographics that actually influence purchasing:
- Usage patterns and consumption habits
- Channel preferences (online, mobile, in-store)
- Decision-making timeline and process
- Lifestyle indicators that correlate with buying behavior
${demographics.lifestyle ? `- Build on their lifestyle: ${demographics.lifestyle}.` : ''}

Write 2-3 paragraphs describing the behavior-driven demographic characteristics that matter for reaching ${avatarName}.`
  };

  return stepPrompts[stepId] || stepPrompts.intent;
}

serve(async (req) => {
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
    const { stepId, userInput, context } = await req.json();

    console.log('[ai-insight-guidance] Request:', { stepId, userInput: userInput?.substring(0, 100) + '...', context });

    // Get authenticated user and retrieve Avatar data
    const authHeader = req.headers.get('authorization');
    let avatarData: AvatarData = { demographics: {}, psychology: {}, buyingBehavior: {} };

    if (authHeader) {
      const supabaseClient = createClient(
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

      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(token);

      if (user) {
        console.log('[ai-insight-guidance] Authenticated user:', user.id);
        avatarData = await retrieveAvatarData(supabaseClient, user.id);
        console.log('[ai-insight-guidance] Avatar data retrieved:', {
          hasName: !!avatarData.name,
          hasDemographics: Object.keys(avatarData.demographics).length > 0,
          hasPsychology: Object.keys(avatarData.psychology).some(k => avatarData.psychology[k as keyof typeof avatarData.psychology]?.length),
          hasBuyingBehavior: Object.keys(avatarData.buyingBehavior).length > 0
        });
      }
    }

    // Build dynamic prompt based on Avatar data
    const dynamicPrompt = buildDynamicPrompt(stepId, avatarData);

    const systemPrompt = `You are an expert brand strategist specializing in customer psychology and the IDEA Strategic Brand Framework. Your task is to generate refined, polished content that can be used directly in a brand strategy document.

Current context: ${context}

CRITICAL REQUIREMENTS:
- Generate ACTUAL CONTENT for the field, not suggestions or feedback
- Output content that the user can accept and use directly
- Do NOT provide instructions or tips - write the actual strategy content
- NEVER use asterisks, markdown, or special formatting
- Write in clear, professional prose
- Be specific based on the user's Avatar data when available
- 2-3 paragraphs, detailed enough to be actionable
- Professional consulting tone throughout

The user has provided their initial thoughts. Use these as a starting point and enhance them with deeper insights based on their Avatar profile.

User's initial input: "${userInput}"`;

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
          { role: 'user', content: dynamicPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[ai-insight-guidance] OpenAI API error:', response.status, errorBody);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const guidance = data.choices[0].message.content.trim();

    console.log('[ai-insight-guidance] Content generated successfully');

    return new Response(JSON.stringify({ guidance }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ai-insight-guidance] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

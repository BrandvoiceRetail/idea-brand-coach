import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stepId, userInput, context } = await req.json();

    console.log('AI Insight Guidance request:', { stepId, userInput: userInput.substring(0, 100) + '...', context });

    const stepPrompts = {
      intent: "Analyze this buyer intent description and provide specific, actionable suggestions to make it more precise and behavior-focused. Focus on the 'why' behind customer searches and actions.",
      motivation: "Review this buyer motivation and suggest ways to dig deeper into the psychological drivers. Help identify subconscious needs and emotional drivers that influence purchase decisions.",
      triggers: "Evaluate these emotional triggers and provide guidance on how to strengthen the emotional connection. Suggest specific ways to implement these triggers in marketing and brand messaging.",
      shopper: "Analyze this shopper type classification and provide insights on how to better serve this customer segment. Include specific strategies for each shopper type.",
      demographics: "Review these demographics and help focus on behavior-driven characteristics that actually impact purchasing decisions. Eliminate irrelevant traits."
    };

    const systemPrompt = `You are an expert marketing strategist specializing in customer psychology and the IDEA framework. Your role is to help users refine their customer insights to be more actionable and behavior-focused.

Current context: ${context}

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

Instructions:
- Provide 3-4 specific, actionable suggestions
- Focus on behavioral insights rather than assumptions
- Include real-world examples when possible
- Keep suggestions concise but detailed enough to implement
- Always prioritize psychological and emotional drivers over demographics`;

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
          { role: 'user', content: `${stepPrompts[stepId] || stepPrompts.intent}\n\nUser's input: "${userInput}"` }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const guidance = data.choices[0].message.content;

    console.log('AI guidance generated successfully');

    return new Response(JSON.stringify({ guidance }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-insight-guidance function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
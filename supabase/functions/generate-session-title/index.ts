import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_message, assistant_response } = await req.json();

    if (!user_message) {
      return new Response(
        JSON.stringify({ error: 'user_message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use GPT-4o-mini for fast, cheap title generation
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a title generator. Generate a concise, descriptive title (3-6 words) that summarizes the main topic or intent of a conversation.

Rules:
- Be specific to the topic discussed
- Use title case
- No quotes or punctuation at the end
- Focus on the user's intent/question, not the response
- Examples of good titles: "Brand Positioning Strategy", "Customer Psychology Insights", "E-commerce Trust Building", "Emotional Marketing Tactics"

Respond with ONLY the title, nothing else.`
          },
          {
            role: 'user',
            content: `User's question: "${user_message}"

${assistant_response ? `Assistant's response summary: "${assistant_response.substring(0, 300)}..."` : ''}

Generate a concise title:`
          }
        ],
        max_tokens: 20,
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const title = data.choices?.[0]?.message?.content?.trim() || null;

    console.log('[generate-session-title] Generated title:', title);

    return new Response(
      JSON.stringify({ title }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-session-title] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

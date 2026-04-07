import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

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

    // Use Claude Haiku for fast, cheap title generation
    const systemPrompt = `You are a title generator. Generate a concise, descriptive title (3-6 words) that summarizes the main topic or intent of a conversation.

Rules:
- Be specific to the topic discussed
- Use title case
- No quotes or punctuation at the end
- Focus on the user's intent/question, not the response
- Examples of good titles: "Brand Positioning Strategy", "Customer Psychology Insights", "E-commerce Trust Building", "Emotional Marketing Tactics"

Respond with ONLY the title, nothing else.`;

    const userMessage = `User's question: "${user_message}"

${assistant_response ? `Assistant's response summary: "${assistant_response.substring(0, 300)}..."` : ''}

Generate a concise title:`;

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 30,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const title = data.content?.[0]?.text?.trim() || null;

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


import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, category, context } = await req.json();

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    console.log('API key exists:', !!anthropicApiKey);
    console.log('API key length:', anthropicApiKey?.length || 0);
    
    if (!anthropicApiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const systemPrompt = `You are an expert branding consultant providing contextual help for the IDEA Brand Diagnostic. 

The IDEA framework stands for:
- Insight: Understanding customer motivations beyond features
- Distinctiveness: What makes the brand unique
- Empathy: Connecting with customer emotions and fears
- Authenticity: Genuine and consistent brand voice

Your role is to provide SPECIFIC, ACTIONABLE guidance that helps users:
1. Understand what the question is really asking
2. Know exactly what to consider when answering
3. Get concrete next steps they can take immediately

Format your response with:
- A brief explanation of what to focus on
- 2-3 specific things to consider or evaluate
- One concrete action they can take right now to improve this area

Be encouraging but practical. Avoid generic advice - make it specific to the category and question.`;

    const categoryGuidance = {
      insight: "Focus on understanding the emotional and psychological drivers behind customer behavior. Look beyond demographics to psychographics.",
      distinctiveness: "Identify your unique brand positioning and how customers perceive you differently from competitors in their minds.",
      empathy: "Address the specific fears, anxieties, and emotional needs that your customers experience in relation to your industry/product.",
      authenticity: "Ensure your brand voice genuinely reflects your values and maintains consistency across all customer touchpoints."
    };

    const userPrompt = `Category: ${category}
Category Focus: ${categoryGuidance[category as keyof typeof categoryGuidance]}

Question: "${question}"

${context ? `Context: ${context}` : ''}

Provide specific, actionable guidance that helps the user answer this question effectively. Include concrete next steps they can take.`;

    console.log('Sending request with:', { question, category, context });
    console.log('Full user prompt:', userPrompt);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anthropicApiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': anthropicApiKey,
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `${systemPrompt}\n\n${userPrompt}`
          }
        ],
        temperature: 0.7,
      }),
    });

    console.log('Anthropic response status:', response.status);
    console.log('Anthropic response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Anthropic error response:', errorText);
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const helpText = data.content[0].text;

    console.log('AI Response received:', helpText);

    return new Response(JSON.stringify({ helpText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in contextual-help function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

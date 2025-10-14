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
    const { searchTerms, industry } = await req.json();

    console.log('Buyer Intent Analysis request:', { searchTerms, industry });

    const systemPrompt = `You are an expert brand strategist specializing in the IDEA Brand Framework. Analyze buyer intent and search behavior to provide detailed, actionable strategic insights.

CRITICAL RESPONSE FORMATTING REQUIREMENTS:
- Write in clear, flowing paragraphs without bold or special formatting
- Use section headings only (no bullets, no bold text within paragraphs)
- Professional, strategic consulting tone
- Highly actionable outputs with specific steps
- Focus on conversion and emotional connection

Your analysis should help brands improve sales conversion and emotional connection with customers.`;

    const prompt = `What is the Buyer intent for the keyword search: ${searchTerms.join(', ')} in the ${industry} industry?

Give me a detailed analysis based on the IDEA Brand Framework with highly actionable outputs.

Structure your response with clear section headings covering:

BUYER INTENT OVERVIEW
Explain what customers are really looking for, what stage of the buying journey they are in, and what problems they are trying to solve.

INSIGHTFUL (Deep Customer Understanding)
Describe the key psychological drivers behind these searches, unmet needs and pain points, customer motivation patterns, and actionable insights for positioning.

DISTINCTIVE (Stand Out Strategy)
Analyze how competitors are currently addressing these searches, gaps in the market you can fill, unique positioning opportunities, and differentiation strategies to implement.

EMPATHETIC (Emotional Connection)
Identify emotional triggers in these search terms, fears, desires, and aspirations, how to speak to their emotional needs, and messaging strategies that resonate.

AUTHENTIC (Trust & Credibility)
Explain what builds trust with these searchers, credibility signals they're looking for, transparency opportunities, and how to align actions with promises.

CONVERSION STRATEGY
Provide specific tactics to turn searchers into customers, content recommendations, messaging hierarchy, and quick wins to implement immediately.

Write in flowing paragraph format. Do NOT use bold text, asterisks, or bullet points. Use only plain text paragraphs under each heading. Provide detailed, specific, actionable recommendations throughout.

Return ONLY valid JSON in this exact format:
{
  "analysis": "Your complete detailed analysis here with section headings (##) followed by plain text paragraphs. No bold, no bullets, no asterisks."
}`;

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
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let analysisResult;
    
    try {
      const content = data.choices[0].message.content;
      console.log('AI Response:', content);
      analysisResult = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Fallback: create structured response
      analysisResult = {
        analysis: "## Analysis Error\n\nUnable to generate detailed analysis. Please try again with different search terms."
      };
    }

    console.log('Buyer intent analysis completed successfully');

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in buyer-intent-analyzer function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
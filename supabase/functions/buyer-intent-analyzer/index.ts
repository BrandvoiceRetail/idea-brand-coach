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
- Use clear headings with proper structure
- Use markdown formatting for better readability (headers, bold, bullets)
- Professional, strategic consulting tone
- Highly actionable outputs with specific steps
- Focus on conversion and emotional connection

Your analysis should help brands improve sales conversion and emotional connection with customers.`;

    const prompt = `What is the Buyer intent for the keyword search: ${searchTerms.join(', ')} in the ${industry} industry?

Give me a detailed analysis based on the IDEA Brand Framework with highly actionable outputs.

Structure your response with clear headings covering:

1. BUYER INTENT OVERVIEW
   - What are customers really looking for?
   - What stage of the buying journey are they in?
   - What problems are they trying to solve?

2. INSIGHTFUL (Deep Customer Understanding)
   - Key psychological drivers behind these searches
   - Unmet needs and pain points
   - Customer motivation patterns
   - Actionable insights for positioning

3. DISTINCTIVE (Stand Out Strategy)
   - How competitors are currently addressing these searches
   - Gaps in the market you can fill
   - Unique positioning opportunities
   - Differentiation strategies to implement

4. EMPATHETIC (Emotional Connection)
   - Emotional triggers in these search terms
   - Fears, desires, and aspirations
   - How to speak to their emotional needs
   - Messaging strategies that resonate

5. AUTHENTIC (Trust & Credibility)
   - What builds trust with these searchers?
   - Credibility signals they're looking for
   - Transparency opportunities
   - How to align actions with promises

6. CONVERSION STRATEGY
   - Specific tactics to turn searchers into customers
   - Content recommendations
   - Messaging hierarchy
   - Quick wins to implement immediately

Provide detailed, specific, actionable recommendations throughout. Focus on practical steps they can take to improve conversion rates and emotional connection.

Return ONLY valid JSON in this exact format:
{
  "analysis": "Your complete detailed analysis here with markdown formatting including headings (##), bold (**text**), and bullet points"
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
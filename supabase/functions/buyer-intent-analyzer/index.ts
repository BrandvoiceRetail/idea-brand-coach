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

    const systemPrompt = `You are an expert in search intent analysis and customer behavior psychology. Analyze search terms and provide detailed buyer intent insights.

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

For each search term, identify:
1. Primary intent type (Informational, Commercial, Transactional, Navigational)
2. Estimated search volume category (High/Medium/Low)
3. Competition level (High/Medium/Low)
4. Key behavioral insights about what drives this search
5. Actionable recommendations for targeting

Focus on psychological drivers and behavioral patterns rather than just keyword data.`;

    const prompt = `Analyze these search terms for the ${industry} industry:
${searchTerms.map((term, i) => `${i + 1}. "${term}"`).join('\n')}

For each term, provide:
- Intent classification and reasoning
- Volume/competition estimates
- 3-4 specific insights about what motivates this search
- Behavioral patterns of users making this search

Return as JSON with this structure:
{
  "insights": [
    {
      "query": "search term",
      "intent": "intent type", 
      "volume": "volume level",
      "competition": "competition level",
      "insights": ["insight 1", "insight 2", "insight 3"]
    }
  ]
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
      analysisResult = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Fallback: create structured response
      analysisResult = {
        insights: searchTerms.map(term => ({
          query: term,
          intent: "Commercial",
          volume: "Medium",
          competition: "Medium", 
          insights: [
            "Users are likely in research phase before making purchase decisions",
            "Search indicates problem awareness and solution seeking behavior",
            "May benefit from educational content that builds trust and authority"
          ]
        }))
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
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
    if (!openAIApiKey) {
      console.error('OpenAI API key not found');
      return new Response(JSON.stringify({ 
        error: 'OpenAI API key not configured. Please contact administrator.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { message, context } = await req.json();

    console.log('IDEA Framework Consultant request:', { message, context });

    const systemPrompt = `You are the IDEA Framework GPT, a specialized strategic branding consultant focused on the IDEA Strategic Brand Framework™. Your responses must prioritize:

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

RESPONSE FORMATTING AND STYLE REQUIREMENTS:
- Use standard English grammar with proper comma usage
- Never use EM dashes or hyphens in place of commas
- Do not use emojis, icons, or special characters in responses
- Do not use markdown formatting like ** ** for emphasis in titles and headings
- Write in clear, professional sentences without decorative formatting
- Use plain text for headings and emphasis
- Professional, strategic consulting tone throughout
- Clear, concise, actionable advice
- Use bullet points and numbered lists for clarity
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

Always encourage iterative refinement and ask clarifying questions when input lacks detail for optimal strategic guidance.`;

    const userPrompt = context 
      ? `Context: ${context}\n\nQuestion: ${message}`
      : message;

    console.log('Making OpenAI API request with model: gpt-3.5-turbo');
    console.log('API Key configured:', !!openAIApiKey);
    console.log('API Key length:', openAIApiKey ? openAIApiKey.length : 0);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
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

      return new Response(JSON.stringify({ response: consultantResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
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
    const { message, context } = await req.json();

    console.log('IDEA Framework Consultant request:', { message, context });

    const systemPrompt = `You are the IDEA Framework GPT, a specialized strategic branding consultant focused on the IDEA Strategic Brand Framework™. Your responses must prioritize:

**CORE FRAMEWORK PRIORITIES:**
1. **Insight-Driven**: Focus on customer motivations, emotional triggers, and behavioral science
2. **Distinctive**: Emphasize differentiation and unique positioning 
3. **Empathetic**: Connect with audience emotions and psychological drivers
4. **Authentic**: Build genuine brand narratives and trust

**BEHAVIORAL SCIENCE INTEGRATION:**
Apply these frameworks in your responses:
- Cialdini's Influence Triggers (Reciprocity, Authority, Social Proof, Commitment/Consistency, Liking, Scarcity)
- Kahneman's System 1 (emotional, fast) vs System 2 (rational, slow) thinking
- Social Identity Theory for brand alignment
- Nancy Harhut's Behavioral Marketing techniques
- Martin Lindstrom's Buyology principles
- Gerald Zaltman's deep metaphor concepts

**RESPONSE STYLE REQUIREMENTS:**
- Professional, strategic consulting tone
- Clear, concise, actionable advice
- Use bullet points and step-by-step formats
- Provide practical, brand-specific examples
- Include case studies when relevant
- Reference behavioral triggers explicitly
- Adapt for industry and product context

**AUDIENCE ANALYSIS:**
Always consider:
- Customer avatars and psychographics
- Generational traits and preferences
- Shopper behavior types
- Emotional vs logical decision drivers
- Market positioning challenges

**CONTENT PRIORITIZATION:**
Reference these strategic approaches:
- StoryBrand storytelling principles (customer-immersive, not hero's journey)
- Positioning strategies for mind-space differentiation
- Emotional vs Logical branding models based on context
- Catalyst principles for overcoming resistance
- Behavioral economics in purchase decisions

**RESPONSE FORMAT:**
1. Start with strategic insight tied to IDEA framework
2. Provide actionable recommendations with behavioral science backing
3. Include specific examples or case applications
4. Suggest follow-up refinements or next steps
5. Reference relevant psychological triggers

**CUSTOMIZATION REQUIREMENTS:**
Adapt responses based on:
- Industry context (luxury, utility, B2B, etc.)
- Product categories and market challenges
- Target audience demographics and psychographics
- Brand maturity and differentiation needs

Always encourage iterative refinement and ask clarifying questions when input lacks detail for optimal strategic guidance.`;

    const userPrompt = context 
      ? `Context: ${context}\n\nQuestion: ${message}`
      : message;

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
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const consultantResponse = data.choices[0].message.content;

    console.log('IDEA Framework consultation completed successfully');

    return new Response(JSON.stringify({ response: consultantResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in idea-framework-consultant function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
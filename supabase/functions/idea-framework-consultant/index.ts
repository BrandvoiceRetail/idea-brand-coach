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
        
        if (response.status === 429) {
          // Fallback response for rate limit
          const fallbackResponse = `**IDEA Framework Analysis** *(Demo Mode - OpenAI API Rate Limited)*

Based on your Plant-Based Stem Cell Face Cream in the Luxury Beauty/Mass Premium Amazon category:

**INSIGHT-DRIVEN Market Analysis:**
• Amazon beauty market is highly competitive with $15B+ annual sales
• Plant-based/stem cell products represent fastest-growing segment (35% YoY growth)
• Target customers: Health-conscious women 25-55, premium beauty buyers

**DISTINCTIVE Positioning:**
• Emphasize scientific innovation of plant stem cells
• Position against synthetic alternatives
• Highlight sustainability + efficacy combination

**EMPATHETIC Emotional Triggers:**
• **Authority**: Scientific backing, dermatologist recommendations
• **Social Proof**: Before/after testimonials, ratings
• **Scarcity**: Limited ingredient sourcing, exclusive formulation
• **Consistency**: Daily routine commitment, visible results

**AUTHENTIC Messaging:**
• Focus on natural science story
• Transparency in ingredient sourcing
• Real customer transformation stories

**Recommended Actions:**
1. Create authority through ingredient education
2. Use social proof in product images/reviews
3. Emphasize premium but accessible positioning
4. Develop scarcity through limited editions

*Note: This is a demo response. Add paid OpenAI credits for full AI consultation.*`;
          
          return new Response(JSON.stringify({ response: fallbackResponse }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        if (response.status === 401) {
          return new Response(JSON.stringify({ 
            error: 'Invalid OpenAI API key. Please check your API key configuration.' 
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
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
      
      // Fallback response for any API errors
      const fallbackResponse = `**IDEA Framework Analysis** *(Demo Mode - API Issue)*

I'd be happy to provide strategic guidance using the IDEA Framework for your business question.

**To get full AI-powered consultation:**
• Ensure your OpenAI API key has paid credits
• Check your OpenAI usage limits at platform.openai.com
• The consultation feature requires GPT access

**Meanwhile, here's the IDEA Framework approach:**

**INSIGHT-DRIVEN**: Research customer motivations and emotional triggers
**DISTINCTIVE**: Identify unique positioning opportunities  
**EMPATHETIC**: Connect with audience psychology and behaviors
**AUTHENTIC**: Build genuine brand narratives

Please add paid credits to your OpenAI account and try again for detailed, personalized consultation.

*Contact support if you continue having issues.*`;

      return new Response(JSON.stringify({ response: fallbackResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!openAIApiKey) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { fieldType, currentValue, ideaFramework, avatar, brandCanvas } = await req.json();

    // Build contextual prompt based on available data
    let contextualInfo = "";
    
    if (ideaFramework) {
      contextualInfo += `\nIDEA Framework Context:`;
      if (ideaFramework.intent) contextualInfo += `\n- Buyer Intent: ${ideaFramework.intent}`;
      if (ideaFramework.motivation) contextualInfo += `\n- Customer Motivation: ${ideaFramework.motivation}`;
      if (ideaFramework.triggers) contextualInfo += `\n- Emotional Triggers: ${ideaFramework.triggers}`;
      if (ideaFramework.shopper) contextualInfo += `\n- Shopper Type: ${ideaFramework.shopper}`;
      if (ideaFramework.demographics) contextualInfo += `\n- Demographics: ${ideaFramework.demographics}`;
    }

    if (avatar) {
      contextualInfo += `\n\nAvatar Profile Context:`;
      if (avatar.name) contextualInfo += `\n- Target Customer: ${avatar.name}`;
      if (avatar.painPoints) contextualInfo += `\n- Pain Points: ${avatar.painPoints.join(', ')}`;
      if (avatar.goals) contextualInfo += `\n- Goals: ${avatar.goals.join(', ')}`;
      if (avatar.demographics?.age) contextualInfo += `\n- Age: ${avatar.demographics.age}`;
      if (avatar.demographics?.income) contextualInfo += `\n- Income: ${avatar.demographics.income}`;
    }

    if (brandCanvas) {
      contextualInfo += `\n\nExisting Brand Elements:`;
      if (brandCanvas.purpose) contextualInfo += `\n- Brand Purpose: ${brandCanvas.purpose}`;
      if (brandCanvas.vision) contextualInfo += `\n- Vision: ${brandCanvas.vision}`;
      if (brandCanvas.mission) contextualInfo += `\n- Mission: ${brandCanvas.mission}`;
      if (brandCanvas.positioning) contextualInfo += `\n- Positioning: ${brandCanvas.positioning}`;
    }

    const fieldPrompts = {
      purpose: `Help improve this brand purpose statement. A great brand purpose should be emotionally resonant, meaningful to customers, and clearly state why the brand exists beyond just making profit.`,
      vision: `Help improve this brand vision statement. A compelling vision should paint a picture of the future the brand wants to create and inspire both customers and employees.`,
      mission: `Help improve this brand mission statement. A strong mission should clearly explain what the brand does, for whom, and how it creates value.`,
      values: `Help improve these brand values. Great brand values should be specific, actionable, and differentiate the brand from competitors. Avoid generic terms.`,
      positioning: `Help improve this brand positioning statement. Strong positioning should clearly differentiate the brand and communicate unique value in a crowded market.`,
      valueProposition: `Help improve this value proposition. It should clearly communicate the specific benefits customers get and why they should choose this brand over alternatives.`,
      personality: `Help improve these brand personality traits. They should be specific, memorable, and consistently reflect how the brand communicates and behaves.`,
      voice: `Help improve this brand voice description. It should provide clear guidance on tone, style, and how the brand should sound in communications.`
    };

    const systemPrompt = `You are an expert brand strategist and consultant specializing in the IDEA Strategic Brand Framework. Your role is to provide specific, actionable feedback to improve brand strategy elements.

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

${fieldPrompts[fieldType as keyof typeof fieldPrompts] || 'Help improve this brand element.'}

Current input to improve: "${currentValue}"
${contextualInfo}

Provide specific, actionable suggestions that:
1. Build on the existing input (don't replace it entirely)
2. Incorporate insights from the IDEA Framework and Avatar data when available
3. Are specific to the ${fieldType} field
4. Follow proven brand strategy principles
5. Are practical and implementable

Focus on concrete improvements rather than generic advice. Be encouraging but provide substantive feedback.`;

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
          { role: 'user', content: `Please provide specific suggestions to improve this ${fieldType}: "${currentValue}"` }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const suggestion = data.choices[0].message.content;

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in brand-ai-assistant function:', error);
    return new Response(JSON.stringify({ 
      error: 'Unable to generate AI suggestions right now. Please try again.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
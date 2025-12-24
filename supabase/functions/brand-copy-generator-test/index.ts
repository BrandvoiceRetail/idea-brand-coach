import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
const systemKbVectorStoreId = Deno.env.get("SYSTEM_KB_VECTOR_STORE_ID");

/**
 * TEST VERSION - Brand Copy Generator with System KB integration
 *
 * This is a test version that includes System KB (Trevor's book) retrieval.
 * Once tested, this can be promoted to the main brand-copy-generator function.
 */

const SYSTEM_PROMPT = `You are an expert copywriter specializing in emotionally resonant brand messaging using the IDEA Framework (Insight, Distinctive, Empathetic, Authentic).

Your goal is to create compelling copy that:
1. **Insight-Driven**: Addresses deep customer motivations and emotional triggers
2. **Distinctive**: Stands out with unique positioning and memorable language
3. **Empathetic**: Connects emotionally with the target audience
4. **Authentic**: Maintains genuine brand voice and values

COPY GUIDELINES:
- Focus on benefits and emotional outcomes, not just features
- Use power words that trigger emotional responses
- Write in the brand's authentic voice
- Address customer pain points and desires
- Include social proof concepts when relevant
- Create urgency without being pushy
- Make the customer the hero of the story

SYSTEM KNOWLEDGE BASE INTEGRATION:
When System KB (Trevor's IDEA Framework) information is provided, YOU MUST:
- Apply Trevor's copywriting principles and methodology
- Use emotional trigger frameworks from the book
- Reference the behavioral science concepts
- Ground your copy in proven IDEA techniques

OUTPUT FORMAT:
Provide the requested copy format with clear, ready-to-use text. Include:
1. Primary copy (the main output)
2. A brief explanation of the psychological triggers used
3. 1-2 alternative versions for A/B testing`;

interface CopyRequest {
  productName: string;
  category: string;
  features: string[];
  targetAudience: string;
  emotionalPayoff: string;
  tone: string;
  format: string;
  additionalContext?: string;
}

/**
 * Retrieve context from System Knowledge Base (Trevor's book)
 * Uses OpenAI's Responses API with file_search tool
 */
async function retrieveSystemKBContext(query: string): Promise<string> {
  if (!systemKbVectorStoreId) {
    console.log("[TEST] [retrieveSystemKBContext] No SYSTEM_KB_VECTOR_STORE_ID configured");
    return "";
  }

  try {
    console.log("[TEST] [retrieveSystemKBContext] Searching System KB for:", query.substring(0, 100));

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: `Find relevant copywriting and brand messaging information about: ${query}`,
        tools: [{
          type: "file_search",
          vector_store_ids: [systemKbVectorStoreId],
        }],
        tool_choice: "required",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[TEST] [retrieveSystemKBContext] API error:", response.status, errorText);
      return "";
    }

    const data = await response.json();

    let systemContext = "";
    if (data.output_text) {
      systemContext = data.output_text;
    } else if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === "message" && item.content) {
          for (const content of item.content) {
            if (content.type === "output_text") {
              systemContext += content.text + "\n";
            }
          }
        }
      }
    }

    if (systemContext) {
      console.log(`[TEST] [retrieveSystemKBContext] Retrieved context (${systemContext.length} chars)`);
      return `SYSTEM KNOWLEDGE BASE (Trevor's IDEA Framework - Copywriting Principles):\n${systemContext}`;
    }

    console.log("[TEST] [retrieveSystemKBContext] No context retrieved");
    return "";
  } catch (error) {
    console.error("[TEST] [retrieveSystemKBContext] Error:", error);
    return "";
  }
}

async function generateEmbedding(text: string, openaiKey: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function retrieveUserContext(
  supabaseClient: any,
  userId: string,
  copyRequest: CopyRequest,
  openaiKey: string
): Promise<string> {
  try {
    const queryText = `
      Brand copy for ${copyRequest.productName} in ${copyRequest.category} category.
      Target audience: ${copyRequest.targetAudience}.
      Emotional payoff: ${copyRequest.emotionalPayoff}.
      Brand voice: ${copyRequest.tone}.
    `;

    const queryEmbedding = await generateEmbedding(queryText, openaiKey);

    const { data: matches, error } = await supabaseClient.rpc(
      "match_user_documents",
      {
        query_embedding: queryEmbedding,
        match_user_id: userId,
        match_count: 5,
      }
    );

    if (error) {
      console.error("[TEST] Error matching documents:", error);
      return "";
    }

    if (!matches || matches.length === 0) {
      const { data: kbEntries } = await supabaseClient
        .from("user_knowledge_base")
        .select("field_identifier, content, category")
        .eq("user_id", userId)
        .in("category", ["avatar", "canvas", "insights", "diagnostic"]);

      if (kbEntries && kbEntries.length > 0) {
        const contextParts = kbEntries.map((entry: any) =>
          `[${entry.category}/${entry.field_identifier}]: ${entry.content}`
        );

        return `
<USER_BRAND_CONTEXT>
${contextParts.join("\n\n")}
</USER_BRAND_CONTEXT>

Use this brand context to create copy that aligns with the user's brand voice, target audience, and positioning.`;
      }

      return "";
    }

    const contextParts = matches.map((match: any) => match.content);

    return `
<USER_BRAND_CONTEXT>
${contextParts.join("\n\n")}
</USER_BRAND_CONTEXT>

Use this brand context to create copy that aligns with the user's brand voice, target audience, and positioning.`;
  } catch (error) {
    console.error("[TEST] Error retrieving user context:", error);
    return "";
  }
}

function buildCopyPrompt(request: CopyRequest): string {
  const formatInstructions: Record<string, string> = {
    "amazon-bullet": `Create 5 Amazon-style bullet points that:
- Start with CAPS benefit statement
- Include emotional triggers
- Address customer pain points
- Build trust and credibility
- End with satisfaction guarantee messaging`,

    "pdp-description": `Create a product description (150-200 words) that:
- Opens with a compelling hook
- Paints a picture of transformation
- Lists key benefits naturally
- Includes social proof language
- Ends with a soft call-to-action`,

    "ad-headline": `Create 3 ad headline variations that:
- Grab attention immediately
- Create curiosity or urgency
- Promise a specific benefit
- Are under 10 words each`,

    "social-caption": `Create a social media caption that:
- Opens with a relatable hook or POV
- Tells a mini-story
- Includes relevant hashtags
- Has a clear call-to-action
- Uses appropriate emojis sparingly`,

    "email-subject": `Create 5 email subject line variations that:
- Create curiosity or urgency
- Are personalized-feeling
- Under 50 characters each
- Avoid spam trigger words`,

    "tiktok-hook": `Create 5 TikTok hook variations that:
- Stop the scroll in first 3 seconds
- Create instant curiosity
- Feel native to the platform
- Can be spoken naturally`,

    "landing-hero": `Create landing page hero copy including:
- A compelling headline
- A supporting subheadline
- 3 key benefit bullets
- A call-to-action button text`,
  };

  const formatInstruction = formatInstructions[request.format] || formatInstructions["pdp-description"];

  return `
Generate brand copy with the following specifications:

**Product:** ${request.productName}
**Category:** ${request.category}
**Target Audience:** ${request.targetAudience}
**Emotional Payoff:** ${request.emotionalPayoff}
**Brand Voice/Tone:** ${request.tone}
**Key Features:** ${request.features.length > 0 ? request.features.join(", ") : "Not specified"}
${request.additionalContext ? `**Additional Context:** ${request.additionalContext}` : ""}

**Format Required:** ${request.format}

${formatInstruction}

Remember to:
- Use the IDEA Framework principles
- Connect features to emotional benefits
- Maintain the specified brand voice
- Make the customer feel understood
`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const copyRequest: CopyRequest = await req.json();

    if (!copyRequest.productName || !copyRequest.targetAudience) {
      throw new Error("Product name and target audience are required");
    }

    console.log("[TEST] Generating copy for user:", user.id, "Product:", copyRequest.productName);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Build query for System KB based on copy request
    const systemKBQuery = `
      Copywriting for ${copyRequest.category} product.
      Target audience: ${copyRequest.targetAudience}.
      Emotional messaging for: ${copyRequest.emotionalPayoff}.
      Brand voice: ${copyRequest.tone}.
      Format: ${copyRequest.format}.
    `;

    // Retrieve context from both knowledge bases in parallel
    const [systemKBContext, userContext] = await Promise.all([
      retrieveSystemKBContext(systemKBQuery),
      retrieveUserContext(supabaseClient, user.id, copyRequest, OPENAI_API_KEY)
    ]);

    console.log("[TEST] System KB context length:", systemKBContext.length);
    console.log("[TEST] User context length:", userContext.length);

    // Build the copy generation prompt
    const copyPrompt = buildCopyPrompt(copyRequest);

    // Build messages array
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add System KB context if available
    if (systemKBContext) {
      messages.push({
        role: "system",
        content: systemKBContext,
      });
    }

    // Add user context if available
    if (userContext) {
      messages.push({
        role: "system",
        content: userContext,
      });
    }

    messages.push({ role: "user", content: copyPrompt });

    console.log("[TEST] Calling OpenAI with", messages.length, "messages");
    console.log("[TEST] Has System KB:", !!systemKBContext);
    console.log("[TEST] Has User context:", !!userContext);

    // Call OpenAI Chat API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview",
        messages,
        temperature: 0.8,
        max_tokens: 1500,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("[TEST] OpenAI API error:", errorText);
      throw new Error(`OpenAI API failed: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const generatedCopy = openaiData.choices[0].message.content;

    console.log("[TEST] Successfully generated copy");

    return new Response(
      JSON.stringify({
        copy: generatedCopy,
        hasUserContext: !!userContext,
        hasSystemKB: !!systemKBContext,
        format: copyRequest.format,
        _test_metadata: {
          systemKBContextLength: systemKBContext.length,
          userContextLength: userContext.length,
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[TEST] Error in brand-copy-generator-test:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

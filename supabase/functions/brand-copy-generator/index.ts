import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Brand Copy Generator Edge Function
 *
 * Generates emotionally resonant brand copy using:
 * 1. User's brand context (diagnostic results, avatar, canvas data)
 * 2. The IDEA Framework principles
 * 3. Specific copy format requirements
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

/**
 * Retrieve all current user knowledge base entries for comprehensive context
 */
async function retrieveAllUserContext(
  supabaseClient: any,
  userId: string
): Promise<string> {
  try {
    console.log("[retrieveAllUserContext] Fetching all knowledge for user:", userId);

    // Get ALL current knowledge base entries - this ensures we have complete brand context
    const { data: entries, error } = await supabaseClient
      .from("user_knowledge_base")
      .select("field_identifier, category, content, subcategory")
      .eq("user_id", userId)
      .eq("is_current", true)
      .not("content", "is", null)
      .neq("content", "");

    if (error) {
      console.error("[retrieveAllUserContext] Error fetching knowledge:", error);
      return "";
    }

    if (!entries || entries.length === 0) {
      console.log("[retrieveAllUserContext] No knowledge base entries found");
      return "";
    }

    console.log(`[retrieveAllUserContext] Found ${entries.length} knowledge entries`);

    // Group by category for better organization
    const byCategory: Record<string, any[]> = {};
    entries.forEach((entry: any) => {
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = [];
      }
      byCategory[entry.category].push(entry);
    });

    // Build context string with clear organization
    const contextParts: string[] = [];

    // Priority order for brand copy generation
    const categoryOrder = ["canvas", "avatar", "idea", "diagnostic", "copy"];

    for (const category of categoryOrder) {
      if (byCategory[category]) {
        const categoryName = category.toUpperCase().replace(/_/g, " ");
        contextParts.push(`\n${categoryName} DATA:`);
        byCategory[category].forEach((entry: any) => {
          const label = entry.field_identifier
            .replace(`${category}_`, "")
            .replace(/_/g, " ")
            .toUpperCase();
          contextParts.push(`- ${label}: ${entry.content}`);
        });
        delete byCategory[category];
      }
    }

    // Add any remaining categories
    for (const [category, categoryEntries] of Object.entries(byCategory)) {
      const categoryName = category.toUpperCase().replace(/_/g, " ");
      contextParts.push(`\n${categoryName} DATA:`);
      (categoryEntries as any[]).forEach((entry: any) => {
        const label = entry.field_identifier
          .replace(`${category}_`, "")
          .replace(/_/g, " ")
          .toUpperCase();
        contextParts.push(`- ${label}: ${entry.content}`);
      });
    }

    const context = contextParts.join("\n");
    console.log(`[retrieveAllUserContext] Generated context (${context.length} chars)`);

    return context;
  } catch (error) {
    console.error("[retrieveAllUserContext] Error:", error);
    return "";
  }
}

/**
 * Retrieve recent chat history for additional brand insights
 */
async function retrieveChatHistory(
  supabaseClient: any,
  userId: string,
  limit: number = 50
): Promise<string> {
  try {
    const { data: messages, error } = await supabaseClient
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !messages || messages.length === 0) {
      return "";
    }

    console.log(`[retrieveChatHistory] Found ${messages.length} recent messages`);

    const formattedMessages = messages
      .reverse()
      .map((msg: any) => `${msg.role === "user" ? "USER" : "CONSULTANT"}: ${msg.content}`)
      .join("\n\n");

    return `\nRECENT BRAND CONSULTANT INSIGHTS:\n${formattedMessages}`;
  } catch (error) {
    console.error("[retrieveChatHistory] Error:", error);
    return "";
  }
}

async function retrieveUserContext(
  supabaseClient: any,
  userId: string,
  copyRequest: CopyRequest,
  openaiKey: string
): Promise<string> {
  try {
    // Fetch all user context and chat history in parallel
    const [allContext, chatHistory] = await Promise.all([
      retrieveAllUserContext(supabaseClient, userId),
      retrieveChatHistory(supabaseClient, userId, 50)
    ]);

    if (!allContext && !chatHistory) {
      console.log("[retrieveUserContext] No user context found, trying vector search");

      // Fall back to vector search if direct query returns nothing
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
          match_count: 10,
        }
      );

      if (error || !matches || matches.length === 0) {
        return "";
      }

      const contextParts = matches.map((match: any) => match.content);
      return `
<USER_BRAND_CONTEXT>
${contextParts.join("\n\n")}
</USER_BRAND_CONTEXT>

Use this brand context to create copy that aligns with the user's brand voice, target audience, and positioning.`;
    }

    // Combine all context sources
    let fullContext = "";
    if (allContext) {
      fullContext += allContext;
    }
    if (chatHistory) {
      fullContext += chatHistory;
    }

    return `
<USER_BRAND_CONTEXT>
${fullContext}
</USER_BRAND_CONTEXT>

IMPORTANT: Use this brand context to create copy that:
- Aligns with the user's defined brand voice and personality
- Speaks directly to their target audience/avatar
- Incorporates their brand values and positioning
- Reflects insights from their brand strategy work`;
  } catch (error) {
    console.error("Error retrieving user context:", error);
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

    console.log("Generating copy for user:", user.id, "Product:", copyRequest.productName);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Retrieve user's brand context
    const userContext = await retrieveUserContext(
      supabaseClient,
      user.id,
      copyRequest,
      OPENAI_API_KEY
    );

    // Build the copy generation prompt
    const copyPrompt = buildCopyPrompt(copyRequest);

    // Build messages array
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add user context if available
    if (userContext) {
      messages.push({
        role: "system",
        content: userContext,
      });
    }

    messages.push({ role: "user", content: copyPrompt });

    console.log("Calling OpenAI with", messages.length, "messages, context:", userContext ? "yes" : "no");

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
        temperature: 0.8, // Slightly higher for creative copy
        max_tokens: 1500,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API failed: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const generatedCopy = openaiData.choices[0].message.content;

    console.log("Successfully generated copy");

    return new Response(
      JSON.stringify({
        copy: generatedCopy,
        hasUserContext: !!userContext,
        format: copyRequest.format,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in brand-copy-generator:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InsightCategory {
  category: string; // diagnostic, avatar, canvas, capture, core, or none
  insights: string[];
  reasoning: string;
}

async function analyzeConversationForInsights(
  userMessage: string,
  assistantResponse: string,
  openaiKey: string
): Promise<InsightCategory[]> {
  const analysisPrompt = `Analyze this brand consulting conversation and extract actionable brand insights. Categorize each insight into ONE of these categories:

**Categories:**
- diagnostic: Brand strengths, weaknesses, IDEA framework assessments, brand health
- avatar: Target audience details, customer personas, buyer psychology, demographics
- canvas: Brand positioning, messaging, value propositions, differentiation
- capture: Campaign ideas, content strategies, marketing tactics, channels
- core: Brand values, purpose, mission, vision, principles
- none: General conversation, greetings, clarifications (no actionable insight)

**Conversation:**
User: ${userMessage}
Assistant: ${assistantResponse}

**Instructions:**
1. Extract ALL actionable brand knowledge from the conversation
2. Be generous - if it contains brand info, extract it
3. Ignore ONLY: greetings, "hello", "thank you", pure questions without context
4. Extract specific details like target audience, values, positioning, campaign ideas
5. Each insight should be specific and quotable
6. IMPORTANT: If the conversation contains brand information, you MUST extract insights
7. Return a JSON object with a "categories" array

**REQUIRED Response Format (JSON object with categories array):**
{
  "categories": [
    {
      "category": "avatar",
      "insights": [
        "Target audience: 25-35 year old TCG enthusiasts",
        "Collectors value protection for prized cards - part investment, part identity"
      ],
      "reasoning": "User stated audience and assistant explained their psychographics"
    },
    {
      "category": "core",
      "insights": [
        "Core values: trustworthy, exclusive, emotionally connected"
      ],
      "reasoning": "Assistant recommended these as brand values"
    }
  ]
}

**Example - Good extraction:**
User: "our target audience is 25-35 TCG enthusiasts"
Assistant: "TCG collectors value protection... This age group values authenticity..."
=> Extract multiple categories: avatar (demographics), canvas (positioning), core (values)

**Example - Skip:**
User: "hello"
Assistant: "Hi there! How can I help?"
=> Return: {"categories": []}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting actionable brand insights from conversations. You MUST return a valid JSON object with a 'categories' array containing insight objects. Be generous in extraction - if there is ANY brand information, extract it.",
        },
        { role: "user", content: analysisPrompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GPT analysis failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const rawContent = data.choices[0].message.content;
  console.log("GPT analysis raw response:", rawContent);

  let result;
  try {
    result = JSON.parse(rawContent);
  } catch (parseError) {
    console.error("Failed to parse GPT response:", parseError);
    console.error("Raw content was:", rawContent);
    return [];
  }

  console.log("GPT analysis parsed:", JSON.stringify(result, null, 2));

  // Validate and extract categories array
  let categories: InsightCategory[] = [];

  if (Array.isArray(result)) {
    // GPT returned array directly (shouldn't happen with json_object, but handle it)
    categories = result;
  } else if (result && typeof result === 'object' && Array.isArray(result.categories)) {
    // GPT returned object with categories array (expected format)
    categories = result.categories;
  } else {
    console.warn("Unexpected GPT response structure:", result);
    return [];
  }

  console.log(`Total categories found: ${categories.length}`);

  // Validate category structure and filter
  const validated = categories.filter((cat: any) => {
    if (!cat || typeof cat !== 'object') {
      console.warn("Invalid category object:", cat);
      return false;
    }
    if (!cat.category || !Array.isArray(cat.insights)) {
      console.warn("Category missing required fields:", cat);
      return false;
    }
    return true;
  });

  console.log(`Valid categories after validation: ${validated.length}`);

  const filtered = validated.filter((cat: InsightCategory) => cat.category !== 'none');
  console.log(`Actionable categories after filtering 'none': ${filtered.length}`);

  if (filtered.length === 0) {
    console.warn("No actionable insights extracted from conversation");
    console.warn("User message length:", userMessage.length);
    console.warn("Assistant response length:", assistantResponse.length);
  }

  return filtered;
}

async function uploadInsightToVectorStore(
  vectorStoreId: string,
  insight: string,
  category: string,
  userEmail: string,
  openaiKey: string
): Promise<string> {
  const timestamp = new Date().toISOString().split('T')[0];
  const content = `# ${category.charAt(0).toUpperCase() + category.slice(1)} Insight - ${timestamp}
**User:** ${userEmail}
**Category:** ${category}

${insight}

---
*Captured from conversation with IDEA Brand Coach*`;

  // Upload as text file
  const blob = new Blob([content], { type: "text/plain" });
  const formData = new FormData();
  formData.append("file", blob, `${category}-insight-${Date.now()}.txt`);
  formData.append("purpose", "assistants");

  const uploadResponse = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: formData,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`File upload failed: ${uploadResponse.status} - ${error}`);
  }

  const fileData = await uploadResponse.json();
  const fileId = fileData.id;

  // Add file to vector store
  const addResponse = await fetch(
    `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2",
      },
      body: JSON.stringify({ file_id: fileId }),
    }
  );

  if (!addResponse.ok) {
    const error = await addResponse.text();
    throw new Error(`Failed to add file to vector store: ${addResponse.status} - ${error}`);
  }

  return fileId;
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

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const { userMessage, assistantResponse } = await req.json();

    if (!userMessage || !assistantResponse) {
      throw new Error("userMessage and assistantResponse are required");
    }

    console.log(`Analyzing conversation for user: ${user.email}`);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Use service role for database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user's vector stores
    const { data: userStores, error: storesError } = await supabase
      .from("user_vector_stores")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (storesError || !userStores) {
      throw new Error("User vector stores not found");
    }

    // Analyze conversation for insights
    console.log("User message:", userMessage.substring(0, 200));
    console.log("Assistant response:", assistantResponse.substring(0, 200));

    const categories = await analyzeConversationForInsights(
      userMessage,
      assistantResponse,
      OPENAI_API_KEY
    );

    console.log(`Found ${categories.length} insight categories to file`);

    const results = [];
    for (const cat of categories) {
      const vectorStoreId = {
        diagnostic: userStores.diagnostic_store_id,
        avatar: userStores.avatar_store_id,
        canvas: userStores.canvas_store_id,
        capture: userStores.capture_store_id,
        core: userStores.core_store_id,
      }[cat.category];

      if (!vectorStoreId) {
        console.warn(`Unknown category: ${cat.category}`);
        continue;
      }

      for (const insight of cat.insights) {
        const fileId = await uploadInsightToVectorStore(
          vectorStoreId,
          insight,
          cat.category,
          user.email!,
          OPENAI_API_KEY
        );

        results.push({
          category: cat.category,
          fileId,
          insight: insight.substring(0, 100) + "...",
        });

        console.log(`✅ Filed insight to ${cat.category}: ${fileId}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        insightsFiled: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in file-conversation-insights:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

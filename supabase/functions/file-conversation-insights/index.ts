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
1. Extract ONLY new, actionable brand knowledge
2. Ignore greetings, questions without answers, or generic advice
3. Each insight should be specific and reusable
4. Return JSON array of categories with insights

**Response Format:**
[
  {
    "category": "avatar",
    "insights": ["Target audience is millennials interested in personal finance"],
    "reasoning": "User stated their audience clearly"
  }
]`;

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
          content: "You are an expert at extracting actionable brand insights from conversations. Return valid JSON only.",
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
  const result = JSON.parse(data.choices[0].message.content);

  // Handle both array and object responses
  const categories = Array.isArray(result) ? result : result.categories || [];

  return categories.filter((cat: InsightCategory) => cat.category !== 'none');
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

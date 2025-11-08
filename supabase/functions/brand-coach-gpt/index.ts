import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the IDEA Brand Coach, an expert in emotionally intelligent branding and the IDEA Framework (Insight, Distinctive, Empathetic, Authentic).

Your role is to help users build stronger brands by:
1. Understanding their customers' emotional triggers and buyer intent
2. Creating distinctive positioning that stands out
3. Building empathetic connections with their audience
4. Maintaining authentic brand consistency

Communication Style:
- Be warm, supportive, and encouraging
- Ask clarifying questions to understand context
- Provide actionable, specific advice
- Use examples and frameworks where helpful
- Reference the user's diagnostic results when relevant

Always ground your advice in the IDEA Framework principles:
- **Insight**: Understanding customer emotional drivers and buyer psychology
- **Distinctive**: Standing out with clear differentiation
- **Empathetic**: Building emotional connections and showing understanding
- **Authentic**: Being consistent, trustworthy, and true to brand values`;

interface ChatMessage {
  role: string;
  content: string;
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

async function retrieveRelevantContext(
  supabaseClient: any,
  userId: string,
  query: string,
  openaiKey: string
): Promise<{ content: string; sources: string[] }> {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query, openaiKey);

    // Use the match_user_documents function for semantic search
    const { data: matches, error } = await supabaseClient.rpc(
      "match_user_documents",
      {
        query_embedding: queryEmbedding,
        match_user_id: userId,
        match_count: 3,
      }
    );

    if (error) {
      console.error("Error matching documents:", error);
      return { content: "", sources: [] };
    }

    if (!matches || matches.length === 0) {
      return { content: "", sources: [] };
    }

    // Combine relevant chunks
    const contextParts = matches.map((match: any) => match.content);
    const sources = matches.map((match: any, idx: number) => 
      `Source ${idx + 1} (similarity: ${(match.similarity * 100).toFixed(1)}%)`
    );

    const combinedContext = `
<USER_DIAGNOSTIC_CONTEXT>
${contextParts.join("\n\n")}
</USER_DIAGNOSTIC_CONTEXT>

Use this diagnostic information to provide personalized advice tailored to the user's specific strengths and areas for improvement.`;

    return { content: combinedContext, sources };
  } catch (error) {
    console.error("Error in RAG retrieval:", error);
    return { content: "", sources: [] };
  }
}

function generateFollowUpSuggestions(userMessage: string, response: string): string[] {
  const suggestions = [
    "How can I improve my weakest IDEA dimension?",
    "What are some practical next steps I can take?",
    "Can you give me examples of brands that do this well?",
    "How do I measure progress in this area?",
  ];
  
  // Return 3 relevant suggestions
  return suggestions.slice(0, 3);
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
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const { message, chat_history } = await req.json();

    if (!message) {
      throw new Error("Message is required");
    }

    console.log("Processing message for user:", user.id);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Retrieve relevant context using RAG
    const { content: ragContext, sources } = await retrieveRelevantContext(
      supabaseClient,
      user.id,
      message,
      OPENAI_API_KEY
    );

    // Build messages array with context
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add RAG context if available
    if (ragContext) {
      messages.push({
        role: "system",
        content: ragContext,
      });
    }

    // Add chat history (last 10 messages)
    if (chat_history && Array.isArray(chat_history)) {
      const recentHistory = chat_history.slice(-10);
      messages.push(...recentHistory);
    }

    // Add current user message
    messages.push({ role: "user", content: message });

    console.log("Calling OpenAI with", messages.length, "messages");

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
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API failed: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const assistantMessage = openaiData.choices[0].message.content;

    // Generate follow-up suggestions
    const suggestions = generateFollowUpSuggestions(message, assistantMessage);

    console.log("Successfully generated response");

    return new Response(
      JSON.stringify({
        response: assistantMessage,
        suggestions,
        sources,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in brand-coach-gpt:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

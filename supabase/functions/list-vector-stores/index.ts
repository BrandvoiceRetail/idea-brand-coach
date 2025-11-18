import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const response = await fetch("https://api.openai.com/v1/vector_stores", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list vector stores: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // Filter for user vector stores (scope: user)
    const userStores = data.data.filter((store: any) =>
      store.metadata?.scope === "user"
    );

    return new Response(JSON.stringify({
      total: data.data.length,
      userStores: userStores.length,
      stores: userStores.map((store: any) => ({
        id: store.id,
        name: store.name,
        created_at: new Date(store.created_at * 1000).toISOString(),
        file_counts: store.file_counts,
        metadata: store.metadata,
      })),
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error listing vector stores:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

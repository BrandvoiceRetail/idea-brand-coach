import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserVectorStores {
  user_id: string;
  diagnostic_store_id: string;
  avatar_store_id: string;
  canvas_store_id: string;
  capture_store_id: string;
  core_store_id: string;
}

async function createVectorStore(
  openaiKey: string,
  name: string,
  userId: string,
  domain: string
): Promise<{ id: string }> {
  const response = await fetch("https://api.openai.com/v1/vector_stores", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    },
    body: JSON.stringify({
      name: name,
      metadata: {
        user_id: userId,
        domain: domain,
        scope: "user",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create vector store: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log(`  ✅ Created ${domain} store: ${data.id}`);

  return { id: data.id };
}

async function createUserVectorStores(
  userId: string,
  userEmail: string,
  openaiKey: string
): Promise<UserVectorStores> {
  console.log(`Creating User KB for ${userEmail} (${userId})`);

  // Create 5 vector stores for this user
  const stores = await Promise.all([
    createVectorStore(openaiKey, `User ${userEmail} - Diagnostic`, userId, "diagnostic"),
    createVectorStore(openaiKey, `User ${userEmail} - Avatar`, userId, "avatar"),
    createVectorStore(openaiKey, `User ${userEmail} - Canvas`, userId, "canvas"),
    createVectorStore(openaiKey, `User ${userEmail} - CAPTURE`, userId, "capture"),
    createVectorStore(openaiKey, `User ${userEmail} - Core`, userId, "core"),
  ]);

  console.log(`✅ Created 5 vector stores for ${userEmail}`);

  return {
    user_id: userId,
    diagnostic_store_id: stores[0].id,
    avatar_store_id: stores[1].id,
    canvas_store_id: stores[2].id,
    capture_store_id: stores[3].id,
    core_store_id: stores[4].id,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Use anon key for auth, service role for database operations
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // Get authenticated user - extract JWT from Bearer header
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Use service role key for database operations to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user already has vector stores
    const { data: existing } = await supabase
      .from("user_vector_stores")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      console.log(`User ${user.email} already has vector stores`);
      return new Response(JSON.stringify({
        success: true,
        exists: true,
        stores: existing,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create vector stores in OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const userStores = await createUserVectorStores(
      user.id,
      user.email!,
      OPENAI_API_KEY
    );

    // Save to database
    const { error: insertError } = await supabase
      .from("user_vector_stores")
      .insert(userStores);

    if (insertError) {
      throw new Error(`Failed to save vector stores: ${insertError.message}`);
    }

    console.log(`✅ Saved vector store IDs to database for ${user.email}`);

    return new Response(JSON.stringify({
      success: true,
      exists: false,
      created: true,
      stores: userStores,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ensure-user-kb:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

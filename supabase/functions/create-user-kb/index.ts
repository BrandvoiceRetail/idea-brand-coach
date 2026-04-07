/**
 * create-user-kb (pgvector edition)
 *
 * Ensures the user's knowledge base infrastructure exists.
 * With pgvector, there are no external vector stores to create —
 * chunks are stored directly in user_knowledge_chunks.
 *
 * This function now simply verifies the user is authenticated and
 * returns success. The user_knowledge_chunks table handles all
 * vector storage via RLS scoped to user_id.
 *
 * Kept for backward compatibility with frontend callers.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

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

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // With pgvector, no external vector stores need to be created.
    // The user_knowledge_chunks table with RLS handles everything.
    // We return a compatible response shape for existing callers.

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get chunk count for the user as a health check
    const { count, error: countError } = await supabase
      .from("user_knowledge_chunks")
      .select("id", { count: 'exact', head: true })
      .eq("user_id", user.id);

    if (countError) {
      console.warn("Failed to count user chunks:", countError);
    }

    console.log(`User ${user.email} KB ready (pgvector). Chunks: ${count || 0}`);

    return new Response(JSON.stringify({
      success: true,
      backend: 'pgvector',
      user_id: user.id,
      chunk_count: count || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in create-user-kb:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

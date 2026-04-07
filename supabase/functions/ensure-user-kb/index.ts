/**
 * ensure-user-kb (pgvector edition)
 *
 * Ensures the user's knowledge base infrastructure exists.
 * With pgvector, there are no external vector stores to create —
 * all chunks live in user_knowledge_chunks scoped by user_id + RLS.
 *
 * This function is kept for backward compatibility. It authenticates
 * the user and returns a success response. Callers that previously
 * read `stores.diagnostic_store_id` etc. will receive a compatible
 * response with `backend: 'pgvector'` indicating the new storage.
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

    console.log(`User ${user.email} KB ensured (pgvector backend)`);

    // Return a compatible response shape.
    // The `stores` object is kept for callers that destructure it,
    // but the values now indicate pgvector usage rather than OpenAI IDs.
    return new Response(JSON.stringify({
      success: true,
      exists: true,
      backend: 'pgvector',
      stores: {
        user_id: user.id,
        backend: 'pgvector',
        // Legacy fields set to sentinel values so callers don't crash
        diagnostic_store_id: 'pgvector',
        avatar_store_id: 'pgvector',
        canvas_store_id: 'pgvector',
        capture_store_id: 'pgvector',
        core_store_id: 'pgvector',
      },
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

/**
 * list-vector-stores (pgvector edition)
 *
 * Returns statistics about the user's pgvector knowledge chunks,
 * grouped by category. Replaces the OpenAI vector store listing.
 *
 * Previously listed OpenAI vector store objects. Now queries
 * user_knowledge_chunks for chunk counts per category.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get chunk counts grouped by user and category
    const { data, error } = await supabase
      .from("user_knowledge_chunks")
      .select("user_id, category, source_type");

    if (error) {
      throw new Error(`Failed to query chunks: ${error.message}`);
    }

    // Aggregate counts
    const userStats: Record<string, Record<string, { total: number; bySourceType: Record<string, number> }>> = {};

    for (const row of data || []) {
      const userId = row.user_id;
      const cat = row.category || 'core';
      const srcType = row.source_type || 'unknown';

      if (!userStats[userId]) userStats[userId] = {};
      if (!userStats[userId][cat]) userStats[userId][cat] = { total: 0, bySourceType: {} };

      userStats[userId][cat].total++;
      userStats[userId][cat].bySourceType[srcType] = (userStats[userId][cat].bySourceType[srcType] || 0) + 1;
    }

    const totalUsers = Object.keys(userStats).length;
    const totalChunks = (data || []).length;

    return new Response(JSON.stringify({
      backend: 'pgvector',
      totalUsers,
      totalChunks,
      userStats,
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

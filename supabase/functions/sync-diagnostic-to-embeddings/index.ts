/**
 * sync-diagnostic-to-embeddings (pgvector edition)
 *
 * Creates pgvector embeddings from diagnostic submission scores.
 * Already used pgvector — updated to use shared embedding utility
 * and populate the new category/field_identifier columns.
 *
 * Called after a diagnostic submission is saved. Takes submission_id,
 * generates IDEA-framework-specific context chunks, embeds them via
 * ada-002, and stores in user_knowledge_chunks.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { generateEmbedding } from "../_shared/embeddings.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface DiagnosticScores {
  overall: number;
  insight: number;
  distinctive: number;
  empathetic: number;
  authentic: number;
}

function getScoreInterpretation(score: number): string {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "moderate";
  if (score >= 20) return "needs improvement";
  return "significant gaps";
}

function formatDiagnosticContext(scores: DiagnosticScores, _userId: string): string[] {
  const chunks: string[] = [];

  // Overall context
  chunks.push(
    `Brand Diagnostic Overview: This user has an overall IDEA score of ${scores.overall}/100, ` +
    `indicating ${getScoreInterpretation(scores.overall)} brand emotional intelligence.`
  );

  // Insight dimension
  chunks.push(
    `Insight Dimension (${scores.insight}/100): ` +
    `The user's ability to understand customer emotional drivers and buyer intent is ${getScoreInterpretation(scores.insight)}. ` +
    (scores.insight < 60
      ? "Focus areas: Deeper customer research, emotional trigger mapping, and buyer journey analysis."
      : "Strengths: Strong understanding of customer motivations and decision-making processes.")
  );

  // Distinctive dimension
  chunks.push(
    `Distinctive Dimension (${scores.distinctive}/100): ` +
    `The brand's differentiation and unique positioning is ${getScoreInterpretation(scores.distinctive)}. ` +
    (scores.distinctive < 60
      ? "Focus areas: Clarifying unique value proposition, competitive differentiation, and memorable brand elements."
      : "Strengths: Clear differentiation with strong unique positioning in the market.")
  );

  // Empathetic dimension
  chunks.push(
    `Empathetic Dimension (${scores.empathetic}/100): ` +
    `The brand's emotional connection and customer understanding is ${getScoreInterpretation(scores.empathetic)}. ` +
    (scores.empathetic < 60
      ? "Focus areas: Building emotional resonance, showing customer understanding, and creating authentic connections."
      : "Strengths: Strong emotional connections with customers and authentic relationship building.")
  );

  // Authentic dimension
  chunks.push(
    `Authentic Dimension (${scores.authentic}/100): ` +
    `The brand's authenticity and consistency is ${getScoreInterpretation(scores.authentic)}. ` +
    (scores.authentic < 60
      ? "Focus areas: Aligning brand actions with values, maintaining consistency, and building trust through transparency."
      : "Strengths: Strong brand authenticity with consistent delivery on promises.")
  );

  // Priority recommendations
  const lowestScore = Math.min(scores.insight, scores.distinctive, scores.empathetic, scores.authentic);
  let priorityArea = '';
  if (lowestScore === scores.insight) priorityArea = 'Insight (customer understanding)';
  else if (lowestScore === scores.distinctive) priorityArea = 'Distinctive (differentiation)';
  else if (lowestScore === scores.empathetic) priorityArea = 'Empathetic (emotional connection)';
  else priorityArea = 'Authentic (authenticity and trust)';

  chunks.push(
    `Priority Focus Area: ${priorityArea} is the lowest-scoring dimension and should be the primary focus ` +
    `for immediate improvement. Addressing this will have the greatest impact on overall brand effectiveness.`
  );

  return chunks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== SYNC DIAGNOSTIC TO EMBEDDINGS STARTED ===");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { submission_id } = body;

    if (!submission_id) {
      throw new Error("submission_id is required");
    }

    console.log("Processing diagnostic submission:", submission_id);

    // Get diagnostic submission
    const { data: submission, error: submissionError } = await supabaseClient
      .from("diagnostic_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (submissionError) throw submissionError;
    if (!submission) throw new Error(`Submission not found: ${submission_id}`);

    const scores = submission.scores as DiagnosticScores;
    const userId = submission.user_id;

    if (!scores || typeof scores.overall === 'undefined') {
      throw new Error("Invalid scores format in submission");
    }

    // Generate context chunks
    const contextChunks = formatDiagnosticContext(scores, userId);
    console.log("Generated", contextChunks.length, "context chunks");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Delete existing diagnostic embeddings for this user
    const { error: deleteError } = await supabaseClient
      .from("user_knowledge_chunks")
      .delete()
      .eq("user_id", userId)
      .eq("source_type", "diagnostic");

    if (deleteError) {
      console.warn("Warning: Failed to delete existing chunks:", deleteError);
    }

    // Generate and store embeddings for each chunk using shared utility
    let successCount = 0;
    for (let i = 0; i < contextChunks.length; i++) {
      const chunk = contextChunks[i];
      console.log(`Processing chunk ${i + 1}/${contextChunks.length}`);

      const embedding = await generateEmbedding(chunk, OPENAI_API_KEY);

      const { error: insertError } = await supabaseClient
        .from("user_knowledge_chunks")
        .insert({
          user_id: userId,
          content: chunk,
          embedding: JSON.stringify(embedding),
          source_type: "diagnostic",
          source_id: submission_id,
          category: "diagnostic",
          chunk_index: i,
          metadata: { chunk_index: i, total_chunks: contextChunks.length },
        });

      if (insertError) {
        console.error(`Error inserting chunk ${i}:`, insertError);
        throw insertError;
      }

      successCount++;
    }

    console.log("=== SYNC DIAGNOSTIC TO EMBEDDINGS COMPLETED ===");
    console.log(`Successfully created ${successCount}/${contextChunks.length} embeddings`);

    return new Response(
      JSON.stringify({
        success: true,
        chunks_created: successCount,
        total_chunks: contextChunks.length,
        user_id: userId,
        submission_id: submission_id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("=== SYNC DIAGNOSTIC TO EMBEDDINGS FAILED ===");
    console.error("Error:", error.message);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function formatDiagnosticContext(scores: DiagnosticScores, userId: string): string[] {
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
    
    console.log("Request body:", JSON.stringify(body));
    
    if (!submission_id) {
      console.error("ERROR: submission_id is required");
      throw new Error("submission_id is required");
    }

    console.log("Processing diagnostic submission:", submission_id);

    // Get diagnostic submission
    const { data: submission, error: submissionError } = await supabaseClient
      .from("diagnostic_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (submissionError) {
      console.error("ERROR fetching submission:", submissionError);
      throw submissionError;
    }

    if (!submission) {
      console.error("ERROR: Submission not found:", submission_id);
      throw new Error(`Submission not found: ${submission_id}`);
    }

    console.log("Found submission:", {
      id: submission.id,
      user_id: submission.user_id,
      scores: submission.scores
    });

    const scores = submission.scores as DiagnosticScores;
    const userId = submission.user_id;

    // Validate scores
    if (!scores || typeof scores.overall === 'undefined') {
      console.error("ERROR: Invalid scores format:", scores);
      throw new Error("Invalid scores format in submission");
    }

    // Generate context chunks
    const contextChunks = formatDiagnosticContext(scores, userId);
    console.log("Generated", contextChunks.length, "context chunks");

    // Generate embeddings using OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("ERROR: OPENAI_API_KEY not configured");
      throw new Error("OPENAI_API_KEY not configured");
    }

    console.log("OpenAI API key configured: ✓");

    // Delete existing diagnostic embeddings for this user
    console.log("Deleting existing diagnostic embeddings for user:", userId);
    const { error: deleteError, count: deleteCount } = await supabaseClient
      .from("user_knowledge_chunks")
      .delete()
      .eq("user_id", userId)
      .eq("source_type", "diagnostic");

    if (deleteError) {
      console.warn("Warning: Failed to delete existing chunks:", deleteError);
    } else {
      console.log("Deleted existing chunks (if any)");
    }

    // Generate and store embeddings for each chunk
    let successCount = 0;
    for (let i = 0; i < contextChunks.length; i++) {
      const chunk = contextChunks[i];
      console.log(`Processing chunk ${i + 1}/${contextChunks.length}:`, chunk.substring(0, 100) + "...");
      
      try {
        const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-ada-002",
            input: chunk,
          }),
        });

        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text();
          console.error(`OpenAI API error for chunk ${i}:`, embeddingResponse.status, errorText);
          throw new Error(`OpenAI embedding failed: ${embeddingResponse.status}`);
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;
        console.log(`Generated embedding for chunk ${i + 1} (dim: ${embedding.length})`);

        // Store in database
        const { error: insertError } = await supabaseClient
          .from("user_knowledge_chunks")
          .insert({
            user_id: userId,
            content: chunk,
            embedding: JSON.stringify(embedding),
            source_type: "diagnostic",
            source_id: submission_id,
            metadata: { chunk_index: i, total_chunks: contextChunks.length },
          });

        if (insertError) {
          console.error(`Error inserting chunk ${i}:`, insertError);
          throw insertError;
        }

        successCount++;
        console.log(`Successfully stored chunk ${i + 1}/${contextChunks.length}`);
      } catch (chunkError) {
        console.error(`Failed to process chunk ${i}:`, chunkError);
        throw chunkError;
      }
    }

    console.log("=== SYNC DIAGNOSTIC TO EMBEDDINGS COMPLETED ===");
    console.log(`Successfully created ${successCount}/${contextChunks.length} embeddings`);

    return new Response(
      JSON.stringify({
        success: true,
        chunks_created: successCount,
        total_chunks: contextChunks.length,
        user_id: userId,
        submission_id: submission_id
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("=== SYNC DIAGNOSTIC TO EMBEDDINGS FAILED ===");
    console.error("Error details:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

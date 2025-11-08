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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { submission_id } = await req.json();
    
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

    const scores = submission.scores as DiagnosticScores;
    const userId = submission.user_id;

    // Generate context chunks
    const contextChunks = formatDiagnosticContext(scores, userId);

    // Generate embeddings using OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    console.log("Generating embeddings for", contextChunks.length, "chunks");

    // Delete existing diagnostic embeddings for this user
    await supabaseClient
      .from("user_knowledge_chunks")
      .delete()
      .eq("user_id", userId)
      .eq("source_type", "diagnostic");

    // Generate and store embeddings for each chunk
    for (let i = 0; i < contextChunks.length; i++) {
      const chunk = contextChunks[i];
      
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
        console.error("OpenAI API error:", errorText);
        throw new Error(`OpenAI embedding failed: ${embeddingResponse.status}`);
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      // Store in database
      const { error: insertError } = await supabaseClient
        .from("user_knowledge_chunks")
        .insert({
          user_id: userId,
          content: chunk,
          embedding,
          source_type: "diagnostic",
          source_id: submission_id,
          metadata: { chunk_index: i, total_chunks: contextChunks.length },
        });

      if (insertError) {
        console.error("Error inserting chunk:", insertError);
        throw insertError;
      }
    }

    console.log("Successfully created", contextChunks.length, "embeddings");

    return new Response(
      JSON.stringify({
        success: true,
        chunks_created: contextChunks.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in sync-diagnostic-to-embeddings:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

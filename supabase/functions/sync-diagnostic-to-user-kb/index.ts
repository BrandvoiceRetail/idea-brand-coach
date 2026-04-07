/**
 * sync-diagnostic-to-user-kb (pgvector edition)
 *
 * Syncs diagnostic data to pgvector embeddings in user_knowledge_chunks.
 * Replaces the OpenAI vector store pipeline — the diagnostic document
 * is embedded via ada-002 and stored directly in pgvector.
 *
 * Usage: { diagnosticData: {...}, scores: {...} }
 * Called from the frontend after diagnostic completion.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { generateEmbedding } from "../_shared/embeddings.ts";
import { chunkText } from "../_shared/chunking.ts";
import { corsHeaders } from "../_shared/cors.ts";

function getScoreInterpretation(score: number): string {
  if (score >= 80) return "Excellent - strong performance";
  if (score >= 60) return "Good - some room for improvement";
  if (score >= 40) return "Needs work - opportunity for growth";
  return "Critical - requires immediate attention";
}

function identifyWeakAreas(scores: any): string {
  const weakDimensions = [];

  if (scores.insight < 60) {
    weakDimensions.push(`- INSIGHT: ${scores.insight}/100 - Priority area for coaching`);
  }
  if (scores.distinctive < 60) {
    weakDimensions.push(`- DISTINCTIVE: ${scores.distinctive}/100 - Priority area for coaching`);
  }
  if (scores.empathetic < 60) {
    weakDimensions.push(`- EMPATHETIC: ${scores.empathetic}/100 - Priority area for coaching`);
  }
  if (scores.authentic < 60) {
    weakDimensions.push(`- AUTHENTIC: ${scores.authentic}/100 - Priority area for coaching`);
  }

  return weakDimensions.length > 0
    ? weakDimensions.join("\n")
    : "All IDEA dimensions performing well!";
}

function formatDiagnosticAsDocument(
  userEmail: string,
  diagnosticData: any,
  scores: any
): string {
  return `# Brand Diagnostic Results - ${userEmail}

**Assessment Date:** ${new Date().toISOString().split('T')[0]}
**User:** ${userEmail}

## IDEA Framework Scores

- **Insight Score:** ${scores.insight}/100 - ${getScoreInterpretation(scores.insight)}
- **Distinctive Score:** ${scores.distinctive}/100 - ${getScoreInterpretation(scores.distinctive)}
- **Empathetic Score:** ${scores.empathetic}/100 - ${getScoreInterpretation(scores.empathetic)}
- **Authentic Score:** ${scores.authentic}/100 - ${getScoreInterpretation(scores.authentic)}

**Overall Brand Strength:** ${scores.overall}/100

## Priority Areas for Improvement

${identifyWeakAreas(scores)}

## Detailed Assessment Responses

${Object.entries(diagnosticData.answers || {})
  .map(([question, answer]) => `**Question:** ${question}\n**Response:** ${answer}`)
  .join("\n\n")}

## Brand Context

${diagnosticData.companyName ? `**Company:** ${diagnosticData.companyName}` : ""}
${diagnosticData.industry ? `**Industry:** ${diagnosticData.industry}` : ""}
${diagnosticData.targetAudience ? `**Target Audience:** ${diagnosticData.targetAudience}` : ""}

## Coaching Focus Areas

Based on the scores above, the Brand Coach should focus on:
${scores.insight < 60 ? "- Developing deeper customer insights and understanding emotional triggers\n" : ""}${scores.distinctive < 60 ? "- Creating unique brand positioning and differentiation strategies\n" : ""}${scores.empathetic < 60 ? "- Building stronger emotional connections with the audience\n" : ""}${scores.authentic < 60 ? "- Strengthening brand authenticity and consistency\n" : ""}
`.trim();
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

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const { diagnosticData, scores } = await req.json();

    if (!diagnosticData || !scores) {
      throw new Error("diagnosticData and scores are required");
    }

    console.log(`Syncing diagnostic for user: ${user.email}`);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Service role client for database operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Format diagnostic as document
    const diagnosticDocument = formatDiagnosticAsDocument(
      user.email!,
      diagnosticData,
      scores
    );

    // Chunk the diagnostic document
    const chunks = chunkText(diagnosticDocument, { chunkSize: 1000, overlap: 200 });
    console.log(`Diagnostic formatted into ${chunks.length} chunks`);

    // Delete existing diagnostic KB chunks for this user
    const { error: deleteError } = await supabase
      .from("user_knowledge_chunks")
      .delete()
      .eq("user_id", user.id)
      .eq("source_type", "diagnostic_kb")
      .eq("category", "diagnostic");

    if (deleteError) {
      console.warn("Failed to delete old diagnostic KB chunks:", deleteError);
    }

    // Generate embeddings and store chunks
    let successCount = 0;
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.content, OPENAI_API_KEY);

      const { error: insertError } = await supabase
        .from("user_knowledge_chunks")
        .insert({
          user_id: user.id,
          content: chunk.content,
          embedding: JSON.stringify(embedding),
          source_type: "diagnostic_kb",
          category: "diagnostic",
          chunk_index: chunk.index,
          metadata: {
            chunk_index: chunk.index,
            total_chunks: chunks.length,
            scores,
          },
        });

      if (insertError) {
        console.error(`Failed to insert diagnostic KB chunk ${chunk.index}:`, insertError);
        throw insertError;
      }
      successCount++;
    }

    console.log(`Synced ${successCount} diagnostic KB chunks to pgvector`);

    return new Response(
      JSON.stringify({
        success: true,
        chunksCreated: successCount,
        backend: 'pgvector',
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in sync-diagnostic-to-user-kb:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

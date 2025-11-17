import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function uploadFileToOpenAI(content: string, openaiKey: string): Promise<string> {
  const blob = new Blob([content], { type: "text/plain" });
  const formData = new FormData();
  formData.append("file", blob, "diagnostic-results.txt");
  formData.append("purpose", "assistants");

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload file: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.id;
}

async function addFileToVectorStore(
  vectorStoreId: string,
  fileId: string,
  openaiKey: string
): Promise<void> {
  const response = await fetch(
    `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2",
      },
      body: JSON.stringify({
        file_id: fileId,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add file to vector store: ${response.status} - ${error}`);
  }
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

    const supabase = createClient(
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
    } = await supabase.auth.getUser();

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

    // Ensure user has vector stores (create if not)
    const ensureResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/ensure-user-kb`,
      {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
      }
    );

    if (!ensureResponse.ok) {
      throw new Error("Failed to ensure user KB");
    }

    const { stores } = await ensureResponse.json();
    const userStores = { data: stores };

    // Format diagnostic as text document
    const diagnosticDocument = formatDiagnosticAsDocument(
      user.email!,
      diagnosticData,
      scores
    );

    // Upload to OpenAI
    console.log("Uploading diagnostic document to OpenAI...");
    const fileId = await uploadFileToOpenAI(diagnosticDocument, OPENAI_API_KEY);
    console.log(`✅ File uploaded: ${fileId}`);

    // Add to user's diagnostic vector store
    console.log("Adding file to diagnostic vector store...");
    await addFileToVectorStore(
      userStores.data.diagnostic_store_id,
      fileId,
      OPENAI_API_KEY
    );
    console.log(`✅ File added to vector store: ${userStores.data.diagnostic_store_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        fileId: fileId,
        vectorStoreId: userStores.data.diagnostic_store_id,
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

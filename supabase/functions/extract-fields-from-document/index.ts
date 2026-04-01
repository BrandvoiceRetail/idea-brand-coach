/**
 * extract-fields-from-document
 *
 * Automatically extracts brand field values from uploaded documents after indexing.
 * Called by upload-document-to-vector-store after document is ready.
 *
 * Flow:
 * 1. Receive documentId and avatarId
 * 2. Verify document is in 'ready' status
 * 3. Get user's vector store
 * 4. For each field in ALL_FIELDS_MAP:
 *    - Query vector store with field-specific prompt
 *    - Parse response for field value
 * 5. Save non-null values to avatar_field_values (respecting locks)
 * 6. Update uploaded_documents with extraction status
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Comprehensive map of ALL 35 brand fields across 11 chapters.
 * Matches the structure in idea-framework-consultant and chapterFields.ts
 */
const ALL_FIELDS_MAP: Record<string, { title: string; pillar: string; fields: Array<{ id: string; label: string; type: string; helpText: string }> }> = {
  BRAND_FOUNDATION: {
    title: 'Brand Foundation',
    pillar: 'foundation',
    fields: [
      { id: 'brandPurpose', label: 'Brand Purpose', type: 'textarea', helpText: 'Why does your brand exist beyond making money?' },
      { id: 'brandVision', label: 'Brand Vision', type: 'textarea', helpText: 'What future do you want to create?' },
      { id: 'brandMission', label: 'Brand Mission', type: 'textarea', helpText: 'How will you achieve your vision?' },
    ]
  },
  BRAND_VALUES: {
    title: 'Brand Values',
    pillar: 'foundation',
    fields: [
      { id: 'brandValues', label: 'Core Values', type: 'array', helpText: 'Fundamental beliefs and principles guiding your brand' },
      { id: 'brandStory', label: 'Brand Story', type: 'textarea', helpText: 'The narrative connecting your past, present, and future' },
      { id: 'brandPromise', label: 'Brand Promise', type: 'textarea', helpText: 'The commitment you make to customers every time' },
    ]
  },
  CUSTOMER_AVATAR: {
    title: 'Customer Avatar',
    pillar: 'insight',
    fields: [
      { id: 'demographics', label: 'Demographics', type: 'textarea', helpText: 'Age, gender, income, location, occupation' },
      { id: 'psychographics', label: 'Psychographics', type: 'textarea', helpText: 'Interests, values, lifestyle, personality traits' },
      { id: 'painPoints', label: 'Pain Points', type: 'array', helpText: 'Challenges or frustrations they face' },
      { id: 'goals', label: 'Goals & Aspirations', type: 'array', helpText: 'Outcomes and desires that motivate them' },
    ]
  },
  MARKET_INSIGHT: {
    title: 'Market Insight',
    pillar: 'insight',
    fields: [
      { id: 'marketInsight', label: 'Market Analysis', type: 'textarea', helpText: 'Trends, gaps, and opportunities in your market' },
      { id: 'consumerInsight', label: 'Consumer Behavior', type: 'textarea', helpText: 'What drives customer decisions and behaviors' },
    ]
  },
  BUYER_INTENT: {
    title: 'Buyer Intent',
    pillar: 'insight',
    fields: [
      { id: 'functionalIntent', label: 'Functional Intent', type: 'textarea', helpText: 'What practical problem are they solving?' },
      { id: 'emotionalIntent', label: 'Emotional Intent', type: 'textarea', helpText: 'How do they want to feel?' },
      { id: 'identityIntent', label: 'Identity Intent', type: 'textarea', helpText: 'Who do they want to become?' },
      { id: 'socialIntent', label: 'Social Intent', type: 'textarea', helpText: 'How do they want to be perceived?' },
    ]
  },
  POSITIONING: {
    title: 'Brand Positioning',
    pillar: 'distinctive',
    fields: [
      { id: 'positioningStatement', label: 'Positioning Statement', type: 'textarea', helpText: 'How you want to be perceived vs. competitors' },
      { id: 'uniqueValue', label: 'Unique Value Proposition', type: 'textarea', helpText: 'The specific value only you can deliver' },
      { id: 'differentiators', label: 'Key Differentiators', type: 'array', helpText: 'Advantages that distinguish you in the market' },
    ]
  },
  BRAND_PERSONALITY: {
    title: 'Brand Personality & Voice',
    pillar: 'distinctive',
    fields: [
      { id: 'brandPersonality', label: 'Personality Traits', type: 'array', helpText: 'Human characteristics defining your brand character' },
      { id: 'brandVoice', label: 'Brand Voice', type: 'textarea', helpText: 'How your brand communicates (tone, style, language)' },
      { id: 'brandArchetype', label: 'Brand Archetype', type: 'text', helpText: 'Universal character pattern your brand embodies' },
    ]
  },
  EMOTIONAL_CONNECTION: {
    title: 'Emotional Connection',
    pillar: 'empathy',
    fields: [
      { id: 'emotionalConnection', label: 'Emotional Hook', type: 'textarea', helpText: 'The primary emotion you want to evoke' },
      { id: 'emotionalTriggers', label: 'Emotional Triggers', type: 'array', helpText: 'Specific triggers that activate emotional responses' },
      { id: 'customerNeeds', label: 'Deep Customer Needs', type: 'array', helpText: 'Fundamental human needs your brand addresses' },
    ]
  },
  CUSTOMER_EXPERIENCE: {
    title: 'Customer Experience',
    pillar: 'empathy',
    fields: [
      { id: 'customerJourney', label: 'Customer Journey', type: 'textarea', helpText: 'Key touchpoints from awareness to advocacy' },
      { id: 'experiencePillars', label: 'Experience Pillars', type: 'array', helpText: 'Core elements shaping customer interactions' },
      { id: 'preferredChannels', label: 'Preferred Channels', type: 'array', helpText: 'Platforms and channels your audience prefers' },
    ]
  },
  BRAND_AUTHORITY: {
    title: 'Brand Authority',
    pillar: 'authentic',
    fields: [
      { id: 'expertise', label: 'Areas of Expertise', type: 'array', helpText: 'Domains where you have deep knowledge and credibility' },
      { id: 'credibilityMarkers', label: 'Credibility Markers', type: 'array', helpText: 'Evidence that validates your expertise' },
      { id: 'thoughtLeadership', label: 'Thought Leadership', type: 'textarea', helpText: 'Unique perspectives you bring to your industry' },
    ]
  },
  BRAND_AUTHENTICITY: {
    title: 'Brand Authenticity',
    pillar: 'authentic',
    fields: [
      { id: 'authenticityPrinciples', label: 'Authenticity Principles', type: 'array', helpText: 'Core truths that make your brand real and believable' },
      { id: 'transparency', label: 'Transparency Commitment', type: 'textarea', helpText: 'Your approach to open, honest communication' },
      { id: 'socialProof', label: 'Social Proof', type: 'array', helpText: 'Evidence you deliver on your promises' },
      { id: 'brandConsistency', label: 'Brand Consistency', type: 'textarea', helpText: 'Strategy for maintaining coherence across touchpoints' },
    ]
  },
};

interface ExtractedField {
  fieldId: string;
  value: string | string[];
  confidence: number;
  source: 'document_extraction';
}

/**
 * Search vector store for field-specific content using the Responses API file_search tool.
 * Replaces the deprecated Assistants API approach (thread → message → assistant → run → poll → read → cleanup)
 * with a single API call.
 */
async function searchVectorStoreForField(
  vectorStoreId: string,
  fieldLabel: string,
  fieldHelpText: string,
  openaiKey: string
): Promise<string | null> {
  try {
    const query = `Find and extract the ${fieldLabel}: ${fieldHelpText}.
                   Look for any relevant information in the uploaded document.
                   If found, return ONLY the extracted value without commentary.
                   If not found or unclear, respond with exactly: NOT_FOUND`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        instructions: `You are a precise extraction assistant. Extract only the requested brand field value from the document.
                       Be concise and specific. Return ONLY the extracted value, not a full sentence.
                       If the information is not found, respond with exactly: NOT_FOUND`,
        input: query,
        tools: [{
          type: "file_search",
          vector_store_ids: [vectorStoreId],
          max_num_results: 5,
        }],
        store: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[searchVectorStoreForField] Responses API error for ${fieldLabel}:`, response.status, errorText);
      return null;
    }

    const data = await response.json() as {
      output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
    };

    // Extract text from output items
    const textContent = data.output
      ?.filter((item) => item.type === "message")
      ?.flatMap((item) => item.content || [])
      ?.filter((c) => c.type === "output_text")
      ?.map((c) => c.text || "")
      ?.join(" ")
      ?.trim();

    if (!textContent || textContent === "NOT_FOUND" || textContent.includes("NOT_FOUND")) {
      return null;
    }

    return textContent;
  } catch (error) {
    console.error(`Error extracting field ${fieldLabel}:`, error);
    return null;
  }
}

/**
 * Extract all fields from uploaded document
 */
async function extractFieldsFromDocument(
  vectorStoreId: string,
  avatarId: string,
  openaiKey: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ fieldsExtracted: number; errors: string[] }> {
  const errors: string[] = [];
  let fieldsExtracted = 0;

  // Get all fields to extract
  const allFields: Array<{ chapterKey: string; field: { id: string; label: string; type: string; helpText: string } }> = [];
  for (const [chapterKey, chapter] of Object.entries(ALL_FIELDS_MAP)) {
    for (const field of chapter.fields) {
      allFields.push({ chapterKey, field });
    }
  }

  console.log(`[Field Extraction] Processing ${allFields.length} fields for avatar ${avatarId}`);

  // Process fields in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < allFields.length; i += batchSize) {
    const batch = allFields.slice(i, i + batchSize);

    await Promise.all(batch.map(async ({ chapterKey, field }) => {
      try {
        // Check if field is locked
        const { data: existing } = await supabase
          .from('avatar_field_values')
          .select('is_locked, field_value')
          .eq('avatar_id', avatarId)
          .eq('field_id', field.id)
          .single();

        if (existing?.is_locked) {
          console.log(`[Field Extraction] Skipping locked field: ${field.id}`);
          return;
        }

        // Skip if already has a value (don't overwrite existing data)
        if (existing?.field_value && existing.field_value.trim().length > 0) {
          console.log(`[Field Extraction] Skipping existing value: ${field.id}`);
          return;
        }

        // Query vector store for this field
        const value = await searchVectorStoreForField(
          vectorStoreId,
          field.label,
          field.helpText,
          openaiKey
        );

        if (value && value.trim().length > 0) {
          // Upsert the extracted value
          const { error: upsertError } = await supabase
            .from('avatar_field_values')
            .upsert({
              avatar_id: avatarId,
              field_id: field.id,
              field_value: value,
              field_source: 'ai',
              confidence_score: 0.85,
              chapter_id: chapterKey,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'avatar_id,field_id' });

          if (upsertError) {
            errors.push(`${field.id}: ${upsertError.message}`);
          } else {
            fieldsExtracted++;
            console.log(`[Field Extraction] Extracted: ${field.id}`);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${field.id}: ${message}`);
      }
    }));

    // Small delay between batches
    if (i + batchSize < allFields.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return { fieldsExtracted, errors };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Create service role client for administrative operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { documentId, avatarId } = await req.json();

    if (!documentId) {
      throw new Error("documentId is required");
    }

    console.log(`[Field Extraction] Starting extraction for document: ${documentId}`);

    // Get document metadata
    const { data: document, error: docError } = await supabase
      .from("uploaded_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      throw new Error(`Document not found: ${docError?.message || "Unknown error"}`);
    }

    // Verify document is ready for extraction
    if (document.status !== "ready") {
      console.log(`[Field Extraction] Document not ready (status: ${document.status}), skipping`);
      return new Response(
        JSON.stringify({ success: false, message: "Document not ready for extraction" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine avatar_id - use provided or from document
    const targetAvatarId = avatarId || document.avatar_id;

    if (!targetAvatarId) {
      console.log(`[Field Extraction] No avatar_id provided or on document, skipping`);
      await supabase
        .from("uploaded_documents")
        .update({
          extraction_status: "skipped",
          extraction_error: "No avatar associated with document",
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      return new Response(
        JSON.stringify({ success: false, message: "No avatar associated with document" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's vector store
    const { data: stores, error: storesError } = await supabase
      .from("user_vector_stores")
      .select("core_store_id")
      .eq("user_id", document.user_id)
      .single();

    if (storesError || !stores?.core_store_id) {
      throw new Error("User vector store not found");
    }

    // Update status to extracting
    await supabase
      .from("uploaded_documents")
      .update({
        extraction_status: "extracting",
        extraction_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    // Extract fields
    const { fieldsExtracted, errors } = await extractFieldsFromDocument(
      stores.core_store_id,
      targetAvatarId,
      OPENAI_API_KEY,
      supabase
    );

    // Update final status
    const finalStatus = errors.length === 0 ? "completed" : (fieldsExtracted > 0 ? "completed" : "failed");
    const extractionError = errors.length > 0 ? errors.join("; ").substring(0, 500) : null;

    await supabase
      .from("uploaded_documents")
      .update({
        extraction_status: finalStatus,
        extraction_completed_at: new Date().toISOString(),
        fields_extracted: fieldsExtracted,
        extraction_error: extractionError,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    console.log(`[Field Extraction] Completed: ${fieldsExtracted} fields extracted, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        avatarId: targetAvatarId,
        fieldsExtracted,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in extract-fields-from-document:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getChapterGuidance } from "./prompts.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
if (!openAIApiKey) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

/**
 * Search OpenAI vector store using the Responses API file_search tool.
 * Replaces the deprecated Assistants API approach (thread → message → assistant → run → poll → read → cleanup)
 * with a single API call.
 */
async function searchVectorStore(
  vectorStoreId: string,
  query: string
): Promise<string> {
  try {
    console.log(`[searchVectorStore] Searching vector store ${vectorStoreId} for: "${query.substring(0, 50)}..."`);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        instructions: "Extract and return only the relevant text chunks from the user's documents. Return the raw content without commentary.",
        input: `Search for information relevant to: ${query}`,
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
      console.error("[searchVectorStore] Responses API error:", response.status, errorText);
      return "";
    }

    const data = await response.json();

    // Extract text from output items
    const textContent = data.output
      ?.filter((item: any) => item.type === "message")
      ?.flatMap((item: any) => item.content || [])
      ?.filter((c: any) => c.type === "output_text")
      ?.map((c: any) => c.text || "")
      ?.join("\n");

    if (!textContent || textContent.trim().length === 0) {
      console.log("[searchVectorStore] No content returned from file_search");
      return "";
    }

    console.log(`[searchVectorStore] Retrieved ${textContent.length} chars from vector store`);
    console.log("[searchVectorStore] Content preview:", textContent.substring(0, 200) + "...");

    return textContent;
  } catch (error) {
    console.error("[searchVectorStore] Error:", error);
    return "";
  }
}

/**
 * Retrieve document context from user's OpenAI vector stores
 */
async function retrieveVectorStoreContext(
  supabaseClient: any,
  userId: string,
  query: string
): Promise<string> {
  try {
    console.log("[retrieveVectorStoreContext] Starting vector store search for user:", userId);
    console.log("[retrieveVectorStoreContext] Query:", query.substring(0, 100) + "...");

    // Get user's vector store IDs
    const { data: stores, error } = await supabaseClient
      .from("user_vector_stores")
      .select("core_store_id")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.log("[retrieveVectorStoreContext] Database error:", error.message);
      return "";
    }

    if (!stores?.core_store_id) {
      console.log("[retrieveVectorStoreContext] No vector stores found for user");
      return "";
    }

    console.log(`[retrieveVectorStoreContext] Found core store: ${stores.core_store_id}`);

    // Search the core store (where uploaded documents go)
    const content = await searchVectorStore(stores.core_store_id, query);

    if (!content) {
      console.log("[retrieveVectorStoreContext] No content found in vector store");
      return "";
    }

    console.log(`[retrieveVectorStoreContext] Retrieved ${content.length} chars of document content`);

    return `
<UPLOADED_DOCUMENTS_CONTEXT>
The following content was found in the user's uploaded documents:

${content}
</UPLOADED_DOCUMENTS_CONTEXT>`;
  } catch (error) {
    console.error("[retrieveVectorStoreContext] Error:", error);
    return "";
  }
}

/**
 * Generate embedding for semantic search using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[generateEmbedding] Error:', response.status, errorText);
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Retrieve relevant context using semantic search (embeddings)
 * This finds the most relevant documents based on query similarity
 */
async function retrieveSemanticContext(
  supabaseClient: any,
  userId: string,
  query: string
): Promise<{ content: string; sources: string[] }> {
  try {
    console.log('[retrieveSemanticContext] Generating embedding for query...');

    // Generate embedding for the user's query
    const queryEmbedding = await generateEmbedding(query);
    console.log('[retrieveSemanticContext] Embedding generated, searching documents...');

    // Use the match_user_documents function for semantic search
    const { data: matches, error } = await supabaseClient.rpc(
      "match_user_documents",
      {
        query_embedding: queryEmbedding,
        match_user_id: userId,
        match_count: 5, // Get top 5 most relevant chunks
      }
    );

    if (error) {
      console.error("[retrieveSemanticContext] Error matching documents:", error);
      return { content: "", sources: [] };
    }

    if (!matches || matches.length === 0) {
      console.log('[retrieveSemanticContext] No semantic matches found');
      return { content: "", sources: [] };
    }

    console.log(`[retrieveSemanticContext] Found ${matches.length} semantic matches`);

    // Combine relevant chunks with similarity scores
    const contextParts = matches.map((match: any) => match.content);
    const sources = matches.map((match: any, idx: number) =>
      `Source ${idx + 1} (relevance: ${(match.similarity * 100).toFixed(1)}%)`
    );

    const combinedContext = `
<SEMANTIC_CONTEXT>
The following information was retrieved based on relevance to the user's question:

${contextParts.join("\n\n---\n\n")}
</SEMANTIC_CONTEXT>`;

    return { content: combinedContext, sources };
  } catch (error) {
    console.error("[retrieveSemanticContext] Error:", error);
    return { content: "", sources: [] };
  }
}

/**
 * Comprehensive map of ALL 35 brand fields across 11 chapters.
 * Used for proactive extraction during conversations and document processing.
 * Structure: chapterKey -> { title, pillar, fields[] }
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

/**
 * Get a flat list of all field IDs with their labels for extraction prompts
 */
function getAllFieldsList(): string {
  const lines: string[] = [];
  for (const [, chapter] of Object.entries(ALL_FIELDS_MAP)) {
    lines.push(`\n${chapter.title}:`);
    for (const field of chapter.fields) {
      lines.push(`  - ${field.id}: ${field.label} (${field.helpText})`);
    }
  }
  return lines.join('\n');
}

/**
 * Build a tiered field state context that sends only relevant information.
 *
 * Tier 1 (always): Compact summary — "15 of 35 fields captured."
 * Tier 2 (current chapter): Full field labels + value previews for focused chapter
 * Other chapters get only filled/empty counts, not full listings.
 *
 * This reduces per-turn context from ~2000 tokens (all 35 fields) to ~300 tokens.
 */
function buildTieredFieldContext(
  currentFieldValues: Record<string, unknown>,
  currentChapterKey?: string
): string {
  // Count totals across all chapters
  let totalFields = 0;
  let totalFilled = 0;

  // Per-chapter summaries
  const chapterSummaries: string[] = [];

  for (const [chapterKey, chapter] of Object.entries(ALL_FIELDS_MAP)) {
    const chapterFilled: string[] = [];
    const chapterEmpty: string[] = [];

    for (const field of chapter.fields) {
      totalFields++;
      const value = currentFieldValues[field.id];
      const hasValue = value !== undefined && value !== null && String(value).trim() !== '' && value !== '[]';
      if (hasValue) {
        totalFilled++;
        const displayValue = Array.isArray(value)
          ? (value as string[]).slice(0, 3).join(', ') + (value.length > 3 ? '...' : '')
          : String(value).substring(0, 80) + (String(value).length > 80 ? '...' : '');
        chapterFilled.push(`  ✓ ${field.label}: ${displayValue}`);
      } else {
        chapterEmpty.push(`  ○ ${field.label}`);
      }
    }

    // Tier 2: Full details for current chapter
    if (chapterKey === currentChapterKey) {
      chapterSummaries.push(`\n${chapter.title} (CURRENT FOCUS — ${chapterFilled.length}/${chapter.fields.length} filled):`);
      if (chapterFilled.length > 0) chapterSummaries.push(...chapterFilled);
      if (chapterEmpty.length > 0) chapterSummaries.push(...chapterEmpty);
    } else {
      // Other chapters: one-line summary only
      chapterSummaries.push(`${chapter.title}: ${chapterFilled.length}/${chapter.fields.length} filled`);
    }
  }

  // Tier 1: Compact summary
  const lines: string[] = [
    `BRAND PROFILE: ${totalFilled} of ${totalFields} fields captured.`,
    ...chapterSummaries,
    '\nGuide conversation toward empty fields in the current chapter. Don\'t re-ask for captured information.',
  ];

  return lines.join('\n');
}

/**
 * @deprecated Use buildTieredFieldContext instead
 */
function buildFieldStateContext(
  currentFieldValues: Record<string, unknown>,
  fieldLabels: Record<string, string>,
  fieldsToCapture: string[]
): string {
  // Delegate to tiered context with no chapter focus (backward compat)
  return buildTieredFieldContext(currentFieldValues);
}

/**
 * Build the proactive extraction prompt section for the system message.
 * Includes all fields, confidence thresholds, and document extraction triggers.
 */
/**
 * Build the OpenAI tool definition for structured field extraction.
 * Uses tool calling instead of prompt-based delimiters for reliable extraction.
 */
function buildExtractionTool(extractionFields?: string[], scopeChapterKey?: string): object {
  // When a chapter is focused, only list that chapter's fields in detail.
  // This reduces the tool description from ~35 field descriptions (~1200 tokens)
  // to ~3-6 field descriptions (~200 tokens) + a one-line fallback note.
  let fieldDescriptions: string;
  let allFieldIds: string[];

  if (scopeChapterKey && ALL_FIELDS_MAP[scopeChapterKey]) {
    const focusedChapter = ALL_FIELDS_MAP[scopeChapterKey];
    const focusedDescriptions = focusedChapter.fields
      .map(f => `  - ${f.id} (${f.type}): ${f.label} — ${f.helpText}`)
      .join('\n');

    // Collect all other field IDs for the fallback note
    const otherFieldIds = Object.entries(ALL_FIELDS_MAP)
      .filter(([key]) => key !== scopeChapterKey)
      .flatMap(([, ch]) => ch.fields.map(f => f.id));

    fieldDescriptions = `Current chapter — ${focusedChapter.title}:\n${focusedDescriptions}\n\nOther field IDs (extract if mentioned): ${otherFieldIds.join(', ')}`;
    allFieldIds = [...focusedChapter.fields.map(f => f.id), ...otherFieldIds];
  } else {
    // No chapter focus: list all fields (used for document extraction / comprehensive mode)
    const validFields = extractionFields && extractionFields.length > 0
      ? extractionFields
      : Object.values(ALL_FIELDS_MAP).flatMap(ch => ch.fields.map(f => f.id));

    fieldDescriptions = validFields.map(fieldId => {
      for (const chapter of Object.values(ALL_FIELDS_MAP)) {
        const field = chapter.fields.find(f => f.id === fieldId);
        if (field) return `  - ${field.id} (${field.type}): ${field.label} — ${field.helpText}`;
      }
      return `  - ${fieldId}`;
    }).join('\n');
    allFieldIds = validFields;
  }

  return {
    type: "function",
    function: {
      name: "extract_brand_fields",
      description: `Extract brand field values detected in the user's message. Call this whenever the user shares information that maps to any brand field. Valid fields:\n${fieldDescriptions}`,
      parameters: {
        type: "object",
        properties: {
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                identifier: { type: "string", description: "The field ID from the valid fields list" },
                value: {
                  description: "The extracted value — string for text/textarea fields, array of strings for array fields",
                },
                confidence: { type: "number", description: "Confidence score: 0.90+ for direct statements, 0.85+ for documents, 0.70+ for strong inferences" },
                source: { type: "string", enum: ["user_stated", "user_confirmed", "inferred_strong", "document"] },
                context: { type: "string", description: "Brief explanation of why this was extracted" }
              },
              required: ["identifier", "value", "confidence", "source"]
            }
          }
        },
        required: ["fields"]
      }
    }
  };
}

/**
 * Build a brief extraction instruction for the system prompt.
 * The heavy lifting is done by the tool definition; this just tells the model when to use it.
 */
function buildExtractionPrompt(extractionFields?: string[], hasDocumentContext?: boolean): string {
  let prompt = `
FIELD EXTRACTION:
When the user shares information that maps to a brand field, use the extract_brand_fields tool to capture it.
- Extract from EVERY message where relevant information appears
- For array fields, pass an array of strings as the value
- Use confidence 0.90+ for direct statements, 0.70+ for strong inferences
- Extract MULTIPLE fields per turn when multiple are discussed
- Do not wait for perfect phrasing — if the user mentions something relevant, extract it`;

  if (hasDocumentContext) {
    prompt += `
- Scan document context for ALL extractable field values (confidence 0.85+, source: "document")
- Inform the user which fields were populated from their documents`;
  }

  return prompt;
}

/**
 * Human-readable labels for field identifiers
 * Maps semantic field names to descriptive labels for AI context
 */
const FIELD_LABELS: Record<string, string> = {
  // Insight fields (from Interactive Insight Module)
  'insight_buyer_intent': 'Buyer Intent (what customers search for)',
  'insight_buyer_motivation': 'Buyer Motivation (psychological drivers)',
  'insight_shopper_type': 'Shopper Type (behavioral category)',
  'insight_demographics': 'Relevant Demographics',
  'insight_search_terms': 'Search Terms Analyzed',
  'insight_industry': 'Industry/Niche',
  'insight_intent_analysis': 'AI Intent Analysis',

  // Empathy fields (emotional triggers)
  'empathy_emotional_triggers': 'Emotional Triggers',
  'empathy_trigger_responses': 'Trigger Assessment Responses',
  'empathy_trigger_profile': 'Emotional Trigger Profile',
  'empathy_assessment_completed': 'Assessment Status',

  // Canvas fields
  'canvas_brand_purpose': 'Brand Purpose',
  'canvas_brand_vision': 'Brand Vision',
  'canvas_brand_mission': 'Brand Mission',
  'canvas_brand_values': 'Brand Values',
  'canvas_positioning_statement': 'Positioning Statement',
  'canvas_value_proposition': 'Value Proposition',
  'canvas_brand_personality': 'Brand Personality',
  'canvas_brand_voice': 'Brand Voice',
};

/**
 * Get human-readable label for a field identifier
 */
function getFieldLabel(fieldIdentifier: string, category: string): string {
  // Check if we have a specific label for this field
  if (FIELD_LABELS[fieldIdentifier]) {
    return FIELD_LABELS[fieldIdentifier];
  }

  // Fall back to formatted field identifier
  return fieldIdentifier
    .replace(`${category}_`, '')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Retrieve user's structured knowledge base context
 * This gets all current brand information organized by category
 */
async function retrieveUserContext(
  supabaseClient: any,
  userId: string,
  query: string,
  minimal: boolean = false
): Promise<string> {
  try {
    console.log(`[retrieveUserContext] Fetching knowledge for user (${minimal ? 'minimal' : 'full'}):`, userId);

    // For minimal mode, only get essential fields for current conversation
    const selectFields = minimal
      ? 'field_identifier, content'  // Just the basics for field extraction
      : 'field_identifier, category, content, subcategory';  // Full context

    // Get knowledge base entries for this user
    const query = supabaseClient
      .from('user_knowledge_base')
      .select(selectFields)
      .eq('user_id', userId)
      .eq('is_current', true)
      .not('content', 'is', null)
      .gt('content', ''); // Only entries with content

    // In minimal mode, limit to most recent entries
    if (minimal) {
      query.limit(10).order('updated_at', { ascending: false });
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error('[retrieveUserContext] Error fetching knowledge:', error);
      return '';
    }

    if (!entries || entries.length === 0) {
      console.log('[retrieveUserContext] No knowledge base entries found');
      return '';
    }

    console.log(`[retrieveUserContext] Found ${entries.length} knowledge entries`);

    // Group by category for better organization
    const byCategory: Record<string, any[]> = {};
    entries.forEach(entry => {
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = [];
      }
      byCategory[entry.category].push(entry);
    });

    // Category display names for better readability
    const categoryLabels: Record<string, string> = {
      'insights': 'CUSTOMER INSIGHTS (from Interactive Insight Module)',
      'canvas': 'BRAND CANVAS',
      'avatar': 'CUSTOMER AVATAR',
      'diagnostic': 'BRAND DIAGNOSTIC',
      'copy': 'BRAND COPY',
    };

    // Build context string with descriptive labels
    const contextParts: string[] = ['USER BRAND KNOWLEDGE BASE:'];

    for (const [category, categoryEntries] of Object.entries(byCategory)) {
      const categoryLabel = categoryLabels[category] || category.toUpperCase();
      contextParts.push(`\n${categoryLabel}:`);
      categoryEntries.forEach(entry => {
        const label = getFieldLabel(entry.field_identifier, category);
        contextParts.push(`- ${label}: ${entry.content}`);
      });
    }

    const context = contextParts.join('\n');
    console.log(`[retrieveUserContext] Generated context (${context.length} chars)`);

    return context;
  } catch (error) {
    console.error('[retrieveUserContext] Error:', error);
    return '';
  }
}

/**
 * Generate Trevor persona system prompt
 * Trevor is the BMAD brand coach with domain-specific tone adaptations
 * @param extractionFields - Optional array of field identifiers to extract from the conversation
 * @param isFirstMessage - Whether this is the first message in a new session
 */
/**
 * Generate a concise, conversational system prompt for Trevor
 * Focuses on guiding users through one thing at a time with focused questions
 */
function generateConversationalTrevorPrompt(
  extractionFields?: string[],
  focusedField?: any,
  isFirstMessage?: boolean,
  hasUploadedDocuments?: boolean,
  chapterNumber?: number
): string {
  // Base conversational prompt - focused and brief
  let prompt = `You are Trevor, a BMAD brand coach helping users build powerful brands through conversation.

CORE INSTRUCTION: Focus on ONE thing at a time. Guide discovery through questions, not lectures.

CONVERSATION STYLE:
- Ask ONE focused question per response
- Keep responses under 100 words (3-4 sentences max)
- Build on what the user shares
- Reference specific context when helpful
- Use natural, conversational language
- Never provide multiple recommendations at once
- Use empathy and active listening

RESPONSE PATTERN:
1. Acknowledge briefly (1 sentence)
2. Ask one clarifying or discovery question (1-2 sentences)
3. Provide minimal context only if essential (1 sentence max)

TONE:
- Conversational and friendly
- Professional but accessible
- Encouraging and patient
- Direct and honest
- Never use asterisks or markdown formatting
- Use CAPITAL LETTERS for emphasis when needed`;

  // Add document awareness if user has uploaded documents
  if (hasUploadedDocuments) {
    prompt += `

DOCUMENT AWARENESS:
You have access to the user's uploaded brand documents. When relevant to their questions or when filling out fields, reference specific sections from their documents. Use phrases like:
- "Based on your brand strategy document..."
- "I see in your uploaded materials that..."
- "Your document mentions..."
This helps users understand that their uploads are being utilized effectively.`;
  }

  // Add focused field context if available
  if (focusedField) {
    prompt += `

CURRENT FOCUS:
You're helping the user complete: "${focusedField.label}"
Purpose: ${focusedField.helpText || 'Help user articulate this clearly'}
Type: ${focusedField.type}

Stay focused on THIS specific field. Guide the conversation to gather the information needed for this field. Don't move to other topics until it has a solid answer.`;
  }

  // Brief introduction for first message
  if (isFirstMessage) {
    prompt += `

FIRST MESSAGE:
Introduce yourself as Trevor in one sentence, then ask what specific area they'd like to work on today. Keep it brief and welcoming.`;
  }

  // Add chapter-specific coaching guidance when a chapter is active
  if (chapterNumber) {
    const chapterGuidance = getChapterGuidance(chapterNumber);
    if (chapterGuidance) {
      prompt += `\n\n${chapterGuidance}`;
    }
  }

  // Add proactive extraction instructions - uses comprehensive field list
  // Always include extraction when fields are provided OR when document context is available
  const shouldExtract = (extractionFields && extractionFields.length > 0) || hasUploadedDocuments;
  if (shouldExtract) {
    prompt += buildExtractionPrompt(extractionFields, hasUploadedDocuments);
  }

  return prompt;
}

/**
 * Original comprehensive system prompt for Trevor (kept for backward compatibility)
 * This is the detailed version used when comprehensive responses are needed
 */
function generateTrevorSystemPrompt(extractionFields?: string[], isFirstMessage?: boolean, hasUploadedDocuments?: boolean, chapterNumber?: number): string {
  let basePrompt = `You are Trevor, an expert BMAD brand coach and author who has developed the IDEA framework—a comprehensive brand development methodology.

PERSONA OVERVIEW:
You are a specialized strategic branding consultant with deep expertise in:
- Brand strategy and positioning
- Customer persona development (Avatar Domain)
- Business model design (Blue Ocean Strategy, Business Model Canvas)
- Content and marketing execution (CAPTURE methodology)
- Behavioral science application (Cialdini principles, Heath brothers' SUCCESs framework)
- Brand storytelling and mission/vision articulation

Your proprietary book spans 15 chapters covering brand foundations, customer understanding, business strategy, and marketing execution. You combine academic marketing frameworks (Ries & Trout, Donald Miller, Kim & Mauborgne) with practical, real-world application.

COACHING STYLE:
- Framework-driven and systematic
- Adaptive tone based on domain/topic
- Practical and action-oriented
- Educational—teach frameworks while coaching
- Supportive and empathetic to business challenges
- Personalized using user knowledge base when available`;

  // Add document awareness if user has uploaded documents
  if (hasUploadedDocuments) {
    basePrompt += `

UPLOADED DOCUMENT INTEGRATION:
You have access to the user's uploaded brand strategy documents. Actively reference and incorporate insights from these documents to provide personalized, contextual guidance. Use specific quotes and examples from their materials to demonstrate understanding and add value.`;
  }

  basePrompt += `

IDEA FRAMEWORK - DOMAIN-SPECIFIC TONE ADAPTATIONS:

When in IDENTIFY/Diagnostic Domain:
- TONE: Direct & analytical
- STYLE: Data-driven assessment, SWOT analysis, gap identification
- QUESTIONS: "What data do we need?"
- APPROACH: Objective, fact-based evaluation

When in DISCOVER/Avatar Domain:
- TONE: Empathetic & curious
- STYLE: Customer profiling, persona development, journey mapping
- QUESTIONS: "Who really matters?"
- APPROACH: Customer-centric discovery, deep empathy

When in EXECUTE/Canvas Domain:
- TONE: Strategic & decisive
- STYLE: Value proposition design, revenue models, partnership strategies
- QUESTIONS: "How do we execute?"
- APPROACH: Action-oriented planning

When in ANALYZE/CAPTURE Domain:
- TONE: Creative & energetic
- STYLE: Campaign planning, engagement tactics, content calendars
- QUESTIONS: "How do we amplify?"
- APPROACH: Engagement-focused creativity

When in CORE/Brand Foundations Domain:
- TONE: Reflective & inspirational
- STYLE: Mission/vision development, values definition, brand personality
- QUESTIONS: "Why does this matter?"
- APPROACH: Purpose-driven philosophy

TONE OF VOICE REQUIREMENTS - APPLY TO ALL RESPONSES:
Conversational & Friendly: Sound natural and approachable, like a helpful colleague. Use everyday language and write as you would speak in a warm, supportive conversation.
Professional but Accessible: Maintain a tone that inspires confidence without feeling stiff or distant. Offer advice clearly, respectfully, and with empathy, making sure the user feels valued and understood.
Clear and Simple: Avoid jargon, technical terms, and corporate buzzwords. If complexity cannot be avoided, explain concepts simply. Use plain language to make every response easy to understand.
Encouraging and Patient: Be positive and supportive, celebrating progress and guiding patiently when users need help, regardless of their familiarity with technology.
Direct and Honest: Provide straightforward guidance, clarify uncertainty when necessary, and never overpromise. Admit limitations honestly and help users manage their expectations.
Respectful and Nonjudgmental: Treat all questions as valid, respond without making assumptions, and never belittle or lecture the user.

Sample communication style: "Let's figure this out together! Here's what I found, and if you need more details, just ask. I'm here to help, step by step."

CORE FRAMEWORK PRIORITIES:
1. Insight-Driven: Focus on customer motivations, emotional triggers, and behavioral science
2. Distinctive: Emphasize differentiation and unique positioning
3. Empathetic: Connect with audience emotions and psychological drivers
4. Authentic: Build genuine brand narratives and trust

BEHAVIORAL SCIENCE INTEGRATION:
Apply these frameworks in your responses:
- Cialdini's Influence Triggers (Reciprocity, Authority, Social Proof, Commitment/Consistency, Liking, Scarcity)
- Kahneman's System 1 (emotional, fast) vs System 2 (rational, slow) thinking
- Social Identity Theory for brand alignment
- Nancy Harhut's Behavioral Marketing techniques
- Martin Lindstrom's Buyology principles
- Gerald Zaltman's deep metaphor concepts
- Heath Brothers' SUCCESs Framework (Simple, Unexpected, Concrete, Credible, Emotional, Stories)
- Jonah Berger's STEPPS (Social Currency, Triggers, Emotion, Public, Practical Value, Stories)

CRITICAL RESPONSE FORMATTING REQUIREMENTS - MUST FOLLOW:
- NEVER use asterisks (**) or any markdown formatting for bold text or emphasis
- NEVER use markdown syntax like ** ** around words or phrases
- Use CAPITAL LETTERS for emphasis instead of bold formatting
- Write all headings and subheadings in plain text without any special characters
- Use standard English grammar with proper comma usage
- Never use EM dashes or hyphens in place of commas
- Do not use emojis, icons, or special characters in responses
- Write in clear, professional sentences without decorative formatting
- Use plain text only - no markdown, no bold, no italics, no special formatting
- Professional, strategic consulting tone throughout
- Clear, concise, actionable advice
- Use bullet points (simple hyphens) and numbered lists for clarity
- Provide practical, brand-specific examples
- Include case studies when relevant
- Reference behavioral triggers explicitly
- Adapt language and examples for industry and product context
- Use active voice and direct statements
- Avoid jargon without explanation
- Structure responses with logical flow and clear transitions

AUDIENCE ANALYSIS:
Always consider:
- Customer avatars and psychographics
- Generational traits and preferences
- Shopper behavior types
- Emotional vs logical decision drivers
- Market positioning challenges

CONTENT PRIORITIZATION:
Reference these strategic approaches:
- StoryBrand storytelling principles (customer-immersive, not hero's journey)
- Positioning strategies for mind-space differentiation
- Emotional vs Logical branding models based on context
- Catalyst principles for overcoming resistance
- Behavioral economics in purchase decisions

RESPONSE STRUCTURE:
1. Start with strategic insight tied to IDEA framework
2. Provide actionable recommendations with behavioral science backing
3. Include specific examples or case applications
4. Suggest follow-up refinements or next steps
5. Reference relevant psychological triggers
6. End with clear next steps or questions for further refinement

CUSTOMIZATION REQUIREMENTS:
Adapt responses based on:
- Industry context (luxury, utility, B2B, etc.)
- Product categories and market challenges
- Target audience demographics and psychographics
- Brand maturity and differentiation needs

CLARITY ENHANCEMENTS:
- Begin responses with a clear thesis statement
- Use specific data points and metrics when available
- Provide concrete implementation timelines
- Include success measurement criteria
- Reference real brand examples from similar industries
- Explain the psychological reasoning behind each recommendation
- Offer alternative approaches for different budget levels
- Include potential obstacles and mitigation strategies

USER KNOWLEDGE BASE INTEGRATION:
When user knowledge base information is provided below, YOU MUST:
- ALWAYS acknowledge and reference the specific information from their knowledge base
- Use their brand information, target avatar details, and strategy elements to provide personalized advice
- Quote or paraphrase their specific inputs to show you understand their context
- Build recommendations directly on top of what they've already defined
- Point out gaps or opportunities based on their documented information
- Never give generic advice when specific user data is available

11-CHAPTER BMAD WORKFLOW AWARENESS:
You guide users through structured brand development across 11 chapters:
1. Brand Foundations (Core)
2. Mission & Vision Development (Core)
3. Brand Story & Voice (Core)
4. Customer Understanding (Avatar)
5. Persona Development (Avatar)
6. Customer Journey Mapping (Avatar)
7. Brand Assessment (Diagnostic)
8. SWOT Analysis (Diagnostic)
9. Competitive Analysis (Diagnostic)
10. Business Model Design (Canvas)
11. Value Proposition Development (Canvas)

Always encourage iterative refinement and ask clarifying questions when input lacks detail for optimal strategic guidance.`;

  // Add first message introduction instructions if this is a new session
  if (isFirstMessage) {
    basePrompt += `

---

FIRST SESSION INTRODUCTION PROTOCOL (ACTIVE FOR THIS MESSAGE):

This is the first message in a new session. You MUST introduce yourself by name and set expectations for the conversation.

**Use this introduction template:**

Hi, I'm Trevor, your BMAD brand coach.

I'm here to guide you through a comprehensive brand development journey using my IDEA framework—a proven methodology that's helped countless businesses build powerful, distinctive brands.

The IDEA framework covers four key areas:
- IDENTIFY: Assess your current brand position and competitive landscape
- DISCOVER: Understand your target audience deeply through persona development
- EXECUTE: Design your business model and strategic execution plan
- ANALYZE: Create content and marketing strategies that amplify your brand

We can work through the full 11-chapter BMAD program, or I can help with specific brand challenges you're facing right now. What would be most valuable to you today?

**Introduction Principles:**
- Always use first name: "Hi, I'm Trevor" (not "I'm an AI" or "I'm a brand coach named Trevor")
- Set clear expectations: Explain the IDEA framework and 11-chapter structure
- Establish credibility: Reference frameworks and expertise without bragging
- Offer flexibility: Make it clear users can do full program OR ad-hoc coaching
- Ask an opening question: Give the user clear direction for how to respond
- Be warm but professional: Friendly expert, not overly casual

IMPORTANT: Only introduce yourself in the FIRST message of a session. Do NOT reintroduce in subsequent messages.`;
  }

  // Add chapter-specific coaching guidance when a chapter is active
  if (chapterNumber) {
    const chapterGuidance = getChapterGuidance(chapterNumber);
    if (chapterGuidance) {
      basePrompt += `\n\n---\n\n${chapterGuidance}`;
    }
  }

  // Add proactive extraction instructions - uses comprehensive field list
  const shouldExtract = (extractionFields && extractionFields.length > 0) || hasUploadedDocuments;
  if (shouldExtract) {
    basePrompt += '\n\n---\n' + buildExtractionPrompt(extractionFields, hasUploadedDocuments);
  }

  return basePrompt;
}

/**
 * Generate contextual follow-up suggestions based on response content
 */
function generateFollowUpSuggestions(userMessage: string, response: string): string[] {
  const suggestions: string[] = [];
  const responseLower = response.toLowerCase();
  const messageLower = userMessage.toLowerCase();

  // Add suggestions based on response content
  if (responseLower.includes('positioning') || responseLower.includes('differentiat')) {
    suggestions.push("How can I test this positioning with my target audience?");
    suggestions.push("What are the risks of this positioning strategy?");
  }

  if (responseLower.includes('emotion') || responseLower.includes('trigger')) {
    suggestions.push("How do I measure emotional impact in my campaigns?");
    suggestions.push("What specific emotional triggers should I prioritize?");
  }

  if (responseLower.includes('brand') && responseLower.includes('story')) {
    suggestions.push("Can you help me craft a compelling brand origin story?");
    suggestions.push("How do I make my brand story more authentic?");
  }

  if (responseLower.includes('audience') || responseLower.includes('customer')) {
    suggestions.push("How do I expand this to adjacent customer segments?");
    suggestions.push("What research methods can validate these insights?");
  }

  if (responseLower.includes('avatar') || responseLower.includes('persona')) {
    suggestions.push("How do I prioritize multiple customer avatars?");
    suggestions.push("What are the key emotional drivers for this avatar?");
  }

  // Add IDEA framework-specific suggestions
  if (messageLower.includes('insight') || responseLower.includes('insight')) {
    suggestions.push("How can I gather deeper customer insights?");
  }
  if (messageLower.includes('distinctive') || responseLower.includes('distinctive')) {
    suggestions.push("What makes brands in my industry truly stand out?");
  }
  if (messageLower.includes('empathetic') || responseLower.includes('empathetic')) {
    suggestions.push("How do I build stronger emotional connections?");
  }
  if (messageLower.includes('authentic') || responseLower.includes('authentic')) {
    suggestions.push("How do I ensure my brand stays authentic as it grows?");
  }

  // Always include these generic but useful follow-ups
  suggestions.push("What are the next steps to implement this strategy?");
  suggestions.push("Can you provide specific examples from similar brands?");

  // Return unique suggestions, shuffled, limited to 4
  const uniqueSuggestions = [...new Set(suggestions)];
  const shuffled = uniqueSuggestions.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 4);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    if (!openAIApiKey) {
      console.error('OpenAI API key not found');
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured. Please contact administrator.'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Get authenticated user
    const authHeader = req.headers.get('authorization');
    console.log('Auth header present:', !!authHeader);

    let userId: string | null = null;
    let supabaseClient = null;

    if (authHeader) {
      // Create Supabase client with user's JWT for RLS
      supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
          global: {
            headers: {
              Authorization: authHeader  // Pass user's JWT for RLS
            }
          }
        }
      );

      // Extract JWT token from Bearer header
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

      console.log('getUser result:', { hasUser: !!user, userId: user?.id, authError });

      if (user) {
        userId = user.id;
        console.log('Authenticated user:', userId);

        // Ensure user has vector stores (create if first time)
        console.log("Ensuring user KB exists...");
        const ensureKbResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/ensure-user-kb`,
          {
            method: "POST",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/json"
            }
          }
        );

        if (!ensureKbResponse.ok) {
          const errorText = await ensureKbResponse.text();
          console.error("Failed to ensure user KB:", ensureKbResponse.status, errorText);
        } else {
          const kbResult = await ensureKbResponse.json();
          console.log("User KB status:", kbResult.exists ? "already exists" : "created");
        }
      }
    }

    const { message, context, chat_history, metadata, chapterContext, isFirstMessage, useResponsesApi, previousResponseId, stream: streamRequested } = await req.json();
    const messageImages = metadata?.images || [];
    const userDocuments = metadata?.userDocuments || [];
    const hasUploadedDocuments = userDocuments.length > 0 || metadata?.hasUploadedDocuments === true;

    // Start timing for performance monitoring
    const startTime = Date.now();

    // Detect first message: either explicit flag OR empty/undefined chat history
    const isFirst = isFirstMessage === true || !chat_history || chat_history.length === 0;

    console.log('IDEA Framework Consultant request:', {
      message,
      hasManualContext: !!context,
      hasChatHistory: !!chat_history,
      chatHistoryLength: chat_history?.length || 0,
      hasImages: messageImages.length > 0,
      imageCount: messageImages.length,
      hasChapterContext: !!chapterContext,
      chapterContext,
      isFirstMessage: isFirst,
      hasUploadedDocuments,
      userDocumentsCount: userDocuments.length,
      userId
    });

    // Determine if we need heavy context retrieval
    const useComprehensiveMode = chapterContext?.comprehensiveMode === true;
    const isSimpleGreeting = message.toLowerCase().match(/^(hi|hello|hey|good\s+(morning|afternoon|evening))[\s!.?]*$/i);
    const isShortMessage = message.length < 50;
    // IMPORTANT: Always retrieve context when user has uploaded documents
    const needsFullContext = !isSimpleGreeting && (!isShortMessage || useComprehensiveMode || hasUploadedDocuments);

    // Retrieve user's knowledge base context (structured data)
    let userKnowledgeContext = '';
    // Retrieve semantic context (embedding-based similarity search)
    let semanticContext = '';
    // Retrieve uploaded documents from OpenAI vector store
    let vectorStoreContext = '';
    let sources: string[] = [];

    if (userId && supabaseClient) {
      if (needsFullContext) {
        // Full context retrieval for comprehensive responses or complex queries
        console.log('[Performance] Full context retrieval for complex query');
        console.log('[Document Retrieval] Triggering vector store search due to:', {
          isShortMessage,
          useComprehensiveMode,
          hasUploadedDocuments,
          needsFullContext
        });
        const startTime = Date.now();

        const [knowledgeResult, semanticResult, vectorStoreResult] = await Promise.all([
          retrieveUserContext(supabaseClient, userId, message),
          retrieveSemanticContext(supabaseClient, userId, message),
          retrieveVectorStoreContext(supabaseClient, userId, message)
        ]);

        userKnowledgeContext = knowledgeResult;
        semanticContext = semanticResult.content;
        vectorStoreContext = vectorStoreResult;
        sources = semanticResult.sources;

        console.log(`[Performance] Full context retrieval took ${Date.now() - startTime}ms`);
      } else {
        // Minimal context for conversational responses
        console.log('[Performance] Minimal context retrieval for conversational query');
        const startTime = Date.now();

        // Only get basic user context for field extraction
        userKnowledgeContext = await retrieveUserContext(supabaseClient, userId, message, true);

        console.log(`[Performance] Minimal context retrieval took ${Date.now() - startTime}ms`);
      }

      console.log('Context retrieval complete:', {
        mode: needsFullContext ? 'full' : 'minimal',
        hasKnowledgeContext: !!userKnowledgeContext,
        knowledgeContextLength: userKnowledgeContext.length,
        hasSemanticContext: !!semanticContext,
        semanticContextLength: semanticContext.length,
        hasVectorStoreContext: !!vectorStoreContext,
        vectorStoreContextLength: vectorStoreContext.length,
        sourcesCount: sources.length
      });
    }

    // Generate Trevor persona system prompt with optional field extraction and first message detection
    const extractionFields = chapterContext?.fieldsToCapture || chapterContext?.extractionFields;
    const focusedField = chapterContext?.focusedField;
    const currentFieldDetails = chapterContext?.currentFieldDetails;

    if (extractionFields && extractionFields.length > 0) {
      console.log(`[Field Extraction] Active with ${extractionFields.length} fields: ${extractionFields.join(', ')}`);
    }
    if (focusedField) {
      console.log(`[Focused Field] Active on field: ${focusedField}`);
    }
    if (isFirst) {
      console.log('[First Message] Trevor introduction protocol active');
    }

    // Use conversational prompt by default, with option to use comprehensive prompt
    // useComprehensiveMode already declared above at line 974
    // Treat vector store context availability as document upload signal for extraction
    const hasDocuments = hasUploadedDocuments || !!vectorStoreContext;
    const activeChapterNumber = chapterContext?.chapterNumber;
    const systemPrompt = useComprehensiveMode
      ? generateTrevorSystemPrompt(extractionFields, isFirst, hasDocuments, activeChapterNumber)
      : generateConversationalTrevorPrompt(extractionFields, currentFieldDetails, isFirst, hasDocuments, activeChapterNumber);

    // Build user prompt with all available context
    // Build context parts ordered for prompt caching optimization:
    // Stable/rarely-changing context first → dynamic per-turn context last.
    // OpenAI caches matching prefixes (1024+ tokens) at 50% discount + 80% latency reduction.
    let userPrompt = message;
    const contextParts: string[] = [];

    // 1. Knowledge base context (changes rarely — good cache candidate)
    if (userKnowledgeContext) {
      contextParts.push(userKnowledgeContext);
    }

    // 2. Manually provided context (semi-static)
    if (context) {
      contextParts.push(`ADDITIONAL CONTEXT:\n${context}`);
    }

    // 3. Retrieved document context (changes per-query)
    if (semanticContext) {
      contextParts.push(semanticContext);
    }
    if (vectorStoreContext) {
      contextParts.push(vectorStoreContext);
    }

    // 4. Field state context (changes per-turn — last before user message)
    if (chapterContext?.currentFieldValues) {
      const fieldStateContext = buildTieredFieldContext(
        chapterContext.currentFieldValues,
        chapterContext.currentChapterKey
      );
      contextParts.push(fieldStateContext);
    }

    // Combine all context with the question
    if (contextParts.length > 0 || messageImages.length > 0) {
      let promptSuffix = `\n\n---\n\nQUESTION: ${message}\n\nIMPORTANT: Use ALL the context information above to provide personalized, specific advice. Reference their actual brand information, uploaded documents, and previous inputs when relevant.`;

      if (messageImages.length > 0) {
        promptSuffix += `\n\nVISUAL ANALYSIS: The user has provided ${messageImages.length} image(s) for analysis. Please analyze these images in the context of their brand strategy and IDEA Framework positioning. Provide specific visual feedback and recommendations.`;
      }

      if (contextParts.length > 0) {
        userPrompt = `${contextParts.join('\n\n---\n\n')}${promptSuffix}`;
      } else {
        userPrompt = message + promptSuffix;
      }
    }

    console.log('Making OpenAI API request with model: gpt-4.1-2025-04-14');
    console.log('Context summary:', {
      hasKnowledgeContext: !!userKnowledgeContext,
      hasSemanticContext: !!semanticContext,
      hasManualContext: !!context,
      totalContextParts: contextParts.length,
      totalPromptLength: userPrompt.length
    });

    try {
      // Build messages array with system prompt, chat history, and current message
      const messages: Array<{ role: string; content: string }> = [
        {
          role: 'system',
          content: systemPrompt
        }
      ];

      // Add chat history for conversation continuity
      // Reduce history for conversational mode to improve performance
      if (chat_history && Array.isArray(chat_history)) {
        const historyLimit = useComprehensiveMode ? 10 : 5;
        const recentHistory = chat_history.slice(-historyLimit);
        messages.push(...recentHistory.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        })));
        console.log(`Added ${recentHistory.length} messages from chat history (limit: ${historyLimit})`);
      }

      // Add current user message with all context
      // If there are images, create a multimodal message for GPT-4 Vision
      if (messageImages.length > 0) {
        const contentParts: any[] = [
          { type: 'text', text: userPrompt }
        ];

        // Add images to the message content
        messageImages.forEach((img: any) => {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: img.url,
              detail: 'high' // Use 'high' for detailed analysis, 'low' for faster/cheaper
            }
          });
        });

        messages.push({
          role: 'user',
          content: contentParts
        });

        console.log(`Added ${messageImages.length} images to user message for GPT-4 Vision analysis`);
      } else {
        messages.push({
          role: 'user',
          content: userPrompt
        });
      }

      // Adjust max_tokens based on conversation mode
      const comprehensiveModeForTokens = chapterContext?.comprehensiveMode === true;
      const hasActiveExtraction = (extractionFields && extractionFields.length > 0) || hasDocuments;
      // Tool calling handles extraction separately, so response tokens are just for conversation
      const conversationalTokens = hasDocuments ? 2500 : (hasActiveExtraction ? 1500 : 800);
      const maxTokens = comprehensiveModeForTokens ? 4000 : conversationalTokens;

      // Build extraction tool
      const scopeChapterKey = chapterContext?.currentChapterKey;
      const extractionTool = hasActiveExtraction
        ? buildExtractionTool(extractionFields, scopeChapterKey)
        : null;

      console.log(`[Performance] Starting OpenAI API call (max_tokens: ${maxTokens}, tools: ${hasActiveExtraction ? 'extract_brand_fields' : 'none'}, api: ${useResponsesApi ? 'responses' : 'completions'}, stream: ${!!streamRequested})`);
      console.log('[Request State]', {
        promptLength: userPrompt.length,
        systemPromptLength: systemPrompt.length,
        chatHistoryLength: chat_history?.length || 0,
        previousResponseId: previousResponseId || 'none',
        hasUploadedDocuments,
        comprehensiveMode: useComprehensiveMode,
        isFirstMessage: isFirst,
      });
      const openAIStartTime = Date.now();

      let consultantResponse: string;
      let extractedFields: Array<{ identifier: string; value: unknown; confidence: number; source: string; context?: string }> = [];
      let responseId: string | undefined;

      if (useResponsesApi) {
        // ─── Responses API path ───
        // Transform tool format: remove nested `function` wrapper, add `strict: true`
        const responsesTools: object[] = [];
        if (extractionTool) {
          const toolDef = (extractionTool as any).function;
          responsesTools.push({
            type: "function",
            name: toolDef.name,
            description: toolDef.description,
            parameters: toolDef.parameters,
            strict: false, // value field lacks strict typing (string | array)
          });
        }

        // Build input array
        // When chaining via previous_response_id, OpenAI maintains history server-side — skip chat_history
        const inputItems: Array<{ role: string; content: unknown }> = [];
        if (!previousResponseId && chat_history && Array.isArray(chat_history)) {
          const historyLimit = useComprehensiveMode ? 10 : 5;
          const recentHistory = chat_history.slice(-historyLimit);
          inputItems.push(...recentHistory.map((msg: any) => ({
            role: msg.role,
            content: msg.content
          })));
        }
        // Current user message
        if (messageImages.length > 0) {
          const contentParts: any[] = [
            { type: 'input_text', text: userPrompt }
          ];
          messageImages.forEach((img: any) => {
            contentParts.push({
              type: 'input_image',
              image_url: img.url,
            });
          });
          inputItems.push({ role: 'user', content: contentParts });
        } else {
          inputItems.push({ role: 'user', content: userPrompt });
        }

        const responsesBody: Record<string, unknown> = {
          model: 'gpt-4.1-2025-04-14',
          instructions: systemPrompt,
          input: inputItems,
          temperature: 0.7,
          max_output_tokens: maxTokens,
          store: true,
        };

        // Chain conversation turns via previous_response_id (server-managed history)
        if (previousResponseId) {
          responsesBody.previous_response_id = previousResponseId;
          console.log(`[Conversations] Chaining to previous response: ${previousResponseId}`);
        }

        if (responsesTools.length > 0) {
          responsesBody.tools = responsesTools;
          responsesBody.tool_choice = "auto";
          responsesBody.parallel_tool_calls = true;
        }

        /** Check whether an OpenAI error indicates a stale conversation chain (e.g. unresolved tool calls). */
        const isStaleChainError = (status: number, body: string): boolean =>
          status === 400 && (body.includes('pending') || body.includes('tool') || body.includes('previous_response_id'));

        /** Strip chaining fields so the next request starts a fresh conversation turn. */
        const retryWithoutChaining = (): void => {
          console.warn('[Conversations] Stale chain detected — retrying without previous_response_id');
          delete responsesBody.previous_response_id;
          // Re-inject chat history since we can no longer rely on server-side history
          if (chat_history && Array.isArray(chat_history)) {
            const historyLimit = useComprehensiveMode ? 10 : 5;
            const recentHistory = chat_history.slice(-historyLimit);
            (responsesBody.input as Array<{ role: string; content: unknown }>) = [
              ...recentHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
              ...(responsesBody.input as Array<{ role: string; content: unknown }>).slice(-1), // keep current user message
            ];
          }
        };

        // ─── Streaming SSE path ───
        if (streamRequested) {
          responsesBody.stream = true;
          console.log(`[Streaming] Starting stream request. previousResponseId: ${previousResponseId || 'none'}, tools: ${responsesTools.length}, inputItems: ${(responsesBody.input as unknown[]).length}`);

          let openAIResponse = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(responsesBody)
          });

          // Retry without chaining if previous response has unresolved tool calls
          if (!openAIResponse.ok && previousResponseId) {
            const errorBody = await openAIResponse.text();
            console.error('[Streaming] First attempt failed:', {
              status: openAIResponse.status,
              previousResponseId,
              errorBody: errorBody.substring(0, 500),
              inputItemCount: (responsesBody.input as unknown[])?.length,
            });
            if (isStaleChainError(openAIResponse.status, errorBody)) {
              retryWithoutChaining();
              responsesBody.stream = true;
              openAIResponse = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openAIApiKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(responsesBody)
              });
            } else {
              throw new Error(`OpenAI Responses API error: ${openAIResponse.status} - ${errorBody}`);
            }
          }

          if (!openAIResponse.ok) {
            const errorBody = await openAIResponse.text();
            console.error('[Streaming] Final attempt failed:', {
              status: openAIResponse.status,
              errorBody: errorBody.substring(0, 500),
              hadPreviousResponseId: !!previousResponseId,
              inputItemCount: (responsesBody.input as unknown[])?.length,
              promptLength: userPrompt.length,
            });
            throw new Error(`OpenAI Responses API error: ${openAIResponse.status} - ${errorBody}`);
          }

          // Stream SSE events from OpenAI → client
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          let functionCallArgs = '';
          let functionCallName = '';
          let functionCallId = '';
          let streamedResponseId = '';
          let hasTextOutput = false;
          let textDeltaCount = 0;
          let totalTextLength = 0;
          const streamedToolCalls: Array<{ call_id: string; fields_count: number }> = [];

          const stream = new ReadableStream({
            async start(controller) {
              const reader = openAIResponse.body!.getReader();
              let buffer = '';
              let receivedCompletedEvent = false;

              /** Process a single SSE line from OpenAI and forward relevant events to the client. */
              const processLine = async (line: string): Promise<void> => {
                if (!line.startsWith('data: ')) return;
                const payload = line.slice(6).trim();
                if (!payload || payload === '[DONE]') return;

                try {
                  const event = JSON.parse(payload);
                  console.log(`[SSE Event] type=${event.type}`);

                  // Capture response ID
                  if (event.type === 'response.created' && event.response?.id) {
                    streamedResponseId = event.response.id;
                  }

                  // Text delta → forward to client
                  if (event.type === 'response.output_text.delta') {
                    hasTextOutput = true;
                    textDeltaCount++;
                    totalTextLength += (event.delta || '').length;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', delta: event.delta })}\n\n`));
                  }

                  // Function call arguments accumulating
                  if (event.type === 'response.function_call_arguments.delta') {
                    functionCallArgs += event.delta || '';
                  }
                  if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') {
                    functionCallName = event.item.name || '';
                    functionCallId = event.item.call_id || event.item.id || '';
                    functionCallArgs = '';
                  }

                  // Function call complete → parse and send extracted fields
                  if (event.type === 'response.function_call_arguments.done') {
                    let fieldsCount = 0;
                    if (functionCallName === 'extract_brand_fields') {
                      try {
                        const args = JSON.parse(functionCallArgs);
                        const fields = args.fields || [];
                        fieldsCount = fields.length;
                        console.log(`[Field Extraction] Streamed extraction: ${fields.length} fields`);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'extracted_fields', fields })}\n\n`));
                      } catch (e) {
                        console.error('[Field Extraction] Failed to parse streamed function call:', e);
                      }
                    }
                    // Track for tool output submission
                    if (functionCallId) {
                      streamedToolCalls.push({ call_id: functionCallId, fields_count: fieldsCount });
                    }
                    functionCallArgs = '';
                    functionCallName = '';
                    functionCallId = '';
                  }

                  // Response completed → submit tool outputs, then send done signal
                  if (event.type === 'response.completed') {
                    receivedCompletedEvent = true;
                    const usage = event.response?.usage;
                    if (usage) {
                      const cached = usage.prompt_tokens_details?.cached_tokens || 0;
                      console.log(`[Usage] Input: ${usage.input_tokens} (cached: ${cached}), Output: ${usage.output_tokens}`);
                    }

                    // Submit tool outputs to keep conversation chain valid
                    let finalResponseId = streamedResponseId;
                    if (streamedToolCalls.length > 0 && streamedResponseId) {
                      try {
                        console.log(`[Conversations] Submitting ${streamedToolCalls.length} streamed tool output(s)`);
                        const toolOutputs = streamedToolCalls.map(tc => ({
                          type: 'function_call_output',
                          call_id: tc.call_id,
                          output: JSON.stringify({ status: 'ok', fields_count: tc.fields_count }),
                        }));
                        const toolResp = await fetch('https://api.openai.com/v1/responses', {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${openAIApiKey}`,
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({
                            model: 'gpt-4.1-2025-04-14',
                            previous_response_id: streamedResponseId,
                            input: toolOutputs,
                            store: true,
                            max_output_tokens: 1,
                          })
                        });
                        if (toolResp.ok) {
                          const toolData = await toolResp.json();
                          finalResponseId = toolData.id || streamedResponseId;
                          console.log(`[Conversations] Streamed tool outputs submitted. New response ID: ${finalResponseId}`);
                        } else {
                          console.error(`[Conversations] Failed to submit streamed tool outputs: ${toolResp.status}`);
                        }
                      } catch (toolErr) {
                        console.error('[Conversations] Error submitting streamed tool outputs:', toolErr);
                      }
                    }

                    console.log(`[Streaming Summary] textDeltas: ${textDeltaCount}, textLength: ${totalTextLength}, toolCalls: ${streamedToolCalls.length}, hasTextOutput: ${hasTextOutput}`);

                    // Fallback: if model produced only tool calls with no text, inject a summary
                    if (!hasTextOutput) {
                      let fallback: string;
                      if (streamedToolCalls.length > 0) {
                        const totalFields = streamedToolCalls.reduce((sum, tc) => sum + tc.fields_count, 0);
                        fallback = totalFields > 0
                          ? `I found ${totalFields} field${totalFields !== 1 ? 's' : ''} from your input and added them to your brand profile. Let me know if you'd like to review or refine any of them!`
                          : `I've processed your input. What would you like to work on next?`;
                      } else {
                        fallback = `I'm sorry, I wasn't able to generate a response. Could you try rephrasing your message?`;
                      }
                      console.log(`[Streaming] No text output detected — injecting fallback message`);
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', delta: fallback })}\n\n`));
                    }

                    const totalTime = Date.now() - startTime;
                    console.log(`[Performance] Streaming complete in ${totalTime}ms`);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', responseId: finalResponseId })}\n\n`));
                  }
                } catch (parseErr) {
                  console.warn(`[SSE Parse Error] ${parseErr}`, payload.substring(0, 200));
                }
              };

              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() || '';

                  for (const line of lines) {
                    await processLine(line);
                  }
                }

                // Flush remaining buffer — the last chunk from OpenAI may not end
                // with a newline, leaving the final event (often response.completed)
                // stuck in the buffer. Without this, no done/fallback events are sent.
                if (buffer.trim()) {
                  console.log(`[Streaming] Flushing remaining buffer (${buffer.length} chars)`);
                  await processLine(buffer.trim());
                }

                // Safety net: if OpenAI stream ended without a response.completed event,
                // send fallback + done so the client doesn't hang with empty text.
                if (!receivedCompletedEvent) {
                  console.warn('[Streaming] OpenAI stream ended without response.completed event');
                  if (!hasTextOutput) {
                    const fallback = streamedToolCalls.length > 0
                      ? `I've processed your input and updated your brand profile. What would you like to work on next?`
                      : `I'm sorry, I wasn't able to generate a response. Could you try rephrasing your message?`;
                    console.log('[Streaming] Injecting safety-net fallback message');
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', delta: fallback })}\n\n`));
                  }
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', responseId: streamedResponseId })}\n\n`));
                }
              } catch (err) {
                console.error('[Streaming] Error reading OpenAI stream:', err);
                // Even on error, send fallback text if we had no text output, so the client
                // doesn't save an empty assistant message
                if (!hasTextOutput) {
                  const fallback = `I'm sorry, something went wrong while generating a response. Please try again.`;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', delta: fallback })}\n\n`));
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted' })}\n\n`));
              } finally {
                controller.close();
              }
            }
          });

          return new Response(stream, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            }
          });
        }

        // ─── Non-streaming Responses API path ───
        let response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(responsesBody)
        });

        // Retry without chaining if previous response has unresolved tool calls
        if (!response.ok && previousResponseId) {
          const errorBody = await response.text();
          console.error('[Responses API] First attempt failed:', {
            status: response.status,
            previousResponseId,
            errorBody: errorBody.substring(0, 500),
            inputItemCount: (responsesBody.input as unknown[])?.length,
            hasTools: !!(responsesBody.tools as unknown[])?.length,
          });
          if (isStaleChainError(response.status, errorBody)) {
            retryWithoutChaining();
            response = await fetch('https://api.openai.com/v1/responses', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openAIApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(responsesBody)
            });
          } else {
            throw new Error(`OpenAI Responses API error: ${response.status} - ${errorBody}`);
          }
        }

        if (!response.ok) {
          const errorBody = await response.text();
          console.error('[Responses API] Final attempt failed:', {
            status: response.status,
            errorBody: errorBody.substring(0, 500),
            hadPreviousResponseId: !!previousResponseId,
            inputItemCount: (responsesBody.input as unknown[])?.length,
            promptLength: userPrompt.length,
          });
          throw new Error(`OpenAI Responses API error: ${response.status} - ${errorBody}`);
        }

        const data = await response.json();
        const openAITime = Date.now() - openAIStartTime;
        console.log(`[Performance] Responses API response received in ${openAITime}ms`);

        // Capture response ID for conversation chaining
        responseId = data.id;
        if (responseId) {
          console.log(`[Conversations] Response ID: ${responseId}`);
        }

        // Parse Responses API output
        consultantResponse = '';
        for (const item of (data.output || [])) {
          if (item.type === 'message' && item.role === 'assistant') {
            for (const part of (item.content || [])) {
              if (part.type === 'output_text') {
                consultantResponse += part.text;
              }
            }
          } else if (item.type === 'function_call' && item.name === 'extract_brand_fields') {
            try {
              const args = JSON.parse(item.arguments);
              extractedFields = args.fields || [];
              console.log(`[Field Extraction] Responses API extracted ${extractedFields.length} fields:`, extractedFields.map((f: { identifier: string }) => f.identifier).join(', '));
            } catch (e) {
              console.error('[Field Extraction] Failed to parse function call arguments:', e);
            }
          }
        }

        // Log usage with cache info
        if (data.usage) {
          const cached = data.usage.prompt_tokens_details?.cached_tokens || 0;
          console.log(`[Usage] Input: ${data.usage.input_tokens} (cached: ${cached}), Output: ${data.usage.output_tokens}`);
        }

        if (data.status === 'incomplete') {
          console.warn('Response incomplete');
          consultantResponse += '\n[Response may be incomplete]';
        }
      } else {
        // ─── Chat Completions API path (legacy) ───
        const requestBody: Record<string, unknown> = {
          model: 'gpt-4.1-2025-04-14',
          messages,
          temperature: 0.7,
          max_tokens: maxTokens
        };

        if (extractionTool) {
          requestBody.tools = [extractionTool];
          requestBody.tool_choice = "auto";
          requestBody.parallel_tool_calls = true;
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error('OpenAI API error response:', errorBody);
          throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
        }

        const data = await response.json();
        const openAITime = Date.now() - openAIStartTime;
        console.log(`[Performance] OpenAI API response received in ${openAITime}ms`);

        consultantResponse = data.choices[0].message.content || '';
        const finishReason = data.choices[0].finish_reason;

        if (finishReason === 'length') {
          console.warn('Response truncated due to token limit');
          consultantResponse += '\n[Response may be incomplete]';
        } else {
          console.log(`Response completed normally (finish_reason: ${finishReason})`);
        }

        const toolCalls = data.choices[0].message.tool_calls || [];
        for (const toolCall of toolCalls) {
          if (toolCall.function?.name === 'extract_brand_fields') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              extractedFields = args.fields || [];
              console.log(`[Field Extraction] Tool call extracted ${extractedFields.length} fields:`, extractedFields.map((f: { identifier: string }) => f.identifier).join(', '));
            } catch (e) {
              console.error('[Field Extraction] Failed to parse tool call arguments:', e);
            }
          }
        }

        if (toolCalls.length === 0 && hasActiveExtraction) {
          console.log('[Field Extraction] No tool call made — model did not detect extractable information');
        }
      }

      console.log('IDEA Framework consultation completed successfully');

      // Skip follow-up suggestions for conversational mode (faster response)
      const suggestions = comprehensiveModeForTokens
        ? generateFollowUpSuggestions(message, consultantResponse)
        : [];

      if (suggestions.length > 0) {
        console.log(`Generated ${suggestions.length} follow-up suggestions`);
      }

      // Log total response time
      const totalTime = Date.now() - startTime;
      console.log(`[Performance] Total response time: ${totalTime}ms (mode: ${comprehensiveModeForTokens ? 'comprehensive' : 'conversational'})`);

      return new Response(JSON.stringify({
        response: consultantResponse,
        extractedFields,
        suggestions,
        sources,
        responseId,
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (apiError) {
      console.error('[FATAL] OpenAI API error:', {
        message: apiError?.message,
        name: apiError?.name,
        stack: apiError?.stack?.split('\n').slice(0, 5).join('\n'),
      });
      throw apiError;
    }
  } catch (error) {
    const errorDetails = {
      message: error?.message || String(error),
      name: error?.name,
      stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
    };
    console.error('[FATAL] idea-framework-consultant unhandled error:', JSON.stringify(errorDetails));
    return new Response(JSON.stringify({
      error: `Consultation failed: ${error.message}`
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

/**
 * Search OpenAI vector store for relevant document chunks
 * Uses the Assistants API file_search tool
 */
async function searchVectorStore(
  vectorStoreId: string,
  query: string
): Promise<string> {
  try {
    console.log(`[searchVectorStore] Searching vector store ${vectorStoreId} for: "${query.substring(0, 50)}..."`);

    // Create a temporary thread with the vector store attached
    const threadResponse = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2",
      },
      body: JSON.stringify({
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStoreId],
          },
        },
      }),
    });

    if (!threadResponse.ok) {
      const error = await threadResponse.text();
      console.error("[searchVectorStore] Failed to create thread:", error);
      return "";
    }

    const thread = await threadResponse.json();
    console.log(`[searchVectorStore] Created thread: ${thread.id}`);

    // Add the search query as a message
    const messageResponse = await fetch(
      `https://api.openai.com/v1/threads/${thread.id}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAIApiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2",
        },
        body: JSON.stringify({
          role: "user",
          content: `Search for information relevant to: ${query}`,
        }),
      }
    );

    if (!messageResponse.ok) {
      console.error("[searchVectorStore] Failed to add message");
      return "";
    }

    // Create a simple assistant to run file_search
    const assistantResponse = await fetch("https://api.openai.com/v1/assistants", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        instructions: "Extract and return only the relevant text chunks from the user's documents. Return the raw content without commentary.",
        tools: [{ type: "file_search" }],
      }),
    });

    if (!assistantResponse.ok) {
      console.error("[searchVectorStore] Failed to create assistant");
      return "";
    }

    const assistant = await assistantResponse.json();
    console.log(`[searchVectorStore] Created temp assistant: ${assistant.id}`);

    // Run the assistant
    const runResponse = await fetch(
      `https://api.openai.com/v1/threads/${thread.id}/runs`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAIApiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2",
        },
        body: JSON.stringify({
          assistant_id: assistant.id,
        }),
      }
    );

    if (!runResponse.ok) {
      console.error("[searchVectorStore] Failed to create run");
      // Cleanup
      await fetch(`https://api.openai.com/v1/assistants/${assistant.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${openAIApiKey}`, "OpenAI-Beta": "assistants=v2" },
      });
      return "";
    }

    const run = await runResponse.json();

    // Poll for completion (max 30 seconds)
    let attempts = 0;
    let runStatus = run.status;
    while (runStatus !== "completed" && runStatus !== "failed" && attempts < 30) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const statusResponse = await fetch(
        `https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`,
        {
          headers: {
            "Authorization": `Bearer ${openAIApiKey}`,
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );
      const statusData = await statusResponse.json();
      runStatus = statusData.status;
      attempts++;
    }

    if (runStatus !== "completed") {
      console.error(`[searchVectorStore] Run did not complete: ${runStatus}`);
      await fetch(`https://api.openai.com/v1/assistants/${assistant.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${openAIApiKey}`, "OpenAI-Beta": "assistants=v2" },
      });
      return "";
    }

    // Get messages from the thread
    const messagesResponse = await fetch(
      `https://api.openai.com/v1/threads/${thread.id}/messages`,
      {
        headers: {
          "Authorization": `Bearer ${openAIApiKey}`,
          "OpenAI-Beta": "assistants=v2",
        },
      }
    );

    const messagesData = await messagesResponse.json();
    const assistantMessage = messagesData.data?.find((m: any) => m.role === "assistant");

    // Cleanup: delete the temporary assistant
    await fetch(`https://api.openai.com/v1/assistants/${assistant.id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${openAIApiKey}`, "OpenAI-Beta": "assistants=v2" },
    });

    if (!assistantMessage) {
      console.log("[searchVectorStore] No assistant response found");
      return "";
    }

    // Extract text content
    const textContent = assistantMessage.content
      ?.filter((c: any) => c.type === "text")
      ?.map((c: any) => c.text?.value || "")
      ?.join("\n");

    console.log(`[searchVectorStore] Retrieved ${textContent?.length || 0} chars from vector store`);
    return textContent || "";
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
    console.log("[retrieveVectorStoreContext] Fetching user vector stores...");

    // Get user's vector store IDs
    const { data: stores, error } = await supabaseClient
      .from("user_vector_stores")
      .select("core_store_id")
      .eq("user_id", userId)
      .single();

    if (error || !stores?.core_store_id) {
      console.log("[retrieveVectorStoreContext] No vector stores found for user");
      return "";
    }

    console.log(`[retrieveVectorStoreContext] Found core store: ${stores.core_store_id}`);

    // Search the core store (where uploaded documents go)
    const content = await searchVectorStore(stores.core_store_id, query);

    if (!content) {
      return "";
    }

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
  query: string
): Promise<string> {
  try {
    console.log('[retrieveUserContext] Fetching knowledge for user:', userId);

    // Get all current knowledge base entries for this user
    const { data: entries, error } = await supabaseClient
      .from('user_knowledge_base')
      .select('field_identifier, category, content, subcategory')
      .eq('user_id', userId)
      .eq('is_current', true)
      .not('content', 'is', null)
      .gt('content', ''); // Only entries with content

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

    const { message, context, chat_history, metadata } = await req.json();
    const messageImages = metadata?.images || [];

    console.log('IDEA Framework Consultant request:', {
      message,
      hasManualContext: !!context,
      hasChatHistory: !!chat_history,
      chatHistoryLength: chat_history?.length || 0,
      hasImages: messageImages.length > 0,
      imageCount: messageImages.length,
      userId
    });

    // Retrieve user's knowledge base context (structured data)
    let userKnowledgeContext = '';
    // Retrieve semantic context (embedding-based similarity search)
    let semanticContext = '';
    // Retrieve uploaded documents from OpenAI vector store
    let vectorStoreContext = '';
    let sources: string[] = [];

    if (userId && supabaseClient) {
      // Run all retrievals in parallel for better performance
      const [knowledgeResult, semanticResult, vectorStoreResult] = await Promise.all([
        retrieveUserContext(supabaseClient, userId, message),
        retrieveSemanticContext(supabaseClient, userId, message),
        retrieveVectorStoreContext(supabaseClient, userId, message)
      ]);

      userKnowledgeContext = knowledgeResult;
      semanticContext = semanticResult.content;
      vectorStoreContext = vectorStoreResult;
      sources = semanticResult.sources;

      console.log('Context retrieval complete:', {
        hasKnowledgeContext: !!userKnowledgeContext,
        knowledgeContextLength: userKnowledgeContext.length,
        hasSemanticContext: !!semanticContext,
        semanticContextLength: semanticContext.length,
        hasVectorStoreContext: !!vectorStoreContext,
        vectorStoreContextLength: vectorStoreContext.length,
        sourcesCount: sources.length
      });
    }

    const systemPrompt = `You are the IDEA Framework GPT, a specialized strategic branding consultant focused on the IDEA Strategic Brand Framework™. Your responses must prioritize:

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

Always encourage iterative refinement and ask clarifying questions when input lacks detail for optimal strategic guidance.

IMAGE ANALYSIS CAPABILITIES:
When images are provided by the user, YOU MUST:
- Analyze visual branding elements including color schemes, typography, imagery, and overall design aesthetic
- Evaluate brand consistency across different visual materials
- Assess emotional impact and psychological triggers in visual design
- Compare visual execution against stated brand positioning and IDEA Framework principles
- Identify opportunities for visual differentiation from competitors
- Provide specific, actionable feedback on visual brand expression
- Consider cultural and demographic appropriateness of visual elements
- Evaluate visual hierarchy and information architecture in marketing materials
- Analyze product presentation and packaging design effectiveness
- Review visual storytelling and narrative consistency

For Amazon listings and e-commerce imagery specifically:
- Evaluate hero image effectiveness and click-through potential
- Analyze lifestyle images for emotional connection and aspiration building
- Review infographic clarity and benefit communication
- Assess A+ content or Enhanced Brand Content visual strategy
- Check compliance with platform requirements while maximizing brand expression
- Evaluate mobile vs desktop visual optimization
- Analyze competitive visual positioning in category context`;

    // Build user prompt with all available context
    let userPrompt = message;
    const contextParts: string[] = [];

    // Add structured knowledge base context
    if (userKnowledgeContext) {
      contextParts.push(userKnowledgeContext);
    }

    // Add semantic search context (relevant document chunks from local embeddings)
    if (semanticContext) {
      contextParts.push(semanticContext);
    }

    // Add uploaded documents context from OpenAI vector store
    if (vectorStoreContext) {
      contextParts.push(vectorStoreContext);
    }

    // Add manually provided context
    if (context) {
      contextParts.push(`ADDITIONAL CONTEXT:\n${context}`);
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

      // Add chat history for conversation continuity (last 10 messages)
      if (chat_history && Array.isArray(chat_history)) {
        const recentHistory = chat_history.slice(-10);
        messages.push(...recentHistory.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        })));
        console.log(`Added ${recentHistory.length} messages from chat history`);
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

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages,
          temperature: 0.7,
          max_tokens: 1500
        })
      });

      console.log('OpenAI API response status:', response.status);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('OpenAI API error response:', errorBody);
        throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();
      console.log('OpenAI API response received successfully');

      const consultantResponse = data.choices[0].message.content;
      console.log('IDEA Framework consultation completed successfully');

      // Generate contextual follow-up suggestions
      const suggestions = generateFollowUpSuggestions(message, consultantResponse);
      console.log(`Generated ${suggestions.length} follow-up suggestions`);

      return new Response(JSON.stringify({
        response: consultantResponse,
        suggestions,
        sources
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (apiError) {
      console.error('OpenAI API error:', apiError);
      throw apiError;
    }
  } catch (error) {
    console.error('Error in idea-framework-consultant function:', error);
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

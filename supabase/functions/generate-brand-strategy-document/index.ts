import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// SEMANTIC RETRIEVAL CONFIGURATION
// Section-specific queries for intelligent document retrieval
// ============================================================================

interface SectionQueryConfig {
  sectionId: string;
  sectionName: string;
  queries: string[];
  matchCount: number;
}

const SECTION_QUERIES: SectionQueryConfig[] = [
  {
    sectionId: '0_brand_identity',
    sectionName: 'Brand Identity',
    queries: [
      "brand name company name business name what is the brand called",
      "brand identity who we are company identity our name"
    ],
    matchCount: 5
  },
  {
    sectionId: '1_introduction',
    sectionName: 'Introduction and Overview',
    queries: [
      "brand overview purpose mission vision values company description",
      "company history founding story industry market business model"
    ],
    matchCount: 3
  },
  {
    sectionId: '2_customer_understanding',
    sectionName: 'Customer Understanding',
    queries: [
      "target customer demographics age income location occupation household psychographics lifestyle values",
      "customer pain points challenges frustrations goals aspirations desires needs wants",
      "buyer intent search behavior purchase decision shopping habits I want to know I want to buy"
    ],
    matchCount: 4
  },
  {
    sectionId: '3_brand_foundations',
    sectionName: 'Brand Foundations',
    queries: [
      "brand essence purpose why we exist core truth fundamental nature meaning",
      "brand vision mission values personality traits guiding principles beliefs"
    ],
    matchCount: 4
  },
  {
    sectionId: '4_brand_story',
    sectionName: 'Brand Story',
    queries: [
      "founder story origin heritage history journey beginning started how we began",
      "brand narrative breakthrough insight problem solution impact transformation"
    ],
    matchCount: 3
  },
  {
    sectionId: '5_brand_positioning',
    sectionName: 'Brand Positioning',
    queries: [
      "positioning statement value proposition unique benefit differentiator what makes us different",
      "competitive advantage market position competitors alternatives white space opportunity"
    ],
    matchCount: 4
  },
  {
    sectionId: '6_brand_principles',
    sectionName: 'Brand Principles',
    queries: [
      "brand principles behavioral guidelines decision making rules governance how we operate",
      "company culture values in action marketing product customer service partnership standards"
    ],
    matchCount: 3
  },
  {
    sectionId: '7_brand_territories',
    sectionName: 'Brand Territories',
    queries: [
      "thematic territories expertise areas cultural conversations lifestyle themes topics we own",
      "brand permission content opportunities topic boundaries where we play"
    ],
    matchCount: 3
  },
  {
    sectionId: '8_tone_of_voice',
    sectionName: 'Tone of Voice',
    queries: [
      "tone of voice communication style voice characteristics warm professional casual friendly",
      "writing guidelines vocabulary sentence structure words to use avoid language style"
    ],
    matchCount: 3
  },
  {
    sectionId: '9_verbal_identity',
    sectionName: 'Verbal Identity',
    queries: [
      "brand name usage correct incorrect tagline strapline slogan",
      "naming conventions product naming service naming campaign naming vocabulary terminology"
    ],
    matchCount: 3
  },
  {
    sectionId: '10_messaging_framework',
    sectionName: 'Messaging Framework',
    queries: [
      "brand promise core messages messaging hierarchy proof points evidence support",
      "audience specific messages value communication key themes talking points"
    ],
    matchCount: 3
  },
  {
    sectionId: '11_product_architecture',
    sectionName: 'Product Architecture',
    queries: [
      "product architecture portfolio branded house sub-brands endorsement hierarchy structure",
      "product lines categories future expansion extensions licensing partnerships growth"
    ],
    matchCount: 3
  }
];

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
 * Retrieve semantic context for a single section
 * Queries both user_documents and user_knowledge_base
 */
async function retrieveSectionContext(
  supabaseClient: any,
  userId: string,
  config: SectionQueryConfig
): Promise<{ sectionName: string; context: string; sourceCount: number }> {
  try {
    const allChunks: Array<{ content: string; similarity: number; id: string }> = [];

    // Run all queries for this section in parallel
    const queryResults = await Promise.all(
      config.queries.map(async (query) => {
        const embedding = await generateEmbedding(query);

        // Query both sources in parallel
        const [docResult, kbResult] = await Promise.all([
          // Search uploaded documents
          supabaseClient.rpc('match_user_documents', {
            query_embedding: embedding,
            match_user_id: userId,
            match_count: config.matchCount,
          }),
          // Search knowledge base
          supabaseClient.rpc('match_user_knowledge', {
            query_embedding: embedding,
            p_user_id: userId,
            match_count: config.matchCount,
            match_threshold: 0.5,
          })
        ]);

        const chunks: Array<{ content: string; similarity: number; id: string }> = [];

        if (docResult.data && !docResult.error) {
          for (const match of docResult.data) {
            chunks.push({
              content: match.content,
              similarity: match.similarity,
              id: `doc_${match.id}`
            });
          }
        }

        if (kbResult.data && !kbResult.error) {
          for (const match of kbResult.data) {
            chunks.push({
              content: match.content,
              similarity: match.similarity,
              id: `kb_${match.id}`
            });
          }
        }

        return chunks;
      })
    );

    // Flatten and deduplicate chunks
    const seen = new Set<string>();
    for (const chunks of queryResults) {
      for (const chunk of chunks) {
        if (!seen.has(chunk.id)) {
          seen.add(chunk.id);
          allChunks.push(chunk);
        }
      }
    }

    // Sort by similarity and take top results
    const sortedChunks = allChunks
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, config.matchCount * 2);

    if (sortedChunks.length === 0) {
      return {
        sectionName: config.sectionName,
        context: '',
        sourceCount: 0
      };
    }

    // Format context
    const context = sortedChunks
      .map(c => c.content)
      .join('\n\n');

    return {
      sectionName: config.sectionName,
      context,
      sourceCount: sortedChunks.length
    };
  } catch (error) {
    console.error(`[retrieveSectionContext] Error for ${config.sectionName}:`, error);
    return {
      sectionName: config.sectionName,
      context: '',
      sourceCount: 0
    };
  }
}

/**
 * Retrieve semantic context for all sections in parallel
 */
async function retrieveAllSectionContexts(
  supabaseClient: any,
  userId: string
): Promise<Map<string, string>> {
  console.log('[retrieveAllSectionContexts] Starting parallel retrieval for all sections...');

  const results = await Promise.all(
    SECTION_QUERIES.map(config =>
      retrieveSectionContext(supabaseClient, userId, config)
    )
  );

  const contextMap = new Map<string, string>();
  let totalSources = 0;

  for (const result of results) {
    contextMap.set(result.sectionName, result.context);
    totalSources += result.sourceCount;
    if (result.sourceCount > 0) {
      console.log(`[retrieveAllSectionContexts] ${result.sectionName}: ${result.sourceCount} sources`);
    }
  }

  console.log(`[retrieveAllSectionContexts] Total sources retrieved: ${totalSources}`);
  return contextMap;
}

/**
 * Extract brand name using semantic search + chat insights + LLM
 * Searches knowledge base, documents, AND chat history for brand name mentions
 */
async function extractBrandNameWithSemanticSearch(
  supabaseClient: any,
  userId: string,
  chatInsights?: Array<{ title: string; excerpt: string }>
): Promise<string | null> {
  console.log('[extractBrandName] Starting semantic search for brand name...');

  try {
    // Semantic search for brand name mentions
    const brandNameQuery = "brand name company name product name what is the brand called our brand identity";
    const embedding = await generateEmbedding(brandNameQuery);

    // Search knowledge base for brand name mentions
    const { data: kbResults, error: kbError } = await supabaseClient.rpc('match_user_knowledge', {
      query_embedding: embedding,
      match_count: 10,
      p_user_id: userId
    });

    if (kbError) {
      console.error('[extractBrandName] Knowledge base search error:', kbError);
    }

    // Search uploaded documents for brand name mentions
    const { data: docResults, error: docError } = await supabaseClient.rpc('match_user_documents', {
      query_embedding: embedding,
      match_count: 10,
      match_user_id: userId
    });

    if (docError) {
      console.error('[extractBrandName] Document search error:', docError);
    }

    // Log what we got from each source
    console.log('[extractBrandName] Knowledge base results:', kbResults?.length || 0);
    console.log('[extractBrandName] Document results:', docResults?.length || 0);

    // Combine results from semantic search
    const allResults = [
      ...(kbResults || []).map((r: any) => ({ content: r.content, similarity: r.similarity, source: 'knowledge' })),
      ...(docResults || []).map((r: any) => ({ content: r.content, similarity: r.similarity, source: 'document' }))
    ];

    // Sort by similarity and take top results
    allResults.sort((a, b) => b.similarity - a.similarity);
    const topResults = allResults.slice(0, 8);

    console.log('[extractBrandName] Semantic search found', allResults.length, 'total results');
    console.log('[extractBrandName] Top results by source:', topResults.map(r => r.source));

    // ALSO include chat insights - brand name is often mentioned in conversations
    // This is critical because chat messages aren't in the semantic search indexes
    let chatContext = '';
    if (chatInsights && chatInsights.length > 0) {
      // Take first few chat sessions, use enough content to find brand mentions
      const relevantChats = chatInsights.slice(0, 3).map(chat => {
        // Use up to 2000 chars per chat to capture brand name mentions
        const excerpt = chat.excerpt.length > 2000 ? chat.excerpt.substring(0, 2000) : chat.excerpt;
        return excerpt;
      });
      chatContext = relevantChats.join('\n\n');
      console.log('[extractBrandName] Added chat context, length:', chatContext.length);
    }

    // Combine semantic results with chat context
    const semanticContent = topResults.map(r => r.content).join('\n\n---\n\n');
    const combinedContext = [semanticContent, chatContext].filter(Boolean).join('\n\n---\n\n');

    console.log('[extractBrandName] Combined context length:', combinedContext.length);

    if (!combinedContext || combinedContext.length < 50) {
      console.log('[extractBrandName] Not enough context found');
      return null;
    }

    // Send to LLM for extraction
    return await extractBrandNameWithLLM(combinedContext);
  } catch (error) {
    console.error('[extractBrandName] Semantic search failed:', error);
    return null;
  }
}

/**
 * Extract brand name from context using LLM
 * Called after semantic search has found relevant content
 */
async function extractBrandNameWithLLM(context: string): Promise<string | null> {
  if (!context || context.length < 50) {
    console.log('[extractBrandNameWithLLM] Not enough context to extract brand name');
    return null;
  }

  // Truncate to avoid token limits
  const truncatedContext = context.substring(0, 6000);
  console.log('[extractBrandNameWithLLM] Sending to LLM, context length:', truncatedContext.length);

  try {
    console.log('[extractBrandNameWithLLM] Calling LLM to extract brand name...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a brand name extractor. Your task is to identify the actual brand/company/product name being discussed in brand strategy conversations.

Look for:
- Product names mentioned in context (e.g., "Infinity Vault", "InfinityVault")
- Company names being coached/advised on
- Brand names the consultant is helping develop strategy for
- Names that appear repeatedly when discussing "the brand" or "your product"

Rules:
- Return ONLY the brand name, nothing else (no quotes, no explanation)
- Do NOT return generic terms like "Your Brand", "The Brand", "Our Brand", "the company"
- Do NOT return framework terms like "IDEA Framework", "Distinctive Dimension", "Brand Canvas", "Brand Coach"
- Do NOT return product categories like "Trading Card Game", "Card Protection", "TCG"
- If the brand name contains multiple words, return them together (e.g., "Infinity Vault")
- If the brand name is CamelCase, preserve it (e.g., "InfinityVault")
- If you cannot find a clear brand name, return exactly: UNKNOWN

Examples of valid brand names: Infinity Vault, InfinityVault, H4H, Nike, Apple, TechCorp, Acme Corp`
          },
          {
            role: 'user',
            content: `Find the specific brand/company/product name being discussed in this brand strategy context. Look for proper nouns that represent the actual brand being developed:\n\n${truncatedContext}`
          }
        ],
        max_tokens: 30,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error('[extractBrandNameWithLLM] API error:', response.status);
      return null;
    }

    const data = await response.json();
    const extractedName = data.choices?.[0]?.message?.content?.trim();
    console.log('[extractBrandNameWithLLM] LLM returned:', extractedName);

    if (!extractedName || extractedName === 'UNKNOWN' || extractedName.toLowerCase() === 'unknown') {
      console.log('[extractBrandNameWithLLM] LLM could not identify brand name');
      return null;
    }

    // Validate the extracted name isn't a generic term
    const invalidNames = [
      'your brand', 'the brand', 'our brand', 'a brand', 'this brand',
      'brand', 'company', 'business', 'unknown', 'n/a', 'none',
      'distinctive dimension', 'idea framework', 'brand canvas'
    ];

    if (invalidNames.includes(extractedName.toLowerCase())) {
      console.log(`[extractBrandNameWithLLM] Rejected invalid name: "${extractedName}"`);
      return null;
    }

    console.log(`[extractBrandNameWithLLM] Successfully extracted brand name: "${extractedName}"`);
    return extractedName;

  } catch (error) {
    console.error('[extractBrandNameWithLLM] Error:', error);
    return null;
  }
}

/**
 * Format section contexts for LLM consumption
 */
function formatSectionContextsForLLM(contextMap: Map<string, string>): string {
  let formatted = '\n## RETRIEVED DOCUMENT INSIGHTS (Per Section)\n';
  formatted += 'The following insights were semantically retrieved from uploaded documents and knowledge base entries. Use these to enrich each section with specific details, quotes, and evidence:\n\n';

  let hasContent = false;
  for (const [sectionName, context] of contextMap) {
    if (context && context.trim()) {
      hasContent = true;
      formatted += `### ${sectionName}\n`;
      formatted += context;
      formatted += '\n\n---\n\n';
    }
  }

  if (!hasContent) {
    return '\n## RETRIEVED DOCUMENT INSIGHTS\nNo uploaded documents or additional knowledge base entries were found. Generate the document based on the canvas, avatar, and chat insights provided above.\n';
  }

  return formatted;
}

// ============================================================================
// BRAND STRATEGY DOCUMENT SYSTEM PROMPT
// Edit this section to modify the AI prompt, then redeploy the function.
// ============================================================================
const STRATEGY_SYSTEM_PROMPT = `# Role

You are a senior brand strategist with 20+ years of experience creating comprehensive brand strategy documents for Fortune 500 companies, consumer brands, and ambitious e-commerce businesses. You have led brand transformations at major consultancies including Interbrand, Landor, and Wolff Olins. Your expertise spans behavioural science, brand architecture, verbal identity, and strategic communications.

Your documents are known for their depth, commercial rigour, and ability to guide brand-building decisions across organisations. You write as a trusted advisor who knows the brand intimately, not as a consultant presenting options.

# Task

Generate a comprehensive Brand Strategy Document using this step-by-step process:

1. **Synthesise all brand data** - Review canvas inputs, avatar profiles, diagnostic insights, and chat context to build a complete picture of the brand's strategic position.

2. **Draft the introduction** - Establish the document's purpose, scope, and how it should be used to guide decisions.

3. **Build customer understanding** - Construct detailed Avatar 2.0 profiles including demographics, psychographics, the Four Moments of Buyer Intent, and emotional frameworks that reveal decision-making patterns.

4. **Articulate brand foundations** - Express Brand Essence, Purpose, Vision, Mission, Values, and Personality as lived principles that guide real decisions.

5. **Craft the brand story** - Develop the heritage narrative, founder journey, and multiple story versions for different contexts.

6. **Define strategic positioning** - Create the positioning statement, value proposition, key differentiators, and competitive white space analysis.

7. **Establish brand principles** - Define the behavioural guidelines that govern how the brand operates and makes decisions.

8. **Map brand territories** - Identify the thematic spaces where the brand has permission to play and expand.

9. **Develop tone of voice** - Describe how the brand communicates across contexts, with examples of in-tone and out-of-tone expression.

10. **Create verbal identity** - Define the brand's linguistic signature including naming conventions, vocabulary, and expression patterns.

11. **Build messaging framework** - Construct the hierarchy of messages from tagline through proof points.

12. **Structure product architecture** - Organise how products relate to the master brand and each other.

# Specifics

## Document Structure (Generate in this exact order)

### 1. Introduction and Overview

**Purpose Statement**
Explain what this document is, why it matters, and how it should be used. Frame it as the brand's strategic foundation.

**Document Scope**
Clarify what this strategy covers: strategic foundations, customer understanding, verbal identity, and product architecture.

**How to Use This Document**
Provide guidance on using this as a reference for marketing, product development, partnerships, and internal alignment.

---

### 2. Customer Understanding (Avatar 2.0)

**Primary Target Customer**
A comprehensive profile including:

*Demographics*
- Age range, gender distribution, household composition
- Geographic focus, income level, education
- Life stage and occupation

*Psychographics*
- Core values and beliefs
- Lifestyle and interests
- Media consumption and shopping behaviours
- Technology adoption and social habits

*Pain Points and Challenges*
- Primary frustrations in the category
- Emotional blockers to purchase
- Practical obstacles

*Goals and Aspirations*
- Immediate desires
- Long-term aspirations
- How the brand helps them achieve these

**The Four Moments of Buyer Intent**

Structure this section with the following moments:

1. **I Want to Know** - Information-seeking behaviour
   - What questions they ask
   - Where they seek information
   - Content they trust

2. **I Want to Go** - Navigation and discovery
   - Where they shop
   - How they discover new brands
   - Physical and digital touchpoints

3. **I Want to Do** - Action and evaluation
   - How they compare options
   - Trial behaviours
   - Decision-making process

4. **I Want to Buy** - Purchase moment
   - Conversion triggers
   - Price sensitivity
   - Purchase frequency

**Emotion Framework**

Create a table or structured format showing:
- Category drivers (functional needs)
- Emotional triggers (feelings sought)
- Trust signals (credibility markers)
- Experience expectations

**Secondary Audiences** (if applicable)
Brief profiles of other relevant customer segments.

---

### 3. Brand Foundations

**Brand Essence**
The single, distilled truth at the heart of the brand. One sentence that captures its fundamental nature.

**Brand Purpose**
Why the brand exists beyond making money. The human role it plays and the stabilising value it provides.

**Brand Vision**
The future the brand is working towards. How it guides decisions and builds credibility.

**Brand Mission**
What the brand does daily to deliver on its purpose. Specific, actionable, measurable.

**Brand Values**
Present each value with:
- The value name
- What it means in practice
- How it shows up in behaviour
- Example of the value in action

Format as a structured list with 3-5 core values.

**Brand Personality**
Define the human traits that characterise the brand:
- Primary personality traits (3-5)
- How these traits manifest in customer interactions
- What the brand is NOT (contrast positioning)

---

### 4. Brand Story

**Heritage and Origin**
The founder's journey, the problem they set out to solve, and the insight that sparked the brand.

**Story Versions**

*30-Second Version*
A concise elevator pitch capturing the essence.

*2-Minute Version*
A fuller narrative for conversations and pitches.

*Full Narrative*
The complete story for website, investor materials, and press.

**Story Elements**
- The challenge or problem
- The insight or breakthrough
- The solution created
- The impact achieved
- The vision ahead

---

### 5. Brand Positioning

**Positioning Statement**
A clear, strategic statement following this structure:
For [target customer], [brand name] is the [category] that [key benefit] because [reasons to believe].

**Value Proposition**
- Primary benefit delivered
- What problem it removes
- Why it is preferable to alternatives

**Key Differentiators**
List 3-5 specific points of differentiation with supporting evidence.

**Competitive Context**
- Direct competitors
- Indirect alternatives
- How customers currently solve this problem

**Competitive White Space**
Identify the strategic gap the brand occupies that competitors do not. Frame this as a clear market opportunity.

---

### 6. Brand Principles

Behavioural guidelines that govern decision-making. Present 4-6 principles, each with:
- The principle statement
- What it means in practice
- Example application

These should guide marketing, product development, customer service, and partnerships.

---

### 7. Brand Territories

Identify 3-5 thematic territories where the brand has permission to operate. For each territory:
- Territory name
- Why the brand owns this space
- Content and communication opportunities
- Boundaries (where the brand should not go)

Territories might include expertise areas, cultural conversations, lifestyle themes, or values-based topics.

---

### 8. Tone of Voice

**Voice Characteristics**
Define 4-6 voice attributes with explanations:
- What each attribute means
- How it sounds in practice
- Examples of in-tone expression

**Tone Spectrum**
Show how tone flexes across contexts:
- Social media (more casual)
- Website (balanced)
- Customer service (warm, solution-focused)
- Legal/formal (clear, professional)

**In-Tone vs Out-of-Tone**
Provide contrasting examples showing correct and incorrect expressions.

**Writing Guidelines**
Specific rules for brand writing:
- Sentence structure preferences
- Vocabulary choices
- Punctuation and formatting
- Words to use and avoid

---

### 9. Verbal Identity

**Brand Name Usage**
- Correct usage formats
- Incorrect usages to avoid
- Name in context examples

**Tagline/Strapline**
- Primary tagline
- When to use it
- Variations for different contexts

**Naming Conventions**
- Product naming approach
- Service naming patterns
- Campaign naming guidelines

**Brand Vocabulary**
Key terms and phrases the brand uses consistently:
- Category language
- Brand-specific terminology
- Words to own
- Words to avoid

---

### 10. Messaging Framework

**Messaging Hierarchy**

*Level 1: Brand Promise*
The overarching commitment to customers.

*Level 2: Core Messages*
3-4 key themes that support the promise.

*Level 3: Proof Points*
Specific evidence and examples for each core message.

**Audience-Specific Messaging**
Tailored messages for different segments or contexts.

**Message Map**
A visual or structured representation showing how messages connect.

---

### 11. Product Architecture

**Architecture Model**
Describe the relationship between master brand and products:
- Branded house (all under master brand)
- House of brands (distinct sub-brands)
- Endorsed brands (sub-brands with master brand endorsement)
- Hybrid model

**Product Portfolio**
- Current product lines
- How they relate to each other
- Naming conventions applied

**Future Architecture**
How the brand might expand:
- Logical extensions
- Category adjacencies
- Licensing or partnership opportunities

---

## Writing Rules (Mandatory)

Apply these rules throughout the entire document:

1. **Tone**: Calm, senior, strategic. Write as a trusted advisor, not a marketer.
2. **No hype language**: Avoid superlatives, buzzwords, and marketing speak.
3. **No em dashes**: Use commas, colons, or separate sentences instead.
4. **UK English**: Use British spelling throughout (colour, behaviour, organise, centre).
5. **Short paragraphs**: Keep paragraphs to 2-4 sentences for clarity.
6. **Clear hierarchy**: Use headings and subheadings to structure content.
7. **Emotion and logic balanced**: Connect emotional drivers to commercial outcomes.
8. **Brand truth, not marketing copy**: Write as documented strategic truth.
9. **Tables where useful**: Use tables for frameworks, comparisons, and structured data.
10. **No AI tell phrases**: Avoid "In conclusion", "It's important to note", "This allows", "In today's", "Whether you're", "This ensures", "This enables".
11. **No invented facts**: Only include information derived from the provided data.
12. **Declarative voice**: State things as facts, not suggestions. "The brand is" not "The brand could be".
13. **Commercial grounding**: Connect strategy to business outcomes.

## Output Format

Generate the document in clean Markdown format with:
- # for the document title
- ## for main sections (numbered: "## 1. Introduction", "## 2. Customer Understanding", etc.)
- ### for subsections
- #### for sub-subsections
- Standard markdown formatting (bold, italic, bullets)
- Tables using proper markdown table syntax with header row and separator
- Horizontal rules (---) between each major numbered section

**Critical formatting rules:**
- IMPORTANT: Numbered lists MUST use sequential numbers (1, 2, 3, 4, 5) NOT repeated "1." - this is a hard requirement
- When listing Brand Principles, use: 1. First Principle, 2. Second Principle, 3. Third Principle, etc.
- When listing Brand Territories, use: 1. First Territory, 2. Second Territory, 3. Third Territory, etc.
- When listing Core Messages, use: 1. First Message, 2. Second Message, 3. Third Message, etc.
- Tables MUST have a header row and separator row, example:
  | Column 1 | Column 2 |
  |----------|----------|
  | Data 1   | Data 2   |
- Each section (## heading) should be separated by a horizontal rule (---)

# Context

## About IDEA Brand Coach

IDEA Brand Coach is a behavioural-science-driven brand coaching application for e-commerce sellers. It helps users build high-trust, emotionally resonant brands using the IDEA Framework (Identify, Discover, Execute, Analyse).

The Brand Strategy Document you are generating is the definitive reference for the user's brand. This is not a summary or overview; it is the comprehensive strategic foundation that will:
- Guide all marketing and communication decisions
- Brief designers, copywriters, agencies, and partners
- Maintain brand consistency across every touchpoint
- Inform product development and customer experience
- Align internal teams around a shared understanding
- Support investor and partnership conversations

Your accurate, thorough synthesis of the user's brand data into this document is essential for their business success. The quality of this document directly impacts their ability to build a coherent, differentiated brand that wins in the market.

## Data Sources

The brand context you receive includes:

- **Brand Canvas**: 8-step strategic framework (Purpose, Vision, Mission, Values, Positioning, Value Proposition, Personality, Voice)
- **Avatar 2.0**: Target customer profiles with demographics, psychographics, pain points, decision factors, and buyer intent moments
- **Interactive Insight**: Diagnostic results, scores, and strategic recommendations
- **Chat Insights**: Key themes, decisions, and recommendations from Brand Coach conversations
- **Retrieved Document Insights**: Semantically relevant excerpts from uploaded documents (PDFs, Word docs, etc.) and knowledge base entries, organised by section. These contain specific details, quotes, research, and evidence that should be incorporated into the relevant sections of the strategy document.

When using Retrieved Document Insights:
- Integrate specific facts, figures, and quotes directly into the relevant sections
- Use document content to support and substantiate strategic claims
- If document insights provide more specific information than canvas/avatar data, prefer the document detail
- Cite the source naturally (e.g., "According to market research..." or "Customer feedback indicates...")

## Quality Expectations

This document should read as if prepared by a senior strategist at a top-tier brand consultancy. It should:
- Feel authoritative and definitive
- Provide actionable guidance
- Connect strategy to commercial reality
- Reflect deep understanding of the brand and customer
- Be immediately usable for decision-making

# Notes

- If data is missing for a section, write a brief placeholder noting the area needs development, but do not invent content. Frame it as "This section requires additional discovery" rather than leaving it empty.
- Ensure all sections flow logically and cross-reference where appropriate.
- The document should read as a unified strategic narrative, not disconnected sections.
- Focus on actionable strategic truth, not aspirational fluff.
- Each section should feel connected to the whole, building a coherent picture.
- Prioritise depth over breadth; better to cover fewer sections thoroughly than many sections superficially.
- When the data supports it, include specific numbers, percentages, and concrete examples.
- Tables improve readability for frameworks and comparisons; use them freely.
- The Lost in the Middle effect means readers retain information at the beginning and end better than the middle. Structure accordingly, with key strategic elements in sections 1-3 and the messaging/architecture framework at the end.`;
// ============================================================================
// END OF PROMPT - Edit above, then redeploy
// ============================================================================

/**
 * Format brand data into a structured context string for the LLM
 */
function formatBrandContext(data: {
  companyName: string;
  generatedDate: string;
  canvas: Record<string, string>;
  avatar: Record<string, string>;
  insights: Record<string, string>;
  chatInsights: Array<{ title: string; excerpt: string }>;
  documentInsights?: string;
}): string {
  let context = '';

  // Company info
  context += `\n## BRAND INFORMATION\n`;
  context += `Company/Brand Name: ${data.companyName || 'Not specified'}\n`;
  context += `Document Generation Date: ${data.generatedDate}\n`;

  // Brand Canvas data
  context += `\n## BRAND CANVAS DATA\n`;
  if (data.canvas.brandPurpose) context += `Brand Purpose: ${data.canvas.brandPurpose}\n`;
  if (data.canvas.brandVision) context += `Brand Vision: ${data.canvas.brandVision}\n`;
  if (data.canvas.brandMission) context += `Brand Mission: ${data.canvas.brandMission}\n`;
  if (data.canvas.brandValues) context += `Brand Values: ${data.canvas.brandValues}\n`;
  if (data.canvas.positioningStatement) context += `Positioning Statement: ${data.canvas.positioningStatement}\n`;
  if (data.canvas.valueProposition) context += `Value Proposition: ${data.canvas.valueProposition}\n`;
  if (data.canvas.brandPersonality) context += `Brand Personality: ${data.canvas.brandPersonality}\n`;
  if (data.canvas.brandVoice) context += `Brand Voice: ${data.canvas.brandVoice}\n`;

  // Avatar data
  context += `\n## CUSTOMER AVATAR DATA\n`;
  const avatarFields = Object.entries(data.avatar);
  if (avatarFields.length > 0) {
    for (const [key, value] of avatarFields) {
      if (value) {
        const formattedKey = key.replace(/_/g, ' ').replace(/^avatar /, '');
        context += `${formattedKey}: ${value}\n`;
      }
    }
  } else {
    context += `No avatar data available.\n`;
  }

  // IDEA Framework insights
  context += `\n## IDEA FRAMEWORK INSIGHTS\n`;
  const insightFields = Object.entries(data.insights);
  if (insightFields.length > 0) {
    for (const [key, value] of insightFields) {
      if (value) {
        const formattedKey = key.replace(/_/g, ' ');
        context += `${formattedKey}: ${value}\n`;
      }
    }
  } else {
    context += `No IDEA framework insights available.\n`;
  }

  // Chat conversation insights (if any)
  if (data.chatInsights && data.chatInsights.length > 0) {
    context += `\n## KEY STRATEGIC CONVERSATIONS\n`;
    context += `The following are excerpts from strategic conversations that informed brand decisions. These conversations contain important context about brand strategy decisions, messaging direction, and customer insights that should be reflected in the document:\n\n`;
    for (const chat of data.chatInsights) {
      context += `### ${chat.title}\n`;
      context += `${chat.excerpt}\n\n`;
    }
  }

  // Document insights from semantic retrieval (if any)
  if (data.documentInsights) {
    context += data.documentInsights;
  }

  return context;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!openAIApiKey) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get authenticated user for semantic retrieval
    const authHeader = req.headers.get('authorization');
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
              Authorization: authHeader
            }
          }
        }
      );

      // Extract JWT token and get user
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

      if (user) {
        userId = user.id;
        console.log('[generate-brand-strategy-document] Authenticated user:', userId);
      } else if (authError) {
        console.warn('[generate-brand-strategy-document] Auth error:', authError.message);
      }
    }

    const requestData = await req.json();

    const {
      companyName,
      canvas,
      avatar,
      insights,
      chatInsights,
    } = requestData;

    // Debug logging
    console.log('[generate-brand-strategy-document] Received data:', {
      companyName,
      chatInsightsCount: chatInsights?.length || 0,
      chatInsightTitles: chatInsights?.map((c: any) => c.title) || [],
      firstChatExcerptPreview: chatInsights?.[0]?.excerpt?.substring(0, 200) || 'none',
    });

    // Validate required data
    if (!companyName) {
      return new Response(
        JSON.stringify({ error: 'Company name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Retrieve semantic document insights if user is authenticated
    let documentInsights = '';
    let extractedBrandName: string | null = null;
    if (userId && supabaseClient) {
      console.log('[generate-brand-strategy-document] Retrieving semantic document insights...');
      try {
        const sectionContexts = await retrieveAllSectionContexts(supabaseClient, userId);
        documentInsights = formatSectionContextsForLLM(sectionContexts);
        console.log('[generate-brand-strategy-document] Document insights retrieved, length:', documentInsights.length);

        // Try to extract brand name using semantic search + chat insights
        extractedBrandName = await extractBrandNameWithSemanticSearch(supabaseClient, userId, chatInsights);
        if (extractedBrandName) {
          console.log('[generate-brand-strategy-document] Extracted brand name:', extractedBrandName);
        }
      } catch (retrievalError) {
        console.error('[generate-brand-strategy-document] Error retrieving document insights:', retrievalError);
        // Continue without document insights - they're optional
      }
    } else {
      console.log('[generate-brand-strategy-document] No authenticated user, skipping semantic search');
      // Can't do semantic search without auth - chatInsights are passed but we can't search semantically
    }

    // Use extracted brand name if companyName is generic/default
    const effectiveBrandName = (companyName === 'Your Brand' || !companyName) && extractedBrandName
      ? extractedBrandName
      : companyName;

    if (effectiveBrandName !== companyName) {
      console.log(`[generate-brand-strategy-document] Using extracted brand name "${effectiveBrandName}" instead of "${companyName}"`);
    }

    // Format the brand context
    const generatedDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const brandContext = formatBrandContext({
      companyName: effectiveBrandName,
      generatedDate,
      canvas: canvas || {},
      avatar: avatar || {},
      insights: insights || {},
      chatInsights: chatInsights || [],
      documentInsights
    });

    console.log('Generating brand strategy document for:', effectiveBrandName);
    console.log('Chat insights received:', chatInsights?.length || 0);
    if (chatInsights?.length > 0) {
      console.log('Chat insight titles:', chatInsights.map((c: any) => c.title));
    }

    const userPrompt = `Generate a complete Brand Strategy Document for the following brand.

IMPORTANT: Pay special attention to the KEY STRATEGIC CONVERSATIONS section and the RETRIEVED DOCUMENT INSIGHTS section below. These contain recent discussions about brand strategy, messaging decisions, customer insights, and semantically relevant information from uploaded documents. The specific language, terminology, and strategic directions mentioned should be directly reflected in the document.

${brandContext}

Generate the complete document now in Markdown format, ensuring all insights from the strategic conversations and document insights are woven throughout the relevant sections.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: STRATEGY_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const document = data.choices[0].message.content.trim();

    console.log('Document generated successfully, length:', document.length);

    return new Response(JSON.stringify({
      success: true,
      document,
      generatedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-brand-strategy-document function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to generate brand strategy document'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

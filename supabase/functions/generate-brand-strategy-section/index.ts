import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ============================================================================
// CONFIGURATION
// ============================================================================

const openAIApiKey = Deno.env.get('OPENAI_API_KEY'); // Kept for embeddings and vector store search
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const skillsVectorStoreId = Deno.env.get('SKILLS_VECTOR_STORE_ID');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

const SKILL_SEARCH_MAX_RESULTS = 5;
const SKILL_SEARCH_MAX_RETRIES = 2;
const USER_CONTEXT_MATCH_COUNT = 4;
const SECTION_MAX_TOKENS = 1500;
const FETCH_TIMEOUT_MS = 30000;
const ASSISTANT_RESPONSE_TRUNCATE = 800;
const CHAT_EXCERPT_MAX_LENGTH = 3000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TREVOR VOICE DIRECTIVE
// Condensed from Skill 02 — prepended to every section generation call
// ============================================================================

const TREVOR_VOICE_DIRECTIVE = `You are writing as Trevor Bradford, a UK-based brand strategist with 35+ years in the creative industries, creator of the IDEA Strategic Brand Framework, and author of "What Captures The Heart Goes In The Cart."

Voice rules (mandatory throughout):
- UK English spelling (colour, behaviour, organisation, centre)
- Calm, senior, strategic tone. Write as a trusted advisor who knows this brand intimately.
- No em dashes. Use commas, colons, or separate sentences.
- No hype language, superlatives, or marketing speak.
- No AI tell phrases: avoid "In conclusion", "It's important to note", "This allows", "In today's", "Whether you're", "This ensures", "This enables", "leveraging", "holistic".
- Ground recommendations in behavioural science. Reference Kahneman, Cialdini, Zaltman, Lindstrom, or Sutherland where relevant and natural.
- Be direct and actionable. Every paragraph should move the reader closer to a decision.
- Declarative voice: "The brand is" not "The brand could be".
- Short paragraphs (2-4 sentences). Tables where useful.
- Commercial grounding: connect strategy to business outcomes.
- Use Trevor's vocabulary naturally: "Authentically Human brand", "Signposts", "Shopper High", "What captures the heart goes in the cart", "System 1", "emotional triggers", "trust wins".`;

// ============================================================================
// SECTION DEFINITIONS
// 13 IDEA-aligned sections with skill retrieval queries
// ============================================================================

interface DocumentSection {
  id: string;
  title: string;
  order: number;
  skillQueries: string[];
  userDataFields: string[];
  writingInstructions: string;
  batch: number;
  dependsOn?: string[];
}

const DOCUMENT_SECTIONS: DocumentSection[] = [
  {
    id: 'idea_overview',
    title: 'IDEA Framework Overview',
    order: 1,
    batch: 99,
    dependsOn: ['customer_avatar', 'brand_purpose', 'brand_positioning', 'brand_essence'],
    skillQueries: [
      'IDEA Strategic Brand Framework four pillars Insight Distinctive Empathetic Authentic trust',
      'Trevor Bradford brand coaching philosophy authentically human brands',
    ],
    userDataFields: ['*'],
    writingInstructions: `Generate an executive summary and IDEA Framework overview for this brand strategy document.

Structure:
## 1. IDEA Framework Overview

### Executive Summary
A 3-4 paragraph synthesis of the brand's strategic position, key strengths, and primary opportunity areas. This should read as a senior strategist's assessment.

### About This Document
Explain what this document is, why it matters, and how it should be used. Frame it as the brand's strategic foundation built using the IDEA Framework.

### The IDEA Framework Applied to This Brand
Briefly explain each pillar (Insight-Driven, Distinctive, Empathetic, Authentic) and how this specific brand expresses each one. Use the user's actual brand data — do not be generic.

### Document Scope
Clarify what this strategy covers and how to use it as a reference for marketing, product development, partnerships, and internal alignment.`,
  },
  {
    id: 'customer_avatar',
    title: 'Customer Understanding (Avatar 2.0)',
    order: 2,
    batch: 1,
    skillQueries: [
      'Avatar 2.0 Five Fields buyer intent motivations emotional triggers shopper types demographics',
      'behavioural science emotion drives decisions System 1 System 2 subconscious purchasing',
    ],
    userDataFields: ['demographics', 'psychographics', 'painPoints', 'goals', 'functionalIntent', 'emotionalIntent', 'identityIntent', 'socialIntent', 'marketInsight', 'consumerInsight'],
    writingInstructions: `Generate the Customer Understanding section using Avatar 2.0's Five Fields methodology.

Structure:
## 2. Customer Understanding (Avatar 2.0)

Introduce Avatar 2.0 as a behaviour-driven customer profiling tool that replaces outdated demographic segmentation.

### Field 1: Buyer Intent (Search)
What the customer is searching for and the "why" behind their actions. Connect to search behaviour and purchase intent.

### Field 2: Motivations (Tasks to Achieve)
The deeper, often subconscious reasons a customer seeks this product. Cover functional, emotional, social, and identity motivations.

### Field 3: Emotional Triggers
The stimuli that resonate with this customer's feelings and subconscious desires. Identify which of the seven core emotional drivers (Hope, Belonging, Validation, Trust, Relief, Aspiration, Empowerment) are most relevant.

### Field 4: Shopper Type
Classify the primary shopper type (Cost-Sensitive, Quality-Focused, Conscious, or Connected) based on the data. Explain what this means for brand strategy.

### Field 5: Relevant Demographics
Contextual data points that complement the behavioural picture. Generational traits and how they inform communication.

### How the Five Fields Feed the Brand Canvas
Explain how each field connects to specific Brand Canvas outputs.`,
  },
  {
    id: 'emotional_triggers',
    title: 'Emotional Triggers & Decision Science',
    order: 3,
    batch: 1,
    skillQueries: [
      'emotional triggers shopper psychology hope belonging validation trust relief aspiration empowerment',
      'Kahneman System 1 System 2 loss aversion anchoring framing cognitive ease',
      'Zaltman 95% subconscious deep metaphors transformation journey connection',
    ],
    userDataFields: ['emotionalConnection', 'emotionalTriggers', 'customerNeeds'],
    writingInstructions: `Generate the Emotional Triggers and Decision Science section.

Structure:
## 3. Emotional Triggers & Decision Science

### The Science of Why Customers Buy
Brief grounding in the behavioural science: 95% of decisions are emotional (Zaltman), System 1 vs System 2 (Kahneman), and the neurochemical cocktail (dopamine, oxytocin, cortisol, serotonin).

### Primary Emotional Triggers for This Brand
Based on the user's data, identify the 3-5 most relevant emotional triggers from the master trigger table. For each:
- The trigger and its psychological effect
- How it applies to this specific brand and customer
- Example messaging that activates this trigger

### The Shopper's High
Describe the neurochemical anticipation this brand should create. Which combination of dopamine (desire), oxytocin (belonging), cortisol reduction (relief), and serotonin (satisfaction) is most relevant?

### Deep Metaphors at Work
Identify which of Zaltman's deep metaphors (Balance, Transformation, Journey, Container, Connection, Resource, Control) this brand connects to. Explain how this should inform messaging.

### Heuristics and Biases to Leverage
Which cognitive biases (social proof, authority, loss aversion, framing, reciprocity) are most relevant for this brand's conversion strategy?`,
  },
  {
    id: 'customer_journey',
    title: 'Customer Journey & Signposts',
    order: 4,
    batch: 1,
    skillQueries: [
      'customer journey five stages awareness consideration decision retention advocacy signposts',
      'pre-suasion privileged moment context priming attention association Cialdini',
    ],
    userDataFields: ['customerJourney', 'experiencePillars', 'preferredChannels'],
    writingInstructions: `Generate the Customer Journey and Signposts section.

Structure:
## 4. Customer Journey & Signposts

### The Journey as an Emotional Process
Introduce the concept: customers never buy randomly. Each decision is accompanied by emotional Signposts that move them forward.

### Stage-by-Stage Journey Map
For each of the five stages, describe:

#### Stage 1: Awareness
- The customer's emotional state (curiosity, frustration)
- The brand's Signpost at this stage
- Pre-suasive context: what the customer encounters first
- Brand task: interrupt the pattern, name the problem

#### Stage 2: Consideration
- Hope and anticipation as the emotional Signpost
- How to demonstrate understanding and build credibility
- Social proof and aspiration triggers

#### Stage 3: Decision
- Trust and relief as the emotional Signpost
- Friction reduction strategies (guarantees, clear policies, easy checkout)
- The "Shopper High" anticipation

#### Stage 4: Retention
- Satisfaction and validation as the emotional Signpost
- Post-purchase relationship building
- The Peak-End Rule (Kahneman): design the ending

#### Stage 5: Advocacy
- Pride and belonging as the emotional Signpost
- Creating moments worth sharing
- Community building

### Brand Voice Across the Journey
How the tone should flex at each stage (curious → educational → reassuring → celebratory → community-focused).

### Pre-Suasion Strategy
What the customer should encounter immediately before the purchase moment. What emotion should the hero image, headline, and above-the-fold content prime?`,
  },
  {
    id: 'brand_purpose',
    title: 'Brand Purpose & Vision',
    order: 5,
    batch: 2,
    skillQueries: [
      'brand purpose why brand exists beyond selling products brand vision future impact',
      'IDEA four tests insight-driven distinctive empathetic authentic purpose vision',
    ],
    userDataFields: ['brandPurpose', 'brandVision'],
    writingInstructions: `Generate the Brand Purpose and Vision section with IDEA 4-Test evaluation.

Structure:
## 5. Brand Purpose & Vision

### Brand Purpose
Present the user's brand purpose statement (from their data). If not provided, note this requires additional discovery.

### IDEA Evaluation: Brand Purpose
Evaluate the purpose against the four IDEA tests:
| Test | Assessment | Recommendation |
|------|-----------|----------------|
| Insight-Driven | Does it identify customer needs beyond the product? | ... |
| Distinctive | Does it stand out with a higher mission? | ... |
| Empathetic | Does it resonate with customer values? | ... |
| Authentic | Does it align with the brand's core identity? | ... |

### Brand Vision
Present the user's brand vision statement. Frame it as the future the brand is building towards.

### IDEA Evaluation: Brand Vision
Same 4-test evaluation table for the vision statement.

### Purpose vs Vision
Clarify the relationship: Purpose = why we exist (stable). Vision = where we are going (evolves).`,
  },
  {
    id: 'brand_mission',
    title: 'Brand Mission & Values',
    order: 6,
    batch: 2,
    skillQueries: [
      'brand mission actionable steps fulfil purpose how we serve brand values guiding principles',
      'values in action demonstrable specific behavioural not generic',
    ],
    userDataFields: ['brandMission', 'brandValues', 'brandStory', 'brandPromise'],
    writingInstructions: `Generate the Brand Mission and Values section with IDEA 4-Test evaluation.

Structure:
## 6. Brand Mission & Values

### Brand Mission
Present the user's mission statement. Frame it as the operational expression of purpose.

### IDEA Evaluation: Brand Mission
4-test evaluation table.

### Core Brand Values
For each value the user has defined:
- **The value name**
- **What it means in practice** (specific, not generic)
- **How it shows up in behaviour** (demonstrable actions)
- **Example of the value in action**

### IDEA Evaluation: Brand Values
4-test evaluation table for the values as a set.

### Values Audit
Are any values generic (e.g., "quality", "innovation", "excellence")? Flag these and suggest more specific, ownable alternatives grounded in the brand's actual behaviour.

### Brand Promise
Present the user's brand promise — the commitment made to customers that sets expectations.`,
  },
  {
    id: 'brand_positioning',
    title: 'Brand Positioning & Value Proposition',
    order: 7,
    batch: 2,
    skillQueries: [
      'positioning statement value proposition differentiation competitive white space mental availability',
      'Sutherland psycho-logic perceived value reframing distinctiveness context dependency',
    ],
    userDataFields: ['positioningStatement', 'uniqueValue', 'differentiators'],
    writingInstructions: `Generate the Positioning and Value Proposition section with IDEA 4-Test evaluation.

Structure:
## 7. Brand Positioning & Value Proposition

### Positioning Statement
Present the user's positioning statement. If it follows the formula "For [target], [brand] is the [category] that [benefit] because [reason to believe]", preserve that structure.

### IDEA Evaluation: Positioning
4-test evaluation table.

### Difference vs Distinctiveness
Analyse: what is objectively different about this brand (functional)? What makes it instantly recognisable (brand identity)? The strongest positioning combines both.

### Value Proposition
Present the user's value proposition. Evaluate whether it names the outcome, identifies the differentiator, addresses emotional and practical benefits, and is believable.

### IDEA Evaluation: Value Proposition
4-test evaluation table.

### The Value Equation
How does this brand tip the perceived value equation in favour of buying? Address: making the benefit vivid, reducing perceived risk, differentiating from alternatives.

### Competitive White Space
Based on the positioning data, identify the strategic gap this brand occupies. Frame as a clear market opportunity.

### The Psycho-Logic Test (Sutherland)
Does this positioning make logical sense, or psycho-logical sense? Is the brand solving a rational problem or a perception problem? What signal does the positioning send?`,
  },
  {
    id: 'brand_personality',
    title: 'Brand Personality & Voice',
    order: 8,
    batch: 2,
    skillQueries: [
      'brand personality human traits voice tone language design imagery four components',
      'brand voice characteristics tone spectrum in-tone out-of-tone writing guidelines',
    ],
    userDataFields: ['brandPersonality', 'brandVoice', 'brandArchetype'],
    writingInstructions: `Generate the Brand Personality and Voice section with IDEA 4-Test evaluation.

Structure:
## 8. Brand Personality & Voice

### Brand Personality
Present the user's personality traits. If the brand were a person at a dinner party, how would they behave?

### IDEA Evaluation: Brand Personality
4-test evaluation table.

### Personality and Emotional Trigger Alignment
Does the personality amplify the right emotional trigger? (e.g., inspiring personality for hope/transformation, authoritative for trust/credibility, warm for belonging/community)

### Brand Voice: The Four Components
1. **Tone of Voice**: The emotional signature
2. **Language**: Distinctive words, phrases, vocabulary
3. **Design (Visual Voice)**: Colour, typography, layout implications
4. **Imagery**: Visual storytelling, the people and environments

### Voice Tone by Channel
| Channel | Tone | Example |
|---------|------|---------|
| Product Listings | ... | ... |
| Social Media | ... | ... |
| Email Marketing | ... | ... |
| Customer Service | ... | ... |

### In-Tone vs Out-of-Tone
Provide contrasting examples showing correct and incorrect brand expression.

### Brand Archetype
If the user specified an archetype, explain how it manifests in the brand's communication and behaviour.`,
  },
  {
    id: 'brand_essence',
    title: 'Brand Essence & DNA',
    order: 9,
    batch: 98,
    dependsOn: ['brand_purpose', 'brand_mission', 'brand_positioning', 'brand_personality'],
    skillQueries: [
      'brand essence DNA four circles attributes benefits values personality intersection irreducible truth',
      'brand essence discovery process distinctive authentic customer-relevant durable test',
    ],
    userDataFields: ['*'],
    writingInstructions: `Generate the Brand Essence and DNA section. This synthesises the Brand Canvas sections into the irreducible core.

Structure:
## 9. Brand Essence & DNA

### What is Brand Essence?
The single, irreducible truth about what this brand stands for. Not a tagline, not a mission statement. The soul of the brand.

### The Brand DNA Model: Four Circles

#### Circle 1: Attributes
The tangible, observable characteristics. What the brand literally is and has.

#### Circle 2: Benefits
Functional benefits (what the product does) and emotional benefits (how the customer feels).

#### Circle 3: Values
The internal compass — what the brand would refuse to compromise on.

#### Circle 4: Personality
The behavioural expression — how the brand acts and communicates.

### The Intersection: Brand Essence
Based on the four circles, what single idea connects all of them? Express in 1-4 words.

### Brand Essence Test
| Test | Assessment |
|------|-----------|
| Distinctive | Could a competitor claim this? |
| Authentic | Is this true of the brand right now? |
| Customer-Relevant | Would the target customer care? |
| Durable | Will this still be true in 10 years? |

### Brand Essence as Organising Principle
How does this essence resolve conflicts between Brand Canvas outputs? What should every piece of content, every product, and every customer interaction have in common?`,
  },
  {
    id: 'brand_story',
    title: 'Brand Story & Narrative',
    order: 10,
    batch: 3,
    skillQueries: [
      'Trevor Bradford brand storytelling founder journey narrative authentic human connection',
      'brand story heritage origin versions elevator pitch full narrative challenge insight solution impact',
    ],
    userDataFields: ['brandStory', 'brandPromise'],
    writingInstructions: `Generate the Brand Story and Narrative section.

Structure:
## 10. Brand Story & Narrative

### Heritage and Origin
The founder's journey, the problem they set out to solve, and the insight that sparked the brand. Use the user's brand story data.

### Story Versions

#### 30-Second Version
A concise elevator pitch capturing the essence.

#### 2-Minute Version
A fuller narrative for conversations and pitches.

#### Full Narrative
The complete story for website, investor materials, and press.

### Story Elements
- The challenge or problem
- The insight or breakthrough
- The solution created
- The impact achieved
- The vision ahead

### The Story as Trust Builder
How does this story build trust with the target customer? Which emotional triggers does it activate? How does it demonstrate authenticity?`,
  },
  {
    id: 'messaging_framework',
    title: 'Messaging Framework',
    order: 11,
    batch: 3,
    skillQueries: [
      'messaging framework hierarchy brand promise core messages proof points audience specific',
      'Cialdini six principles influence reciprocity social proof authority liking scarcity unity',
    ],
    userDataFields: ['brandVoice', 'expertise', 'socialProof', 'credibilityMarkers'],
    writingInstructions: `Generate the Messaging Framework section.

Structure:
## 11. Messaging Framework

### Messaging Hierarchy

#### Level 1: Brand Promise
The overarching commitment to customers.

#### Level 2: Core Messages (3-4)
Key themes that support the promise. Each should connect to a specific emotional trigger.

#### Level 3: Proof Points
Specific evidence and examples for each core message.

### Cialdini's Six Principles Applied
For this specific brand, how should each principle be deployed:

| Principle | Application | Example |
|-----------|------------|---------|
| Reciprocity | ... | ... |
| Social Proof | ... | ... |
| Authority | ... | ... |
| Liking | ... | ... |
| Scarcity | ... | ... |
| Unity | ... | ... |

### Audience-Specific Messaging
Tailored messages for different customer segments or journey stages.

### Lead with Emotion, Support with Logic
The coaching formula: for each core message, identify the emotional hook (System 1) and the logical support (System 2).`,
  },
  {
    id: 'agentic_commerce',
    title: 'Agentic Commerce & AI Visibility',
    order: 12,
    batch: 3,
    skillQueries: [
      'agentic commerce AI visibility Rufus ChatGPT Gemini earned media citation sources',
      'generative engine optimisation semantic SEO AI recommendation affiliate review sites',
    ],
    userDataFields: ['marketInsight', 'expertise', 'differentiators'],
    writingInstructions: `Generate the Agentic Commerce and AI Visibility section.

Structure:
## 12. Agentic Commerce & AI Visibility

### The Shift to Agentic Commerce
Brief context: AI agents (Rufus, ChatGPT, Gemini, Sparky) are now the primary discovery interface. 58% of consumers have replaced traditional search with AI recommendations.

### Why This Matters for This Brand
Based on the user's market position and product category, explain the specific implications.

### AI Citation Strategy
Where AI agents get their information:
- Affiliate/Review Sites (72.7% of Rufus citations)
- Earned Media (35-40% of ChatGPT/Gemini citations)
- Brand.com sites (10-30%)

### Four-Phase AI Visibility Roadmap
1. **Analyse**: What questions are AI agents asking in this category?
2. **Target**: Build a Tier 1 AI media list
3. **Implement**: Structure content for machines, not just media
4. **Measure**: Track AI citation count, share of voice, and AI-driven revenue

### IDEA Framework in an Agentic World
How each IDEA pillar becomes more important when AI agents are the intermediary between brand and customer.

### Quick Wins
3-5 immediate actions this brand can take to improve AI visibility.`,
  },
  {
    id: 'implementation',
    title: 'Implementation Roadmap',
    order: 13,
    batch: 97,
    dependsOn: ['brand_essence'],
    skillQueries: [
      'IDEA framework integration strategy implementation execution brand building',
      'customer journey signposts research methods sources data gathering',
    ],
    userDataFields: ['*'],
    writingInstructions: `Generate the Implementation Roadmap section.

Structure:
## 13. Implementation Roadmap

### Immediate Priorities (Next 30 Days)
3-5 specific, actionable steps based on the brand's current state and gaps identified in this document.

### Short-Term Strategy (30-90 Days)
Brand-building activities across the IDEA pillars. For each:
- The action
- Which IDEA pillar it serves
- Expected outcome
- How to measure success

### Medium-Term Strategy (90-180 Days)
Scaling activities including agentic commerce preparation, earned media strategy, and community building.

### Research Agenda
Based on gaps identified in the Avatar 2.0 and Brand Canvas sections, what additional research should be conducted? Reference specific methods from the research toolkit.

### Success Metrics
| Metric | Current State | Target | Timeframe |
|--------|--------------|--------|-----------|
| ... | ... | ... | ... |

### Ongoing Brand Health
How to use this document as a living reference. What should be reviewed quarterly, annually, and after major market shifts?`,
  },
];

// ============================================================================
// RETRY & DELAY UTILITIES
// ============================================================================

const delay = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  label: string = 'fetch'
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) return response;

      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const retryAfter = response.headers.get('retry-after');
        const backoffMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(2000 * Math.pow(2, attempt), 30000);
        console.warn(`[${label}] ${response.status} on attempt ${attempt + 1}, retrying in ${backoffMs}ms...`);
        await delay(backoffMs);
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (attempt < maxRetries) {
        const backoffMs = Math.min(2000 * Math.pow(2, attempt), 30000);
        console.warn(`[${label}] Error on attempt ${attempt + 1}: ${error.message}, retrying in ${backoffMs}ms...`);
        await delay(backoffMs);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`[${label}] All ${maxRetries + 1} attempts failed`);
}

// ============================================================================
// SKILLS VECTOR STORE SEARCH
// ============================================================================

async function searchSkillsVectorStore(
  queries: string[],
  maxResults: number = SKILL_SEARCH_MAX_RESULTS
): Promise<string> {
  if (!skillsVectorStoreId) {
    console.warn('[searchSkills] No SKILLS_VECTOR_STORE_ID configured');
    return '';
  }

  try {
    const allResults: Array<{ content: string; score: number }> = [];

    const responses = await Promise.all(
      queries.map(query =>
        fetchWithRetry(
          `https://api.openai.com/v1/vector_stores/${skillsVectorStoreId}/search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2',
            },
            body: JSON.stringify({
              query,
              max_num_results: maxResults,
            }),
          },
          SKILL_SEARCH_MAX_RETRIES,
          'searchSkills'
        ).then(async (response) => {
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[searchSkills] Search failed for query "${query.substring(0, 40)}...":`, response.status, errorText);
            return null;
          }
          return response.json();
        }).catch(() => null)
      )
    );

    for (const data of responses) {
      if (!data?.data) continue;
      for (const result of data.data) {
        for (const contentItem of result.content || []) {
          if (contentItem.type === 'text' && contentItem.text) {
            allResults.push({
              content: contentItem.text,
              score: result.score || 0,
            });
          }
        }
      }
    }

    const seen = new Set<string>();
    const unique = allResults.filter(r => {
      const key = r.content.substring(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => b.score - a.score);
    const topResults = unique.slice(0, maxResults * 2);

    if (topResults.length === 0) return '';

    return topResults.map(r => r.content).join('\n\n---\n\n');
  } catch (error) {
    console.error('[searchSkills] Error:', error);
    return '';
  }
}

// ============================================================================
// USER DATA SEMANTIC RETRIEVAL
// ============================================================================

const embeddingCache = new Map<string, number[]>();

async function generateEmbedding(text: string): Promise<number[]> {
  const cacheKey = text.substring(0, 200).toLowerCase().trim();
  if (embeddingCache.has(cacheKey)) {
    console.log(`[generateEmbedding] Cache hit for: "${cacheKey.substring(0, 50)}..."`);
    return embeddingCache.get(cacheKey)!;
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error('Invalid embedding response: no embeddings returned');
  }

  const embedding = data.data[0].embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Invalid embedding response: embedding is not a valid array');
  }

  embeddingCache.set(cacheKey, embedding);
  return embedding;
}

async function retrieveUserContext(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
  query: string,
  matchCount: number = USER_CONTEXT_MATCH_COUNT
): Promise<string> {
  try {
    const embedding = await generateEmbedding(query);

    const [docResult, kbResult] = await Promise.all([
      supabaseClient.rpc('match_user_documents', {
        query_embedding: embedding,
        match_user_id: userId,
        match_count: matchCount,
      }),
      supabaseClient.rpc('match_user_knowledge', {
        query_embedding: embedding,
        p_user_id: userId,
        match_count: matchCount,
        match_threshold: 0.5,
      }),
    ]);

    const chunks: Array<{ content: string; similarity: number }> = [];

    if (docResult.data && !docResult.error) {
      for (const match of docResult.data) {
        if (match.content && typeof match.similarity === 'number') {
          chunks.push({ content: String(match.content), similarity: match.similarity });
        }
      }
    }

    if (kbResult.data && !kbResult.error) {
      for (const match of kbResult.data) {
        if (match.content && typeof match.similarity === 'number') {
          chunks.push({ content: String(match.content), similarity: match.similarity });
        }
      }
    }

    chunks.sort((a, b) => b.similarity - a.similarity);
    return chunks.slice(0, matchCount).map(c => c.content).join('\n\n');
  } catch (error) {
    console.error('[retrieveUserContext] Error:', error);
    return '';
  }
}

// ============================================================================
// SECTION GENERATION
// ============================================================================

async function generateSection(
  section: DocumentSection,
  brandName: string,
  avatarFieldValues: Record<string, string>,
  canvas: Record<string, string>,
  avatar: Record<string, string>,
  insights: Record<string, string>,
  chatInsights: Array<{ title: string; excerpt: string }>,
  supabaseClient: ReturnType<typeof createClient> | null,
  userId: string | null,
  previousSections?: Record<string, string>
): Promise<string> {
  console.log(`[generateSection] Generating: ${section.title}`);

  const skillContextPromise = searchSkillsVectorStore(section.skillQueries, 3);
  const semanticContextPromise = (supabaseClient && userId)
    ? retrieveUserContext(supabaseClient, userId, section.skillQueries[0], 2)
    : Promise.resolve('');

  const [skillContext, semanticContext] = await Promise.all([skillContextPromise, semanticContextPromise]);

  // Gather user data for this section
  let userData = '';

  if (section.userDataFields.includes('*')) {
    for (const [key, value] of Object.entries(avatarFieldValues)) {
      if (value) userData += `${key}: ${value}\n`;
    }
  } else {
    for (const fieldId of section.userDataFields) {
      const value = avatarFieldValues[fieldId];
      if (value) userData += `${fieldId}: ${value}\n`;
    }
  }

  for (const [key, value] of Object.entries(canvas)) {
    if (value && !userData.includes(key)) userData += `canvas_${key}: ${value}\n`;
  }
  for (const [key, value] of Object.entries(avatar)) {
    if (value && !userData.includes(key)) userData += `avatar_${key}: ${value}\n`;
  }
  for (const [key, value] of Object.entries(insights)) {
    if (value && !userData.includes(key)) userData += `insight_${key}: ${value}\n`;
  }

  // Chat insights for sections that benefit from conversation context
  let chatContext = '';
  if (chatInsights.length > 0 && ['idea_overview', 'brand_story', 'implementation'].includes(section.id)) {
    chatContext = chatInsights
      .slice(0, 3)
      .map(c => `### ${c.title}\n${c.excerpt.substring(0, ASSISTANT_RESPONSE_TRUNCATE)}`)
      .join('\n\n');
    if (chatContext.length > CHAT_EXCERPT_MAX_LENGTH) {
      chatContext = chatContext.substring(0, CHAT_EXCERPT_MAX_LENGTH);
    }
  }

  // Previous sections context for synthesis sections
  let previousContext = '';
  if (previousSections && section.dependsOn) {
    for (const depId of section.dependsOn) {
      if (previousSections[depId]) {
        previousContext += `\n[From ${depId}]: ${previousSections[depId].substring(0, 500)}...\n`;
      }
    }
  }

  const systemPrompt = `${TREVOR_VOICE_DIRECTIVE}

## IDEA Framework Skill Knowledge
The following is relevant methodology from the IDEA Strategic Brand Framework skills library. Use this to ground your writing in the framework's principles:

${skillContext || 'No specific skill context available for this section.'}

## Section Writing Instructions
${section.writingInstructions}

## Output Rules
- Generate ONLY this section's content in clean Markdown
- Start with the ## heading as specified in the instructions
- Use ###, ####, tables, and bullet points as needed
- No preamble or closing remarks — just the section content
- Every recommendation must be specific to THIS brand, not generic advice
- If user data is missing for a subsection, write: "This area requires additional discovery through [specific method]."`;

  const userPrompt = `Generate section "${section.title}" for the brand: ${brandName}

## User's Brand Data
${userData || 'No structured field data available.'}

${semanticContext ? `## Additional Context (from uploaded documents and knowledge base)\n${semanticContext}` : ''}

${chatContext ? `## Strategic Conversation Insights\n${chatContext}` : ''}

${previousContext ? `## Context from Previous Sections\n${previousContext}` : ''}

Generate the complete section now.`;

  // System prompt is always large (TREVOR_VOICE_DIRECTIVE + skill context + instructions), use prompt caching
  const response = await fetchWithRetry(
    CLAUDE_API_URL,
    {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey!,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: SECTION_MAX_TOKENS,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.7,
      }),
    },
    1,
    `generateSection:${section.id}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[generateSection] Claude Haiku error for ${section.title}:`, response.status, errorText);
    return `## ${section.order}. ${section.title}\n\nThis section could not be generated. Please try again.\n`;
  }

  const data = await response.json();

  if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
    console.error(`[generateSection] Invalid response structure for ${section.title}`);
    return `## ${section.order}. ${section.title}\n\nGeneration error: invalid API response. Please try again.\n`;
  }

  const firstBlock = data.content[0];
  if (!firstBlock?.text || typeof firstBlock.text !== 'string') {
    console.error(`[generateSection] Missing content in API response for ${section.title}`);
    return `## ${section.order}. ${section.title}\n\nGeneration error: no content returned. Please try again.\n`;
  }

  const content = firstBlock.text.trim();
  console.log(`[generateSection] ${section.title} generated: ${content.length} chars`);
  return content;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!anthropicApiKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Anthropic API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!openAIApiKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'OpenAI API key not configured (needed for embeddings and vector store search)' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Parse request body
  let requestData: Record<string, unknown>;
  try {
    requestData = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Malformed JSON in request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const {
    sectionId,
    brandName: requestedBrandName,
    avatarFieldValues = {},
    canvas = {},
    avatar = {},
    insights = {},
    chatInsights = [],
    previousSections,
  } = requestData as {
    sectionId: string;
    brandName: string;
    avatarFieldValues: Record<string, string>;
    canvas: Record<string, string>;
    avatar: Record<string, string>;
    insights: Record<string, string>;
    chatInsights: Array<{ title: string; excerpt: string }>;
    previousSections?: Record<string, string>;
  };

  // Validate sectionId
  if (!sectionId || typeof sectionId !== 'string') {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing required field: sectionId' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const section = DOCUMENT_SECTIONS.find(s => s.id === sectionId);
  if (!section) {
    const validIds = DOCUMENT_SECTIONS.map(s => s.id).join(', ');
    return new Response(
      JSON.stringify({ success: false, error: `Invalid sectionId: "${sectionId}". Valid IDs: ${validIds}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const brandName = requestedBrandName || 'Your Brand';

  console.log(`[section] Generating section "${sectionId}" for brand "${brandName}"`);

  try {
    // Authenticate user (optional)
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    let supabaseClient: ReturnType<typeof createClient> | null = null;

    if (authHeader) {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace('Bearer ', '');
      const authResult = await supabaseClient.auth.getUser(token);
      if (authResult?.data?.user?.id) {
        userId = authResult.data.user.id;
        console.log('[section] Authenticated user:', userId);
      }
    }

    // Generate the section
    const content = await generateSection(
      section,
      brandName,
      avatarFieldValues as Record<string, string>,
      canvas as Record<string, string>,
      avatar as Record<string, string>,
      insights as Record<string, string>,
      chatInsights as Array<{ title: string; excerpt: string }>,
      supabaseClient,
      userId,
      previousSections as Record<string, string> | undefined
    );

    console.log(`[section] Complete: sectionId=${sectionId}, chars=${content.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        sectionId,
        content,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[section] Error generating "${sectionId}":`, error);
    return new Response(
      JSON.stringify({
        success: false,
        sectionId,
        content: '',
        error: error.message || `Failed to generate section: ${sectionId}`,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

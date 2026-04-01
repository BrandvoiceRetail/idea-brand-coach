// ============================================================================
// SECTION DEFINITIONS
// 13 IDEA-aligned sections with skill retrieval queries
// ============================================================================

export interface DocumentSection {
  id: string;
  title: string;
  order: number;
  skillQueries: string[];
  userDataFields: string[];
  writingInstructions: string;
  batch: number;
  dependsOn?: string[];
}

export const DOCUMENT_SECTIONS: DocumentSection[] = [
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

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// Types
// ============================================================================

interface CompetitorInfo {
  name: string;
  url: string;
  description: string;
  source: string;
}

interface ReviewData {
  competitor_name: string;
  source: string;
  review_text: string;
  rating: number | null;
  review_date: string | null;
  verified_purchase: boolean;
  sentiment_score: number | null;
  key_themes: string[];
}

interface AnalysisState {
  analysisId: string;
  userId: string;
  status: 'discovering' | 'scraping_reviews' | 'analyzing' | 'saving' | 'completed' | 'failed';
  progress: number;
  competitors: CompetitorInfo[];
  reviews: ReviewData[];
  error?: string;
}

interface OrchestratorRequest {
  brandName: string;
  industry: string;
  productCategory?: string;
  maxCompetitors?: number;
}

// ============================================================================
// State Management
// ============================================================================

async function updateAnalysisStatus(
  supabase: ReturnType<typeof createClient>,
  analysisId: string,
  status: string,
  additionalData?: Record<string, unknown>
): Promise<void> {
  const updatePayload: Record<string, unknown> = { status };
  if (additionalData) {
    Object.assign(updatePayload, additionalData);
  }

  const { error } = await supabase
    .from('competitive_analyses')
    .update(updatePayload)
    .eq('id', analysisId);

  if (error) {
    console.error(`[updateAnalysisStatus] Failed to update status to ${status}:`, error);
  }
}

// ============================================================================
// Retry Helper
// ============================================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts: number = 3,
  delayMs: number = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.error(`[${label}] Attempt ${attempt}/${maxAttempts} failed:`, error.message);
      if (attempt === maxAttempts) throw error;
      console.log(`[${label}] Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`[${label}] All ${maxAttempts} attempts failed`);
}

// ============================================================================
// Step 1: Competitor Discovery
// ============================================================================

async function discoverCompetitors(
  supabaseUrl: string,
  authHeader: string,
  brandName: string,
  industry: string,
  productCategory?: string,
  maxResults: number = 15
): Promise<CompetitorInfo[]> {
  console.log('[discoverCompetitors] Calling competitor-discovery function...');

  return withRetry(
    async () => {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/competitor-discovery`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            brandName,
            industry,
            productCategory,
            maxResults,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Competitor discovery failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log(`[discoverCompetitors] Found ${data.competitors?.length || 0} competitors`);
      return data.competitors || [];
    },
    'discoverCompetitors',
    3,
    2000
  );
}

// ============================================================================
// Step 2: Review Scraping
// ============================================================================

interface ReviewScraperResult {
  url: string;
  reviews: Array<{
    reviewerName: string;
    rating: number;
    title: string;
    body: string;
    date: string;
    verified: boolean;
    source: string;
  }>;
  error?: string;
}

async function scrapeReviews(
  supabaseUrl: string,
  authHeader: string,
  competitors: CompetitorInfo[]
): Promise<ReviewData[]> {
  console.log(`[scrapeReviews] Scraping reviews for ${competitors.length} competitors...`);

  // Build URL-to-competitor-name mapping for attribution
  const urlToCompetitor = new Map<string, string>();
  const urls: string[] = [];
  for (const competitor of competitors) {
    if (competitor.url) {
      urls.push(competitor.url);
      urlToCompetitor.set(competitor.url, competitor.name);
    }
  }

  if (urls.length === 0) {
    console.log('[scrapeReviews] No competitor URLs to scrape');
    return [];
  }

  // Review-scraper accepts up to 10 URLs per call; batch accordingly
  const maxUrlsPerCall = 10;
  const allReviews: ReviewData[] = [];

  for (let i = 0; i < urls.length; i += maxUrlsPerCall) {
    const batchUrls = urls.slice(i, i + maxUrlsPerCall);

    const results: ReviewScraperResult[] = await withRetry(
      async () => {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/review-scraper`,
          {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              urls: batchUrls,
              maxReviewsPerUrl: 20,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Review scraper returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data.results || [];
      },
      'scrapeReviews',
      2,
      3000
    );

    // Map review-scraper response to orchestrator's ReviewData format
    for (const result of results) {
      const competitorName = urlToCompetitor.get(result.url) || 'Unknown';

      if (result.error) {
        console.error(`[scrapeReviews] Error for ${competitorName} (${result.url}): ${result.error}`);
        continue;
      }

      for (const review of result.reviews) {
        allReviews.push({
          competitor_name: competitorName,
          source: review.source || result.url,
          review_text: review.body || '',
          rating: review.rating || null,
          review_date: review.date || null,
          verified_purchase: review.verified || false,
          sentiment_score: null,
          key_themes: [],
        });
      }
    }
  }

  console.log(`[scrapeReviews] Total reviews collected: ${allReviews.length}`);
  return allReviews;
}

// ============================================================================
// Step 3: GPT-4 Analysis
// ============================================================================

/**
 * GPT-4 analysis output types.
 * These mirror the frontend TypeScript interfaces in src/types/competitive-analysis.ts
 * so the database columns can be consumed directly by the UI without transformation.
 */
interface MarketInsightsOutput {
  summary: string;
  trends: string[];
  threats: string[];
}

interface CustomerSegmentOutput {
  name: string;
  description: string;
  size: string;
  needs: string[];
}

interface CompetitivePositioningOutput {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface OpportunityGapOutput {
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
}

interface IdeaInsightsOutput {
  identify: string[];
  discover: string[];
  execute: string[];
  analyze: string[];
}

interface AnalysisOutput {
  marketInsights: MarketInsightsOutput;
  customerSegments: CustomerSegmentOutput[];
  competitivePositioning: CompetitivePositioningOutput;
  opportunityGaps: OpportunityGapOutput[];
  ideaInsights: IdeaInsightsOutput;
}

async function generateAnalysis(
  competitors: CompetitorInfo[],
  reviews: ReviewData[],
  brandName: string,
  industry: string
): Promise<AnalysisOutput> {
  console.log('[generateAnalysis] Generating GPT-4 analysis...');

  const reviewSummary = reviews.map((r) => ({
    competitor: r.competitor_name,
    rating: r.rating,
    sentiment: r.sentiment_score,
    themes: r.key_themes,
    excerpt: r.review_text.substring(0, 200),
  }));

  const competitorSummary = competitors.map((c) => ({
    name: c.name,
    url: c.url,
    description: c.description,
  }));

  const prompt = `You are a competitive analysis expert using the IDEA Brand Framework.
Analyze the following competitor data for "${brandName}" in the "${industry}" industry.

COMPETITORS:
${JSON.stringify(competitorSummary, null, 2)}

REVIEW DATA (${reviews.length} reviews):
${JSON.stringify(reviewSummary, null, 2)}

Generate a comprehensive competitive analysis. Return ONLY valid JSON matching the exact schema below. Every field is required.

{
  "marketInsights": {
    "summary": "2-3 sentence market overview synthesizing competitor landscape and review sentiment",
    "trends": ["trend derived from review data", "another trend"],
    "threats": ["competitive threat facing the brand", "another threat"]
  },
  "customerSegments": [
    {
      "name": "Segment Name",
      "description": "Who this customer segment is and what defines them",
      "size": "Estimated share of the market (e.g. '35% of buyers')",
      "needs": ["core need derived from reviews", "another need"]
    }
  ],
  "competitivePositioning": {
    "strengths": ["${brandName}'s potential strength vs competitors"],
    "weaknesses": ["area where competitors currently outperform"],
    "opportunities": ["market opportunity revealed by review gaps"],
    "threats": ["competitive threat to address"]
  },
  "opportunityGaps": [
    {
      "description": "Specific gap in the market that reviews reveal",
      "impact": "high | medium | low",
      "effort": "high | medium | low"
    }
  ],
  "ideaInsights": {
    "identify": ["Insight about who the customer really is, derived from review patterns"],
    "discover": ["What makes the brand's opportunity unique vs these competitors"],
    "execute": ["Specific tactical recommendation based on competitor weaknesses"],
    "analyze": ["Metric or KPI to track based on competitive landscape"]
  }
}

Guidelines:
- Be specific and data-driven. Reference actual competitor names and review themes.
- For customerSegments, identify 2-4 distinct segments from the review data.
- For opportunityGaps, identify 3-5 concrete gaps with realistic impact/effort ratings.
- For ideaInsights, provide 2-4 items per IDEA pillar (Identify, Discover, Execute, Analyze).
- Keep each string concise (1-2 sentences max) so the UI can render them as bullet points.
- Return ONLY valid JSON with no markdown, no code fences, no commentary.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a competitive analysis expert. Return ONLY valid JSON with no markdown formatting, no code fences, and no extra text. Match the requested schema exactly.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content.trim();

  // Strip markdown code fences if present (safety net)
  if (content.startsWith('```')) {
    content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const analysis = JSON.parse(content);

  // Validate required top-level keys are present
  const requiredKeys = ['marketInsights', 'customerSegments', 'competitivePositioning', 'opportunityGaps', 'ideaInsights'];
  for (const key of requiredKeys) {
    if (!(key in analysis)) {
      throw new Error(`GPT-4 response missing required key: ${key}`);
    }
  }

  console.log('[generateAnalysis] Analysis generated successfully');

  return {
    marketInsights: analysis.marketInsights,
    customerSegments: analysis.customerSegments,
    competitivePositioning: analysis.competitivePositioning,
    opportunityGaps: analysis.opportunityGaps,
    ideaInsights: analysis.ideaInsights,
  };
}

// ============================================================================
// Step 4: Save Results to Knowledge Base
// ============================================================================

async function saveToKnowledgeBase(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  analysisId: string,
  brandName: string,
  industry: string,
  analysis: AnalysisOutput
): Promise<void> {
  console.log('[saveToKnowledgeBase] Saving analysis results...');

  const knowledgeEntries = [
    {
      user_id: userId,
      field_identifier: 'competitive_market_insights',
      category: 'competitive_analysis',
      subcategory: 'market',
      content: JSON.stringify(analysis.marketInsights),
      is_current: true,
      source: 'competitive_analysis_orchestrator',
      metadata: { analysis_id: analysisId, brand_name: brandName, industry },
    },
    {
      user_id: userId,
      field_identifier: 'competitive_customer_segments',
      category: 'competitive_analysis',
      subcategory: 'segments',
      content: JSON.stringify(analysis.customerSegments),
      is_current: true,
      source: 'competitive_analysis_orchestrator',
      metadata: { analysis_id: analysisId, brand_name: brandName, industry },
    },
    {
      user_id: userId,
      field_identifier: 'competitive_positioning',
      category: 'competitive_analysis',
      subcategory: 'positioning',
      content: JSON.stringify(analysis.competitivePositioning),
      is_current: true,
      source: 'competitive_analysis_orchestrator',
      metadata: { analysis_id: analysisId, brand_name: brandName, industry },
    },
    {
      user_id: userId,
      field_identifier: 'competitive_opportunity_gaps',
      category: 'competitive_analysis',
      subcategory: 'opportunities',
      content: JSON.stringify(analysis.opportunityGaps),
      is_current: true,
      source: 'competitive_analysis_orchestrator',
      metadata: { analysis_id: analysisId, brand_name: brandName, industry },
    },
    {
      user_id: userId,
      field_identifier: 'competitive_idea_insights',
      category: 'competitive_analysis',
      subcategory: 'idea_framework',
      content: JSON.stringify(analysis.ideaInsights),
      is_current: true,
      source: 'competitive_analysis_orchestrator',
      metadata: { analysis_id: analysisId, brand_name: brandName, industry },
    },
  ];

  // Mark previous competitive analysis entries as not current
  await supabase
    .from('user_knowledge_base')
    .update({ is_current: false })
    .eq('user_id', userId)
    .eq('category', 'competitive_analysis')
    .eq('is_current', true);

  // Insert new entries
  const { error } = await supabase
    .from('user_knowledge_base')
    .insert(knowledgeEntries);

  if (error) {
    console.error('[saveToKnowledgeBase] Error saving entries:', error);
    throw new Error(`Failed to save knowledge base entries: ${error.message}`);
  }

  console.log(`[saveToKnowledgeBase] Saved ${knowledgeEntries.length} entries`);
}

// ============================================================================
// Main Orchestrator
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    const {
      brandName,
      industry,
      productCategory,
      maxCompetitors = 10,
    }: OrchestratorRequest = await req.json();

    if (!brandName || !industry) {
      return new Response(
        JSON.stringify({ error: 'brandName and industry are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[orchestrator] Starting competitive analysis:', {
      brandName, industry, productCategory, maxCompetitors, userId: user.id,
    });

    // Create analysis record
    const { data: analysis, error: insertError } = await supabase
      .from('competitive_analyses')
      .insert({
        user_id: user.id,
        market_category: `${industry}${productCategory ? ` - ${productCategory}` : ''}`,
        status: 'processing',
        competitors: [],
      })
      .select('id')
      .single();

    if (insertError || !analysis) {
      throw new Error(`Failed to create analysis record: ${insertError?.message}`);
    }

    const analysisId = analysis.id;
    console.log(`[orchestrator] Created analysis record: ${analysisId}`);

    const state: AnalysisState = {
      analysisId,
      userId: user.id,
      status: 'discovering',
      progress: 0,
      competitors: [],
      reviews: [],
    };

    try {
      // Step 1: Discover competitors
      state.status = 'discovering';
      state.progress = 10;
      await updateAnalysisStatus(supabase, analysisId, 'processing');

      const competitors = await discoverCompetitors(
        supabaseUrl,
        authHeader,
        brandName,
        industry,
        productCategory,
        maxCompetitors
      );
      state.competitors = competitors;
      state.progress = 30;

      // Update analysis with discovered competitors
      await updateAnalysisStatus(supabase, analysisId, 'processing', {
        competitors: competitors,
      });

      // Step 2: Scrape reviews
      state.status = 'scraping_reviews';
      state.progress = 40;

      const reviews = await scrapeReviews(supabaseUrl, authHeader, competitors);
      state.reviews = reviews;
      state.progress = 60;

      // Save individual reviews to competitor_reviews table
      if (reviews.length > 0) {
        const reviewRecords = reviews.map((review) => ({
          analysis_id: analysisId,
          competitor_name: review.competitor_name,
          source: review.source,
          review_text: review.review_text,
          rating: review.rating,
          review_date: review.review_date,
          verified_purchase: review.verified_purchase,
          sentiment_score: review.sentiment_score,
          key_themes: review.key_themes,
        }));

        const { error: reviewError } = await supabase
          .from('competitor_reviews')
          .insert(reviewRecords);

        if (reviewError) {
          console.error('[orchestrator] Error saving reviews:', reviewError);
        } else {
          console.log(`[orchestrator] Saved ${reviewRecords.length} reviews`);
        }
      }

      // Step 3: Generate GPT-4 analysis
      state.status = 'analyzing';
      state.progress = 70;

      const analysisResults = await generateAnalysis(competitors, reviews, brandName, industry);
      state.progress = 85;

      // Step 4: Save to knowledge base
      state.status = 'saving';
      state.progress = 90;

      await saveToKnowledgeBase(
        supabase,
        user.id,
        analysisId,
        brandName,
        industry,
        analysisResults
      );

      // Update final analysis record
      await updateAnalysisStatus(supabase, analysisId, 'completed', {
        total_reviews_analyzed: reviews.length,
        market_insights: analysisResults.marketInsights,
        customer_segments: analysisResults.customerSegments,
        competitive_positioning: analysisResults.competitivePositioning,
        opportunity_gaps: analysisResults.opportunityGaps,
        idea_insights: analysisResults.ideaInsights,
      });

      state.status = 'completed';
      state.progress = 100;

      console.log(`[orchestrator] Analysis complete: ${analysisId}`);

      return new Response(
        JSON.stringify({
          analysisId,
          status: 'completed',
          competitorsFound: competitors.length,
          reviewsAnalyzed: reviews.length,
          marketInsights: analysisResults.marketInsights,
          customerSegments: analysisResults.customerSegments,
          competitivePositioning: analysisResults.competitivePositioning,
          opportunityGaps: analysisResults.opportunityGaps,
          ideaInsights: analysisResults.ideaInsights,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (stepError) {
      // Update analysis as failed
      state.status = 'failed';
      state.error = stepError.message;

      await updateAnalysisStatus(supabase, analysisId, 'failed');

      throw stepError;
    }
  } catch (error) {
    console.error('[orchestrator] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

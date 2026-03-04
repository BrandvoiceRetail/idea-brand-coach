import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// Types
// ============================================================================

interface KBEntry {
  field_identifier: string;
  category: string;
  content: string;
  subcategory?: string;
}

interface CompetitiveAnalysisRow {
  id: string;
  market_category: string;
  competitors: Array<{ name: string; url?: string; category?: string }>;
  total_reviews_analyzed: number;
  market_insights: {
    summary: string;
    trends: string[];
    threats: string[];
  } | null;
  customer_segments: Array<{
    name: string;
    description: string;
    size: string;
    needs: string[];
  }> | null;
  competitive_positioning: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  } | null;
  opportunity_gaps: Array<{
    description: string;
    impact: string;
    effort: string;
  }> | null;
  idea_insights: {
    identify: string[];
    discover: string[];
    execute: string[];
    analyze: string[];
  } | null;
  status: string;
  analysis_date: string;
}

interface CompetitorReviewRow {
  competitor_name: string;
  source: string;
  rating: number | null;
  sentiment_score: number | null;
  key_themes: string[];
}

// ============================================================================
// Knowledge Base Field Labels
// ============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  diagnostic: 'Brand Diagnostic',
  insights: 'Customer Insights',
  canvas: 'Brand Canvas',
  avatar: 'Customer Avatar',
  empathy: 'Emotional Triggers',
  copy: 'Brand Copy',
};

const FIELD_LABELS: Record<string, string> = {
  insight_buyer_intent: 'Buyer Intent',
  insight_buyer_motivation: 'Buyer Motivation',
  insight_shopper_type: 'Shopper Type',
  insight_demographics: 'Demographics',
  insight_search_terms: 'Search Terms',
  insight_industry: 'Industry',
  insight_intent_analysis: 'Intent Analysis',
  canvas_brand_purpose: 'Brand Purpose',
  canvas_brand_vision: 'Brand Vision',
  canvas_brand_mission: 'Brand Mission',
  canvas_brand_values: 'Brand Values',
  canvas_positioning_statement: 'Positioning Statement',
  canvas_value_proposition: 'Value Proposition',
  canvas_brand_personality: 'Brand Personality',
  canvas_brand_voice: 'Brand Voice',
  empathy_emotional_triggers: 'Emotional Triggers',
  empathy_trigger_profile: 'Trigger Profile',
};

function getFieldLabel(identifier: string): string {
  return FIELD_LABELS[identifier] || identifier
    .replace(/^[a-z]+_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
}

// ============================================================================
// HTML Helpers
// ============================================================================

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatContent(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return `<ul>${parsed.map((item: unknown) => `<li>${escapeHTML(String(item))}</li>`).join('')}</ul>`;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const items = Object.entries(parsed)
        .map(([key, value]) => `<li><strong>${escapeHTML(key)}:</strong> ${escapeHTML(String(value))}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    }
  } catch {
    // Not JSON, use as plain text
  }
  return escapeHTML(content).replace(/\n/g, '<br>');
}

// ============================================================================
// Section Builders
// ============================================================================

function buildExecutiveSummarySection(
  brandName: string,
  entries: KBEntry[],
  analysis: CompetitiveAnalysisRow | null
): string {
  const purpose = entries.find((e) => e.field_identifier === 'canvas_brand_purpose')?.content;
  const positioning = entries.find((e) => e.field_identifier === 'canvas_positioning_statement')?.content;
  const valueProp = entries.find((e) => e.field_identifier === 'canvas_value_proposition')?.content;
  const industry = entries.find((e) => e.field_identifier === 'insight_industry')?.content;

  let summaryContent = '';

  if (purpose) {
    summaryContent += `
      <div class="field">
        <div class="field-label">Brand Purpose</div>
        <div class="field-content">${formatContent(purpose)}</div>
      </div>`;
  }

  if (positioning) {
    summaryContent += `
      <div class="field">
        <div class="field-label">Strategic Positioning</div>
        <div class="field-content">${formatContent(positioning)}</div>
      </div>`;
  }

  if (valueProp) {
    summaryContent += `
      <div class="field">
        <div class="field-label">Value Proposition</div>
        <div class="field-content">${formatContent(valueProp)}</div>
      </div>`;
  }

  if (industry) {
    summaryContent += `
      <div class="field">
        <div class="field-label">Industry</div>
        <div class="field-content">${formatContent(industry)}</div>
      </div>`;
  }

  if (analysis && analysis.status === 'completed') {
    summaryContent += `
      <div class="field">
        <div class="field-label">Competitive Landscape</div>
        <div class="field-content">
          ${escapeHTML(brandName)} operates in the ${escapeHTML(analysis.market_category)} market
          with ${analysis.competitors.length} identified competitors
          and ${analysis.total_reviews_analyzed} customer reviews analysed.
        </div>
      </div>`;
  }

  if (!summaryContent) {
    summaryContent = `
      <div class="field">
        <div class="field-content"><em>Complete brand exercises to populate this section.</em></div>
      </div>`;
  }

  return `
    <div class="section">
      <h2>1. Executive Summary</h2>
      <p class="section-intro">
        This document outlines the strategic brand foundation for ${escapeHTML(brandName)},
        synthesised from brand diagnostic data, customer insights, and competitive analysis.
      </p>
      ${summaryContent}
    </div>`;
}

function buildKnowledgeBaseSection(
  sectionNumber: number,
  sectionTitle: string,
  categories: string[],
  entries: KBEntry[]
): string {
  const filtered = entries.filter((e) => categories.includes(e.category));
  if (filtered.length === 0) return '';

  const byCategory: Record<string, KBEntry[]> = {};
  for (const entry of filtered) {
    if (!byCategory[entry.category]) {
      byCategory[entry.category] = [];
    }
    byCategory[entry.category].push(entry);
  }

  let fieldsHTML = '';
  for (const [category, categoryEntries] of Object.entries(byCategory)) {
    const categoryLabel = CATEGORY_LABELS[category] ||
      category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

    if (Object.keys(byCategory).length > 1) {
      fieldsHTML += `<h3>${escapeHTML(categoryLabel)}</h3>`;
    }

    for (const entry of categoryEntries) {
      const label = getFieldLabel(entry.field_identifier);
      fieldsHTML += `
        <div class="field">
          <div class="field-label">${escapeHTML(label)}</div>
          <div class="field-content">${formatContent(entry.content)}</div>
        </div>`;
    }
  }

  return `
    <div class="section">
      <h2>${sectionNumber}. ${escapeHTML(sectionTitle)}</h2>
      ${fieldsHTML}
    </div>`;
}

function buildCompetitiveAnalysisSection(
  sectionNumber: number,
  analysis: CompetitiveAnalysisRow | null,
  reviews: CompetitorReviewRow[]
): string {
  if (!analysis || analysis.status !== 'completed') {
    return `
      <div class="section">
        <h2>${sectionNumber}. Competitive Analysis</h2>
        <div class="field">
          <div class="field-content"><em>Competitive analysis not yet completed. Start a competitive analysis from the research phase to populate this section.</em></div>
        </div>
      </div>`;
  }

  let html = `
    <div class="section">
      <h2>${sectionNumber}. Competitive Analysis</h2>
      <p class="section-intro">
        Analysis of the ${escapeHTML(analysis.market_category)} market,
        covering ${analysis.competitors.length} competitors
        and ${analysis.total_reviews_analyzed} customer reviews.
      </p>`;

  // Competitors list
  if (analysis.competitors.length > 0) {
    html += `
      <h3>Identified Competitors</h3>
      <table>
        <thead>
          <tr>
            <th>Competitor</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>`;
    for (const comp of analysis.competitors) {
      html += `
          <tr>
            <td>${escapeHTML(comp.name)}</td>
            <td>${escapeHTML(comp.category || analysis.market_category)}</td>
          </tr>`;
    }
    html += `
        </tbody>
      </table>`;
  }

  // Market insights
  if (analysis.market_insights) {
    html += `
      <h3>Market Insights</h3>
      <div class="field">
        <div class="field-label">Summary</div>
        <div class="field-content">${escapeHTML(analysis.market_insights.summary)}</div>
      </div>`;

    if (analysis.market_insights.trends.length > 0) {
      html += `
      <div class="field">
        <div class="field-label">Market Trends</div>
        <div class="field-content">
          <ul>${analysis.market_insights.trends.map((t: string) => `<li>${escapeHTML(t)}</li>`).join('')}</ul>
        </div>
      </div>`;
    }

    if (analysis.market_insights.threats.length > 0) {
      html += `
      <div class="field">
        <div class="field-label">Market Threats</div>
        <div class="field-content">
          <ul>${analysis.market_insights.threats.map((t: string) => `<li>${escapeHTML(t)}</li>`).join('')}</ul>
        </div>
      </div>`;
    }
  }

  // SWOT / Competitive positioning
  if (analysis.competitive_positioning) {
    const pos = analysis.competitive_positioning;
    html += `
      <h3>Competitive Positioning (SWOT)</h3>
      <table class="swot-table">
        <thead>
          <tr><th>Strengths</th><th>Weaknesses</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><ul>${pos.strengths.map((s: string) => `<li>${escapeHTML(s)}</li>`).join('')}</ul></td>
            <td><ul>${pos.weaknesses.map((w: string) => `<li>${escapeHTML(w)}</li>`).join('')}</ul></td>
          </tr>
        </tbody>
        <thead>
          <tr><th>Opportunities</th><th>Threats</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><ul>${pos.opportunities.map((o: string) => `<li>${escapeHTML(o)}</li>`).join('')}</ul></td>
            <td><ul>${pos.threats.map((t: string) => `<li>${escapeHTML(t)}</li>`).join('')}</ul></td>
          </tr>
        </tbody>
      </table>`;
  }

  // Opportunity gaps
  if (analysis.opportunity_gaps && analysis.opportunity_gaps.length > 0) {
    html += `
      <h3>Opportunity Gaps</h3>
      <table>
        <thead>
          <tr><th>Opportunity</th><th>Impact</th><th>Effort</th></tr>
        </thead>
        <tbody>`;
    for (const gap of analysis.opportunity_gaps) {
      html += `
          <tr>
            <td>${escapeHTML(gap.description)}</td>
            <td><span class="badge badge-${gap.impact}">${escapeHTML(gap.impact)}</span></td>
            <td><span class="badge badge-${gap.effort}">${escapeHTML(gap.effort)}</span></td>
          </tr>`;
    }
    html += `
        </tbody>
      </table>`;
  }

  // Customer segments from analysis
  if (analysis.customer_segments && analysis.customer_segments.length > 0) {
    html += `<h3>Customer Segments Identified</h3>`;
    for (const segment of analysis.customer_segments) {
      html += `
      <div class="field">
        <div class="field-label">${escapeHTML(segment.name)}</div>
        <div class="field-content">
          ${escapeHTML(segment.description)}
          ${segment.needs.length > 0
            ? `<br><strong>Key needs:</strong><ul>${segment.needs.map((n: string) => `<li>${escapeHTML(n)}</li>`).join('')}</ul>`
            : ''}
        </div>
      </div>`;
    }
  }

  // Review sentiment summary
  if (reviews.length > 0) {
    const byCompetitor: Record<string, CompetitorReviewRow[]> = {};
    for (const review of reviews) {
      if (!byCompetitor[review.competitor_name]) {
        byCompetitor[review.competitor_name] = [];
      }
      byCompetitor[review.competitor_name].push(review);
    }

    html += `
      <h3>Review Sentiment Summary</h3>
      <table>
        <thead>
          <tr><th>Competitor</th><th>Reviews</th><th>Avg Rating</th><th>Avg Sentiment</th><th>Top Themes</th></tr>
        </thead>
        <tbody>`;

    for (const [name, compReviews] of Object.entries(byCompetitor)) {
      const ratings = compReviews.filter((r) => r.rating !== null).map((r) => r.rating as number);
      const sentiments = compReviews.filter((r) => r.sentiment_score !== null).map((r) => r.sentiment_score as number);
      const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 'N/A';
      const avgSentiment = sentiments.length > 0 ? (sentiments.reduce((a, b) => a + b, 0) / sentiments.length).toFixed(2) : 'N/A';

      // Collect all themes and count
      const themeCounts: Record<string, number> = {};
      for (const review of compReviews) {
        for (const theme of (review.key_themes || [])) {
          themeCounts[theme] = (themeCounts[theme] || 0) + 1;
        }
      }
      const topThemes = Object.entries(themeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([theme]) => theme);

      html += `
          <tr>
            <td>${escapeHTML(name)}</td>
            <td>${compReviews.length}</td>
            <td>${avgRating}</td>
            <td>${avgSentiment}</td>
            <td>${topThemes.map((t) => escapeHTML(t)).join(', ') || 'N/A'}</td>
          </tr>`;
    }
    html += `
        </tbody>
      </table>`;
  }

  html += `</div>`;
  return html;
}

function buildIdeaFrameworkSection(
  sectionNumber: number,
  analysis: CompetitiveAnalysisRow | null
): string {
  if (!analysis?.idea_insights) return '';

  const insights = analysis.idea_insights;
  let html = `
    <div class="section">
      <h2>${sectionNumber}. IDEA Framework Analysis</h2>
      <p class="section-intro">
        Strategic insights mapped to the IDEA Framework based on competitive analysis findings.
      </p>`;

  const frameworks = [
    { key: 'identify', label: 'Identify', description: 'Assessment and gap identification' },
    { key: 'discover', label: 'Discover', description: 'Customer understanding and persona insights' },
    { key: 'execute', label: 'Execute', description: 'Strategic execution and business model' },
    { key: 'analyze', label: 'Analyse', description: 'Marketing amplification and content strategy' },
  ] as const;

  for (const fw of frameworks) {
    const items = insights[fw.key];
    if (items && items.length > 0) {
      html += `
      <div class="field idea-field idea-${fw.key}">
        <div class="field-label">${fw.label} - ${fw.description}</div>
        <div class="field-content">
          <ul>${items.map((item: string) => `<li>${escapeHTML(item)}</li>`).join('')}</ul>
        </div>
      </div>`;
    }
  }

  html += `</div>`;
  return html;
}

// ============================================================================
// Full Document Generator
// ============================================================================

function generateBrandStrategyHTML(
  brandName: string,
  entries: KBEntry[],
  analysis: CompetitiveAnalysisRow | null,
  reviews: CompetitorReviewRow[],
  generatedDate: string
): string {
  let sectionNumber = 1;

  // 1. Executive Summary
  const executiveSummary = buildExecutiveSummarySection(brandName, entries, analysis);
  sectionNumber++;

  // 2. Brand Foundations (canvas)
  const brandFoundations = buildKnowledgeBaseSection(
    sectionNumber, 'Brand Foundations', ['canvas'], entries
  );
  if (brandFoundations) sectionNumber++;

  // 3. Customer Understanding (avatar + insights)
  const customerUnderstanding = buildKnowledgeBaseSection(
    sectionNumber, 'Customer Understanding', ['avatar', 'insights'], entries
  );
  if (customerUnderstanding) sectionNumber++;

  // 4. Emotional Triggers (empathy)
  const emotionalTriggers = buildKnowledgeBaseSection(
    sectionNumber, 'Emotional Triggers', ['empathy'], entries
  );
  if (emotionalTriggers) sectionNumber++;

  // 5. Brand Diagnostic
  const diagnostic = buildKnowledgeBaseSection(
    sectionNumber, 'Brand Diagnostic', ['diagnostic'], entries
  );
  if (diagnostic) sectionNumber++;

  // 6. Competitive Analysis
  const competitiveAnalysis = buildCompetitiveAnalysisSection(sectionNumber, analysis, reviews);
  sectionNumber++;

  // 7. IDEA Framework Analysis (from competitive analysis)
  const ideaFramework = buildIdeaFrameworkSection(sectionNumber, analysis);
  if (ideaFramework) sectionNumber++;

  // 8. Brand Copy
  const brandCopy = buildKnowledgeBaseSection(
    sectionNumber, 'Brand Copy', ['copy'], entries
  );

  // Combine all sections
  const allSections = [
    executiveSummary,
    brandFoundations,
    customerUnderstanding,
    emotionalTriggers,
    diagnostic,
    competitiveAnalysis,
    ideaFramework,
    brandCopy,
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brand Strategy - ${escapeHTML(brandName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a2e;
      line-height: 1.6;
      background: #ffffff;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header {
      text-align: center;
      padding: 48px 0;
      border-bottom: 3px solid #6366f1;
      margin-bottom: 40px;
    }
    .header h1 {
      font-size: 36px;
      color: #1a1a2e;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    .header .subtitle {
      font-size: 18px;
      color: #6366f1;
      font-weight: 500;
    }
    .header .date {
      font-size: 14px;
      color: #94a3b8;
      margin-top: 8px;
    }
    .section {
      margin-bottom: 36px;
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 22px;
      color: #6366f1;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
    .section h3 {
      font-size: 17px;
      color: #334155;
      margin: 20px 0 10px 0;
    }
    .section-intro {
      font-size: 15px;
      color: #475569;
      margin-bottom: 16px;
      line-height: 1.7;
    }
    .field {
      margin-bottom: 16px;
      padding: 12px 16px;
      background: #f8fafc;
      border-left: 3px solid #6366f1;
      border-radius: 0 8px 8px 0;
    }
    .field-label {
      font-weight: 600;
      font-size: 13px;
      color: #475569;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .field-content {
      font-size: 15px;
      color: #1e293b;
    }
    .field-content ul {
      margin: 4px 0 0 16px;
    }
    .field-content li {
      margin-bottom: 4px;
    }
    .idea-field.idea-identify { border-left-color: #3b82f6; }
    .idea-field.idea-discover { border-left-color: #8b5cf6; }
    .idea-field.idea-execute { border-left-color: #10b981; }
    .idea-field.idea-analyze { border-left-color: #f59e0b; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 20px 0;
      font-size: 14px;
    }
    thead th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 600;
      text-align: left;
      padding: 10px 12px;
      border-bottom: 2px solid #e2e8f0;
    }
    tbody td {
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    tbody tr:last-child td { border-bottom: none; }
    .swot-table td { width: 50%; }
    .swot-table ul { margin: 0 0 0 16px; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-high { background: #fef2f2; color: #b91c1c; }
    .badge-medium { background: #fffbeb; color: #b45309; }
    .badge-low { background: #f0fdf4; color: #15803d; }
    .footer {
      text-align: center;
      padding: 24px 0;
      border-top: 2px solid #e2e8f0;
      margin-top: 40px;
      font-size: 12px;
      color: #94a3b8;
    }
    @media print {
      .container { padding: 20px; }
      .section { page-break-inside: avoid; }
      .header { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Brand Strategy Document</h1>
      <div class="subtitle">${escapeHTML(brandName)}</div>
      <div class="date">Generated ${escapeHTML(generatedDate)}</div>
    </div>
    ${allSections}
    <div class="footer">
      Generated by IDEA Brand Coach &bull; ${escapeHTML(generatedDate)}
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
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

    const { brandName = 'My Brand', format = 'html' } = await req.json();

    console.log(`[generate-brand-strategy-pdf] Generating for user ${user.id}, brand: ${brandName}`);

    // Fetch all data sources in parallel
    const [kbResult, analysisResult] = await Promise.all([
      // Knowledge base entries
      supabase
        .from('user_knowledge_base')
        .select('field_identifier, category, content, subcategory')
        .eq('user_id', user.id)
        .eq('is_current', true)
        .not('content', 'is', null),
      // Most recent completed competitive analysis
      supabase
        .from('competitive_analyses')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (kbResult.error) {
      throw new Error(`Failed to fetch knowledge base: ${kbResult.error.message}`);
    }

    const entries: KBEntry[] = kbResult.data || [];
    const analysis: CompetitiveAnalysisRow | null = analysisResult.data as CompetitiveAnalysisRow | null;

    // Fetch reviews if we have an analysis
    let reviews: CompetitorReviewRow[] = [];
    if (analysis) {
      const { data: reviewData, error: reviewError } = await supabase
        .from('competitor_reviews')
        .select('competitor_name, source, rating, sentiment_score, key_themes')
        .eq('analysis_id', analysis.id);

      if (!reviewError && reviewData) {
        reviews = reviewData as CompetitorReviewRow[];
      }

      console.log(`[generate-brand-strategy-pdf] Loaded analysis ${analysis.id} with ${reviews.length} reviews`);
    }

    if (entries.length === 0 && !analysis) {
      return new Response(
        JSON.stringify({ error: 'No brand data found. Please complete some brand exercises first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Generate comprehensive HTML document
    const html = generateBrandStrategyHTML(brandName, entries, analysis, reviews, generatedDate);

    const filename = `brand-strategy-${brandName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
    const categories = [...new Set(entries.map((e) => e.category))];
    if (analysis) categories.push('competitive_analysis');

    const metadata = {
      brandName,
      generatedDate,
      totalFields: entries.length,
      hasCompetitiveAnalysis: !!analysis,
      reviewsAnalyzed: analysis?.total_reviews_analyzed || 0,
      categories,
    };

    if (format === 'html') {
      // Return HTML directly for client-side PDF conversion
      return new Response(
        JSON.stringify({ html, filename, metadata }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store HTML in Supabase storage for later access
    const storagePath = `brand-strategy/${user.id}/${Date.now()}.html`;
    const { error: uploadError } = await supabase
      .storage
      .from('documents')
      .upload(storagePath, new Blob([html], { type: 'text/html' }), {
        contentType: 'text/html',
        upsert: true,
      });

    if (uploadError) {
      console.error('[generate-brand-strategy-pdf] Upload error:', uploadError);
      // Still return the HTML even if storage fails
    }

    const { data: urlData } = supabase
      .storage
      .from('documents')
      .getPublicUrl(storagePath);

    return new Response(
      JSON.stringify({
        html,
        storageUrl: urlData?.publicUrl || null,
        filename,
        metadata,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-brand-strategy-pdf] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

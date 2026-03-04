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

interface AnalysisData {
  id: string;
  market_category: string;
  analysis_date: string;
  competitors: Array<{ name: string; url: string; description: string }>;
  total_reviews_analyzed: number;
  market_insights: {
    overview: string;
    trends: string[];
    marketSize: string;
    growthDrivers: string[];
  };
  customer_segments: {
    segments: Array<{
      name: string;
      description: string;
      demographics: { ageRange: string; income: string; location: string };
      painPoints: string[];
      motivations: string[];
      sentimentDistribution: { positive: number; neutral: number; negative: number };
      size: string;
    }>;
    avatarProfiles: Array<{
      name: string;
      age: number;
      occupation: string;
      goals: string[];
      frustrations: string[];
      preferredBrands: string[];
      buyingBehavior: string;
      emotionalDrivers: string[];
    }>;
  };
  competitive_positioning: {
    leaderboard: Array<{
      name: string;
      strengths: string[];
      weaknesses: string[];
      positioning: string;
      averageRating: number;
      reviewSentiment: number;
    }>;
  };
  opportunity_gaps: {
    gaps: Array<{
      title: string;
      description: string;
      evidence: string;
      potentialImpact: string;
      actionItems: string[];
    }>;
    whiteSpaceOpportunities: string[];
  };
  idea_insights: {
    insightful: { summary: string; findings: string[] };
    distinctive: { summary: string; strategies: string[] };
    empathetic: { summary: string; emotionalTriggers: string[] };
    authentic: { summary: string; trustSignals: string[] };
  };
}

// ============================================================================
// HTML Generation - Matching customer-avatar-report.pdf format
// ============================================================================

function escapeHTML(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateSentimentBar(positive: number, neutral: number, negative: number): string {
  const posPercent = Math.round(positive * 100);
  const neuPercent = Math.round(neutral * 100);
  const negPercent = Math.round(negative * 100);

  return `
    <div class="sentiment-bar">
      <div class="sentiment-positive" style="width: ${posPercent}%">${posPercent}%</div>
      <div class="sentiment-neutral" style="width: ${neuPercent}%">${neuPercent}%</div>
      <div class="sentiment-negative" style="width: ${negPercent}%">${negPercent}%</div>
    </div>
    <div class="sentiment-legend">
      <span class="legend-item"><span class="dot positive"></span> Positive</span>
      <span class="legend-item"><span class="dot neutral"></span> Neutral</span>
      <span class="legend-item"><span class="dot negative"></span> Negative</span>
    </div>`;
}

function generateCompetitorAnalysisHTML(
  brandName: string,
  analysis: AnalysisData,
  generatedDate: string
): string {
  // Executive Summary
  const executiveSummaryHTML = `
    <div class="section">
      <h2>Executive Summary</h2>
      <div class="summary-box">
        <p>${escapeHTML(analysis.market_insights?.overview || 'Analysis in progress.')}</p>
        <div class="stats-grid">
          <div class="stat">
            <div class="stat-number">${analysis.competitors?.length || 0}</div>
            <div class="stat-label">Competitors Analyzed</div>
          </div>
          <div class="stat">
            <div class="stat-number">${analysis.total_reviews_analyzed || 0}</div>
            <div class="stat-label">Reviews Analyzed</div>
          </div>
          <div class="stat">
            <div class="stat-number">${analysis.customer_segments?.segments?.length || 0}</div>
            <div class="stat-label">Customer Segments</div>
          </div>
          <div class="stat">
            <div class="stat-number">${analysis.opportunity_gaps?.gaps?.length || 0}</div>
            <div class="stat-label">Opportunity Gaps</div>
          </div>
        </div>
      </div>
    </div>`;

  // Sentiment & Demographics
  const segmentsHTML = (analysis.customer_segments?.segments || []).map((segment) => `
    <div class="segment-card">
      <h3>${escapeHTML(segment.name)}</h3>
      <p>${escapeHTML(segment.description)}</p>
      <div class="demographics">
        <span class="demo-tag">Age: ${escapeHTML(segment.demographics?.ageRange || 'N/A')}</span>
        <span class="demo-tag">Income: ${escapeHTML(segment.demographics?.income || 'N/A')}</span>
        <span class="demo-tag">Location: ${escapeHTML(segment.demographics?.location || 'N/A')}</span>
        <span class="demo-tag">Market Share: ${escapeHTML(segment.size || 'N/A')}</span>
      </div>
      <h4>Sentiment Distribution</h4>
      ${generateSentimentBar(
        segment.sentimentDistribution?.positive || 0,
        segment.sentimentDistribution?.neutral || 0,
        segment.sentimentDistribution?.negative || 0
      )}
    </div>`).join('\n');

  const sentimentDemographicsHTML = `
    <div class="section">
      <h2>Sentiment & Demographics</h2>
      ${segmentsHTML || '<p>No segment data available.</p>'}
    </div>`;

  // Pain Points
  const painPointsHTML = `
    <div class="section">
      <h2>Customer Pain Points</h2>
      <div class="pain-points-grid">
        ${(analysis.customer_segments?.segments || []).map((segment) => `
          <div class="pain-card">
            <h3>${escapeHTML(segment.name)}</h3>
            <ul>
              ${(segment.painPoints || []).map((p) => `<li>${escapeHTML(p)}</li>`).join('')}
            </ul>
          </div>`).join('\n')}
      </div>
    </div>`;

  // Motivations
  const motivationsHTML = `
    <div class="section">
      <h2>Customer Motivations</h2>
      <div class="motivations-grid">
        ${(analysis.customer_segments?.segments || []).map((segment) => `
          <div class="motivation-card">
            <h3>${escapeHTML(segment.name)}</h3>
            <ul>
              ${(segment.motivations || []).map((m) => `<li>${escapeHTML(m)}</li>`).join('')}
            </ul>
          </div>`).join('\n')}
      </div>
    </div>`;

  // Customer Avatars / Segments
  const avatarsHTML = (analysis.customer_segments?.avatarProfiles || []).map((avatar) => `
    <div class="avatar-card">
      <div class="avatar-header">
        <h3>${escapeHTML(avatar.name)}</h3>
        <span class="avatar-meta">${avatar.age} years old, ${escapeHTML(avatar.occupation)}</span>
      </div>
      <div class="avatar-body">
        <div class="avatar-section">
          <h4>Goals</h4>
          <ul>${(avatar.goals || []).map((g) => `<li>${escapeHTML(g)}</li>`).join('')}</ul>
        </div>
        <div class="avatar-section">
          <h4>Frustrations</h4>
          <ul>${(avatar.frustrations || []).map((f) => `<li>${escapeHTML(f)}</li>`).join('')}</ul>
        </div>
        <div class="avatar-section">
          <h4>Buying Behavior</h4>
          <p>${escapeHTML(avatar.buyingBehavior || 'N/A')}</p>
        </div>
        <div class="avatar-section">
          <h4>Emotional Drivers</h4>
          <div class="tag-list">
            ${(avatar.emotionalDrivers || []).map((d) => `<span class="tag">${escapeHTML(d)}</span>`).join('')}
          </div>
        </div>
        <div class="avatar-section">
          <h4>Preferred Brands</h4>
          <div class="tag-list">
            ${(avatar.preferredBrands || []).map((b) => `<span class="tag brand">${escapeHTML(b)}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>`).join('\n');

  const customerSegmentsHTML = `
    <div class="section">
      <h2>Customer Segments & Avatars</h2>
      ${avatarsHTML || '<p>No avatar data available.</p>'}
    </div>`;

  // Competitive Landscape
  const leaderboardHTML = (analysis.competitive_positioning?.leaderboard || []).map((comp, i) => `
    <div class="competitor-card">
      <div class="competitor-rank">#${i + 1}</div>
      <div class="competitor-info">
        <h3>${escapeHTML(comp.name)}</h3>
        <p class="positioning">${escapeHTML(comp.positioning || '')}</p>
        <div class="rating-row">
          <span class="rating">Rating: ${comp.averageRating?.toFixed(1) || 'N/A'}/5.0</span>
          <span class="sentiment">Sentiment: ${comp.reviewSentiment ? `${Math.round(comp.reviewSentiment * 100)}%` : 'N/A'}</span>
        </div>
        <div class="strengths-weaknesses">
          <div class="sw-col">
            <h4>Strengths</h4>
            <ul>${(comp.strengths || []).map((s) => `<li class="strength">${escapeHTML(s)}</li>`).join('')}</ul>
          </div>
          <div class="sw-col">
            <h4>Weaknesses</h4>
            <ul>${(comp.weaknesses || []).map((w) => `<li class="weakness">${escapeHTML(w)}</li>`).join('')}</ul>
          </div>
        </div>
      </div>
    </div>`).join('\n');

  const competitiveLandscapeHTML = `
    <div class="section">
      <h2>Competitive Landscape</h2>
      ${leaderboardHTML || '<p>No competitive data available.</p>'}
    </div>`;

  // Opportunity Gaps
  const gapsHTML = (analysis.opportunity_gaps?.gaps || []).map((gap) => `
    <div class="gap-card ${gap.potentialImpact === 'high' ? 'high-impact' : ''}">
      <div class="gap-header">
        <h3>${escapeHTML(gap.title)}</h3>
        <span class="impact-badge impact-${escapeHTML(gap.potentialImpact || 'medium')}">${escapeHTML((gap.potentialImpact || 'medium').toUpperCase())} IMPACT</span>
      </div>
      <p>${escapeHTML(gap.description)}</p>
      <div class="evidence">
        <strong>Evidence:</strong> ${escapeHTML(gap.evidence)}
      </div>
      <div class="action-items">
        <strong>Action Items:</strong>
        <ul>${(gap.actionItems || []).map((a) => `<li>${escapeHTML(a)}</li>`).join('')}</ul>
      </div>
    </div>`).join('\n');

  const opportunityGapsHTML = `
    <div class="section">
      <h2>Opportunity Gaps</h2>
      ${gapsHTML || '<p>No opportunity gaps identified.</p>'}
      ${analysis.opportunity_gaps?.whiteSpaceOpportunities?.length ? `
        <div class="white-space">
          <h3>White Space Opportunities</h3>
          <ul>${analysis.opportunity_gaps.whiteSpaceOpportunities.map((o) => `<li>${escapeHTML(o)}</li>`).join('')}</ul>
        </div>` : ''}
    </div>`;

  // IDEA Framework Insights
  const ideaHTML = `
    <div class="section">
      <h2>IDEA Framework Insights</h2>
      <div class="idea-grid">
        <div class="idea-card idea-insightful">
          <h3>Insightful</h3>
          <p>${escapeHTML(analysis.idea_insights?.insightful?.summary || 'N/A')}</p>
          <ul>${(analysis.idea_insights?.insightful?.findings || []).map((f) => `<li>${escapeHTML(f)}</li>`).join('')}</ul>
        </div>
        <div class="idea-card idea-distinctive">
          <h3>Distinctive</h3>
          <p>${escapeHTML(analysis.idea_insights?.distinctive?.summary || 'N/A')}</p>
          <ul>${(analysis.idea_insights?.distinctive?.strategies || []).map((s) => `<li>${escapeHTML(s)}</li>`).join('')}</ul>
        </div>
        <div class="idea-card idea-empathetic">
          <h3>Empathetic</h3>
          <p>${escapeHTML(analysis.idea_insights?.empathetic?.summary || 'N/A')}</p>
          <ul>${(analysis.idea_insights?.empathetic?.emotionalTriggers || []).map((t) => `<li>${escapeHTML(t)}</li>`).join('')}</ul>
        </div>
        <div class="idea-card idea-authentic">
          <h3>Authentic</h3>
          <p>${escapeHTML(analysis.idea_insights?.authentic?.summary || 'N/A')}</p>
          <ul>${(analysis.idea_insights?.authentic?.trustSignals || []).map((s) => `<li>${escapeHTML(s)}</li>`).join('')}</ul>
        </div>
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Competitive Analysis - ${escapeHTML(brandName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a2e;
      line-height: 1.6;
      background: #ffffff;
    }
    .container { max-width: 850px; margin: 0 auto; padding: 40px; }
    .cover {
      text-align: center;
      padding: 60px 0;
      border-bottom: 4px solid #6366f1;
      margin-bottom: 40px;
    }
    .cover h1 {
      font-size: 36px;
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    .cover .subtitle {
      font-size: 20px;
      color: #6366f1;
      font-weight: 500;
    }
    .cover .market {
      font-size: 16px;
      color: #64748b;
      margin-top: 8px;
    }
    .cover .date {
      font-size: 14px;
      color: #94a3b8;
      margin-top: 12px;
    }
    .section {
      margin-bottom: 36px;
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 24px;
      color: #6366f1;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 20px;
    }
    .summary-box {
      background: #f8fafc;
      border-radius: 12px;
      padding: 24px;
    }
    .summary-box p {
      font-size: 15px;
      margin-bottom: 20px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .stat {
      text-align: center;
      padding: 12px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .stat-number {
      font-size: 28px;
      font-weight: 700;
      color: #6366f1;
    }
    .stat-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .segment-card, .pain-card, .motivation-card {
      background: #f8fafc;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .segment-card h3, .pain-card h3, .motivation-card h3 {
      color: #1e293b;
      margin-bottom: 8px;
    }
    .demographics {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 12px 0;
    }
    .demo-tag {
      background: #e0e7ff;
      color: #4338ca;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 13px;
    }
    .sentiment-bar {
      display: flex;
      height: 28px;
      border-radius: 14px;
      overflow: hidden;
      margin: 8px 0;
    }
    .sentiment-positive {
      background: #22c55e;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
    }
    .sentiment-neutral {
      background: #f59e0b;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
    }
    .sentiment-negative {
      background: #ef4444;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
    }
    .sentiment-legend {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .legend-item { display: flex; align-items: center; gap: 4px; }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot.positive { background: #22c55e; }
    .dot.neutral { background: #f59e0b; }
    .dot.negative { background: #ef4444; }
    ul { padding-left: 20px; margin-top: 8px; }
    li { margin-bottom: 4px; font-size: 14px; }
    .avatar-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    .avatar-header {
      background: #6366f1;
      color: white;
      padding: 16px 20px;
    }
    .avatar-header h3 { color: white; margin-bottom: 2px; }
    .avatar-meta { font-size: 14px; opacity: 0.9; }
    .avatar-body { padding: 20px; }
    .avatar-section { margin-bottom: 16px; }
    .avatar-section h4 {
      font-size: 14px;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag {
      background: #f1f5f9;
      color: #475569;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 13px;
    }
    .tag.brand {
      background: #e0e7ff;
      color: #4338ca;
    }
    .competitor-card {
      display: flex;
      gap: 16px;
      padding: 20px;
      background: #f8fafc;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .competitor-rank {
      font-size: 24px;
      font-weight: 700;
      color: #6366f1;
      min-width: 40px;
    }
    .competitor-info { flex: 1; }
    .competitor-info h3 { margin-bottom: 4px; }
    .positioning { font-size: 14px; color: #64748b; margin-bottom: 8px; }
    .rating-row {
      display: flex;
      gap: 24px;
      font-size: 14px;
      margin-bottom: 12px;
    }
    .rating { color: #f59e0b; font-weight: 600; }
    .sentiment { color: #22c55e; font-weight: 600; }
    .strengths-weaknesses {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .sw-col h4 {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .strength { color: #16a34a; }
    .weakness { color: #dc2626; }
    .gap-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .gap-card.high-impact { border-left: 4px solid #ef4444; }
    .gap-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .impact-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .impact-high { background: #fee2e2; color: #dc2626; }
    .impact-medium { background: #fef3c7; color: #d97706; }
    .impact-low { background: #dcfce7; color: #16a34a; }
    .evidence {
      background: #f1f5f9;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 14px;
      margin: 12px 0;
    }
    .action-items { margin-top: 8px; }
    .white-space {
      background: #f0fdf4;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .idea-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .idea-card {
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid;
    }
    .idea-insightful { background: #eff6ff; border-color: #3b82f6; }
    .idea-distinctive { background: #faf5ff; border-color: #a855f7; }
    .idea-empathetic { background: #fef2f2; border-color: #ef4444; }
    .idea-authentic { background: #f0fdf4; border-color: #22c55e; }
    .idea-card h3 {
      font-size: 16px;
      margin-bottom: 8px;
    }
    .idea-card p {
      font-size: 14px;
      margin-bottom: 8px;
    }
    .footer {
      text-align: center;
      padding: 24px 0;
      border-top: 1px solid #e2e8f0;
      margin-top: 40px;
      font-size: 12px;
      color: #94a3b8;
    }
    @media print {
      .container { padding: 20px; }
      .section { page-break-inside: avoid; }
      .stats-grid { grid-template-columns: repeat(4, 1fr); }
      .idea-grid { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="cover">
      <h1>Competitive Analysis Report</h1>
      <div class="subtitle">${escapeHTML(brandName)}</div>
      <div class="market">${escapeHTML(analysis.market_category || 'Market Analysis')}</div>
      <div class="date">Generated ${escapeHTML(generatedDate)}</div>
    </div>
    ${executiveSummaryHTML}
    ${sentimentDemographicsHTML}
    ${painPointsHTML}
    ${motivationsHTML}
    ${customerSegmentsHTML}
    ${competitiveLandscapeHTML}
    ${opportunityGapsHTML}
    ${ideaHTML}
    <div class="footer">
      Generated by IDEA Brand Coach | ${escapeHTML(generatedDate)}
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

    const { analysisId, brandName = 'My Brand', format = 'html' } = await req.json();

    console.log(`[generate-competitor-analysis-pdf] Generating for user ${user.id}, analysisId: ${analysisId}`);

    // Fetch the analysis data
    let query = supabase
      .from('competitive_analyses')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'completed');

    if (analysisId) {
      query = query.eq('id', analysisId);
    } else {
      query = query.order('created_at', { ascending: false }).limit(1);
    }

    const { data: analyses, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch analysis: ${fetchError.message}`);
    }

    if (!analyses || analyses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No completed competitive analysis found. Please run a competitive analysis first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysis = analyses[0] as AnalysisData;

    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Generate HTML document
    const html = generateCompetitorAnalysisHTML(brandName, analysis, generatedDate);

    if (format === 'html') {
      return new Response(
        JSON.stringify({
          html,
          filename: `competitor-analysis-${brandName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
          metadata: {
            analysisId: analysis.id,
            brandName,
            marketCategory: analysis.market_category,
            generatedDate,
            competitorsAnalyzed: analysis.competitors?.length || 0,
            reviewsAnalyzed: analysis.total_reviews_analyzed || 0,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store in Supabase storage
    const fileName = `competitor-analysis/${user.id}/${Date.now()}.html`;
    const { error: uploadError } = await supabase
      .storage
      .from('documents')
      .upload(fileName, new Blob([html], { type: 'text/html' }), {
        contentType: 'text/html',
        upsert: true,
      });

    if (uploadError) {
      console.error('[generate-competitor-analysis-pdf] Upload error:', uploadError);
    }

    const { data: urlData } = supabase
      .storage
      .from('documents')
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({
        html,
        storageUrl: urlData?.publicUrl || null,
        filename: `competitor-analysis-${brandName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
        metadata: {
          analysisId: analysis.id,
          brandName,
          marketCategory: analysis.market_category,
          generatedDate,
          competitorsAnalyzed: analysis.competitors?.length || 0,
          reviewsAnalyzed: analysis.total_reviews_analyzed || 0,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-competitor-analysis-pdf] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

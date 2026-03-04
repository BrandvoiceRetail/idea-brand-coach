/**
 * Competitive Analysis Types
 *
 * Type definitions for background competitive analysis feature.
 * Maps to competitive_analyses and competitor_reviews database tables.
 */

export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface CompetitorData {
  name: string;
  url?: string;
  category?: string;
}

export interface MarketInsights {
  summary: string;
  trends: string[];
  threats: string[];
}

export interface CustomerSegment {
  name: string;
  description: string;
  size: string;
  needs: string[];
}

export interface CompetitivePositioning {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface OpportunityGap {
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
}

export interface IdeaInsights {
  identify: string[];
  discover: string[];
  execute: string[];
  analyze: string[];
}

export interface CompetitiveAnalysis {
  id: string;
  user_id: string;
  market_category: string;
  analysis_date: string;
  competitors: CompetitorData[];
  total_reviews_analyzed: number;
  market_insights: MarketInsights | null;
  customer_segments: CustomerSegment[] | null;
  competitive_positioning: CompetitivePositioning | null;
  opportunity_gaps: OpportunityGap[] | null;
  idea_insights: IdeaInsights | null;
  status: AnalysisStatus;
  created_at: string;
  updated_at: string;
}

export interface CompetitiveAnalysisCreate {
  market_category: string;
  competitors?: CompetitorData[];
}

export interface CompetitorReview {
  id: string;
  analysis_id: string;
  competitor_name: string;
  source: string;
  review_text: string;
  rating: number | null;
  review_date: string | null;
  verified_purchase: boolean;
  sentiment_score: number | null;
  key_themes: string[];
  created_at: string;
}

export interface AnalysisProgress {
  analysisId: string;
  status: AnalysisStatus;
  competitorsFound: number;
  reviewsAnalyzed: number;
  totalReviews: number;
  currentStep: string;
  percentComplete: number;
}

/**
 * CompetitiveAnalysisService
 *
 * Main orchestration service for background competitive analysis.
 * Triggers edge functions for competitor discovery and review scraping,
 * manages background processing without blocking UI, and updates
 * analysis status when complete.
 *
 * Follows the Service Extraction Pattern from CLAUDE.md:
 * - This service orchestrates the analysis workflow
 * - BackgroundAnalysisMonitor handles progress tracking separately
 * - Each has a single, clear responsibility
 */

import { supabase } from '@/integrations/supabase/client';
import { ICompetitiveAnalysisService } from './interfaces/ICompetitiveAnalysisService';
import {
  CompetitiveAnalysis,
  CompetitiveAnalysisCreate,
  CompetitorReview,
  AnalysisProgress,
  AnalysisStatus,
  CompetitorData,
} from '@/types/competitive-analysis';

export class CompetitiveAnalysisService implements ICompetitiveAnalysisService {
  /**
   * Get current authenticated user ID.
   * @throws Error if user is not authenticated
   */
  private async getUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return user.id;
  }

  /**
   * Get auth session for edge function calls.
   * @throws Error if no active session
   */
  private async getAuthSession(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session found');
    return session.access_token;
  }

  async startAnalysis(data: CompetitiveAnalysisCreate): Promise<CompetitiveAnalysis> {
    const userId = await this.getUserId();

    // 1. Create analysis record with 'pending' status
    const { data: analysis, error: insertError } = await supabase
      .from('competitive_analyses')
      .insert({
        user_id: userId,
        market_category: data.market_category,
        competitors: (data.competitors || []) as unknown as Record<string, unknown>,
        status: 'pending' as const,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[CompetitiveAnalysis] Failed to create analysis:', insertError);
      throw insertError;
    }

    // 2. Trigger background processing via edge function (fire-and-forget)
    this.triggerBackgroundAnalysis(analysis.id as string, data.market_category, data.competitors)
      .catch((error) => {
        console.error('[CompetitiveAnalysis] Background analysis trigger failed:', error);
        // Update status to failed if trigger fails
        this.updateAnalysisStatus(analysis.id as string, 'failed').catch(() => {
          // Silently ignore status update failure
        });
      });

    return this.mapAnalysisFromDb(analysis);
  }

  async getAnalysis(analysisId: string): Promise<CompetitiveAnalysis | null> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('competitive_analyses')
      .select('*')
      .eq('id', analysisId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.mapAnalysisFromDb(data);
  }

  async getAnalyses(): Promise<CompetitiveAnalysis[]> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('competitive_analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map((item) => this.mapAnalysisFromDb(item));
  }

  async getLatestAnalysis(marketCategory: string): Promise<CompetitiveAnalysis | null> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('competitive_analyses')
      .select('*')
      .eq('user_id', userId)
      .eq('market_category', marketCategory)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return this.mapAnalysisFromDb(data);
  }

  async getReviews(analysisId: string): Promise<CompetitorReview[]> {
    // Verify user owns this analysis (RLS handles this, but check for clarity)
    await this.getUserId();

    const { data, error } = await supabase
      .from('competitor_reviews')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data.map((item) => this.mapReviewFromDb(item));
  }

  async getProgress(analysisId: string): Promise<AnalysisProgress> {
    const analysis = await this.getAnalysis(analysisId);
    if (!analysis) {
      throw new Error(`Analysis not found: ${analysisId}`);
    }

    const competitors = analysis.competitors || [];
    const reviewCount = analysis.total_reviews_analyzed;

    // Calculate progress based on status and data completeness
    let percentComplete = 0;
    let currentStep = 'Initializing...';

    switch (analysis.status) {
      case 'pending':
        percentComplete = 5;
        currentStep = 'Queued for processing';
        break;
      case 'processing':
        if (competitors.length === 0) {
          percentComplete = 15;
          currentStep = 'Discovering competitors';
        } else if (reviewCount === 0) {
          percentComplete = 35;
          currentStep = 'Scraping reviews';
        } else if (!analysis.market_insights) {
          percentComplete = 65;
          currentStep = 'Analyzing market insights';
        } else if (!analysis.idea_insights) {
          percentComplete = 85;
          currentStep = 'Generating IDEA framework insights';
        } else {
          percentComplete = 95;
          currentStep = 'Finalizing analysis';
        }
        break;
      case 'completed':
        percentComplete = 100;
        currentStep = 'Analysis complete';
        break;
      case 'failed':
        currentStep = 'Analysis failed';
        break;
    }

    return {
      analysisId: analysis.id,
      status: analysis.status,
      competitorsFound: competitors.length,
      reviewsAnalyzed: reviewCount,
      totalReviews: reviewCount, // Updated as reviews are scraped
      currentStep,
      percentComplete,
    };
  }

  async deleteAnalysis(analysisId: string): Promise<void> {
    const userId = await this.getUserId();

    // Reviews will be cascade deleted via FK constraint
    const { error } = await supabase
      .from('competitive_analyses')
      .delete()
      .eq('id', analysisId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  /**
   * Trigger background analysis via edge function.
   * This is fire-and-forget from the caller's perspective;
   * the edge function updates the database as it progresses.
   */
  private async triggerBackgroundAnalysis(
    analysisId: string,
    marketCategory: string,
    competitors?: CompetitorData[]
  ): Promise<void> {
    const accessToken = await this.getAuthSession();

    // Update status to processing
    await this.updateAnalysisStatus(analysisId, 'processing');

    // Call the analysis orchestrator edge function
    const { error } = await supabase.functions.invoke('competitive-analysis-orchestrator', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        analysis_id: analysisId,
        market_category: marketCategory,
        initial_competitors: competitors || [],
      },
    });

    if (error) {
      console.error('[CompetitiveAnalysis] Edge function error:', error);
      await this.updateAnalysisStatus(analysisId, 'failed');
      throw error;
    }
  }

  /**
   * Update analysis status in the database.
   */
  private async updateAnalysisStatus(
    analysisId: string,
    status: AnalysisStatus
  ): Promise<void> {
    const { error } = await supabase
      .from('competitive_analyses')
      .update({ status })
      .eq('id', analysisId);

    if (error) {
      console.error('[CompetitiveAnalysis] Failed to update status:', error);
    }
  }

  /**
   * Map database row to CompetitiveAnalysis.
   */
  private mapAnalysisFromDb(item: Record<string, unknown>): CompetitiveAnalysis {
    return {
      id: item.id as string,
      user_id: item.user_id as string,
      market_category: item.market_category as string,
      analysis_date: item.analysis_date as string,
      competitors: (item.competitors as CompetitorData[]) || [],
      total_reviews_analyzed: (item.total_reviews_analyzed as number) || 0,
      market_insights: item.market_insights as CompetitiveAnalysis['market_insights'],
      customer_segments: item.customer_segments as CompetitiveAnalysis['customer_segments'],
      competitive_positioning: item.competitive_positioning as CompetitiveAnalysis['competitive_positioning'],
      opportunity_gaps: item.opportunity_gaps as CompetitiveAnalysis['opportunity_gaps'],
      idea_insights: item.idea_insights as CompetitiveAnalysis['idea_insights'],
      status: item.status as AnalysisStatus,
      created_at: item.created_at as string,
      updated_at: item.updated_at as string,
    };
  }

  /**
   * Map database row to CompetitorReview.
   */
  private mapReviewFromDb(item: Record<string, unknown>): CompetitorReview {
    return {
      id: item.id as string,
      analysis_id: item.analysis_id as string,
      competitor_name: item.competitor_name as string,
      source: item.source as string,
      review_text: item.review_text as string,
      rating: item.rating as number | null,
      review_date: item.review_date as string | null,
      verified_purchase: (item.verified_purchase as boolean) || false,
      sentiment_score: item.sentiment_score as number | null,
      key_themes: (item.key_themes as string[]) || [],
      created_at: item.created_at as string,
    };
  }
}

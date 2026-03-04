/**
 * BackgroundAnalysisMonitor
 *
 * Monitors analysis status from the database, provides progress updates,
 * and manages completion notifications. Polls the database at intervals
 * and notifies subscribers when status changes.
 *
 * Follows the Service Extraction Pattern from CLAUDE.md:
 * - Single responsibility: progress tracking only
 * - CompetitiveAnalysisService handles orchestration separately
 */

import { supabase } from '@/integrations/supabase/client';
import { AnalysisProgress, AnalysisStatus } from '@/types/competitive-analysis';

type ProgressCallback = (progress: AnalysisProgress) => void;
type CompletionCallback = (analysisId: string) => void;
type ErrorCallback = (analysisId: string, error: string) => void;

interface MonitorSubscription {
  analysisId: string;
  onProgress: ProgressCallback;
  onComplete?: CompletionCallback;
  onError?: ErrorCallback;
  intervalId: ReturnType<typeof setInterval>;
  lastStatus: AnalysisStatus | null;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export class BackgroundAnalysisMonitor {
  private subscriptions: Map<string, MonitorSubscription> = new Map();

  /**
   * Start monitoring an analysis for progress updates.
   * Polls the database at regular intervals and calls the progress callback
   * whenever the analysis state changes.
   *
   * @param analysisId - The analysis to monitor
   * @param onProgress - Called with updated progress data
   * @param onComplete - Called when analysis reaches 'completed' status
   * @param onError - Called when analysis reaches 'failed' status
   */
  subscribe(
    analysisId: string,
    onProgress: ProgressCallback,
    onComplete?: CompletionCallback,
    onError?: ErrorCallback
  ): void {
    // Unsubscribe existing monitor for this analysis
    this.unsubscribe(analysisId);

    const startTime = Date.now();

    const intervalId = setInterval(async () => {
      // Stop polling after max duration
      if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
        console.warn(`[AnalysisMonitor] Polling timeout for analysis: ${analysisId}`);
        this.unsubscribe(analysisId);
        onError?.(analysisId, 'Analysis monitoring timed out');
        return;
      }

      await this.pollAnalysis(analysisId);
    }, POLL_INTERVAL_MS);

    this.subscriptions.set(analysisId, {
      analysisId,
      onProgress,
      onComplete,
      onError,
      intervalId,
      lastStatus: null,
    });

    // Do an immediate poll
    this.pollAnalysis(analysisId).catch(() => {
      // Silently ignore first poll failure
    });
  }

  /**
   * Stop monitoring an analysis.
   *
   * @param analysisId - The analysis to stop monitoring
   */
  unsubscribe(analysisId: string): void {
    const subscription = this.subscriptions.get(analysisId);
    if (subscription) {
      clearInterval(subscription.intervalId);
      this.subscriptions.delete(analysisId);
    }
  }

  /**
   * Stop monitoring all analyses. Call this on component unmount.
   */
  unsubscribeAll(): void {
    for (const [analysisId] of this.subscriptions) {
      this.unsubscribe(analysisId);
    }
  }

  /**
   * Check if an analysis is currently being monitored.
   */
  isMonitoring(analysisId: string): boolean {
    return this.subscriptions.has(analysisId);
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  /**
   * Poll the database for analysis status and notify subscribers.
   */
  private async pollAnalysis(analysisId: string): Promise<void> {
    const subscription = this.subscriptions.get(analysisId);
    if (!subscription) return;

    try {
      const { data, error } = await supabase
        .from('competitive_analyses')
        .select('id, status, competitors, total_reviews_analyzed, market_insights, idea_insights')
        .eq('id', analysisId)
        .single();

      if (error) {
        console.error(`[AnalysisMonitor] Poll error for ${analysisId}:`, error);
        return;
      }

      const status = data.status as AnalysisStatus;
      const competitors = (data.competitors as unknown[]) || [];
      const reviewCount = (data.total_reviews_analyzed as number) || 0;

      // Calculate progress
      const progress = this.calculateProgress(
        analysisId,
        status,
        competitors.length,
        reviewCount,
        !!data.market_insights,
        !!data.idea_insights
      );

      // Always notify with latest progress
      subscription.onProgress(progress);

      // Check for terminal states
      if (status !== subscription.lastStatus) {
        subscription.lastStatus = status;

        if (status === 'completed') {
          subscription.onComplete?.(analysisId);
          this.unsubscribe(analysisId);
        } else if (status === 'failed') {
          subscription.onError?.(analysisId, 'Analysis processing failed');
          this.unsubscribe(analysisId);
        }
      }
    } catch (error) {
      console.error(`[AnalysisMonitor] Unexpected error polling ${analysisId}:`, error);
    }
  }

  /**
   * Calculate progress percentage and step description from analysis state.
   */
  private calculateProgress(
    analysisId: string,
    status: AnalysisStatus,
    competitorCount: number,
    reviewCount: number,
    hasMarketInsights: boolean,
    hasIdeaInsights: boolean
  ): AnalysisProgress {
    let percentComplete = 0;
    let currentStep = 'Initializing...';

    switch (status) {
      case 'pending':
        percentComplete = 5;
        currentStep = 'Queued for processing';
        break;
      case 'processing':
        if (competitorCount === 0) {
          percentComplete = 15;
          currentStep = 'Discovering competitors';
        } else if (reviewCount === 0) {
          percentComplete = 35;
          currentStep = `Found ${competitorCount} competitors, scraping reviews...`;
        } else if (!hasMarketInsights) {
          percentComplete = 65;
          currentStep = `Analyzed ${reviewCount} reviews, generating insights...`;
        } else if (!hasIdeaInsights) {
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
      analysisId,
      status,
      competitorsFound: competitorCount,
      reviewsAnalyzed: reviewCount,
      totalReviews: reviewCount,
      currentStep,
      percentComplete,
    };
  }
}

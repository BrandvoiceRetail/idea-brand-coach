/**
 * ICompetitiveAnalysisService Interface
 *
 * Abstract contract for background competitive analysis operations.
 * This abstraction allows us to switch out implementations as downstream
 * dependencies evolve without impacting application code.
 *
 * Current implementation:
 * - CompetitiveAnalysisService: Orchestrates background analysis via Supabase Edge Functions
 */

import {
  CompetitiveAnalysis,
  CompetitiveAnalysisCreate,
  CompetitorReview,
  AnalysisProgress,
} from '@/types/competitive-analysis';

export interface ICompetitiveAnalysisService {
  /**
   * Start a new competitive analysis in the background.
   * Creates the analysis record and triggers edge functions for
   * competitor discovery and review scraping.
   *
   * @param data - Analysis creation data (market category, optional competitors)
   * @returns Promise resolving to the created analysis with 'pending' status
   * @throws Error if analysis cannot be created or user is not authenticated
   */
  startAnalysis(data: CompetitiveAnalysisCreate): Promise<CompetitiveAnalysis>;

  /**
   * Get an analysis by ID.
   *
   * @param analysisId - The analysis ID
   * @returns Promise resolving to the analysis or null if not found
   * @throws Error if query fails
   */
  getAnalysis(analysisId: string): Promise<CompetitiveAnalysis | null>;

  /**
   * Get all analyses for the current user.
   * Results are ordered by creation date (newest first).
   *
   * @returns Promise resolving to array of analyses
   * @throws Error if query fails
   */
  getAnalyses(): Promise<CompetitiveAnalysis[]>;

  /**
   * Get the most recent analysis for a market category.
   *
   * @param marketCategory - The market category to search
   * @returns Promise resolving to the most recent analysis or null
   * @throws Error if query fails
   */
  getLatestAnalysis(marketCategory: string): Promise<CompetitiveAnalysis | null>;

  /**
   * Get reviews for a specific analysis.
   *
   * @param analysisId - The analysis ID
   * @returns Promise resolving to array of competitor reviews
   * @throws Error if query fails
   */
  getReviews(analysisId: string): Promise<CompetitorReview[]>;

  /**
   * Get current progress for an in-progress analysis.
   *
   * @param analysisId - The analysis ID
   * @returns Promise resolving to progress data
   * @throws Error if analysis not found
   */
  getProgress(analysisId: string): Promise<AnalysisProgress>;

  /**
   * Delete an analysis and all associated reviews.
   *
   * @param analysisId - The analysis ID
   * @returns Promise resolving when deleted
   * @throws Error if delete fails
   */
  deleteAnalysis(analysisId: string): Promise<void>;
}

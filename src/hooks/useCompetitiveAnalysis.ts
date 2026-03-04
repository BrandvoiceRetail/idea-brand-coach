/**
 * useCompetitiveAnalysis Hook
 *
 * React hook wrapping CompetitiveAnalysisService for component consumption.
 * Provides analysis state, progress polling, loading/error states, and
 * auto-trigger capability when the user reaches the research phase.
 *
 * Updates BrandContext when a completed analysis is available.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { CompetitiveAnalysisService } from '@/services/CompetitiveAnalysisService';
import type {
  CompetitiveAnalysis,
  CompetitiveAnalysisCreate,
  CompetitorReview,
  AnalysisProgress,
  AnalysisStatus,
} from '@/types/competitive-analysis';

/** Polling interval for in-progress analyses (10 seconds) */
const POLL_INTERVAL_MS = 10_000;

interface UseCompetitiveAnalysisResult {
  /** Current analysis record, or null if none exists */
  analysis: CompetitiveAnalysis | null;
  /** All analyses for the current user */
  analyses: CompetitiveAnalysis[];
  /** Reviews for the current analysis */
  reviews: CompetitorReview[];
  /** Progress data for an in-progress analysis */
  progress: AnalysisProgress | null;
  /** Current analysis status shortcut */
  status: AnalysisStatus | null;
  /** True while any data is being fetched */
  isLoading: boolean;
  /** True while an analysis is actively running (pending or processing) */
  isAnalyzing: boolean;
  /** True when the current analysis has completed successfully */
  isComplete: boolean;
  /** Last error message, or null */
  error: string | null;
  /** Start a new competitive analysis */
  startAnalysis: (data: CompetitiveAnalysisCreate) => Promise<void>;
  /** Refresh current analysis data from the server */
  refreshAnalysis: (analysisId: string) => Promise<void>;
  /** Load the latest analysis for a given market category */
  loadLatestAnalysis: (marketCategory: string) => Promise<void>;
  /** Delete an analysis */
  deleteAnalysis: (analysisId: string) => Promise<void>;
  /** Load reviews for the current analysis */
  loadReviews: (analysisId: string) => Promise<void>;
}

export function useCompetitiveAnalysis(): UseCompetitiveAnalysisResult {
  const { user } = useAuth();
  const { updateBrandData } = useBrand();

  const service = useMemo(() => new CompetitiveAnalysisService(), []);

  const [analysis, setAnalysis] = useState<CompetitiveAnalysis | null>(null);
  const [analyses, setAnalyses] = useState<CompetitiveAnalysis[]>([]);
  const [reviews, setReviews] = useState<CompetitorReview[]>([]);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Derived state
  const status = analysis?.status ?? null;
  const isAnalyzing = status === 'pending' || status === 'processing';
  const isComplete = status === 'completed';

  // --------------------------------------------------
  // Cleanup
  // --------------------------------------------------

  const stopPolling = useCallback((): void => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  // --------------------------------------------------
  // Sync completed analysis to BrandContext
  // --------------------------------------------------

  useEffect(() => {
    if (isComplete && analysis) {
      updateBrandData('distinctive', {
        completed: true,
      });
    }
  }, [isComplete, analysis, updateBrandData]);

  // --------------------------------------------------
  // Progress polling for in-progress analyses
  // --------------------------------------------------

  const pollProgress = useCallback(async (analysisId: string): Promise<void> => {
    try {
      const progressData = await service.getProgress(analysisId);
      if (!isMountedRef.current) return;

      setProgress(progressData);

      // If analysis finished, fetch the full record and stop polling
      if (progressData.status === 'completed' || progressData.status === 'failed') {
        stopPolling();
        const updatedAnalysis = await service.getAnalysis(analysisId);
        if (!isMountedRef.current) return;

        setAnalysis(updatedAnalysis);

        if (progressData.status === 'completed') {
          toast.success('Competitive analysis complete!');
        } else {
          toast.error('Competitive analysis failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('[useCompetitiveAnalysis] Poll error:', err);
    }
  }, [service, stopPolling]);

  const startPolling = useCallback((analysisId: string): void => {
    stopPolling();
    // Immediate first poll
    pollProgress(analysisId);
    pollTimerRef.current = setInterval(() => {
      pollProgress(analysisId);
    }, POLL_INTERVAL_MS);
  }, [stopPolling, pollProgress]);

  // --------------------------------------------------
  // Public actions
  // --------------------------------------------------

  const startAnalysis = useCallback(async (data: CompetitiveAnalysisCreate): Promise<void> => {
    if (!user) {
      setError('You must be signed in to run an analysis.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const created = await service.startAnalysis(data);
      if (!isMountedRef.current) return;

      setAnalysis(created);
      setProgress({
        analysisId: created.id,
        status: created.status,
        competitorsFound: 0,
        reviewsAnalyzed: 0,
        totalReviews: 0,
        currentStep: 'Queued for processing',
        percentComplete: 5,
      });

      toast.success('Competitive analysis started. This may take a few minutes.');
      startPolling(created.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start analysis.';
      if (isMountedRef.current) {
        setError(message);
        toast.error(message);
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [user, service, startPolling]);

  const refreshAnalysis = useCallback(async (analysisId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const fetched = await service.getAnalysis(analysisId);
      if (!isMountedRef.current) return;

      setAnalysis(fetched);

      if (fetched && (fetched.status === 'pending' || fetched.status === 'processing')) {
        startPolling(analysisId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load analysis.';
      if (isMountedRef.current) setError(message);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [service, startPolling]);

  const loadLatestAnalysis = useCallback(async (marketCategory: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const latest = await service.getLatestAnalysis(marketCategory);
      if (!isMountedRef.current) return;

      setAnalysis(latest);

      if (latest && (latest.status === 'pending' || latest.status === 'processing')) {
        startPolling(latest.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load latest analysis.';
      if (isMountedRef.current) setError(message);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [service, startPolling]);

  const deleteAnalysis = useCallback(async (analysisId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await service.deleteAnalysis(analysisId);
      if (!isMountedRef.current) return;

      stopPolling();
      setAnalysis(null);
      setProgress(null);
      setReviews([]);
      setAnalyses((prev) => prev.filter((a) => a.id !== analysisId));
      toast.success('Analysis deleted.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete analysis.';
      if (isMountedRef.current) {
        setError(message);
        toast.error(message);
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [service, stopPolling]);

  const loadReviews = useCallback(async (analysisId: string): Promise<void> => {
    try {
      const data = await service.getReviews(analysisId);
      if (isMountedRef.current) setReviews(data);
    } catch (err) {
      console.error('[useCompetitiveAnalysis] Failed to load reviews:', err);
    }
  }, [service]);

  // --------------------------------------------------
  // Auto-load analyses list when user is authenticated
  // --------------------------------------------------

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const loadAnalyses = async (): Promise<void> => {
      try {
        const data = await service.getAnalyses();
        if (!cancelled && isMountedRef.current) {
          setAnalyses(data);
        }
      } catch (err) {
        console.error('[useCompetitiveAnalysis] Failed to load analyses:', err);
      }
    };

    loadAnalyses();

    return () => {
      cancelled = true;
    };
  }, [user, service]);

  return {
    analysis,
    analyses,
    reviews,
    progress,
    status,
    isLoading,
    isAnalyzing,
    isComplete,
    error,
    startAnalysis,
    refreshAnalysis,
    loadLatestAnalysis,
    deleteAnalysis,
    loadReviews,
  };
}

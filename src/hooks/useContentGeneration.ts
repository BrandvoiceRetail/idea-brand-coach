/**
 * useContentGeneration — drives one piece's generation lifecycle.
 *
 * start() routes to the right provider; for async jobs (Pixii images, Palmier
 * video) it then polls every 5s until completed/failed. Copy (Claude) completes
 * synchronously, as does a Palmier brief (parked when Palmier isn't reachable).
 * The poll timer is cleaned up on unmount and on reset().
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SupabaseContentGenerationService } from '@/services/SupabaseContentGenerationService';
import type { SaveToFunnelInput } from '@/services/interfaces/IContentGenerationService';
import type { ContentProvider, GenerationJob, GenerationStartInput } from '@/services/contentGeneration/types';
import type { Result, BrandAsset } from '@/services/interfaces/IBrandFunnelService';

const POLL_INTERVAL_MS = 5000;

interface UseContentGeneration {
  job: GenerationJob | null;
  generating: boolean;
  error: string | null;
  start: (input: GenerationStartInput) => Promise<void>;
  save: (input: SaveToFunnelInput) => Promise<Result<BrandAsset>>;
  reset: () => void;
}

export function useContentGeneration(): UseContentGeneration {
  const service = useMemo(() => new SupabaseContentGenerationService(), []);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const pollLoop = useCallback(async (jobId: string, provider: ContentProvider): Promise<void> => {
    const { data, error: pollErr } = await service.poll(jobId, provider);
    if (cancelled.current) return;
    if (pollErr || !data) {
      setError(pollErr?.message ?? 'Polling failed');
      setGenerating(false);
      return;
    }
    setJob(data);
    if (data.status === 'completed' || data.status === 'failed') {
      setGenerating(false);
      if (data.status === 'failed') setError(data.error?.message ?? 'Generation failed');
      return;
    }
    timer.current = setTimeout(() => void pollLoop(jobId, provider), POLL_INTERVAL_MS);
  }, [service]);

  const start = useCallback(async (input: GenerationStartInput): Promise<void> => {
    cancelled.current = false;
    clearTimer();
    setError(null);
    setJob(null);
    setGenerating(true);
    const { data, error: startErr } = await service.start(input);
    if (cancelled.current) return;
    if (startErr || !data) {
      setError(startErr?.message ?? 'Generation failed');
      setGenerating(false);
      return;
    }
    setJob(data);
    const terminal = data.status === 'completed' || data.status === 'failed';
    // Pixii polls while non-terminal; Palmier polls only an in-flight ('processing')
    // job — a Palmier brief (status 'pending') is terminal-for-now, nothing to poll.
    const shouldPoll =
      (data.provider === 'pixii' && !terminal) ||
      (data.provider === 'palmier' && data.status === 'processing');
    if (shouldPoll && data.jobId) {
      void pollLoop(data.jobId, data.provider); // poll immediately, then every 5s
    } else {
      setGenerating(false);
      if (data.status === 'failed') setError(data.error?.message ?? 'Generation failed');
    }
  }, [service, pollLoop, clearTimer]);

  const reset = useCallback((): void => {
    cancelled.current = true;
    clearTimer();
    setJob(null);
    setError(null);
    setGenerating(false);
  }, [clearTimer]);

  const save = useCallback(
    (input: SaveToFunnelInput): Promise<Result<BrandAsset>> => service.saveToFunnel(input),
    [service],
  );

  // Stop polling if the component unmounts mid-job.
  useEffect(() => () => {
    cancelled.current = true;
    clearTimer();
  }, [clearTimer]);

  return { job, generating, error, start, save, reset };
}

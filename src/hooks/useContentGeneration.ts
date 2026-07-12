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
// Stop polling after this many attempts (~7.5 min at 5s). A job stuck in a
// non-terminal status — an unreachable local video app, or a hung upstream that
// keeps returning 'processing' — must not poll forever; it surfaces a timeout.
const MAX_POLL_ATTEMPTS = 90;

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
  // Monotonic run token: each start()/reset()/unmount bumps it, so an in-flight
  // poll or start from a superseded run bails instead of writing stale state. A
  // single boolean is unsafe here — a new start() flipping it back to false would
  // un-cancel an already-in-flight poll from the previous run; a token can't be.
  const runId = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const pollLoop = useCallback(async (jobId: string, provider: ContentProvider, run: number, attempt: number): Promise<void> => {
    const { data, error: pollErr } = await service.poll(jobId, provider);
    if (run !== runId.current) return; // superseded by a newer run / reset / unmount
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
    if (attempt >= MAX_POLL_ATTEMPTS) {
      setError('Generation is taking longer than expected — please try again.');
      setGenerating(false);
      return;
    }
    timer.current = setTimeout(() => void pollLoop(jobId, provider, run, attempt + 1), POLL_INTERVAL_MS);
  }, [service]);

  const start = useCallback(async (input: GenerationStartInput): Promise<void> => {
    const run = runId.current + 1;
    runId.current = run;
    clearTimer();
    setError(null);
    setJob(null);
    setGenerating(true);
    const { data, error: startErr } = await service.start(input);
    if (run !== runId.current) return; // a newer start()/reset() superseded this one
    if (startErr || !data) {
      setError(startErr?.message ?? 'Generation failed');
      setGenerating(false);
      return;
    }
    setJob(data);
    const terminal = data.status === 'completed' || data.status === 'failed';
    // Pixii + fal poll while non-terminal; Palmier polls only an in-flight
    // ('processing') job — a Palmier brief (status 'pending') is terminal-for-now.
    const shouldPoll =
      ((data.provider === 'pixii' || data.provider === 'fal') && !terminal) ||
      (data.provider === 'palmier' && data.status === 'processing');
    if (shouldPoll && data.jobId) {
      void pollLoop(data.jobId, data.provider, run, 1); // poll immediately, then every 5s
    } else {
      setGenerating(false);
      if (data.status === 'failed') setError(data.error?.message ?? 'Generation failed');
    }
  }, [service, pollLoop, clearTimer]);

  const reset = useCallback((): void => {
    runId.current += 1; // invalidate any in-flight poll/start
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
    runId.current += 1;
    clearTimer();
  }, [clearTimer]);

  return { job, generating, error, start, save, reset };
}

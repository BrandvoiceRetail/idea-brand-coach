import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useForensicAvatarBuild } from '../useForensicAvatarBuild';
import type { StageRunResult } from '@/types/forensicBuild';

// Mock the service so the hook's run orchestration is the unit under test.
const { runStage, recordBuildState, getBuildState, getStageArtifact } = vi.hoisted(() => ({
  runStage: vi.fn(),
  recordBuildState: vi.fn(),
  getBuildState: vi.fn(),
  getStageArtifact: vi.fn(),
}));

vi.mock('@/services/ForensicBuildService', () => ({
  ForensicBuildService: class {
    runStage = runStage;
    recordBuildState = recordBuildState;
    getBuildState = getBuildState;
    getStageArtifact = getStageArtifact;
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ok = (stage: string): StageRunResult =>
  ({ status: 'ok', stage, content: { rows: [{}] } } as unknown as StageRunResult);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useForensicAvatarBuild — parallel stop precedence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordBuildState.mockResolvedValue(undefined);
    getBuildState.mockResolvedValue(null);
    getStageArtifact.mockResolvedValue(null);
  });

  it('surfaces a hard failure over a needs_input when s3/s4 both stop', async () => {
    // s1, s2 ok; s3 needs_input, s4 failed (parallel). The run must surface the
    // FAILURE (more actionable) and NOT record the build as built.
    runStage.mockImplementation((stage: string) => {
      if (stage === 's1' || stage === 's2') return Promise.resolve(ok(stage));
      if (stage === 's3') return Promise.resolve({ status: 'needs_input', stage: 's3', needs_input: [{ field: 'reviews', reason: 'thin' }] } as unknown as StageRunResult);
      return Promise.resolve({ status: 'failed', stage: 's4', error: 'edge 500' } as unknown as StageRunResult);
    });

    const { result } = renderHook(() => useForensicAvatarBuild('avatar-1'), { wrapper });

    await act(async () => {
      await result.current.runBuild('some reviews');
    });

    await waitFor(() => expect(result.current.isRunning).toBe(false));

    expect(result.current.runError).toBe('edge 500');
    expect(result.current.needsInput).toBeNull();
    expect(recordBuildState).not.toHaveBeenCalledWith('avatar-1', expect.anything(), 'built');
  });

  it('records built and surfaces no stop reason on a full S1→S4 pass', async () => {
    runStage.mockImplementation((stage: string) => Promise.resolve(ok(stage)));

    const { result } = renderHook(() => useForensicAvatarBuild('avatar-1'), { wrapper });

    await act(async () => {
      await result.current.runBuild('some reviews');
    });

    await waitFor(() => expect(result.current.isRunning).toBe(false));

    expect(result.current.runError).toBeNull();
    expect(result.current.needsInput).toBeNull();
    expect(recordBuildState).toHaveBeenCalledWith('avatar-1', expect.arrayContaining(['s1', 's2', 's3', 's4']), 'built');
  });
});

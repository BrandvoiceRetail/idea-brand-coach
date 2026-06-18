import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForensicBuildService } from '../ForensicBuildService';
import { supabase } from '@/integrations/supabase/client';

const AUTH_USER = { id: 'user-1' };
const AVATAR_ID = 'avatar-1';

/** Mock `artifacts` reads (gatherPrior) and `avatars` brand lookup. */
function mockTableReads(priorByStage: Record<string, unknown> = {}): void {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'avatars') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { brand_id: 'brand-1' }, error: null }),
          }),
        }),
      } as never;
    }
    // artifacts read (kind→content), keyed off the requested kind via eq chain
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn((_col: string, kind: string) => ({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: priorByStage[kind] ? { content: priorByStage[kind] } : null,
                error: null,
              }),
            }),
          }),
        })),
      }),
    } as never;
  });
}

describe('ForensicBuildService', () => {
  let service: ForensicBuildService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ForensicBuildService();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: AUTH_USER }, error: null } as never);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { id: 'art-1' }, error: null } as never);
  });

  it('runStage s1 invokes avatar-vocabulary with { reviews, prior } and persists via the chain', async () => {
    mockTableReads();
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { clusters: [{ cluster: 'Protection', customer_words: ['scratch'], frequency_signal: 'High', why_it_matters: 'loss aversion' }] },
      error: null,
    } as never);

    const result = await service.runStage('s1', AVATAR_ID, 'the reviews');

    expect(result.status).toBe('ok');
    const invokeCall = vi.mocked(supabase.functions.invoke).mock.calls[0];
    expect(invokeCall[0]).toBe('avatar-vocabulary');
    expect((invokeCall[1] as { body: { reviews: string; prior: object } }).body).toEqual({ reviews: 'the reviews', prior: {} });
    // persisted via save_artifact_atomic (the artifact chain / re-run supersede)
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('save_artifact_atomic', expect.objectContaining({
      p_kind: 'avatar_s1_vocab', p_avatar_id: AVATAR_ID, p_grounding: 'evidence',
    }));
  });

  it('keys prior BY STAGE ID (prior.s1) for s2', async () => {
    mockTableReads({ avatar_s1_vocab: { clusters: [{ cluster: 'X', customer_words: ['x'], frequency_signal: 'High', why_it_matters: 'y' }] } });
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { job_map: [{ functional_job: 'f', emotional_job: 'e', identity_job: 'i', villain: 'v' }] },
      error: null,
    } as never);

    await service.runStage('s2', AVATAR_ID, 'reviews');

    const body = (vi.mocked(supabase.functions.invoke).mock.calls[0][1] as { body: { prior: Record<string, unknown> } }).body;
    expect(body.prior).toHaveProperty('s1');
    expect(body.prior).not.toHaveProperty('avatar_s1_vocab');
  });

  it('surfaces needs_input on an HTTP-200 needs_input body (grounding gap, not failure)', async () => {
    mockTableReads();
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { needs_input: [{ slot: 1, question: 'paste reviews', why: 'evidence' }] },
      error: null,
    } as never);

    const result = await service.runStage('s1', AVATAR_ID, '');
    expect(result.status).toBe('needs_input');
    if (result.status === 'needs_input') expect(result.needs_input[0].slot).toBe(1);
    // never persists on needs_input
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalled();
  });

  it('treats an in-body error (insufficient grounding) as a retryable failure', async () => {
    mockTableReads();
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { error: 'insufficient grounding' },
      error: null,
    } as never);

    const result = await service.runStage('s1', AVATAR_ID, 'reviews');
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.error).toContain('insufficient grounding');
    // retried (max 2) → 3 invocations
    expect(vi.mocked(supabase.functions.invoke)).toHaveBeenCalledTimes(3);
  });

  it('recordBuildState upserts approved with approved_at stamped', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    await service.recordBuildState(AVATAR_ID, ['s1', 's2', 's3', 's4'], 'approved');

    const row = upsert.mock.calls[0][0] as { status: string; approved_at: string | null; user_id: string };
    expect(row.status).toBe('approved');
    expect(row.approved_at).not.toBeNull();
    expect(row.user_id).toBe(AUTH_USER.id);
  });
});

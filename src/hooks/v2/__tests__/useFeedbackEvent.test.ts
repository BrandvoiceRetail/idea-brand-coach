import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFeedbackEvent } from '../useFeedbackEvent';
import { supabase } from '@/integrations/supabase/client';

const invoke = vi.mocked(supabase.functions.invoke);

describe('useFeedbackEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes save-feedback-event with moment, session_id and payload', async () => {
    invoke.mockResolvedValue({ data: { id: 'evt-1' }, error: null } as never);
    const { result } = renderHook(() => useFeedbackEvent());

    let res: { ok: boolean; id?: string } | undefined;
    await act(async () => {
      res = await result.current.recordEvent({
        moment: 'moment_1',
        sessionId: 'sess-9',
        payload: { chosen_signature: 'X', scores: { score_felt_right: 'yes' }, free_text: 'good' },
      });
    });

    expect(invoke).toHaveBeenCalledWith('save-feedback-event', {
      body: {
        moment: 'moment_1',
        session_id: 'sess-9',
        payload: { chosen_signature: 'X', scores: { score_felt_right: 'yes' }, free_text: 'good' },
      },
    });
    expect(res).toEqual({ ok: true, id: 'evt-1' });
  });

  it('sends session_id null when none provided', async () => {
    invoke.mockResolvedValue({ data: { id: 'evt-2' }, error: null } as never);
    const { result } = renderHook(() => useFeedbackEvent());

    await act(async () => {
      await result.current.recordEvent({ moment: 'moment_1', payload: { skipped: true } });
    });

    expect(invoke).toHaveBeenCalledWith('save-feedback-event', {
      body: { moment: 'moment_1', session_id: null, payload: { skipped: true } },
    });
  });

  it('returns ok:false and sets error without throwing when the write fails', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'boom' } } as never);
    const { result } = renderHook(() => useFeedbackEvent());

    let res: { ok: boolean } | undefined;
    await act(async () => {
      res = await result.current.recordEvent({ moment: 'moment_1', payload: {} });
    });

    expect(res).toEqual({ ok: false });
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  it('toggles isSubmitting around the write', async () => {
    let resolveInvoke: (v: unknown) => void = () => {};
    invoke.mockReturnValue(new Promise((r) => { resolveInvoke = r; }) as never);
    const { result } = renderHook(() => useFeedbackEvent());

    let p: Promise<unknown>;
    act(() => { p = result.current.recordEvent({ moment: 'moment_1', payload: {} }); });
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));

    await act(async () => {
      resolveInvoke({ data: { id: 'x' }, error: null });
      await p;
    });
    expect(result.current.isSubmitting).toBe(false);
  });
});

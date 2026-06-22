import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDeliverable } from '../generate';
import { buildFocusQueue, SEED_SNAPSHOT } from '../engine';

const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

const focus = buildFocusQueue(SEED_SNAPSHOT)[0]; // Recognition fix

beforeEach(() => invoke.mockReset());

describe('generateDeliverable', () => {
  it('returns AI copy (live) when brand-copy-generator succeeds, grounded by the focus', async () => {
    invoke.mockResolvedValue({ data: { copy: 'Finally, a binder you can actually trust.' }, error: null });
    const { deliverable, live } = await generateDeliverable({ focus, snapshot: SEED_SNAPSHOT, mode: 'diy-listing', idea: 'lean into the guarantee' });
    expect(live).toBe(true);
    expect(deliverable.body).toMatch(/Finally, a binder/);
    // it called the deployed generator with a real format + grounded context
    expect(invoke).toHaveBeenCalledWith('brand-copy-generator', expect.objectContaining({
      body: expect.objectContaining({ format: 'amazon-bullet' }),
    }));
    const sentContext = invoke.mock.calls[0][1].body.additionalContext as string;
    expect(sentContext).toMatch(/Recognition/);
    expect(sentContext).toMatch(/Dove/);
    expect(sentContext).toMatch(/lean into the guarantee/);
  });

  it('falls back to the deterministic template on edge-fn error (never throws, never blocks)', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'needs_upgrade' } });
    const { deliverable, live } = await generateDeliverable({ focus, snapshot: SEED_SNAPSHOT, mode: 'diy-listing' });
    expect(live).toBe(false);
    expect(deliverable.body.length).toBeGreaterThan(20); // the template still produced something usable
  });

  it('falls back when the edge fn returns no copy', async () => {
    invoke.mockResolvedValue({ data: {}, error: null });
    const { deliverable, live } = await generateDeliverable({ focus, snapshot: SEED_SNAPSHOT, mode: 'competitor' });
    expect(live).toBe(false);
    expect(deliverable.body.length).toBeGreaterThan(20);
  });

  it('canvas mode stays deterministic (no copy fn fits) — does not call the edge fn', async () => {
    const canvasFocus = { ...focus, modes: ['canvas' as const] };
    const { live } = await generateDeliverable({ focus: canvasFocus, snapshot: SEED_SNAPSHOT, mode: 'canvas' });
    expect(live).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import {
  V4ContextProvider,
  useV4Context,
  V4_SLOTS,
  type V4ContextValue,
} from '../V4ContextStore';

/**
 * The store persists via the shared FieldSyncService stack (user_knowledge_base).
 * We mock useFieldSync with a stateful in-memory fake so these tests assert the
 * store's CONTRACT — write-through, inferred-vs-stated promotion, allFilled, reset,
 * subset status, and the one-time legacy-localStorage migration — without touching
 * IndexedDB/Supabase. (Mirrors how the real hook updates value + re-renders.)
 */
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/useFieldSync', async () => {
  const React = await import('react');
  return {
    useFieldSync: ({ defaultValue }: { defaultValue: unknown }) => {
      const [value, setValue] = React.useState(defaultValue);
      return { value, onChange: setValue, isLoading: false, syncStatus: 'synced', error: null, refresh: vi.fn() };
    },
  };
});

let ctx: V4ContextValue;
function Capture(): null {
  ctx = useV4Context();
  return null;
}

function renderStore(): void {
  render(
    <V4ContextProvider>
      <Capture />
    </V4ContextProvider>,
  );
}

describe('V4ContextStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('starts empty — every slot missing, nothing satisfied', () => {
    renderStore();
    expect(ctx.allFilled).toBe(false);
    expect(ctx.fillMap).toHaveLength(V4_SLOTS.length);
    expect(ctx.fillMap.every((s) => s.status === 'missing')).toBe(true);
    expect(ctx.contextCard).toHaveLength(0);
  });

  it('persists a manual answer as filled-stated (write-through)', () => {
    renderStore();
    act(() => ctx.provideContext([{ key: 'brand_name', value: 'RestWell' }]));
    const slot = ctx.fillMap.find((s) => s.key === 'brand_name')!;
    expect(slot.status).toBe('filled-stated');
    expect(slot.value).toBe('RestWell');
    expect(slot.source).toBe('manual');
  });

  it('flips allFilled once every slot is satisfied', () => {
    renderStore();
    act(() => ctx.provideContext(V4_SLOTS.map((s) => ({ key: s.key, value: 'x' }))));
    expect(ctx.allFilled).toBe(true);
    expect(ctx.contextCard).toHaveLength(V4_SLOTS.length);
  });

  it('keeps bare megaprompt extraction as filled-inferred (not yet satisfied)', () => {
    renderStore();
    act(() => ctx.provideContext([{ key: 'product', value: 'sleep aid', source: 'megaprompt' }]));
    const slot = ctx.fillMap.find((s) => s.key === 'product')!;
    expect(slot.status).toBe('filled-inferred');
    // inferred is NOT satisfied → still surfaced as needs-input until confirmed
    expect(ctx.needsInput.some((s) => s.key === 'product')).toBe(true);
  });

  it('promotes an inferred slot to stated on confirm', () => {
    renderStore();
    act(() => ctx.provideContext([{ key: 'product', value: 'sleep aid', source: 'megaprompt', confirm: true }]));
    expect(ctx.fillMap.find((s) => s.key === 'product')!.status).toBe('filled-stated');
  });

  it('getContextStatus resolves a subset', () => {
    renderStore();
    act(() => ctx.provideContext([{ key: 'brand_name', value: 'X' }]));
    const sub = ctx.getContextStatus(['brand_name']);
    expect(sub.fillMap).toHaveLength(1);
    expect(sub.allFilled).toBe(true);
  });

  it('reset clears the store', () => {
    renderStore();
    act(() => ctx.provideContext([{ key: 'goal', value: 'grow repeat orders' }]));
    expect(ctx.contextCard.length).toBeGreaterThan(0);
    act(() => ctx.reset());
    expect(ctx.allFilled).toBe(false);
    expect(ctx.contextCard).toHaveLength(0);
  });

  it('migrates pre-sync localStorage context into the store on first load', async () => {
    localStorage.setItem(
      'idea.v4.context.user-1',
      JSON.stringify({ brand_name: { value: 'Legacy Co', status: 'filled-stated', source: 'manual' } }),
    );
    renderStore();
    await waitFor(() => {
      expect(ctx.fillMap.find((s) => s.key === 'brand_name')!.value).toBe('Legacy Co');
    });
  });
});

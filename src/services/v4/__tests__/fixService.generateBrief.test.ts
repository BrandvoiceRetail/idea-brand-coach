import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * generateBrief MUST resolve the brand positioning and PASS it to the export-brief
 * engine — the app used to send only {touchpoint_id, avatar_id, context}, so the
 * engine always hit its "create a Signature first" wall and the on-brand rewrite
 * never worked. These tests lock the resolution: a real Signature is forwarded, and
 * when no Signature/Canvas exists the avatar profile is forwarded as a degrade root
 * (so the brief still generates instead of walling).
 *
 * The supabase client is mocked as a tiny chainable builder whose terminal
 * `maybeSingle()` returns per-table data via `responders`.
 */
type Filters = Record<string, unknown>;
const responders: Record<string, (f: Filters) => unknown> = {};

function builder(table: string) {
  const filters: Filters = {};
  const b: Record<string, unknown> = {
    select: () => b,
    eq: (col: string, v: unknown) => ((filters[col] = v), b),
    is: (col: string, v: unknown) => ((filters[col] = v), b),
    order: () => b,
    limit: () => b,
    maybeSingle: async () => ({ data: responders[table]?.(filters) ?? null, error: null }),
  };
  return b;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => builder(t) },
}));

import { FixService } from '@/services/v4/fixService';
import type { IBrandFunnelService } from '@/services/interfaces/IBrandFunnelService';

const VALID_BRIEF = {
  title_formula: { brief: 'Lead with the trigger', example_output: 'BrandX — Holds Your Cards' },
  bullets: [{ element: 'BULLET 1', brief: 'b', example_output: 'o' }],
  image_brief: [{ slot: 'Hero', intent: 'i', brief: 'b' }],
  ppc_keywords: { tier_a: ['x'], tier_b: ['y'], tier_c: ['z'] },
  product_truth_claims: [],
};

const noFunnel = {} as unknown as IBrandFunnelService;

beforeEach(() => {
  for (const k of Object.keys(responders)) delete responders[k];
  responders.artifacts = () => null; // no canvas / s1 / s3 / s4 by default
});

describe('FixService.generateBrief — resolves + forwards positioning', () => {
  it('forwards the chosen Signature (and empty claims) to the engine', async () => {
    responders.signatures = (f) =>
      f.avatar_id === 'av1'
        ? { signature_text: "They're not buying a binder — they're buying calm", all_options: ['a', 'b'] }
        : null;

    const invoke = vi.fn(async () => ({ data: VALID_BRIEF, error: null }));
    const svc = new FixService(noFunnel, invoke);

    const res = await svc.generateBrief({ touchpointId: 'amazon_listing_copy', avatarId: 'av1' });

    expect(res.status).toBe('ok');
    expect(invoke).toHaveBeenCalledTimes(1);
    const [fn, body] = invoke.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe('export-brief');
    expect(body.signature).toEqual({
      signature: "They're not buying a binder — they're buying calm",
      options: ['a', 'b'],
    });
    expect(body.canvas).toBeNull();
    expect(body.confirmed_claims).toEqual([]);
  });

  it('degrades to the avatar profile when no Signature or Canvas exists', async () => {
    responders.signatures = () => null;
    responders.avatars = (f) =>
      f.id === 'av1'
        ? { name: 'The First-Vault Parent', description: 'gift-buyer white space', psychographics: null, demographics: null }
        : null;

    const invoke = vi.fn(async () => ({ data: VALID_BRIEF, error: null }));
    const svc = new FixService(noFunnel, invoke);

    const res = await svc.generateBrief({ touchpointId: 'amazon_listing_copy', avatarId: 'av1' });

    expect(res.status).toBe('ok');
    const [, body] = invoke.mock.calls[0] as [string, Record<string, unknown>];
    const sig = body.signature as Record<string, unknown>;
    expect(sig.source).toBe('avatar_profile');
    expect(sig.positioning).toBe('gift-buyer white space');
    expect(body.canvas).toBeNull();
  });

  it('passes the engine needs_input through unchanged (honest wall, no fabrication)', async () => {
    responders.signatures = () => null;
    responders.avatars = () => null; // avatar unreadable → signature null → engine walls
    const invoke = vi.fn(async () => ({
      data: { needs_input: [{ slot: 1, question: 'Create a Signature first', why: 'positioning' }] },
      error: null,
    }));
    const svc = new FixService(noFunnel, invoke);

    const res = await svc.generateBrief({ touchpointId: 'amazon_listing_copy', avatarId: 'av1' });
    expect(res.status).toBe('needs_input');
  });
});

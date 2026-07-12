import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * generateBrief MUST resolve the brand positioning and PASS it to the export-brief
 * engine — the app used to send only {touchpoint_id, avatar_id, context}, so the
 * engine always hit its "create a Signature first" wall and the on-brand rewrite
 * never worked. These tests lock the resolution: a real Signature is forwarded, the
 * persisted Decision Trigger is forwarded as `trigger` (the engine's other valid
 * root — Trevor's 2026-07-09 dead end was this field going missing), and when no
 * root of any kind exists the avatar profile is forwarded as a trigger-shaped
 * degrade root (so the brief still generates instead of walling).
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
  supabase: {
    from: (t: string) => builder(t),
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  },
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

  it('forwards the persisted Decision Trigger as the positioning root', async () => {
    responders.signatures = () => null;
    responders.decision_triggers = (f) =>
      f.avatar_id === 'av1'
        ? {
            dominant_type: 'Recognition',
            brand_anchor: 'seen for the collection, not the clutter',
            evidence_phrases: ['finally looks organized'],
            placement_instruction: 'lead bullet 1',
            why_this_trigger: 'weakest pillar Empathetic',
            generated_at: '2026-07-09T14:32:00Z',
          }
        : null;

    const invoke = vi.fn(async () => ({ data: VALID_BRIEF, error: null }));
    const svc = new FixService(noFunnel, invoke);

    const res = await svc.generateBrief({ touchpointId: 'amazon_listing_copy', avatarId: 'av1' });

    expect(res.status).toBe('ok');
    const [, body] = invoke.mock.calls[0] as [string, Record<string, unknown>];
    const trig = body.trigger as Record<string, unknown>;
    expect(trig.dominant_type).toBe('Recognition');
    expect(body.canvas).toBeNull();
    expect(body.signature).toBeNull();
  });

  it('degrades to the avatar profile when no Canvas, Trigger, or Signature exists', async () => {
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
    const trig = body.trigger as Record<string, unknown>;
    expect(trig.source).toBe('avatar_profile');
    expect(trig.positioning).toBe('gift-buyer white space');
    expect(body.canvas).toBeNull();
    expect(body.signature).toBeNull();
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

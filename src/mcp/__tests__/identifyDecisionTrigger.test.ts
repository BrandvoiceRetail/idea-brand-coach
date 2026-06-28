// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { runIdentifyDecisionTrigger, type IdentifyTriggerDeps } from '../tools/identifyDecisionTrigger.js';
import { EdgeFnClient, type EdgeFnResult } from '../edgeFn/client.js';
import type { ResolvedSlot } from '../service/contextResolver.js';

const SCORES = { insight: 18, distinctive: 17, empathetic: 8, authentic: 19 }; // empathetic weakest -> Recognition

function stubEdge(reply: Record<string, unknown> | { fail: true } | { errorBody: Record<string, unknown> }): EdgeFnClient {
  return {
    invoke: async <T>(): Promise<EdgeFnResult<T>> => {
      if ((reply as { fail?: true }).fail) return { ok: false, data: null, note: 'unavailable' };
      if ((reply as { errorBody?: unknown }).errorBody) return { ok: true, data: (reply as { errorBody: unknown }).errorBody as T };
      return { ok: true, data: reply as T };
    },
  } as unknown as EdgeFnClient;
}

function makeResolve(map: Record<number, ResolvedSlot>): IdentifyTriggerDeps['resolve'] {
  return (async (slots: number[]): Promise<ResolvedSlot[]> =>
    slots.map((s) => map[s] ?? { slot: s, value: null, source: null, confidence: 0, status: 'missing' })) as IdentifyTriggerDeps['resolve'];
}

const filled = (slot: number, value: unknown): ResolvedSlot => ({ slot: slot as ResolvedSlot['slot'], value, source: 'evidence_snapshots', confidence: 1, status: 'filled-evidence' });

function deps(over: Partial<IdentifyTriggerDeps>): IdentifyTriggerDeps {
  return {
    resolve: over.resolve ?? makeResolve({ 1: filled(1, 'I was burned by a flimsy binder before') }),
    edgeFn: over.edgeFn ?? stubEdge({ trigger: 'Recognition', brandAnchor: 'Dove', evidencePhrases: ['burned by a flimsy binder before'], placementInstruction: 'Lead the hero image with the moment of past failure.' }),
    newSessionId: over.newSessionId ?? ((): string => 'sess-test'),
  };
}

describe('runIdentifyDecisionTrigger', () => {
  it('returns needs_evidence when neither reviews nor listing are filled (never fabricates)', async () => {
    let invoked = false;
    const edge = { invoke: async () => { invoked = true; return { ok: true, data: {} }; } } as unknown as EdgeFnClient;
    const res = await runIdentifyDecisionTrigger(SCORES, null, deps({ resolve: makeResolve({}), edgeFn: edge }));
    expect(res.status).toBe('needs_evidence');
    expect(invoked).toBe(false); // engine never runs without evidence
  });

  it('derives the trigger from the seller’s own evidence', async () => {
    const res = await runIdentifyDecisionTrigger(SCORES, null, deps({}));
    expect(res.status).toBe('derived');
    if (res.status !== 'derived') return;
    expect(res.trigger.trigger).toBe('Recognition');
    expect(res.trigger.brandAnchor).toBe('Dove');
    expect(Array.isArray(res.trigger.evidencePhrases)).toBe(true);
  });

  it('splits reviews into topReviews and passes scores + evidence to the engine', async () => {
    let captured: unknown;
    const edge = { invoke: async (_n: string, body: unknown) => { captured = body; return { ok: true, data: { trigger: 'Recognition' } }; } } as unknown as EdgeFnClient;
    await runIdentifyDecisionTrigger(SCORES, 'av-1', deps({
      resolve: makeResolve({ 1: filled(1, 'review one\nreview two'), 3: filled(3, 'Listing title + bullets') }),
      edgeFn: edge,
    }));
    const b = captured as { scores: unknown; avatarId: string; evidence: { topReviews: string[]; listings: unknown[] }; sessionId: string };
    expect(b.scores).toEqual(SCORES);
    expect(b.avatarId).toBe('av-1');
    expect(b.evidence.topReviews).toEqual(['review one', 'review two']);
    expect(b.evidence.listings).toHaveLength(1);
    expect(b.sessionId).toBe('sess-test');
  });

  it('returns failed when the engine errors or returns an error body', async () => {
    const t = await runIdentifyDecisionTrigger(SCORES, null, deps({ edgeFn: stubEdge({ fail: true }) }));
    expect(t.status).toBe('failed');
    const e = await runIdentifyDecisionTrigger(SCORES, null, deps({ edgeFn: stubEdge({ errorBody: { error: 'needs_upgrade' } }) }));
    expect(e.status).toBe('failed');
  });
});

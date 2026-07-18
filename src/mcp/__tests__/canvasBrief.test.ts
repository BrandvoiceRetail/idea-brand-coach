// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { scanBrief, detectClaims, detectBriefClaims, type ConfirmedClaim } from '../service/claimGate.js';
import { runGenerateCanvas, registerGenerateCanvasTool, type GenerateCanvasDeps } from '../tools/generateCanvas.js';
import { runGenerateBrief, registerGenerateBriefTool, type GenerateBriefDeps } from '../tools/generateBrief.js';
import { EdgeFnClient, type EdgeFnResult } from '../edgeFn/client.js';
import type { ArtifactRow, SaveArtifactOptions } from '../service/artifactStore.js';
import type { ResolvedSlot } from '../service/contextResolver.js';
import type { ArtifactKind, BrandCanvasOutput, ExportBriefOutput } from '../contracts/index.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

// --- Fixtures -------------------------------------------------------------------------

/** A contract-valid Brand Canvas the brand-canvas engine would return. */
const CANVAS_REPLY: Record<string, unknown> = {
  positioning_statement: "My customer isn't buying a binder. They're buying certainty their collection is safe.",
  positioning: {
    category: 'Premium trading card binders and accessories',
    position: 'The binder serious collectors choose when their collection has outgrown the gaming aisle.',
    promise: 'No dimples. No slips. No second-guessing whether your grail card is safe.',
    villain: 'The cheap big-box binder that dimples corners.',
    identity_payoff: "From 'I'm not sure my cards are safe' to 'My collection is exactly where it should be.'",
  },
  voice: {
    voice_attributes: 'Confident without bragging. Knows the hobby. Collector-to-collector.',
    tone_dos: 'Specific, warm, evidence-led.',
    tone_donts: 'Hype, fake scarcity, vague superlatives.',
    words_we_use: ['collection', 'grail', 'protect', 'finally'],
    words_we_dont: ['cheap', 'basic', 'starter'],
  },
  story_spine: 'InfinityVault builds for the collector whose hobby has outgrown the gaming aisle.',
  grounding: 'evidence',
  evidence_refs: [{ kind: 'artifact', ref: 'avatar_s1_vocab' }],
};

/** Build a contract-valid Export Brief; bullet-3 example_output is injectable to test the gate. */
function briefReply(bullet3Copy: string, claimsUsed: string[]): Record<string, unknown> {
  const bullet = (element: string, copy: string, stage: string, used: string[] = []): Record<string, unknown> => ({
    element,
    brief: `instruction for ${element}`,
    example_output: copy,
    stage_ref: stage,
    product_truth_claims: used.map((c) => ({ claim: c, slot: 6, confirmed: false })),
  });
  const image = (slot: string): Record<string, unknown> => ({ slot, intent: `intent ${slot}`, brief: `brief ${slot}` });
  return {
    title_formula: {
      brief: 'Brand Hero | Identity Claim',
      example_output: 'InfinityVault Diamond Grain Premium Binder | The Binder Serious Collectors Use',
      product_truth_claims: [],
    },
    bullets: [
      bullet('BULLET 1 — Decision Trigger', 'FOR THE COLLECTION YOU HAVE OUTGROWN. Built for collectors whose binder is full.', 's3_triggers'),
      bullet('BULLET 2 — Villain', 'NO MORE DIMPLES. Standard binders compress and crease cards. Ours does not.', 's2_jobmap'),
      bullet('BULLET 3 — Capacity dignity', bullet3Copy, 's1_vocab', claimsUsed),
      bullet('BULLET 4 — Authority', 'BUILT BY COLLECTORS, FOR COLLECTORS. Premium materials your grail deserves.', 'canvas'),
      bullet('BULLET 5 — Risk reversal', 'Buy with confidence. We stand behind the build.', 'canvas'),
    ],
    image_brief: ['Hero', 'Image 2', 'Image 3', 'Image 4', 'Image 5', 'Image 6', 'Image 7'].map(image),
    ppc_keywords: {
      tier_a: ['card storage upgrade', 'binder for full collection'],
      tier_b: ['serious collector binder'],
      tier_c: ['trading card binder'],
    },
    grounding: 'evidence',
    evidence_refs: [{ kind: 'artifact', ref: 'brand_canvas' }],
  };
}

// --- Stubs ----------------------------------------------------------------------------

function stubEdgeFn(replyByFn: Record<string, Record<string, unknown> | { fail: true }>): EdgeFnClient {
  return {
    invoke: async <T>(name: string): Promise<EdgeFnResult<T>> => {
      const r = replyByFn[name];
      if (!r) return { ok: false, data: null, note: `no stub for ${name}` };
      if ((r as { fail?: true }).fail) return { ok: false, data: null, note: 'unavailable' };
      return { ok: true, data: r as T };
    },
  } as unknown as EdgeFnClient;
}

/**
 * A sequencing edge-fn stub: returns each scripted result in order (cycling on the last),
 * recording the invocation count. `{ ok:false }` entries simulate a transient 5xx/parse
 * failure the tool should retry; `{ ok:true, data }` entries are the success/needs_input
 * reply. Used to assert retry-once-then-succeed and no-retry-on-needs_input.
 */
function makeSeqEdgeFn(sequence: Array<EdgeFnResult<Record<string, unknown>>>): { edge: EdgeFnClient; count: () => number } {
  let i = 0;
  const edge = {
    invoke: async <T>(): Promise<EdgeFnResult<T>> => {
      const r = sequence[Math.min(i, sequence.length - 1)];
      i += 1;
      return r as unknown as EdgeFnResult<T>;
    },
  } as unknown as EdgeFnClient;
  return { edge, count: () => i };
}

const transientFail: EdgeFnResult<Record<string, unknown>> = { ok: false, data: null, note: 'edge function failed (HTTP 500)' };
/** A synchronous sleep seam so retry-backoff tests don't wait on real time. */
const noSleep = async (): Promise<void> => {};

let savedCounter = 0;
function makeSaveStub(record: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }>) {
  return (async (kind: ArtifactKind, content: unknown, opts: SaveArtifactOptions): Promise<ArtifactRow> => {
    record.push({ kind, content, opts });
    savedCounter += 1;
    return {
      id: `art-${savedCounter}`, user_id: 'user-1', avatar_id: opts.avatarId ?? null, kind, content,
      grounding: opts.grounding, evidence_refs: opts.evidenceRefs, superseded_by: null,
      created_at: new Date().toISOString(),
    };
  }) as GenerateCanvasDeps['saveArtifact'];
}

/** getCurrentArtifact stub backed by a kind->content map. */
function makeGetCurrent(store: Map<ArtifactKind, unknown>): GenerateCanvasDeps['getCurrentArtifact'] {
  return (async (kind: ArtifactKind): Promise<ArtifactRow | null> => {
    if (!store.has(kind)) return null;
    return {
      id: `cur-${kind}`, user_id: 'user-1', avatar_id: null, kind, content: store.get(kind),
      grounding: 'evidence', evidence_refs: [{ kind: 'review', ref: 'x' }], superseded_by: null,
      created_at: new Date().toISOString(),
    };
  }) as GenerateCanvasDeps['getCurrentArtifact'];
}

/** resolve stub returning a fixed map of slot->ResolvedSlot. */
function makeResolve(map: Record<number, ResolvedSlot>): GenerateCanvasDeps['resolve'] {
  return (async (slots: number[]): Promise<ResolvedSlot[]> =>
    slots.map((s) => map[s] ?? { slot: s, value: null, source: null, confidence: 0, status: 'missing' })) as GenerateCanvasDeps['resolve'];
}

afterEach(() => vi.restoreAllMocks());

// ======================================================================================
// claimGate.scanBrief — the deterministic §6 fabrication gate (the gold guarantee case).
// ======================================================================================
describe('claimGate.scanBrief', () => {
  /** A contract-valid brief object with an injectable bullet-3 copy line. */
  function brief(bullet3: string): ExportBriefOutput {
    return briefReply(bullet3, []) as unknown as ExportBriefOutput;
  }

  it('BLOCKS an unconfirmed 30-DAY GUARANTEE (gold case)', () => {
    const b = brief('30-DAY GUARANTEE. Holds 432 cards. PSA-slab compatible on outer pockets.');
    const verdict = scanBrief(b, []); // no confirmed claims
    expect(verdict.ok).toBe(false);
    const cats = verdict.violations.map((v) => v.category);
    expect(cats).toContain('guarantee_policy');
    expect(cats).toContain('capacity');
    expect(cats).toContain('compatibility');
    // The guarantee fragment is captured for the confirmation question.
    expect(verdict.violations.some((v) => /guarantee/i.test(v.fragment))).toBe(true);
  });

  it('PASSES the same brief once every claim is confirmed', () => {
    const b = brief('30-DAY GUARANTEE. Holds 432 cards. PSA-slab compatible on outer pockets.');
    const confirmed: ConfirmedClaim[] = [
      { claim: '30-day guarantee', source: 'owner' },
      { claim: 'Holds 432 cards', source: 'owner' },
      { claim: 'PSA-slab compatible', source: 'owner' },
    ];
    const verdict = scanBrief(b, confirmed);
    expect(verdict.ok).toBe(true);
    expect(verdict.violations).toHaveLength(0);
  });

  it('passes a brief with only creative/emotional copy and no product claims', () => {
    const b = brief('FINALLY, ONE BINDER FOR EVERYTHING you are proud to flip through.');
    expect(scanBrief(b, []).ok).toBe(true);
  });

  it('flags a material claim (archival-grade) when unconfirmed', () => {
    const b = brief('Built with archival-grade pages your collection deserves.');
    const verdict = scanBrief(b, []);
    expect(verdict.ok).toBe(false);
    expect(verdict.violations.map((v) => v.category)).toContain('material');
  });
});

// ======================================================================================
// claimGate.detectClaims — the broad compliance net (connector claim-gate, determination #4).
// ======================================================================================
describe('claimGate.detectClaims', () => {
  it('flags warranty / guarantee / lifetime / money-back language (true positive)', () => {
    const hits = detectClaims('Backed by a lifetime warranty and a money-back guarantee.').map((h) => h.toLowerCase());
    expect(hits).toEqual(expect.arrayContaining(['lifetime', 'warranty', 'guarantee', 'money-back']));
  });

  it('flags health / medical signals (true positive); bare treats/cures do NOT trip', () => {
    const hits = detectClaims('Clinically proven, dermatologist tested, FDA-cleared formula.').map((h) => h.toLowerCase());
    expect(hits).toEqual(expect.arrayContaining(['clinically proven', 'fda', 'dermatologist tested']));
    // Bare product nouns are intentionally NOT flagged (false-positive prone):
    expect(detectClaims('Tasty dog treats; we cure the leather by hand.')).toEqual([]);
  });

  it('flags unverifiable superlatives, incl. #1 / no. 1 / number 1 (true positive)', () => {
    const hits = detectClaims('The #1 best-selling, award-winning, doctor recommended binder.').map((h) => h.toLowerCase());
    expect(hits).toEqual(expect.arrayContaining(['#1', 'best-selling', 'award-winning', 'doctor recommended']));
    expect(detectClaims('Rated No. 1; the number 1 choice.').map((h) => h.toLowerCase())).toEqual(expect.arrayContaining(['no. 1', 'number 1']));
  });

  it('false-positive guard: benign copy and near-miss words do not trip', () => {
    expect(detectClaims('A warranted concern about treatment plans, proudly organised.')).toEqual([]);
    expect(detectClaims('Finally, one binder you are proud to flip through.')).toEqual([]);
  });

  it('detectBriefClaims surfaces compliance phrases, minus already-confirmed claims', () => {
    const b = briefReply('Backed by a lifetime warranty.', []) as unknown as ExportBriefOutput;
    expect(detectBriefClaims(b).map((h) => h.toLowerCase())).toEqual(expect.arrayContaining(['lifetime', 'warranty']));
    // An owner-confirmed claim is not re-surfaced for confirmation:
    expect(detectBriefClaims(b, [{ claim: 'lifetime warranty', source: 'owner' }])).toEqual([]);
  });
});

// ======================================================================================
// generate_canvas — chain resolution + persist + needs_input gate.
// ======================================================================================
describe('runGenerateCanvas', () => {
  function deps(over: Partial<GenerateCanvasDeps>): GenerateCanvasDeps {
    return {
      resolve: over.resolve ?? makeResolve({}),
      getCurrentArtifact: over.getCurrentArtifact ?? makeGetCurrent(new Map()),
      saveArtifact: over.saveArtifact ?? makeSaveStub([]),
      edgeFn: over.edgeFn ?? stubEdgeFn({ 'brand-canvas': CANVAS_REPLY }),
    };
  }

  it('returns needs_input when no chosen Positioning Statement exists (never runs ungrounded)', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    let invoked = false;
    const edge = { invoke: async () => { invoked = true; return { ok: true, data: CANVAS_REPLY }; } } as unknown as EdgeFnClient;
    const res = await runGenerateCanvas(null, deps({ getCurrentArtifact: makeGetCurrent(new Map()), saveArtifact: makeSaveStub(saved), edgeFn: edge }));
    expect(res.status).toBe('needs_input');
    if (res.status !== 'needs_input') return;
    expect(res.needs_input[0].slot).toBe(1);
    expect(invoked).toBe(false);
    expect(saved).toHaveLength(0);
  });

  it('persists a brand_canvas artifact when the Positioning Statement exists', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const store = new Map<ArtifactKind, unknown>([
      ['positioning_statement', { options: [{ option: 1, sentence: 'x' }], chosen_option: 1, grounding: 'evidence', evidence_refs: [{ kind: 'review', ref: 'r' }] }],
      ['avatar_s1_vocab', { clusters: [] }],
    ]);
    const res = await runGenerateCanvas(null, deps({ getCurrentArtifact: makeGetCurrent(store), saveArtifact: makeSaveStub(saved) }));
    expect(res.status).toBe('persisted');
    if (res.status !== 'persisted') return;
    expect(saved).toHaveLength(1);
    expect(saved[0].kind).toBe('brand_canvas');
    const content = saved[0].content as BrandCanvasOutput;
    expect(content.positioning.category).toBeTruthy();
    expect(content.voice.words_we_use.length).toBeGreaterThan(0);
  });

  it('fails when the engine output violates the contract', async () => {
    const store = new Map<ArtifactKind, unknown>([['positioning_statement', { options: [{ option: 1, sentence: 'x' }], grounding: 'inference', evidence_refs: [] }]]);
    const res = await runGenerateCanvas(null, deps({
      getCurrentArtifact: makeGetCurrent(store),
      edgeFn: stubEdgeFn({ 'brand-canvas': { positioning_statement: 'only this', grounding: 'evidence', evidence_refs: [{ kind: 'artifact', ref: 'x' }] } }),
    }));
    expect(res.status).toBe('failed');
    if (res.status !== 'failed') return;
    expect(res.note).toMatch(/contract 'brand_canvas'/);
  });
});

// ======================================================================================
// generate_brief — canvas + claims gate + claimGate block + persist.
// ======================================================================================
describe('runGenerateBrief', () => {
  const cleanBrief = briefReply('FINALLY, one binder for the whole collection you are proud to flip through.', []);
  const guaranteeBrief = briefReply('30-DAY GUARANTEE. Holds 432 cards. PSA-slab compatible on outer pockets.', ['30-day guarantee', 'Holds 432 cards', 'PSA-slab compatible']);

  const confirmedSlot = (value: unknown): ResolvedSlot => ({ slot: 6, value, source: 'evidence_snapshots', confidence: 1, status: 'filled-evidence' });
  const missingSlot: ResolvedSlot = { slot: 6, value: null, source: null, confidence: 0, status: 'missing' };

  function deps(over: Partial<GenerateBriefDeps>): GenerateBriefDeps {
    return {
      resolve: over.resolve ?? makeResolve({ 6: confirmedSlot('Holds 432 cards') }),
      getCurrentArtifact: over.getCurrentArtifact ?? makeGetCurrent(new Map([['brand_canvas', CANVAS_REPLY]])),
      saveArtifact: over.saveArtifact ?? (makeSaveStub([]) as GenerateBriefDeps['saveArtifact']),
      edgeFn: over.edgeFn ?? stubEdgeFn({ 'export-brief': cleanBrief }),
      getLatestDecisionTrigger: over.getLatestDecisionTrigger ?? (async () => null),
    };
  }

  it('returns needs_input when NEITHER a Brand Canvas nor a Decision Trigger exists', async () => {
    const res = await runGenerateBrief(null, deps({ getCurrentArtifact: makeGetCurrent(new Map()) }));
    expect(res.status).toBe('needs_input');
    if (res.status !== 'needs_input') return;
    expect(res.reason).toBe('no_canvas');
  });

  it('a legacy Positioning Statement alone is NOT a root — returns needs_input (dropped from the chain, 2026-07-08)', async () => {
    // Positioning Statement present, NO brand_canvas, NO decision trigger. The old
    // degrade-to-positioning statement path is retired: the brief asks honestly instead.
    const sigOnly = makeGetCurrent(new Map<ArtifactKind, unknown>([
      ['positioning_statement', { options: [{ option: 1, sentence: 'x' }], chosen_option: 1, grounding: 'evidence', evidence_refs: [{ kind: 'review', ref: 'r' }] }],
    ]));
    const res = await runGenerateBrief(null, deps({ getCurrentArtifact: sigOnly }));
    expect(res.status).toBe('needs_input');
    if (res.status !== 'needs_input') return;
    expect(res.reason).toBe('no_canvas');
  });

  it('a Decision Trigger alone IS a root — persists the brief (kills the homework wall)', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    // Trigger present, NO brand_canvas — the alpha "shippable brief today" path.
    const res = await runGenerateBrief(null, deps({
      getCurrentArtifact: makeGetCurrent(new Map()),
      getLatestDecisionTrigger: async () => ({
        id: 't-1', user_id: 'u-1', session_id: 's-1', avatar_id: null,
        content: {
          dominant_type: 'Recognition',
          brand_anchor: 'certainty their collection is safe',
          evidence_phrases: ['finally feels safe'],
          placement_instruction: 'Lead the hero with the recognition moment.',
          why_this_trigger: 'Strongest lever in the reviews.',
        },
        generated_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z',
      }),
      saveArtifact: makeSaveStub(saved) as GenerateBriefDeps['saveArtifact'],
    }));
    expect(res.status).toBe('persisted');
    if (res.status !== 'persisted') return;
    expect(saved).toHaveLength(1);
    expect(saved[0].kind).toBe('export_brief');
  });

  it('returns needs_input when the product-claims slot (#6) is unconfirmed', async () => {
    let invoked = false;
    const edge = { invoke: async () => { invoked = true; return { ok: true, data: cleanBrief }; } } as unknown as EdgeFnClient;
    const res = await runGenerateBrief(null, deps({ resolve: makeResolve({ 6: missingSlot }), edgeFn: edge }));
    expect(res.status).toBe('needs_input');
    if (res.status !== 'needs_input') return;
    expect(res.reason).toBe('claims_unconfirmed');
    expect(res.needs_input[0].slot).toBe(6);
    expect(invoked).toBe(false); // engine never runs without a confirmed allowlist
  });

  it('BLOCKS persistence and surfaces needs_input when the brief invents an unconfirmed guarantee (gold case)', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    // Slot #6 confirms ONLY capacity, NOT the guarantee or compatibility.
    const res = await runGenerateBrief(null, deps({
      resolve: makeResolve({ 6: confirmedSlot('Holds 432 cards') }),
      saveArtifact: makeSaveStub(saved) as GenerateBriefDeps['saveArtifact'],
      edgeFn: stubEdgeFn({ 'export-brief': guaranteeBrief }),
    }));
    expect(res.status).toBe('needs_input');
    if (res.status !== 'needs_input') return;
    expect(res.reason).toBe('claim_violations');
    // The unconfirmed guarantee + compatibility surface as confirmation questions; nothing persisted.
    expect(res.needs_input.some((n) => /guarantee/i.test(n.question))).toBe(true);
    expect(saved).toHaveLength(0);
  });

  it('PASSES the guarantee brief once all claims are confirmed in slot #6', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const res = await runGenerateBrief(null, deps({
      resolve: makeResolve({ 6: confirmedSlot(['30-day guarantee', 'Holds 432 cards', 'PSA-slab compatible']) }),
      saveArtifact: makeSaveStub(saved) as GenerateBriefDeps['saveArtifact'],
      edgeFn: stubEdgeFn({ 'export-brief': guaranteeBrief }),
    }));
    expect(res.status).toBe('persisted');
    if (res.status !== 'persisted') return;
    expect(saved).toHaveLength(1);
    expect(saved[0].kind).toBe('export_brief');
    const content = saved[0].content as ExportBriefOutput;
    expect(content.bullets).toHaveLength(5);
    expect(content.image_brief).toHaveLength(7);
  });

  it('persists a clean brief (no product claims) without confirmation', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const res = await runGenerateBrief(null, deps({ saveArtifact: makeSaveStub(saved) as GenerateBriefDeps['saveArtifact'] }));
    expect(res.status).toBe('persisted');
    expect(saved).toHaveLength(1);
  });
});

// ======================================================================================
// R2 — bounded transient retry on the canvas/brief edge-fn legs.
// ======================================================================================
describe('runGenerateCanvas — transient retry (R2)', () => {
  const positioningStatementStore = new Map<ArtifactKind, unknown>([
    ['positioning_statement', { options: [{ option: 1, sentence: 'x' }], chosen_option: 1, grounding: 'evidence', evidence_refs: [{ kind: 'review', ref: 'r' }] }],
    ['avatar_s1_vocab', { clusters: [] }],
  ]);

  it('retries once on a transient 5xx then succeeds (persists)', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const { edge, count } = makeSeqEdgeFn([transientFail, { ok: true, data: CANVAS_REPLY }]);
    const res = await runGenerateCanvas(null, {
      resolve: makeResolve({}),
      getCurrentArtifact: makeGetCurrent(positioningStatementStore),
      saveArtifact: makeSaveStub(saved),
      edgeFn: edge,
      sleep: noSleep,
    });
    expect(res.status).toBe('persisted');
    expect(count()).toBe(2); // one retry
    expect(saved).toHaveLength(1);
  });

  it('does NOT retry a needs_input body (correct refusal, ok:true)', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const { edge, count } = makeSeqEdgeFn([{ ok: true, data: { needs_input: [{ slot: 1, question: 'no positioning statement text', why: 'x' }] } }]);
    const res = await runGenerateCanvas(null, {
      resolve: makeResolve({}),
      getCurrentArtifact: makeGetCurrent(positioningStatementStore),
      saveArtifact: makeSaveStub(saved),
      edgeFn: edge,
      sleep: noSleep,
    });
    expect(res.status).toBe('needs_input');
    expect(count()).toBe(1); // no retry
    expect(saved).toHaveLength(0);
  });

  it('gives up after the max retries and returns failed', async () => {
    const { edge, count } = makeSeqEdgeFn([transientFail]);
    const res = await runGenerateCanvas(null, {
      resolve: makeResolve({}),
      getCurrentArtifact: makeGetCurrent(positioningStatementStore),
      saveArtifact: makeSaveStub([]),
      edgeFn: edge,
      sleep: noSleep,
    });
    expect(res.status).toBe('failed');
    expect(count()).toBe(3); // initial + 2 retries
  });
});

describe('runGenerateBrief — transient retry (R2)', () => {
  const cleanBrief = briefReply('FINALLY, one binder for the whole collection you are proud to flip through.', []);
  const guaranteeBrief = briefReply('30-DAY GUARANTEE. Holds 432 cards.', ['Holds 432 cards']);
  const confirmedSlot: ResolvedSlot = { slot: 6, value: 'Holds 432 cards', source: 'evidence_snapshots', confidence: 1, status: 'filled-evidence' };
  const canvasStore = new Map<ArtifactKind, unknown>([['brand_canvas', CANVAS_REPLY]]);

  it('retries once on a transient 5xx then succeeds (persists)', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const { edge, count } = makeSeqEdgeFn([transientFail, { ok: true, data: cleanBrief }]);
    const res = await runGenerateBrief(null, {
      resolve: makeResolve({ 6: confirmedSlot }),
      getCurrentArtifact: makeGetCurrent(canvasStore),
      saveArtifact: makeSaveStub(saved) as GenerateBriefDeps['saveArtifact'],
      edgeFn: edge,
      sleep: noSleep,
      getLatestDecisionTrigger: async () => null,
    });
    expect(res.status).toBe('persisted');
    expect(count()).toBe(2);
    expect(saved).toHaveLength(1);
  });

  it('does NOT retry a claim-gate block (correct refusal, ok:true reply)', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    // Slot #6 confirms only capacity; the guarantee in the copy is unconfirmed -> claim block.
    const { edge, count } = makeSeqEdgeFn([{ ok: true, data: guaranteeBrief }]);
    const res = await runGenerateBrief(null, {
      resolve: makeResolve({ 6: confirmedSlot }),
      getCurrentArtifact: makeGetCurrent(canvasStore),
      saveArtifact: makeSaveStub(saved) as GenerateBriefDeps['saveArtifact'],
      edgeFn: edge,
      sleep: noSleep,
      getLatestDecisionTrigger: async () => null,
    });
    expect(res.status).toBe('needs_input');
    if (res.status !== 'needs_input') return;
    expect(res.reason).toBe('claim_violations');
    expect(count()).toBe(1); // the single engine call was not retried by the claim gate
    expect(saved).toHaveLength(0);
  });
});

// ======================================================================================
// Tool surface — identity gate via the MCP transport.
// ======================================================================================
describe('generate_canvas / generate_brief tool surface', () => {
  async function connect(register: (s: McpServer) => void): Promise<Client> {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    register(server);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([server.connect(st), client.connect(ct)]);
    return client;
  }

  it('generate_canvas denies anonymous callers before any work', async () => {
    const client = await connect((s) =>
      registerGenerateCanvasTool(s, {
        getCurrentArtifact: makeGetCurrent(new Map([['positioning_statement', { options: [{ option: 1, sentence: 'x' }], grounding: 'evidence', evidence_refs: [{ kind: 'review', ref: 'r' }] }]])),
        resolve: makeResolve({}),
        saveArtifact: makeSaveStub([]),
        edgeFn: stubEdgeFn({ 'brand-canvas': CANVAS_REPLY }),
      }),
    );
    const res = await client.callTool({ name: 'generate_canvas', arguments: {} });
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/unauthenticated/i);
  });

  it('generate_brief runs the gate for an authenticated caller (claims unconfirmed -> needs_input)', async () => {
    const client = await connect((s) =>
      registerGenerateBriefTool(s, {
        getCurrentArtifact: makeGetCurrent(new Map([['brand_canvas', CANVAS_REPLY]])),
        resolve: makeResolve({ 6: { slot: 6, value: null, source: null, confidence: 0, status: 'missing' } }),
        saveArtifact: makeSaveStub([]) as GenerateBriefDeps['saveArtifact'],
        edgeFn: stubEdgeFn({ 'export-brief': briefReply('clean copy', []) }),
      }),
    );
    const res = await runWithIdentity(authed, () => client.callTool({ name: 'generate_brief', arguments: {} }));
    const sc = res.structuredContent as { ok: boolean; reason?: string; needs_input?: Array<{ slot: number }> };
    expect(sc.ok).toBe(false);
    expect(sc.reason).toBe('claims_unconfirmed');
    expect(sc.needs_input?.[0].slot).toBe(6);
  });
});

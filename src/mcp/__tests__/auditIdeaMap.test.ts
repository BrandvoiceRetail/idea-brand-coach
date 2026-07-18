// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  runAuditIdeaMap,
  registerGenerateAuditIdeaMapTool,
  type AuditIdeaMapDeps,
} from '../tools/generateAuditIdeaMap.js';
import { EdgeFnClient, type EdgeFnResult } from '../edgeFn/client.js';
import type { ArtifactRow, SaveArtifactOptions } from '../service/artifactStore.js';
import type { ArtifactKind } from '../contracts/index.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

// --- A contract-valid `audit_x_idea` engine reply (rows + grounding envelope echoed). ---
const VALID_REPLY = {
  rows: [
    {
      audit_investment: 'PPC restructure',
      without_idea: 'Better ACoS on category keywords through bid discipline.',
      with_idea: 'Tier A trigger-state keywords added, high-intent and low-competition. SBV uses the Positioning Statement as the hook.',
      estimated_lift: 'Same budget, ~30-50% better ROAS',
    },
    {
      audit_investment: 'A+ Content overhaul',
      without_idea: 'Prettier feature comparison. Lifestyle module added.',
      with_idea: 'A+ modules sequenced as the customer emotional journey: trigger to villain to promise to identity payoff.',
      estimated_lift: '1.5-2.5x lift vs generic A+ refresh',
    },
  ],
  grounding: 'evidence',
  evidence_refs: [{ kind: 'artifact', ref: 'brand_canvas' }],
};

/** A persisted brand_canvas artifact (the upstream chain input). */
const CANVAS_CONTENT = {
  positioning_statement: "They're not buying a binder, they're buying peace of mind.",
  positioning: {
    category: 'Premium trading card binders',
    position: 'The vault serious collectors trust',
    promise: 'Your cards stay mint',
    villain: 'Flimsy binders that crease cards',
    identity_payoff: 'A collector who protects what they chase',
  },
  voice: {
    voice_attributes: 'Calm, expert, protective',
    tone_dos: 'Speak to the collector instinct',
    tone_donts: 'No hype',
    words_we_use: ['vault', 'mint', 'protect'],
    words_we_dont: ['cheap', 'basic'],
  },
  story_spine: 'Built by a collector who lost a chase card to a bad binder.',
  grounding: 'evidence',
  evidence_refs: [{ kind: 'review', ref: 'x' }],
};

/** A persisted export_brief artifact (the other upstream chain input). */
const BRIEF_CONTENT = {
  title_formula: { brief: 'Lead with the trigger', example_output: 'Premium Card Binder — the vault your collection deserves', product_truth_claims: [] },
  bullets: [],
  image_brief: [],
  ppc_keywords: { tier_a: ['premium card binder'], tier_b: ['serious collector binder'], tier_c: ['card binder'] },
  grounding: 'evidence',
  evidence_refs: [{ kind: 'review', ref: 'x' }],
};

/** Stub EdgeFnClient. Records invocations; replies, returns needs_input, or fails. */
function stubEdgeFn(
  opts: { reply?: unknown; needsInput?: boolean; fail?: boolean; capture?: (body: unknown) => void } = {},
): EdgeFnClient {
  return {
    invoke: async <T>(_name: string, body: unknown): Promise<EdgeFnResult<T>> => {
      opts.capture?.(body);
      if (opts.fail) return { ok: false, data: null, note: 'unavailable' };
      if (opts.needsInput) {
        return {
          ok: true,
          data: { needs_input: [{ slot: 1, question: 'chain incomplete', why: 'no inputs' }] } as T,
        };
      }
      return { ok: true, data: (opts.reply ?? VALID_REPLY) as T };
    },
  } as unknown as EdgeFnClient;
}

/**
 * A sequencing edge-fn stub: returns each scripted result in order (cycling on the last)
 * and records the invocation count. `{ ok:false }` simulates a transient 5xx the tool
 * retries; `{ ok:true, data }` is a success/needs_input reply. Drives the R2 retry tests.
 */
function makeSeqEdgeFn(sequence: Array<EdgeFnResult<unknown>>): { edge: EdgeFnClient; count: () => number } {
  let i = 0;
  const edge = {
    invoke: async <T>(): Promise<EdgeFnResult<T>> => {
      const r = sequence[Math.min(i, sequence.length - 1)];
      i += 1;
      return r as EdgeFnResult<T>;
    },
  } as unknown as EdgeFnClient;
  return { edge, count: () => i };
}

const transientFail: EdgeFnResult<unknown> = { ok: false, data: null, note: 'edge function failed (HTTP 500)' };
/** A synchronous sleep seam so retry-backoff tests don't wait on real time. */
const noSleep = async (): Promise<void> => {};

let savedCounter = 0;
/** Stub saveArtifact recording every persisted (kind, content). */
function makeSaveStub(record: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }>) {
  return (async (kind: ArtifactKind, content: unknown, opts: SaveArtifactOptions): Promise<ArtifactRow> => {
    record.push({ kind, content, opts });
    savedCounter += 1;
    return {
      id: `art-${savedCounter}`,
      user_id: 'user-1',
      avatar_id: opts.avatarId ?? null,
      kind,
      content,
      grounding: opts.grounding,
      evidence_refs: opts.evidenceRefs,
      superseded_by: null,
      created_at: new Date().toISOString(),
    };
  }) as AuditIdeaMapDeps['saveArtifact'];
}

/** getCurrentArtifact backed by a kind->content map (absent kinds resolve to null). */
function makeGetCurrentStub(
  store: Map<ArtifactKind, unknown>,
  reads?: ArtifactKind[],
): AuditIdeaMapDeps['getCurrentArtifact'] {
  return (async (kind: ArtifactKind): Promise<ArtifactRow | null> => {
    reads?.push(kind);
    if (!store.has(kind)) return null;
    return {
      id: `prior-${kind}`,
      user_id: 'user-1',
      avatar_id: null,
      kind,
      content: store.get(kind),
      grounding: 'evidence',
      evidence_refs: [{ kind: 'review', ref: 'x' }],
      superseded_by: null,
      created_at: new Date().toISOString(),
    };
  }) as AuditIdeaMapDeps['getCurrentArtifact'];
}

afterEach(() => vi.restoreAllMocks());

describe('runAuditIdeaMap — orchestration', () => {
  it('happy path: resolves canvas+brief, validates, and persists an audit_x_idea artifact', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const reads: ArtifactKind[] = [];
    let sentBody: unknown = null;
    const store = new Map<ArtifactKind, unknown>([
      ['brand_canvas', CANVAS_CONTENT],
      ['export_brief', BRIEF_CONTENT],
    ]);

    const res = await runAuditIdeaMap(null, {
      getCurrentArtifact: makeGetCurrentStub(store, reads),
      saveArtifact: makeSaveStub(saved),
      edgeFn: stubEdgeFn({ capture: (b) => (sentBody = b) }),
    });

    expect(res.status).toBe('persisted');
    if (res.status !== 'persisted') return;
    expect(res.grounding).toBe('evidence');
    expect(res.row_count).toBe(2);

    // Persisted exactly one audit_x_idea artifact with a non-empty evidence_refs envelope.
    expect(saved).toHaveLength(1);
    expect(saved[0].kind).toBe('audit_x_idea');
    expect(saved[0].opts.evidenceRefs.length).toBeGreaterThan(0);

    // Both upstream chain artifacts were resolved and fed to the engine.
    expect(reads).toContain('brand_canvas');
    expect(reads).toContain('export_brief');
    const body = sentBody as { canvas: unknown; brief: unknown };
    expect(body.canvas).toEqual(CANVAS_CONTENT);
    expect(body.brief).toEqual(BRIEF_CONTENT);
  });

  it('feeds the marketing_audit investment rows in as `investments` when present', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    let sentBody: unknown = null;
    const auditContent = { rows: [{ tier: 'T1', investment: 'PPC restructure', what_it_is: 'rework keywords' }] };
    const store = new Map<ArtifactKind, unknown>([
      ['brand_canvas', CANVAS_CONTENT],
      ['export_brief', BRIEF_CONTENT],
      ['marketing_audit', auditContent],
    ]);

    const res = await runAuditIdeaMap(null, {
      getCurrentArtifact: makeGetCurrentStub(store),
      saveArtifact: makeSaveStub(saved),
      edgeFn: stubEdgeFn({ capture: (b) => (sentBody = b) }),
    });

    expect(res.status).toBe('persisted');
    expect((sentBody as { investments: unknown }).investments).toEqual(auditContent);
  });

  it('needs_input when the canvas/brief chain is incomplete (never runs the engine)', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    let invoked = false;
    const edge = {
      invoke: async () => {
        invoked = true;
        return { ok: true, data: VALID_REPLY };
      },
    } as unknown as EdgeFnClient;

    // Only the canvas exists; the brief is missing -> chain incomplete.
    const store = new Map<ArtifactKind, unknown>([['brand_canvas', CANVAS_CONTENT]]);
    const res = await runAuditIdeaMap(null, {
      getCurrentArtifact: makeGetCurrentStub(store),
      saveArtifact: makeSaveStub(saved),
      edgeFn: edge,
    });

    expect(res.status).toBe('needs_input');
    if (res.status !== 'needs_input') return;
    expect(res.needs_input[0].slot).toBe(1);
    expect(res.needs_input[0].question).toMatch(/Export Brief/);
    // The engine was never called and nothing was persisted.
    expect(invoked).toBe(false);
    expect(saved).toHaveLength(0);
  });

  it('relays an edge-fn needs_input (engine judged the chain incomplete)', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const store = new Map<ArtifactKind, unknown>([
      ['brand_canvas', CANVAS_CONTENT],
      ['export_brief', BRIEF_CONTENT],
    ]);
    const res = await runAuditIdeaMap(null, {
      getCurrentArtifact: makeGetCurrentStub(store),
      saveArtifact: makeSaveStub(saved),
      edgeFn: stubEdgeFn({ needsInput: true }),
    });
    expect(res.status).toBe('needs_input');
    expect(saved).toHaveLength(0);
  });

  it('fails when the engine output violates the audit_x_idea contract', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const store = new Map<ArtifactKind, unknown>([
      ['brand_canvas', CANVAS_CONTENT],
      ['export_brief', BRIEF_CONTENT],
    ]);
    const res = await runAuditIdeaMap(null, {
      getCurrentArtifact: makeGetCurrentStub(store),
      saveArtifact: makeSaveStub(saved),
      edgeFn: stubEdgeFn({ reply: { rows: [{ audit_investment: 'only one field' }] } }),
    });
    expect(res.status).toBe('failed');
    if (res.status !== 'failed') return;
    expect(res.note).toMatch(/contract 'audit_x_idea'/);
    expect(saved).toHaveLength(0);
  });
});

describe('runAuditIdeaMap — transient retry (R2)', () => {
  const store = new Map<ArtifactKind, unknown>([
    ['brand_canvas', CANVAS_CONTENT],
    ['export_brief', BRIEF_CONTENT],
  ]);

  it('retries once on a transient 5xx then succeeds (persists)', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const { edge, count } = makeSeqEdgeFn([transientFail, { ok: true, data: VALID_REPLY }]);
    const res = await runAuditIdeaMap(null, {
      getCurrentArtifact: makeGetCurrentStub(store),
      saveArtifact: makeSaveStub(saved),
      edgeFn: edge,
      sleep: noSleep,
    });
    expect(res.status).toBe('persisted');
    expect(count()).toBe(2); // one retry
    expect(saved).toHaveLength(1);
  });

  it('does NOT retry an edge-fn needs_input (correct refusal, ok:true)', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const { edge, count } = makeSeqEdgeFn([
      { ok: true, data: { needs_input: [{ slot: 1, question: 'chain incomplete', why: 'no inputs' }] } },
    ]);
    const res = await runAuditIdeaMap(null, {
      getCurrentArtifact: makeGetCurrentStub(store),
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
    const res = await runAuditIdeaMap(null, {
      getCurrentArtifact: makeGetCurrentStub(store),
      saveArtifact: makeSaveStub([]),
      edgeFn: edge,
      sleep: noSleep,
    });
    expect(res.status).toBe('failed');
    expect(count()).toBe(3); // initial + 2 retries
  });
});

describe('generate_audit_idea_map tool', () => {
  async function connect(deps?: Partial<AuditIdeaMapDeps>): Promise<Client> {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerGenerateAuditIdeaMapTool(server, deps);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([server.connect(st), client.connect(ct)]);
    return client;
  }

  it('denies anonymous callers before running the map', async () => {
    const client = await connect(); // no deps: a leaked run would hit the live client
    const res = await client.callTool({ name: 'generate_audit_idea_map', arguments: {} });
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/unauthenticated/i);
  });

  it('persists for an authenticated caller when the chain is complete', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const store = new Map<ArtifactKind, unknown>([
      ['brand_canvas', CANVAS_CONTENT],
      ['export_brief', BRIEF_CONTENT],
    ]);
    const client = await connect({
      getCurrentArtifact: makeGetCurrentStub(store),
      saveArtifact: makeSaveStub(saved),
      edgeFn: stubEdgeFn(),
    });
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'generate_audit_idea_map', arguments: {} }),
    );
    const sc = res.structuredContent as { ok: boolean; artifact_id?: string; row_count?: number };
    expect(sc.ok).toBe(true);
    expect(sc.row_count).toBe(2);
    expect(saved).toHaveLength(1);
    expect(saved[0].kind).toBe('audit_x_idea');
  });

  it('returns needs_input through the tool surface when the chain is incomplete', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const store = new Map<ArtifactKind, unknown>([['brand_canvas', CANVAS_CONTENT]]);
    const client = await connect({
      getCurrentArtifact: makeGetCurrentStub(store),
      saveArtifact: makeSaveStub(saved),
      edgeFn: stubEdgeFn(),
    });
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'generate_audit_idea_map', arguments: {} }),
    );
    const sc = res.structuredContent as { ok: boolean; needs_input?: Array<{ slot: number }> };
    expect(sc.ok).toBe(false);
    expect(sc.needs_input?.[0].slot).toBe(1);
    expect(saved).toHaveLength(0);
  });
});

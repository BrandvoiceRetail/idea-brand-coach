// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runStage, runPipeline, type AvatarPipelineDeps } from '../service/avatarPipeline.js';
import { registerBuildAvatarStageTool } from '../tools/buildAvatarStage.js';
import { EdgeFnClient, type EdgeFnResult } from '../edgeFn/client.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import type { ArtifactRow, SaveArtifactOptions } from '../service/artifactStore.js';
import type { ResolvedSlot } from '../service/contextResolver.js';
import type { ArtifactKind } from '../contracts/index.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

// --- Valid contract-shaped engine replies, keyed by edge fn name. ----------------------
const VALID_REPLY: Record<string, Record<string, unknown>> = {
  'avatar-vocabulary': {
    clusters: [
      {
        cluster: 'Protection anxiety',
        customer_words: ['finally feel safe', 'no more bent corners'],
        frequency_signal: 'High',
        why_it_matters: 'Loss-aversion is the dominant emotional driver.',
      },
    ],
  },
  'avatar-jobmap': {
    job_map: [
      {
        functional_job: 'Store 432 graded cards safely',
        emotional_job: 'Stop worrying about damage',
        identity_job: 'Be a serious collector',
        villain: 'Flimsy binders that crease cards',
      },
    ],
  },
  'avatar-triggers': {
    triggers: [
      {
        trigger_moment: 'A card arrives damaged from a binder',
        what_they_feel: 'Frustration and regret',
        search_terms: ['card storage box', 'graded card case'],
        estimated_volume_band: 'High and growing',
      },
    ],
  },
  'avatar-objections': {
    objections: [
      {
        hesitation: 'Worried it will not fit PSA slabs',
        verbatim_signal: 'wish it fit my graded slabs',
        resolution: 'Image showing a PSA slab in the outer pocket.',
      },
    ],
  },
  'reveal-positioning-statement': {
    options: ["They're not buying a box, they're buying peace of mind.", 'The vault their cards deserve.'],
    usedReviews: true,
    inference: false,
  },
};

/** Stub EdgeFnClient. Records invocations; replies per fn, or a queued failure. */
function stubEdgeFn(
  opts: { fail?: Set<string>; badShape?: Set<string>; capture?: (fn: string, body: unknown) => void } = {},
): EdgeFnClient {
  return {
    invoke: async <T>(name: string, body: unknown): Promise<EdgeFnResult<T>> => {
      opts.capture?.(name, body);
      if (opts.fail?.has(name)) return { ok: false, data: null, note: 'unavailable' };
      if (opts.badShape?.has(name)) return { ok: true, data: { garbage: true } as T };
      const reply = VALID_REPLY[name];
      if (!reply) return { ok: false, data: null, note: 'no stub reply' };
      return { ok: true, data: reply as T };
    },
  } as unknown as EdgeFnClient;
}

let savedCounter = 0;
/** Stub saveArtifact recording every persisted (kind, content). */
function makeSaveStub(record: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }>) {
  return async (kind: ArtifactKind, content: unknown, opts: SaveArtifactOptions): Promise<ArtifactRow> => {
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
  };
}

/** Reviews-resolved stub for slot #1. */
function resolveReviewsFilled(): AvatarPipelineDeps['resolve'] {
  return (async () => [
    { slot: 1, value: 'finally feel safe — no more bent corners', source: 'user_product_reviews', confidence: 1, status: 'filled-evidence' } as ResolvedSlot,
  ]) as AvatarPipelineDeps['resolve'];
}

/** Reviews-missing stub for slot #1. */
function resolveReviewsMissing(): AvatarPipelineDeps['resolve'] {
  return (async () => [
    { slot: 1, value: null, source: null, confidence: 0, status: 'missing' } as ResolvedSlot,
  ]) as AvatarPipelineDeps['resolve'];
}

/** Records which dependency artifacts are read; returns prior content per kind. */
function makeGetCurrentStub(
  store: Map<ArtifactKind, unknown>,
  reads?: ArtifactKind[],
): AvatarPipelineDeps['getCurrentArtifact'] {
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
  }) as AvatarPipelineDeps['getCurrentArtifact'];
}

const noSleep = async (): Promise<void> => {};

afterEach(() => vi.restoreAllMocks());

describe('avatarPipeline — single stages', () => {
  it('runs s1, validates against the contract, and persists an evidence artifact', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const res = await runStage('s1', {}, {
      resolve: resolveReviewsFilled(),
      getCurrentArtifact: makeGetCurrentStub(new Map()),
      saveArtifact: makeSaveStub(saved),
      edgeFn: stubEdgeFn(),
      sleep: noSleep,
    });
    expect(res.status).toBe('persisted');
    if (res.status !== 'persisted') return;
    expect(res.summary.kind).toBe('avatar_s1_vocab');
    expect(res.summary.grounding).toBe('evidence');
    expect(res.summary.evidence_ref_count).toBe(1);
    // Persisted exactly one artifact, of kind avatar_s1_vocab, with non-empty evidence_refs.
    expect(saved).toHaveLength(1);
    expect(saved[0].kind).toBe('avatar_s1_vocab');
    expect(saved[0].opts.evidenceRefs.length).toBeGreaterThan(0);
  });

  it('short-circuits to needs_input when the reviews slot is unresolved (never runs ungrounded)', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    let invoked = false;
    const edge = {
      invoke: async () => {
        invoked = true;
        return { ok: true, data: VALID_REPLY['avatar-vocabulary'] };
      },
    } as unknown as EdgeFnClient;

    const res = await runStage('s1', {}, {
      resolve: resolveReviewsMissing(),
      getCurrentArtifact: makeGetCurrentStub(new Map()),
      saveArtifact: makeSaveStub(saved),
      edgeFn: edge,
      sleep: noSleep,
    });
    expect(res.status).toBe('needs_input');
    if (res.status !== 'needs_input') return;
    expect(res.needs_input[0].slot).toBe(1);
    // The engine was never called and nothing was persisted.
    expect(invoked).toBe(false);
    expect(saved).toHaveLength(0);
  });

  it('fails (after retries) when the engine output violates the contract', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const invocations: string[] = [];
    const res = await runStage('s1', {}, {
      resolve: resolveReviewsFilled(),
      getCurrentArtifact: makeGetCurrentStub(new Map()),
      saveArtifact: makeSaveStub(saved),
      edgeFn: stubEdgeFn({ badShape: new Set(['avatar-vocabulary']), capture: (fn) => invocations.push(fn) }),
      sleep: noSleep,
    });
    expect(res.status).toBe('failed');
    if (res.status !== 'failed') return;
    expect(res.note).toMatch(/contract 'avatar_s1_vocab'/);
    // Retried: 1 initial + MAX_STAGE_RETRIES(2) = 3 attempts, none persisted.
    expect(invocations).toHaveLength(3);
    expect(saved).toHaveLength(0);
  });

  it('gates S5 unless allowPositioningStatement is set', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const gated = await runStage('s5', { allowPositioningStatement: false }, {
      resolve: resolveReviewsFilled(),
      getCurrentArtifact: makeGetCurrentStub(new Map()),
      saveArtifact: makeSaveStub(saved),
      edgeFn: stubEdgeFn(),
      sleep: noSleep,
    });
    expect(gated.status).toBe('positioning_statement_gated');
    expect(saved).toHaveLength(0);

    const allowed = await runStage('s5', { allowPositioningStatement: true }, {
      resolve: resolveReviewsFilled(),
      getCurrentArtifact: makeGetCurrentStub(new Map()),
      saveArtifact: makeSaveStub(saved),
      edgeFn: stubEdgeFn(),
      sleep: noSleep,
    });
    expect(allowed.status).toBe('persisted');
    if (allowed.status !== 'persisted') return;
    expect(allowed.summary.kind).toBe('positioning_statement');
    expect(saved).toHaveLength(1);
  });
});

describe('avatarPipeline — full chain', () => {
  it('runs s1 → s2 → {s3,s4} → s5 in dependency order, persisting each, with prior fed forward', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const priorStore = new Map<ArtifactKind, unknown>();
    const fnBodies: Array<{ fn: string; prior: Record<string, unknown> }> = [];

    // getCurrentArtifact reflects what has been persisted so far (prior chain).
    const getCurrent = (async (kind: ArtifactKind): Promise<ArtifactRow | null> => {
      if (!priorStore.has(kind)) return null;
      return {
        id: `prior-${kind}`, user_id: 'user-1', avatar_id: null, kind,
        content: priorStore.get(kind), grounding: 'evidence',
        evidence_refs: [{ kind: 'review', ref: 'x' }], superseded_by: null,
        created_at: new Date().toISOString(),
      };
    }) as AvatarPipelineDeps['getCurrentArtifact'];

    const save = (async (kind: ArtifactKind, content: unknown, opts: SaveArtifactOptions): Promise<ArtifactRow> => {
      saved.push({ kind, content, opts });
      priorStore.set(kind, content); // make persisted artifact visible to later stages
      savedCounter += 1;
      return {
        id: `art-${savedCounter}`, user_id: 'user-1', avatar_id: opts.avatarId ?? null, kind, content,
        grounding: opts.grounding, evidence_refs: opts.evidenceRefs, superseded_by: null,
        created_at: new Date().toISOString(),
      };
    }) as AvatarPipelineDeps['saveArtifact'];

    const edge = {
      invoke: async <T>(fn: string, body: unknown): Promise<EdgeFnResult<T>> => {
        fnBodies.push({ fn, prior: (body as { prior?: Record<string, unknown> }).prior ?? {} });
        const reply = VALID_REPLY[fn];
        return reply ? { ok: true, data: reply as T } : { ok: false, data: null, note: 'no reply' };
      },
    } as unknown as EdgeFnClient;

    const result = await runPipeline({ allowPositioningStatement: true }, {
      resolve: resolveReviewsFilled(),
      getCurrentArtifact: getCurrent,
      saveArtifact: save,
      edgeFn: edge,
      sleep: noSleep,
    });

    expect(result.ok).toBe(true);
    expect(result.stages.map((s) => s.kind)).toEqual([
      'avatar_s1_vocab',
      'avatar_s2_jobmap',
      'avatar_s3_triggers',
      'avatar_s4_objections',
      'positioning_statement',
    ]);
    // Persist called once per stage.
    expect(saved).toHaveLength(5);

    // Dependency order: s2's call saw s1's artifact in `prior`; s3/s4 saw s1 AND s2.
    // `prior` is keyed by STAGE ID (s1/s2) — the key the S2/S3/S4 edge fns actually read
    // (body.prior.s1 / body.prior.s2). The value is the dep artifact's content (clusters /
    // job_map), the shape the fns' formatS1/formatS2 consume.
    const s2Call = fnBodies.find((b) => b.fn === 'avatar-jobmap')!;
    expect(s2Call.prior).toHaveProperty('s1');
    expect((s2Call.prior.s1 as { clusters?: unknown }).clusters).toBeDefined();
    const s3Call = fnBodies.find((b) => b.fn === 'avatar-triggers')!;
    expect(s3Call.prior).toHaveProperty('s1');
    expect(s3Call.prior).toHaveProperty('s2');
    expect((s3Call.prior.s2 as { job_map?: unknown }).job_map).toBeDefined();
  });

  it('surfaces an edge-fn needs_input (HTTP 200) as a clean stage needs_input, not a generic failure', async () => {
    // Simulate the symptom this fix targets: a stage edge fn returns a needs_input body
    // (e.g. it could not find its prior). The pipeline must NOT burn retries failing the
    // contract — it must surface needs_input immediately.
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const invocations: string[] = [];
    const edge = {
      invoke: async <T>(fn: string): Promise<EdgeFnResult<T>> => {
        invocations.push(fn);
        return {
          ok: true,
          data: {
            needs_input: [
              { slot: 1, question: 'Run Stage 1 first.', why: 'S2 is synthesised from S1 clusters.' },
            ],
          } as T,
        };
      },
    } as unknown as EdgeFnClient;

    const res = await runStage('s2', {}, {
      resolve: resolveReviewsFilled(),
      getCurrentArtifact: makeGetCurrentStub(new Map()),
      saveArtifact: makeSaveStub(saved),
      edgeFn: edge,
      sleep: noSleep,
    });
    expect(res.status).toBe('needs_input');
    if (res.status !== 'needs_input') return;
    expect(res.needs_input[0].slot).toBe(1);
    // Surfaced on the FIRST attempt (no retry burn), nothing persisted.
    expect(invocations).toHaveLength(1);
    expect(saved).toHaveLength(0);
  });

  it('pipeline stops at the S5 gate (S1-S4 persisted) when allowPositioningStatement is not set', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const priorStore = new Map<ArtifactKind, unknown>();
    const save = (async (kind: ArtifactKind, content: unknown, opts: SaveArtifactOptions): Promise<ArtifactRow> => {
      saved.push({ kind, content, opts });
      priorStore.set(kind, content);
      savedCounter += 1;
      return {
        id: `art-${savedCounter}`, user_id: 'user-1', avatar_id: null, kind, content,
        grounding: opts.grounding, evidence_refs: opts.evidenceRefs, superseded_by: null,
        created_at: new Date().toISOString(),
      };
    }) as AvatarPipelineDeps['saveArtifact'];

    const result = await runPipeline({}, {
      resolve: resolveReviewsFilled(),
      getCurrentArtifact: makeGetCurrentStub(priorStore),
      saveArtifact: save,
      edgeFn: stubEdgeFn(),
      sleep: noSleep,
    });
    expect(result.ok).toBe(true);
    expect(result.positioning_statement_gated).toBeTruthy();
    expect(result.stages).toHaveLength(4);
    expect(saved.map((s) => s.kind)).not.toContain('positioning_statement');
  });

  it('pipeline short-circuits to needs_input before any stage when reviews are missing', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const result = await runPipeline({}, {
      resolve: resolveReviewsMissing(),
      getCurrentArtifact: makeGetCurrentStub(new Map()),
      saveArtifact: makeSaveStub(saved),
      edgeFn: stubEdgeFn(),
      sleep: noSleep,
    });
    expect(result.ok).toBe(false);
    expect(result.needs_input?.[0].slot).toBe(1);
    expect(result.stages).toHaveLength(0);
    expect(saved).toHaveLength(0);
  });
});

describe('build_avatar_stage tool', () => {
  async function connect(): Promise<Client> {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerBuildAvatarStageTool(server);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([server.connect(st), client.connect(ct)]);
    return client;
  }

  it('denies anonymous callers before running any stage', async () => {
    const client = await connect(); // no deps stubbed: a leaked run would hit the live client
    const res = await client.callTool({ name: 'build_avatar_stage', arguments: { stage: 's1' } });
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/unauthenticated/i);
  });

  it('passes through needs_input for an authenticated caller when reviews are unresolved', async () => {
    // The tool uses the live pipeline (which uses the live resolver). Stub the JWT-bound
    // client so every resolver read returns empty (no network) -> reviews missing ->
    // needs_input, proving the grounding gate end-to-end through the tool surface.
    const emptyBuilder = (): unknown => {
      const self: Record<string, unknown> = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (onfulfilled: (v: { data: null; error: null }) => unknown) =>
                Promise.resolve({ data: null, error: null }).then(onfulfilled);
            }
            if (prop === 'maybeSingle' || prop === 'single') {
              return () => Promise.resolve({ data: null, error: null });
            }
            return () => self;
          },
        },
      );
      return self;
    };
    __setUserSupabaseFactory(() => ({ from: () => emptyBuilder() }) as unknown as SupabaseClient);

    const client = await connect();
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'build_avatar_stage', arguments: { stage: 's1' } }),
    );
    __setUserSupabaseFactory(null);
    const sc = res.structuredContent as { ok: boolean; mode: string; needs_input?: Array<{ slot: number }> };
    expect(sc.ok).toBe(false);
    expect(sc.mode).toBe('stage');
    expect(sc.needs_input?.[0].slot).toBe(1);
  });
});

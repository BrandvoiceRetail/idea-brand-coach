// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  saveArtifact,
  getCurrentArtifact,
  getChain,
  saveSignatureChoice,
  ArtifactStoreError,
} from '../service/artifactStore.js';
import { __setUserSupabaseFactory, getUserSupabase, UnauthenticatedError } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';
import type { ArtifactKind, EvidenceRef } from '../contracts/index.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };
const anon: Identity = { userId: null, token: null, authenticated: false };

/** One captured PostgREST operation against the stub. */
interface Op {
  /** Table name for from()-rooted ops; the RPC name for rpc()-rooted ops. */
  table: string;
  verb: 'insert' | 'update' | 'select' | 'rpc';
  /** insert/update payload, or the RPC argument object. */
  payload?: Record<string, unknown>;
  filters: Array<{ op: string; col: string; val: unknown }>;
}

interface Result {
  data: unknown;
  error: { message: string } | null;
}

/**
 * Chainable fake of the PostgREST query builder. Every chain method returns `this`
 * and records its filters; the terminal awaiters (`single`/`maybeSingle`/`order` and
 * the implicit thenable) resolve the per-verb queued result. This lets the tests drive
 * insert-then-supersede and read paths without any network.
 */
class QueryStub implements PromiseLike<Result> {
  filters: Op['filters'] = [];
  payload?: Record<string, unknown>;
  constructor(
    private readonly op: Op,
    private readonly resolve: (op: Op) => Result,
  ) {}
  private rec(op: string, col: string, val: unknown): this {
    this.filters.push({ op, col, val });
    this.op.filters.push({ op, col, val });
    return this;
  }
  insert(payload: Record<string, unknown>): this {
    this.op.payload = payload;
    return this;
  }
  update(payload: Record<string, unknown>): this {
    this.op.payload = payload;
    return this;
  }
  select(): this {
    return this;
  }
  eq(col: string, val: unknown): this {
    return this.rec('eq', col, val);
  }
  is(col: string, val: unknown): this {
    return this.rec('is', col, val);
  }
  neq(col: string, val: unknown): this {
    return this.rec('neq', col, val);
  }
  order(): Promise<Result> {
    return Promise.resolve(this.resolve(this.op));
  }
  single(): Promise<Result> {
    return Promise.resolve(this.resolve(this.op));
  }
  maybeSingle(): Promise<Result> {
    return Promise.resolve(this.resolve(this.op));
  }
  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.resolve(this.op)).then(onfulfilled, onrejected);
  }
}

class SupabaseStub {
  readonly ops: Op[] = [];
  /** Queue of results keyed by verb, consumed FIFO. */
  private queue: Partial<Record<Op['verb'], Result[]>> = {};

  enqueue(verb: Op['verb'], result: Result): this {
    (this.queue[verb] ??= []).push(result);
    return this;
  }

  from(table: string): QueryStub {
    const op: Op = { table, verb: 'select', filters: [] };
    this.ops.push(op);
    return new QueryStub(op, (finalized) => {
      // Verb inference from the captured shape (rpc ops are pre-tagged, never inferred):
      //  - no payload          → select (read path)
      //  - payload is exactly { superseded_by } → update (the supersede call)
      //  - any other payload    → insert
      if (finalized.verb !== 'rpc') {
        const payloadKeys = finalized.payload ? Object.keys(finalized.payload) : [];
        if (!finalized.payload) {
          finalized.verb = 'select';
        } else if (payloadKeys.length === 1 && payloadKeys[0] === 'superseded_by') {
          finalized.verb = 'update';
        } else {
          finalized.verb = 'insert';
        }
      }
      const next = this.queue[finalized.verb]?.shift();
      if (!next) {
        throw new Error(`no queued ${finalized.verb} result for ${finalized.table} (filters: ${JSON.stringify(finalized.filters)})`);
      }
      return next;
    });
  }

  /** rpc(name, args) → a QueryStub pre-tagged as a single-op 'rpc' verb. */
  rpc(name: string, args: Record<string, unknown>): QueryStub {
    const op: Op = { table: name, verb: 'rpc', payload: args, filters: [] };
    this.ops.push(op);
    return new QueryStub(op, (finalized) => {
      const next = this.queue.rpc?.shift();
      if (!next) {
        throw new Error(`no queued rpc result for ${finalized.table} (args: ${JSON.stringify(finalized.payload)})`);
      }
      return next;
    });
  }
}

function installStub(): SupabaseStub {
  const stub = new SupabaseStub();
  __setUserSupabaseFactory(() => stub as unknown as SupabaseClient);
  return stub;
}

afterEach(() => {
  __setUserSupabaseFactory(null);
});

// --- Minimal valid artifact contents per kind used below ---
const validSignature = {
  options: [
    { option: 1, sentence: 'Built for collectors who refuse to compromise.' },
    { option: 2, sentence: 'The vault your cards deserve.' },
  ],
  grounding: 'inference' as const,
  evidence_refs: [] as EvidenceRef[],
};

const evidenceRef: EvidenceRef = { kind: 'review', ref: 'rev-7: "holds my whole PSA set"' };

describe('supabaseUser (JWT-bound, RLS-honoring client)', () => {
  afterEach(() => __setUserSupabaseFactory(null));

  it('throws UnauthenticatedError outside any identity scope', () => {
    expect(() => getUserSupabase()).toThrow(UnauthenticatedError);
  });

  it('throws UnauthenticatedError for an anonymous identity', async () => {
    await runWithIdentity(anon, async () => {
      expect(() => getUserSupabase()).toThrow(UnauthenticatedError);
    });
  });

  it('binds the caller JWT as an Authorization: Bearer header', async () => {
    let seenToken: string | null = null;
    __setUserSupabaseFactory((token) => {
      seenToken = token;
      return {} as unknown as SupabaseClient;
    });
    await runWithIdentity(authed, async () => {
      getUserSupabase();
    });
    expect(seenToken).toBe('jwt-abc');
  });
});

describe('artifactStore.saveArtifact (atomic supersede→insert→repoint RPC)', () => {
  it('saves via a single atomic RPC carrying user/kind/scope and returns the new current row', async () => {
    const stub = installStub();
    const newRow = {
      id: 'art-2',
      user_id: 'user-1',
      avatar_id: null,
      kind: 'signature' as ArtifactKind,
      content: validSignature,
      grounding: 'inference',
      evidence_refs: [],
      superseded_by: null,
      created_at: '2026-06-05T00:00:00Z',
    };
    stub.enqueue('rpc', { data: newRow, error: null });

    const row = await runWithIdentity(authed, () => saveArtifact('signature', validSignature, { grounding: 'inference', evidenceRefs: [] }));

    expect(row.id).toBe('art-2');
    // Exactly ONE op: the atomic save RPC (no separate insert + supersede that could
    // transiently create a second current row — the R1 regeneration defect).
    expect(stub.ops).toHaveLength(1);
    const [rpc] = stub.ops;
    expect(rpc.verb).toBe('rpc');
    expect(rpc.table).toBe('save_artifact_atomic');
    expect(rpc.payload).toEqual({
      p_user_id: 'user-1',
      p_avatar_id: null,
      p_kind: 'signature',
      p_content: validSignature,
      p_grounding: 'inference',
      p_evidence_refs: [],
    });
  });

  it('passes the given avatar id to the RPC when provided', async () => {
    const stub = installStub();
    stub.enqueue('rpc', { data: { id: 'art-9', avatar_id: 'av-1' }, error: null });

    await runWithIdentity(authed, () =>
      saveArtifact('signature', validSignature, { grounding: 'inference', evidenceRefs: [], avatarId: 'av-1' }),
    );

    expect(stub.ops).toHaveLength(1);
    expect(stub.ops[0].payload).toMatchObject({ p_avatar_id: 'av-1', p_kind: 'signature' });
  });

  it('regeneration on an existing current row succeeds (no duplicate-current failure path)', async () => {
    // Two consecutive saves of the same (user, avatar, kind). Under the old insert-then-
    // supersede ordering the SECOND save tripped uq_artifacts_current_per_kind; the RPC
    // makes each save a single atomic op, so the repeat succeeds and returns the new row.
    const stub = installStub();
    stub.enqueue('rpc', { data: { id: 'art-v1' }, error: null });
    stub.enqueue('rpc', { data: { id: 'art-v2' }, error: null });

    const first = await runWithIdentity(authed, () =>
      saveArtifact('signature', validSignature, { grounding: 'inference', evidenceRefs: [] }),
    );
    const second = await runWithIdentity(authed, () =>
      saveArtifact('signature', validSignature, { grounding: 'inference', evidenceRefs: [] }),
    );

    expect(first.id).toBe('art-v1');
    expect(second.id).toBe('art-v2');
    expect(stub.ops).toHaveLength(2);
    expect(stub.ops.every((o) => o.verb === 'rpc')).toBe(true);
  });

  it('surfaces an RPC error as ArtifactStoreError (chain left untouched on failure)', async () => {
    // The RPC is one transaction: a failure rolls back the supersede AND the insert, so
    // the chain is never left with zero current rows. The store maps the error verbatim.
    const stub = installStub();
    stub.enqueue('rpc', { data: null, error: { message: 'duplicate key value' } });
    await expect(
      runWithIdentity(authed, () => saveArtifact('signature', validSignature, { grounding: 'inference', evidenceRefs: [] })),
    ).rejects.toThrow(/duplicate key value/);
  });

  it('rejects content that violates the kind contract before any DB write', async () => {
    const stub = installStub();
    await expect(
      runWithIdentity(authed, () =>
        // signature requires options[].sentence; this payload is malformed.
        saveArtifact('signature', { options: [{ option: 1 }], grounding: 'inference', evidence_refs: [] }, { grounding: 'inference', evidenceRefs: [] }),
      ),
    ).rejects.toBeInstanceOf(ArtifactStoreError);
    expect(stub.ops).toHaveLength(0); // never reached the DB
  });

  it('rejects grounding=evidence with empty evidence_refs (manifest §6 gate)', async () => {
    const stub = installStub();
    await expect(
      runWithIdentity(authed, () =>
        saveArtifact('signature', { ...validSignature, grounding: 'evidence', evidence_refs: [evidenceRef] }, { grounding: 'evidence', evidenceRefs: [] }),
      ),
    ).rejects.toThrow(/evidence_refs/);
    expect(stub.ops).toHaveLength(0);
  });

  it('accepts grounding=evidence when evidence_refs are present', async () => {
    const stub = installStub();
    const content = { ...validSignature, grounding: 'evidence' as const, evidence_refs: [evidenceRef] };
    stub.enqueue('rpc', { data: { id: 'art-e1' }, error: null });

    const row = await runWithIdentity(authed, () =>
      saveArtifact('signature', content, { grounding: 'evidence', evidenceRefs: [evidenceRef] }),
    );
    expect(row.id).toBe('art-e1');
    expect(stub.ops[0].payload).toMatchObject({ p_grounding: 'evidence', p_evidence_refs: [evidenceRef] });
  });

  it('requires an authenticated caller (RLS client unavailable for anon)', async () => {
    installStub();
    await expect(
      runWithIdentity(anon, () => saveArtifact('signature', validSignature, { grounding: 'inference', evidenceRefs: [] })),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe('artifactStore reads', () => {
  it('getCurrentArtifact selects the non-superseded row for the kind/scope', async () => {
    const stub = installStub();
    stub.enqueue('select', { data: { id: 'art-cur', kind: 'signature' }, error: null });
    const row = await runWithIdentity(authed, () => getCurrentArtifact('signature'));
    expect(row?.id).toBe('art-cur');
    const op = stub.ops[0];
    expect(op.filters).toContainEqual({ op: 'eq', col: 'kind', val: 'signature' });
    expect(op.filters).toContainEqual({ op: 'is', col: 'superseded_by', val: null });
    expect(op.filters).toContainEqual({ op: 'is', col: 'avatar_id', val: null });
  });

  it('getCurrentArtifact returns null when none exists', async () => {
    const stub = installStub();
    stub.enqueue('select', { data: null, error: null });
    const row = await runWithIdentity(authed, () => getCurrentArtifact('brand_canvas', 'av-1'));
    expect(row).toBeNull();
    expect(stub.ops[0].filters).toContainEqual({ op: 'eq', col: 'avatar_id', val: 'av-1' });
  });

  it('getChain returns only current rows, newest first', async () => {
    const stub = installStub();
    stub.enqueue('select', { data: [{ id: 'a' }, { id: 'b' }], error: null });
    const rows = await runWithIdentity(authed, () => getChain());
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(stub.ops[0].filters).toContainEqual({ op: 'is', col: 'superseded_by', val: null });
  });
});

describe('artifactStore.saveSignatureChoice', () => {
  it('writes a signature artifact AND a signatures row (atomic artifact RPC + signatures insert)', async () => {
    const stub = installStub();
    // Artifact is written FIRST (via the atomic RPC) so the signatures row can carry its
    // artifact_id FK.
    stub.enqueue('rpc', { data: { id: 'art-sig-1' }, error: null }); // signature artifact (atomic save)
    stub.enqueue('insert', { data: { id: 'sig-1', chosen_index: 1 }, error: null }); // signatures row

    const res = await runWithIdentity(authed, () =>
      saveSignatureChoice({
        options: validSignature.options,
        chosenOption: 1,
        grounding: 'inference',
        evidenceRefs: [],
      }),
    );

    expect(res.signature.id).toBe('sig-1');
    expect(res.artifact.id).toBe('art-sig-1');
    // Artifact first (the chain, via the atomic save RPC), then the dedicated signatures row.
    expect(stub.ops[0].verb).toBe('rpc');
    expect(stub.ops[0].table).toBe('save_artifact_atomic');
    expect(stub.ops[0].payload).toMatchObject({ p_kind: 'signature', p_user_id: 'user-1' });
    // The persisted artifact carries the chosen option through the contract.
    expect((stub.ops[0].payload?.p_content as { chosen_option?: number }).chosen_option).toBe(1);
    // signatures row uses the LIVE columns and links back to the artifact.
    expect(stub.ops[1].table).toBe('signatures');
    expect(stub.ops[1].payload).toMatchObject({
      user_id: 'user-1',
      chosen_index: 1,
      all_options: validSignature.options,
      signature_text: validSignature.options[0].sentence,
      used_reviews: false,
      inference: true,
      artifact_id: 'art-sig-1',
    });
  });

  it('rejects a chosen_option not present in the options list', async () => {
    const stub = installStub();
    await expect(
      runWithIdentity(authed, () =>
        saveSignatureChoice({ options: validSignature.options, chosenOption: 99, grounding: 'inference', evidenceRefs: [] }),
      ),
    ).rejects.toThrow(/not among/);
    expect(stub.ops).toHaveLength(0);
  });
});

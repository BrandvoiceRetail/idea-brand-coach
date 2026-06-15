// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registerGenerateSignatureTool } from '../tools/generateSignature.js';
import { registerPersistSignatureTool } from '../tools/persistSignature.js';
import { EdgeFnClient, type EdgeFnResult } from '../edgeFn/client.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };
const anon: Identity = { userId: null, token: null, authenticated: false };

interface RevealResponse {
  options: string[];
  usedReviews: boolean;
  inference: boolean;
}

/** Stub EdgeFnClient returning a canned reveal-signature reply (and recording the body). */
function stubEdgeFn(
  reply: RevealResponse | null,
  capture?: (body: unknown) => void,
): EdgeFnClient {
  return {
    invoke: async <T>(name: string, body: unknown): Promise<EdgeFnResult<T>> => {
      capture?.(body);
      if (name === 'reveal-signature' && reply) return { ok: true, data: reply as T };
      return { ok: false, data: null, note: 'unavailable' };
    },
  } as unknown as EdgeFnClient;
}

/** Build a fresh server with only the signature tools registered, connect a client. */
async function connectGenerate(edgeFn: EdgeFnClient): Promise<Client> {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerGenerateSignatureTool(server, edgeFn);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return client;
}

async function connectPersist(): Promise<Client> {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerPersistSignatureTool(server);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return client;
}

/** Minimal chainable Supabase stub: insert().select().single() resolves a queued row. */
function installSignatureStub(): { tables: string[]; payloads: Array<Record<string, unknown>> } {
  const tables: string[] = [];
  const payloads: Array<Record<string, unknown>> = [];
  let inserted = 0;
  const builder = (table: string): unknown => {
    let payload: Record<string, unknown> | undefined;
    const self: Record<string, unknown> = {
      insert(p: Record<string, unknown>) {
        payload = p;
        tables.push(table);
        payloads.push(p);
        return self;
      },
      update() {
        return self;
      },
      select() {
        return self;
      },
      eq() {
        return self;
      },
      is() {
        return self;
      },
      neq() {
        return self;
      },
      order() {
        // supersede update path resolves here with no row
        return Promise.resolve({ data: null, error: null });
      },
      single() {
        inserted += 1;
        const id = table === 'signatures' ? 'sig-1' : 'art-1';
        return Promise.resolve({ data: { id, ...payload }, error: null });
      },
      maybeSingle() {
        return Promise.resolve({ data: null, error: null });
      },
      then(onfulfilled: (v: { data: unknown; error: null }) => unknown) {
        // bare-await on the supersede update -> resolve empty
        return Promise.resolve({ data: null, error: null }).then(onfulfilled);
      },
    };
    return self;
  };
  // saveArtifact now persists via the `save_artifact_atomic` RPC (R1 fix) rather than a
  // from().insert()+update() pair; the stub answers that rpc() with the same artifact row.
  const rpc = (name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: null }> => {
    tables.push('artifacts');
    payloads.push(args);
    return Promise.resolve({ data: { id: 'art-1', ...args }, error: null });
  };
  __setUserSupabaseFactory(
    () =>
      ({
        from: (t: string) => builder(t),
        rpc: (name: string, args: Record<string, unknown>) => ({ single: () => rpc(name, args) }),
      }) as unknown as SupabaseClient,
  );
  return { tables, payloads };
}

afterEach(() => __setUserSupabaseFactory(null));

describe('generate_signature tool', () => {
  it('wraps reveal-signature and maps options into the contract row shape (evidence grounding)', async () => {
    let sentBody: unknown;
    const edge = stubEdgeFn(
      { options: ["Not buying X, they're buying Y.", 'The vault their cards deserve.'], usedReviews: true, inference: false },
      (b) => {
        sentBody = b;
      },
    );
    const client = await connectGenerate(edge);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'generate_signature', arguments: { reviews: 'holds my whole PSA set' } }),
    );
    const sc = res.structuredContent as {
      ok: boolean;
      options: Array<{ option: number; sentence: string }>;
      grounding: string;
      used_reviews: boolean;
    };
    expect(sc.ok).toBe(true);
    expect(sc.options).toEqual([
      { option: 1, sentence: "Not buying X, they're buying Y." },
      { option: 2, sentence: 'The vault their cards deserve.' },
    ]);
    expect(sc.grounding).toBe('evidence');
    expect(sc.used_reviews).toBe(true);
    // verbatim pass-through: caller reviews reach the engine untouched
    expect((sentBody as { reviews: string }).reviews).toBe('holds my whole PSA set');
  });

  it('reports inference grounding when the engine did not use reviews', async () => {
    const edge = stubEdgeFn({ options: ['An on-brand candidate.'], usedReviews: false, inference: true });
    const client = await connectGenerate(edge);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'generate_signature', arguments: { fields: { tone: 'confident' } } }),
    );
    const sc = res.structuredContent as { ok: boolean; grounding: string; inference: boolean };
    expect(sc.ok).toBe(true);
    expect(sc.grounding).toBe('inference');
    expect(sc.inference).toBe(true);
  });

  it('degrades (ok:false) when the engine returns no options', async () => {
    const edge = stubEdgeFn(null);
    const client = await connectGenerate(edge);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'generate_signature', arguments: { reviews: 'x' } }),
    );
    const sc = res.structuredContent as { ok: boolean; options: unknown[] };
    expect(sc.ok).toBe(false);
    expect(sc.options).toEqual([]);
  });
});

describe('persist_signature tool', () => {
  const options = [
    { option: 1, sentence: 'Built for collectors who refuse to compromise.' },
    { option: 2, sentence: 'The vault your cards deserve.' },
  ];

  it('denies anonymous callers before any store write', async () => {
    const client = await connectPersist(); // no stub installed: a leaked write would throw
    const res = await client.callTool({
      name: 'persist_signature',
      arguments: { options, chosen_index: 1 },
    });
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/unauthenticated/i);
  });

  it('round-trips a chosen option through saveSignatureChoice (signatures + artifact rows)', async () => {
    const captured = installSignatureStub();
    const client = await connectPersist();
    const res = await runWithIdentity(authed, () =>
      client.callTool({
        name: 'persist_signature',
        arguments: { options, chosen_index: 2, used_reviews: true },
      }),
    );
    const sc = res.structuredContent as {
      ok: boolean;
      signature_id: string;
      artifact_id: string;
      chosen_option: number;
      grounding: string;
    };
    expect(sc.ok).toBe(true);
    expect(sc.signature_id).toBe('sig-1');
    expect(sc.artifact_id).toBe('art-1');
    expect(sc.chosen_option).toBe(2);
    expect(sc.grounding).toBe('evidence');
    // Both stores written: the dedicated signatures row and the chain artifact.
    expect(captured.tables).toContain('signatures');
    expect(captured.tables).toContain('artifacts');
    // The signatures row uses the live `chosen_index` column (not chosen_option).
    const sigPayload = captured.payloads.find((p) => p.chosen_index === 2);
    expect(sigPayload).toBeDefined();
  });

  it('rejects a chosen_index not present in the options (ArtifactStoreError surfaced)', async () => {
    installSignatureStub();
    const client = await connectPersist();
    const res = await runWithIdentity(authed, () =>
      client.callTool({
        name: 'persist_signature',
        arguments: { options, chosen_index: 99 },
      }),
    );
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/not among/);
  });
});

// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registerGetContextStatusTool } from '../tools/getContextStatus.js';
import { registerProvideContextTool } from '../tools/provideContext.js';
import { registerIngestEvidenceTool, parseReviews } from '../tools/ingestEvidence.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };
const anon: Identity = { userId: null, token: null, authenticated: false };

/** One captured PostgREST op. */
interface Op {
  table: string;
  verb: 'insert' | 'update' | 'select';
  payload?: unknown;
  filters: Array<{ op: string; col: string; val: unknown }>;
}
interface Result {
  data: unknown;
  error: { message: string } | null;
}

/**
 * Per-(table,verb) FIFO result queue mirroring the PostgREST surface the services use.
 * Borrowed from contextResolver.test.ts so the same readers/writers behave identically.
 */
class Stub {
  readonly ops: Op[] = [];
  private queue: Record<string, Result[]> = {};
  on(table: string, verb: Op['verb'], result: Result): this {
    (this.queue[`${table}:${verb}`] ??= []).push(result);
    return this;
  }
  private take(table: string, verb: Op['verb']): Result {
    return this.queue[`${table}:${verb}`]?.shift() ?? { data: null, error: null };
  }
  from(table: string): Builder {
    return new Builder(table, this.ops, (op) => this.take(op.table, op.verb));
  }
}

class Builder implements PromiseLike<Result> {
  private readonly op: Op;
  constructor(
    table: string,
    private readonly ops: Op[],
    private readonly resolveOp: (op: Op) => Result,
  ) {
    this.op = { table, verb: 'select', filters: [] };
    this.ops.push(this.op);
  }
  insert(payload: unknown): this {
    this.op.verb = 'insert';
    this.op.payload = payload;
    return this;
  }
  update(payload: unknown): this {
    this.op.verb = 'update';
    this.op.payload = payload;
    return this;
  }
  select(): this {
    return this;
  }
  private rec(op: string, col: string, val: unknown): this {
    this.op.filters.push({ op, col, val });
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
  not(col: string, _op: string, val: unknown): this {
    return this.rec('not', col, val);
  }
  in(col: string, val: unknown): this {
    return this.rec('in', col, val);
  }
  limit(): this {
    return this;
  }
  order(): this {
    return this;
  }
  single(): Promise<Result> {
    return Promise.resolve(this.resolveOp(this.op));
  }
  maybeSingle(): Promise<Result> {
    return Promise.resolve(this.resolveOp(this.op));
  }
  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.resolveOp(this.op)).then(onfulfilled, onrejected);
  }
}

function install(): Stub {
  const stub = new Stub();
  __setUserSupabaseFactory(() => stub as unknown as SupabaseClient);
  return stub;
}

async function connect(register: (s: McpServer) => void): Promise<Client> {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  register(server);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return client;
}

afterEach(() => __setUserSupabaseFactory(null));

// ---------------------------------------------------------------------------------------
// get_context_status
// ---------------------------------------------------------------------------------------
describe('get_context_status tool', () => {
  it('surfaces needs_input for every unfilled required slot (all stores empty)', async () => {
    install(); // every queue empty → all slots resolve missing
    const client = await connect(registerGetContextStatusTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'get_context_status', arguments: { target: 'signature' } }),
    );
    const sc = res.structuredContent as {
      ok: boolean;
      target: string;
      all_filled: boolean;
      fill_map: Array<{ slot: number; status: string }>;
      needs_input: Array<{ slot: number; question: string; why: string; current_guess: unknown; status: string }>;
    };
    expect(sc.ok).toBe(true);
    // signature requiredContext = [1, 12, 13]; all missing.
    expect(sc.fill_map.map((f) => f.slot).sort()).toEqual([1, 12, 13]);
    expect(sc.needs_input.map((n) => n.slot).sort()).toEqual([1, 12, 13]);
    expect(sc.all_filled).toBe(false);
    // Each needs_input carries the slot's askQuestion + a null guess for missing slots.
    const slot1 = sc.needs_input.find((n) => n.slot === 1);
    expect(slot1?.question).toMatch(/paste your product reviews/i);
    expect(slot1?.current_guess).toBeNull();
    expect(slot1?.status).toBe('missing');
  });

  it('omits satisfied slots from needs_input (filled-stated does not surface)', async () => {
    const stub = install();
    // Slot 9 (cash constraints) resolves filled-stated from business_facts → out of needs_input.
    stub.on('business_facts', 'select', {
      data: { content: 'tight cash', structured_data: { repayment: 1000 }, updated_at: new Date().toISOString() },
      error: null,
    });
    const client = await connect(registerGetContextStatusTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'get_context_status', arguments: { target: 'rollout_plan' } }),
    );
    const sc = res.structuredContent as {
      fill_map: Array<{ slot: number; status: string }>;
      needs_input: Array<{ slot: number }>;
    };
    // rollout_plan requiredContext = [17, 9, 11, 8]; 17 is framework (filled-stated), 9 filled now.
    const slot9 = sc.fill_map.find((f) => f.slot === 9);
    expect(slot9?.status).toBe('filled-stated');
    expect(sc.needs_input.find((n) => n.slot === 9)).toBeUndefined();
    expect(sc.needs_input.find((n) => n.slot === 17)).toBeUndefined(); // framework satisfied
  });

  it('workbook_a resolves the union of its sheet contracts', async () => {
    install();
    const client = await connect(registerGetContextStatusTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'get_context_status', arguments: { target: 'workbook_a' } }),
    );
    const sc = res.structuredContent as { fill_map: Array<{ slot: number }> };
    const slots = sc.fill_map.map((f) => f.slot).sort((a, b) => a - b);
    // Union across diagnostic + avatar S1-S4 + signature + canvas + brief + audit×idea.
    // Includes the fabrication-gated PRODUCT-TRUTH slots 5 & 6 (from the brief).
    expect(slots).toContain(1);
    expect(slots).toContain(6);
    expect(slots).toContain(18);
    expect(new Set(slots).size).toBe(slots.length); // deduplicated
  });
});

// ---------------------------------------------------------------------------------------
// provide_context
// ---------------------------------------------------------------------------------------
describe('provide_context tool', () => {
  it('denies anonymous callers before any store write', async () => {
    const client = await connect(registerProvideContextTool); // no stub: a leaked write would throw
    const res = await client.callTool({
      name: 'provide_context',
      arguments: { answers: [{ slot: 8, value: { revenue: 10000 } }] },
    });
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/unauthenticated/i);
  });

  it('persists a BUSINESS-FACT answer and re-resolves it to filled-stated', async () => {
    const stub = install();
    // Write path: read prior (none) → insert. Re-resolve read: returns the fresh fact.
    stub.on('business_facts', 'select', { data: null, error: null }); // writeback: no prior current
    stub.on('business_facts', 'insert', { data: { id: 'bf-1' }, error: null });
    stub.on('business_facts', 'select', {
      data: { content: '{"revenue":10000}', structured_data: { revenue: 10000 }, updated_at: new Date().toISOString() },
      error: null,
    }); // re-resolve read
    const client = await connect(registerProvideContextTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({
        name: 'provide_context',
        arguments: { answers: [{ slot: 8, value: { revenue: 10000 } }] },
      }),
    );
    const sc = res.structuredContent as {
      ok: boolean;
      persisted: number;
      results: Array<{ slot: number; ok: boolean; store: string; status: string }>;
    };
    expect(sc.ok).toBe(true);
    expect(sc.persisted).toBe(1);
    expect(sc.results[0].store).toBe('business_facts');
    expect(sc.results[0].status).toBe('filled-stated');
    // The fact landed in the dedicated business_facts table, field_identifier = slot id.
    const ins = stub.ops.find((o) => o.table === 'business_facts' && o.verb === 'insert');
    expect(ins?.payload).toMatchObject({ field_identifier: '8', is_current: true });
  });

  it('per-answer never-fail: a failed answer does not abort the others', async () => {
    const stub = install();
    // Slot 17 (FRAMEWORK) is not user-answerable → its storeAnswer rejects.
    // Slot 8 (BUSINESS-FACT) persists fine.
    stub.on('business_facts', 'select', { data: null, error: null });
    stub.on('business_facts', 'insert', { data: { id: 'bf-2' }, error: null });
    stub.on('business_facts', 'select', {
      data: { structured_data: { x: 1 }, content: null, updated_at: new Date().toISOString() },
      error: null,
    });
    const client = await connect(registerProvideContextTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({
        name: 'provide_context',
        arguments: {
          answers: [
            { slot: 17, value: 'cannot route' },
            { slot: 8, value: { x: 1 } },
          ],
        },
      }),
    );
    const sc = res.structuredContent as {
      ok: boolean;
      persisted: number;
      failed: number;
      results: Array<{ slot: number; ok: boolean; note?: string }>;
    };
    expect(sc.persisted).toBe(1);
    expect(sc.failed).toBe(1);
    expect(sc.results.find((r) => r.slot === 17)?.ok).toBe(false);
    expect(sc.results.find((r) => r.slot === 17)?.note).toMatch(/not user-answerable|no write-back/i);
    expect(sc.results.find((r) => r.slot === 8)?.ok).toBe(true);
  });

  it('OWNER-INTENT answer routes to avatar_field_values with the avatar scope', async () => {
    const stub = install();
    stub.on('avatar_field_values', 'insert', { data: { id: 'afv-1' }, error: null });
    // Re-resolve read for slot 12 (avatar_field_values first).
    stub.on('avatar_field_values', 'select', {
      data: { field_value: 'premium anchor', field_source: 'manual', extracted_at: new Date().toISOString() },
      error: null,
    });
    const client = await connect(registerProvideContextTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({
        name: 'provide_context',
        arguments: { answers: [{ slot: 12, value: 'premium anchor' }], avatar_id: 'av-1' },
      }),
    );
    const sc = res.structuredContent as { results: Array<{ slot: number; store: string; status: string }> };
    expect(sc.results[0].store).toBe('avatar_field_values');
    expect(sc.results[0].status).toBe('filled-stated');
    const ins = stub.ops.find((o) => o.table === 'avatar_field_values' && o.verb === 'insert');
    expect(ins?.payload).toMatchObject({ avatar_id: 'av-1', field_source: 'manual' });
  });
});

// ---------------------------------------------------------------------------------------
// ingest_evidence
// ---------------------------------------------------------------------------------------
describe('parseReviews', () => {
  it('chunks blank-line-separated reviews and extracts rating + reviewer', async () => {
    const text = [
      '5 stars\nBy Jane\nHolds my whole PSA set, exactly as described.',
      'Rating: 2\nFlimsy hinge, broke in a week.',
    ].join('\n\n');
    const out = parseReviews(text);
    expect(out).toHaveLength(2);
    expect(out[0].rating).toBe(5);
    expect(out[0].reviewer).toBe('Jane');
    expect(out[0].body).toMatch(/whole PSA set/);
    expect(out[1].rating).toBe(2);
  });

  it('falls back to one-per-line when there are no blank-line groups', async () => {
    const out = parseReviews('Great vault.\nLove the side loading.');
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.body.length > 0)).toBe(true);
  });

  it('never invents a rating/reviewer it cannot see', async () => {
    const out = parseReviews('Just a plain review with no metadata.');
    expect(out).toHaveLength(1);
    expect(out[0].rating).toBeUndefined();
    expect(out[0].reviewer).toBeUndefined();
  });

  it('returns [] for empty text', async () => {
    expect(parseReviews('   \n  ')).toEqual([]);
  });
});

describe('ingest_evidence tool', () => {
  it('denies anonymous callers before any store write', async () => {
    const client = await connect(registerIngestEvidenceTool); // no stub: leaked write would throw
    const res = await client.callTool({
      name: 'ingest_evidence',
      arguments: { reviews_text: 'great vault' },
    });
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/unauthenticated/i);
  });

  it('freezes pasted reviews into an evidence_snapshots row (reviews jsonb)', async () => {
    const stub = install();
    stub.on('evidence_snapshots', 'insert', { data: { id: 'snap-1' }, error: null });
    const client = await connect(registerIngestEvidenceTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({
        name: 'ingest_evidence',
        arguments: { reviews_text: '5 stars\nGreat vault.\n\nFlimsy.', source_label: 'iv paste' },
      }),
    );
    const sc = res.structuredContent as {
      ok: boolean;
      snapshot_id: string;
      reviews_parsed: number;
      reviews_rows: number;
      listing_captured: boolean;
    };
    expect(sc.ok).toBe(true);
    expect(sc.snapshot_id).toBe('snap-1');
    expect(sc.reviews_parsed).toBe(2);
    expect(sc.reviews_rows).toBe(0); // no product_id → no user_product_reviews rows
    const ins = stub.ops.find((o) => o.table === 'evidence_snapshots' && o.verb === 'insert');
    expect(ins?.payload).toMatchObject({ user_id: 'user-1', source: 'iv paste' });
    expect(Array.isArray((ins?.payload as { reviews?: unknown }).reviews)).toBe(true);
  });

  it('with a product_id, also writes user_product_reviews rows', async () => {
    const stub = install();
    stub.on('evidence_snapshots', 'insert', { data: { id: 'snap-2' }, error: null });
    stub.on('user_product_reviews', 'insert', { data: [{ id: 'r1' }, { id: 'r2' }], error: null });
    const client = await connect(registerIngestEvidenceTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({
        name: 'ingest_evidence',
        arguments: { reviews_text: 'Great vault.\n\nLove it.', product_id: 'prod-1' },
      }),
    );
    const sc = res.structuredContent as { reviews_rows: number };
    expect(sc.reviews_rows).toBe(2);
    const ins = stub.ops.find((o) => o.table === 'user_product_reviews' && o.verb === 'insert');
    const rows = ins?.payload as Array<{ product_id: string; body: string }>;
    expect(rows[0]).toMatchObject({ product_id: 'prod-1' });
    expect(rows[0].body.length).toBeGreaterThan(0);
  });

  it('captures listing copy into the snapshot listing column', async () => {
    const stub = install();
    stub.on('evidence_snapshots', 'insert', { data: { id: 'snap-3' }, error: null });
    const client = await connect(registerIngestEvidenceTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({
        name: 'ingest_evidence',
        arguments: { listing_text: 'Title: The Vault\nBullet 1: Holds 432 cards' },
      }),
    );
    const sc = res.structuredContent as { listing_captured: boolean };
    expect(sc.listing_captured).toBe(true);
    const ins = stub.ops.find((o) => o.table === 'evidence_snapshots');
    expect((ins?.payload as { listing?: { text: string } }).listing?.text).toMatch(/Holds 432 cards/);
  });

  it('asin-only returns a clearly-marked stub note and ingests nothing', async () => {
    install();
    const client = await connect(registerIngestEvidenceTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'ingest_evidence', arguments: { asin: 'B0XYZ' } }),
    );
    const sc = res.structuredContent as { ok: boolean; notes: string[]; snapshot_id: string | null };
    expect(sc.ok).toBe(false);
    expect(sc.snapshot_id).toBeNull();
    expect(sc.notes.join(' ')).toMatch(/not yet wired/i);
    expect(sc.notes.join(' ')).toContain('B0XYZ');
  });
});

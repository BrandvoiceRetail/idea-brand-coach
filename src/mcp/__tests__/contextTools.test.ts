// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registerGetContextStatusTool } from '../tools/getContextStatus.js';
import { registerProvideContextTool } from '../tools/provideContext.js';
import { registerRememberTool } from '../tools/remember.js';
import { registerRecallTool } from '../tools/recall.js';
import { registerIngestEvidenceTool, parseReviews } from '../tools/ingestEvidence.js';
import { EdgeFnClient, type EdgeFnResult } from '../edgeFn/client.js';
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

/** Stub EdgeFnClient for ingest_evidence: replies with `reply` (default: unavailable). */
function stubEdge(
  reply?: EdgeFnResult<unknown>,
  capture?: (name: string, body: unknown) => void,
): EdgeFnClient {
  return {
    invoke: async <T>(name: string, body: unknown): Promise<EdgeFnResult<T>> => {
      capture?.(name, body);
      return (reply ?? { ok: false, data: null, note: 'unavailable' }) as EdgeFnResult<T>;
    },
  } as unknown as EdgeFnClient;
}

/** Register ingest_evidence with a (usually never-called) stub edge client. */
const ingestWith =
  (edge: EdgeFnClient = stubEdge()) =>
  (s: McpServer): void =>
    registerIngestEvidenceTool(s, edge);

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
    // requireOwnedAvatar reads the avatar first (RLS ownership gate) before any write.
    stub.on('avatars', 'select', { data: { id: 'av-1', brand_id: 'brand-1' }, error: null });
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
// remember — proactive capture, relevance-filtered to the stated classes
// ---------------------------------------------------------------------------------------
describe('remember tool', () => {
  it('denies anonymous callers before any store write', async () => {
    const client = await connect(registerRememberTool); // no stub: a leaked write would throw
    const res = await client.callTool({
      name: 'remember',
      arguments: { facts: [{ slot: 8, value: { revenue: 10000 } }] },
    });
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/unauthenticated/i);
  });

  it('captures a BUSINESS-FACT and re-resolves it to confirmable filled-stated', async () => {
    const stub = install();
    stub.on('business_facts', 'select', { data: null, error: null }); // writeback: no prior current
    stub.on('business_facts', 'insert', { data: { id: 'bf-1' }, error: null });
    stub.on('business_facts', 'select', {
      data: { structured_data: { revenue: 10000 }, content: null, updated_at: new Date().toISOString() },
      error: null,
    }); // re-resolve read
    const client = await connect(registerRememberTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'remember', arguments: { facts: [{ slot: 8, value: { revenue: 10000 } }] } }),
    );
    const sc = res.structuredContent as {
      ok: boolean;
      captured: number;
      results: Array<{ slot: number; ok: boolean; store: string; status: string }>;
    };
    expect(sc.ok).toBe(true);
    expect(sc.captured).toBe(1);
    expect(sc.results[0].store).toBe('business_facts');
    expect(sc.results[0].status).toBe('filled-stated'); // never filled-evidence
  });

  it('REJECTS an EVIDENCE slot (verbatim) and points to ingest_evidence — no store write', async () => {
    install(); // any leaked write would surface as a different result than the rejection
    const client = await connect(registerRememberTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'remember', arguments: { facts: [{ slot: 1, value: 'a review the owner mentioned' }] } }),
    );
    const sc = res.structuredContent as {
      captured: number;
      rejected: number;
      results: Array<{ slot: number; ok: boolean; note?: string }>;
    };
    expect(sc.captured).toBe(0);
    expect(sc.rejected).toBe(1);
    expect(sc.results[0].ok).toBe(false);
    expect(sc.results[0].note).toMatch(/ingest_evidence/);
  });

  it('an inferred OWNER-INTENT fact stores field_source=ai → resolves filled-inferred (confirmable)', async () => {
    const stub = install();
    stub.on('avatars', 'select', { data: { id: 'av-1', brand_id: 'brand-1' }, error: null }); // ownership gate
    stub.on('avatar_field_values', 'insert', { data: { id: 'afv-1' }, error: null });
    stub.on('avatar_field_values', 'select', {
      data: { field_value: 'wants status', field_source: 'ai', extracted_at: new Date().toISOString() },
      error: null,
    }); // re-resolve read
    const client = await connect(registerRememberTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({
        name: 'remember',
        arguments: { facts: [{ slot: 14, value: 'wants status', source: 'inferred' }], avatar_id: 'av-1' },
      }),
    );
    const sc = res.structuredContent as { results: Array<{ slot: number; store: string; status: string }> };
    expect(sc.results[0].store).toBe('avatar_field_values');
    expect(sc.results[0].status).toBe('filled-inferred');
    const ins = stub.ops.find((o) => o.table === 'avatar_field_values' && o.verb === 'insert');
    expect(ins?.payload).toMatchObject({ field_source: 'ai' });
  });
});

// ---------------------------------------------------------------------------------------
// recall — the symmetric load half (session-start resurface)
// ---------------------------------------------------------------------------------------
describe('recall tool', () => {
  it('loads the filled slots as a readable summary, excluding framework slots', async () => {
    const stub = install();
    // One slot resolves from business_facts (the first business_facts reader wins the single
    // queued row). Slot 5 (product catalog, PRODUCT-TRUTH) now lists business_facts first in its
    // residesIn, so it wins — proving remember({slot:5}) is resurfaced. The rest of the stores are
    // empty. Framework slots (17/18) always fill but recall excludes them.
    stub.on('business_facts', 'select', {
      data: { structured_data: { registry: 'brand registered' }, content: null, updated_at: new Date().toISOString() },
      error: null,
    });
    const client = await connect(registerRecallTool);
    const res = await runWithIdentity(authed, () => client.callTool({ name: 'recall', arguments: {} }));
    const sc = res.structuredContent as {
      ok: boolean;
      known: Array<{ slot: number; class: string; status: string }>;
      missing: number;
    };
    expect(sc.ok).toBe(true);
    expect(sc.known.some((k) => k.slot === 5 && k.class === 'PRODUCT-TRUTH' && k.status === 'filled-stated')).toBe(true);
    expect(sc.known.some((k) => k.slot === 17 || k.slot === 18)).toBe(false); // framework excluded
  });

  it('empty brand → nothing on file', async () => {
    install(); // every store empty → only framework slots fill, which recall excludes
    const client = await connect(registerRecallTool);
    const res = await runWithIdentity(authed, () => client.callTool({ name: 'recall', arguments: {} }));
    const sc = res.structuredContent as { known: unknown[] };
    const text = (res.content as Array<{ text: string }>)[0].text;
    expect(sc.known).toEqual([]);
    expect(text).toMatch(/nothing is on file/i);
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
    const client = await connect(ingestWith()); // no stub: leaked write would throw
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
    const client = await connect(ingestWith());
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
    const client = await connect(ingestWith());
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
    const client = await connect(ingestWith());
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

  it('asin: scrapes reviews via review-scraper and freezes them (title folded, reviewer/rating kept)', async () => {
    const stub = install();
    stub.on('evidence_snapshots', 'insert', { data: { id: 'snap-asin' }, error: null });
    const calls: Array<{ name: string; body: { urls?: string[] } }> = [];
    const edge = stubEdge(
      {
        ok: true,
        data: {
          results: [
            {
              url: 'x',
              reviews: [
                { reviewerName: 'Kit', rating: 5, title: 'sleek design', body: 'my favorite binder' },
                { reviewerName: 'Anonymous', rating: 0, title: '', body: 'great quality' },
              ],
            },
          ],
        },
      },
      (name, body) => {
        calls.push({ name, body: body as { urls?: string[] } });
      },
    );
    const res = await runWithIdentity(authed, () =>
      connect(ingestWith(edge)).then((c) =>
        c.callTool({ name: 'ingest_evidence', arguments: { asin: 'B0CJBN849W', marketplace: 'co.uk' } }),
      ),
    );
    const sc = res.structuredContent as { ok: boolean; reviews_parsed: number; notes: string[] };
    expect(sc.ok).toBe(true);
    expect(sc.reviews_parsed).toBe(2);
    // Called review-scraper with the right marketplace /dp/ URL.
    expect(calls[0]?.name).toBe('review-scraper');
    expect(calls[0]?.body.urls?.[0]).toBe('https://www.amazon.co.uk/dp/B0CJBN849W');
    // Title folded into body; reviewer/rating captured; "Anonymous"/0 dropped.
    const ins = stub.ops.find((o) => o.table === 'evidence_snapshots' && o.verb === 'insert');
    const reviews = (ins?.payload as { reviews: Array<{ body: string; reviewer?: string; rating?: number }> }).reviews;
    expect(reviews[0].body).toContain('sleek design');
    expect(reviews[0].reviewer).toBe('Kit');
    expect(reviews[0].rating).toBe(5);
    expect(reviews[1].reviewer).toBeUndefined();
    expect(sc.notes.join(' ')).toMatch(/Scraped 2 review/);
  });

  it('asin: degrades to a note when the scrape fails — never fabricates', async () => {
    install();
    const edge = stubEdge({ ok: false, data: null, note: 'edge function review-scraper failed (HTTP 500)' });
    const res = await runWithIdentity(authed, () =>
      connect(ingestWith(edge)).then((c) =>
        c.callTool({ name: 'ingest_evidence', arguments: { asin: 'B000000001' } }),
      ),
    );
    const sc = res.structuredContent as { ok: boolean; snapshot_id: string | null; notes: string[] };
    expect(sc.ok).toBe(false);
    expect(sc.snapshot_id).toBeNull();
    expect(sc.notes.join(' ')).toMatch(/asin-scrape failed/i);
  });

  it('asin: notes zero results without inventing reviews', async () => {
    install();
    const edge = stubEdge({ ok: true, data: { results: [{ url: 'x', reviews: [] }] } });
    const res = await runWithIdentity(authed, () =>
      connect(ingestWith(edge)).then((c) =>
        c.callTool({ name: 'ingest_evidence', arguments: { asin: 'B000000001', marketplace: 'com' } }),
      ),
    );
    const sc = res.structuredContent as { ok: boolean; notes: string[] };
    expect(sc.ok).toBe(false);
    expect(sc.notes.join(' ')).toMatch(/0 reviews/);
  });

  it('asin: surfaces a per-URL scrape error (e.g. rate limit) instead of a generic 0-reviews note', async () => {
    install();
    const edge = stubEdge({
      ok: true,
      data: { results: [{ url: 'x', reviews: [], error: 'rate limit: global daily scrape budget reached' }] },
    });
    const res = await runWithIdentity(authed, () =>
      connect(ingestWith(edge)).then((c) =>
        c.callTool({ name: 'ingest_evidence', arguments: { asin: 'B000000001' } }),
      ),
    );
    const sc = res.structuredContent as { ok: boolean; notes: string[] };
    expect(sc.ok).toBe(false);
    expect(sc.notes.join(' ')).toMatch(/unavailable/i);
    expect(sc.notes.join(' ')).toMatch(/global daily scrape budget/i);
  });

  it('asin: a full amazon.* URL is passed through verbatim (marketplace ignored)', async () => {
    const stub = install();
    stub.on('evidence_snapshots', 'insert', { data: { id: 'snap-url' }, error: null });
    const calls: Array<{ body: { urls?: string[] } }> = [];
    const edge = stubEdge(
      { ok: true, data: { results: [{ url: 'x', reviews: [{ body: 'solid binder' }] }] } },
      (_n, body) => calls.push({ body: body as { urls?: string[] } }),
    );
    const res = await runWithIdentity(authed, () =>
      connect(ingestWith(edge)).then((c) =>
        c.callTool({
          name: 'ingest_evidence',
          arguments: { asin: 'https://www.amazon.de/dp/B000000002', marketplace: 'com' },
        }),
      ),
    );
    const sc = res.structuredContent as { ok: boolean; reviews_parsed: number };
    expect(sc.ok).toBe(true);
    expect(sc.reviews_parsed).toBe(1);
    expect(calls[0]?.body.urls?.[0]).toBe('https://www.amazon.de/dp/B000000002'); // verbatim, .com ignored
  });

  it('asin: rejects a non-ASIN / non-amazon input without calling the scraper (no fabrication)', async () => {
    install();
    const calls: string[] = [];
    const edge = stubEdge({ ok: true, data: { results: [] } }, (n) => calls.push(n));
    const bad = async (args: Record<string, unknown>) =>
      runWithIdentity(authed, () =>
        connect(ingestWith(edge)).then((c) => c.callTool({ name: 'ingest_evidence', arguments: args })),
      );

    const short = (await bad({ asin: 'B0XYZ' })).structuredContent as { ok: boolean; notes: string[] };
    expect(short.ok).toBe(false);
    expect(short.notes.join(' ')).toMatch(/not a valid 10-character ASIN/i);

    const traversal = (await bad({ asin: 'B0CJBN849W/../../s?k=x' })).structuredContent as { notes: string[] };
    expect(traversal.notes.join(' ')).toMatch(/not a valid 10-character ASIN/i);

    const evilMkt = (await bad({ asin: 'B000000001', marketplace: 'evil.com/x?=' })).structuredContent as { notes: string[] };
    expect(evilMkt.notes.join(' ')).toMatch(/unknown marketplace/i);

    const evilUrl = (await bad({ asin: 'https://evil.com/dp/B000000001' })).structuredContent as { notes: string[] };
    expect(evilUrl.notes.join(' ')).toMatch(/amazon\.\* product page/i);

    expect(calls).toHaveLength(0); // the scraper was never invoked for any invalid input
  });

  it('asin + product_id: scraped reviews are also written to user_product_reviews', async () => {
    const stub = install();
    stub.on('evidence_snapshots', 'insert', { data: { id: 'snap-pid' }, error: null });
    stub.on('user_product_reviews', 'insert', { data: [{ id: 'r1' }, { id: 'r2' }], error: null });
    const edge = stubEdge({
      ok: true,
      data: {
        results: [
          { url: 'x', reviews: [{ reviewerName: 'Kit', rating: 5, body: 'a' }, { reviewerName: 'Anne', rating: 4, body: 'b' }] },
        ],
      },
    });
    const res = await runWithIdentity(authed, () =>
      connect(ingestWith(edge)).then((c) =>
        c.callTool({ name: 'ingest_evidence', arguments: { asin: 'B000000001', product_id: 'prod-9' } }),
      ),
    );
    const sc = res.structuredContent as { reviews_rows: number };
    expect(sc.reviews_rows).toBe(2);
    const ins = stub.ops.find((o) => o.table === 'user_product_reviews' && o.verb === 'insert');
    expect((ins?.payload as Array<{ product_id: string }>)[0]).toMatchObject({ product_id: 'prod-9' });
  });
});

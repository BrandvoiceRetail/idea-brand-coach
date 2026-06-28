// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registerBulkIngestEvidenceTool, registerGetIngestJobTool } from '../tools/bulkIngest.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';
import { EdgeFnClient, type EdgeFnResult } from '../edgeFn/client.js';

const authed: Identity = { userId: 'user-1', token: 'jwt', authenticated: true };

interface Op { table: string; verb: 'select' | 'insert'; payload?: unknown }
interface Result { data: unknown; error: { message: string } | null }

class Stub {
  readonly ops: Op[] = [];
  private results: Record<string, Result> = {};
  on(table: string, verb: 'select' | 'insert', data: unknown, error: { message: string } | null = null): this {
    this.results[`${table}:${verb}`] = { data, error };
    return this;
  }
  take(table: string, verb: 'select' | 'insert'): Result {
    return this.results[`${table}:${verb}`] ?? { data: null, error: null };
  }
  from(table: string): Builder {
    return new Builder(table, this.ops, (t, v) => this.take(t, v));
  }
}
class Builder implements PromiseLike<Result> {
  private op: Op;
  constructor(
    private readonly table: string,
    ops: Op[],
    private readonly resolve: (t: string, v: 'select' | 'insert') => Result,
  ) {
    this.op = { table, verb: 'select' };
    ops.push(this.op);
  }
  insert(payload: unknown): this {
    this.op.verb = 'insert';
    this.op.payload = payload;
    return this;
  }
  select(): this {
    return this;
  }
  eq(): this {
    return this;
  }
  single(): Promise<Result> {
    return Promise.resolve(this.resolve(this.table, this.op.verb));
  }
  maybeSingle(): Promise<Result> {
    return Promise.resolve(this.resolve(this.table, this.op.verb));
  }
  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.resolve(this.table, this.op.verb)).then(onfulfilled, onrejected);
  }
}

function install(): Stub {
  const stub = new Stub();
  __setUserSupabaseFactory(() => stub as unknown as SupabaseClient);
  return stub;
}

function stubEdge(capture?: (name: string) => void): EdgeFnClient {
  return {
    invoke: async <T>(name: string): Promise<EdgeFnResult<T>> => {
      capture?.(name);
      return { ok: true, data: null } as EdgeFnResult<T>;
    },
  } as unknown as EdgeFnClient;
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

describe('bulk_ingest_evidence tool', () => {
  it('validates + dedups, enqueues job + items, and kicks the drainer', async () => {
    const stub = install().on('scrape_jobs', 'insert', { id: 'job-1' });
    const kicks: string[] = [];
    const res = await runWithIdentity(authed, () =>
      connect((s) => registerBulkIngestEvidenceTool(s, stubEdge((n) => kicks.push(n)))).then((c) =>
        c.callTool({
          name: 'bulk_ingest_evidence',
          // 2 valid (one duplicated), 1 invalid
          arguments: { asins: ['B0CJBN849W', 'B000000002', 'B0XYZ', 'B0CJBN849W'], marketplace: 'co.uk' },
        }),
      ),
    );
    const sc = res.structuredContent as { ok: boolean; job_id: string; queued: number; skipped: Array<{ input: string }> };
    expect(sc.ok).toBe(true);
    expect(sc.job_id).toBe('job-1');
    expect(sc.queued).toBe(2); // duplicate collapsed, invalid skipped
    expect(sc.skipped.map((s) => s.input)).toContain('B0XYZ');

    const itemsOp = stub.ops.find((o) => o.table === 'scrape_job_items' && o.verb === 'insert');
    const rows = itemsOp?.payload as Array<{ job_id: string; user_id: string; url: string; status: string; asin: string | null }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ job_id: 'job-1', user_id: 'user-1', status: 'pending' });
    expect(rows[0].url).toBe('https://www.amazon.co.uk/dp/B0CJBN849W');
    expect(kicks).toContain('process-scrape-jobs');
  });

  it('queues nothing (no job insert) when every ASIN is invalid', async () => {
    const stub = install();
    const res = await runWithIdentity(authed, () =>
      connect((s) => registerBulkIngestEvidenceTool(s, stubEdge())).then((c) =>
        c.callTool({ name: 'bulk_ingest_evidence', arguments: { asins: ['B0XYZ', 'not-an-asin'] } }),
      ),
    );
    const sc = res.structuredContent as { ok: boolean; queued: number };
    expect(sc.ok).toBe(false);
    expect(sc.queued).toBe(0);
    expect(stub.ops.some((o) => o.table === 'scrape_jobs')).toBe(false); // never touched the queue
  });

  it('denies an anonymous caller before any write', async () => {
    install();
    const res = await connect((s) => registerBulkIngestEvidenceTool(s, stubEdge())).then((c) =>
      c.callTool({ name: 'bulk_ingest_evidence', arguments: { asins: ['B0CJBN849W'] } }),
    );
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/unauthenticated/i);
  });
});

describe('get_ingest_job tool', () => {
  it('reports progress (status + pending = total-done-failed)', async () => {
    install().on('scrape_jobs', 'select', {
      id: 'job-1',
      status: 'running',
      total: 5,
      done: 2,
      failed: 1,
    });
    const kicks: string[] = [];
    const res = await runWithIdentity(authed, () =>
      connect((s) => registerGetIngestJobTool(s, stubEdge((n) => kicks.push(n)))).then((c) =>
        c.callTool({ name: 'get_ingest_job', arguments: { job_id: 'job-1' } }),
      ),
    );
    const sc = res.structuredContent as { ok: boolean; pending: number; job: { status: string } };
    expect(sc.ok).toBe(true);
    expect(sc.pending).toBe(2); // 5 - 2 - 1
    expect(sc.job.status).toBe('running');
    expect(kicks).toContain('process-scrape-jobs'); // checking progress nudges the drain
  });

  it('returns not found for an unknown job', async () => {
    install(); // scrape_jobs:select → default {data:null}
    const res = await runWithIdentity(authed, () =>
      connect((s) => registerGetIngestJobTool(s, stubEdge())).then((c) =>
        c.callTool({ name: 'get_ingest_job', arguments: { job_id: 'nope' } }),
      ),
    );
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/not found/i);
  });
});

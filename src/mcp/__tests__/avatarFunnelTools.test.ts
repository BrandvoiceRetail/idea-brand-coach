// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registerCreateAvatarTool } from '../tools/createAvatar.js';
import { registerListAvatarsTool } from '../tools/listAvatars.js';
import { registerSetCurrentAvatarTool } from '../tools/setCurrentAvatar.js';
import { registerSetPrimaryAvatarTool } from '../tools/setPrimaryAvatar.js';
import { registerRecordAvatarBuildTool } from '../tools/recordAvatarBuild.js';
import { registerUpsertFunnelTouchpointTool } from '../tools/upsertFunnelTouchpoint.js';
import { registerRunFunnelAuditTool } from '../tools/runFunnelAudit.js';
import { registerGetFunnelAuditTool } from '../tools/getFunnelAudit.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

interface Op {
  table?: string;
  rpc?: string;
  verb: 'insert' | 'update' | 'upsert' | 'select' | 'rpc';
  payload?: unknown;
  args?: unknown;
  filters: Array<{ op: string; col: string; val: unknown }>;
}
interface Result {
  data: unknown;
  error: { message: string } | null;
}

/** PostgREST + RPC stub: per-(table|rpc, verb) FIFO result queue. */
class Stub {
  readonly ops: Op[] = [];
  private queue: Record<string, Result[]> = {};
  on(key: string, verb: Op['verb'], result: Result): this {
    (this.queue[`${key}:${verb}`] ??= []).push(result);
    return this;
  }
  private take(key: string, verb: Op['verb']): Result {
    return this.queue[`${key}:${verb}`]?.shift() ?? { data: null, error: null };
  }
  from(table: string): Builder {
    return new Builder({ table, verb: 'select', filters: [] }, this.ops, (op) =>
      this.take(op.table as string, op.verb),
    );
  }
  rpc(name: string, args: unknown): Builder {
    return new Builder({ rpc: name, verb: 'rpc', args, filters: [] }, this.ops, (op) =>
      this.take(op.rpc as string, 'rpc'),
    );
  }
}

class Builder implements PromiseLike<Result> {
  constructor(
    private readonly op: Op,
    ops: Op[],
    private readonly resolveOp: (op: Op) => Result,
  ) {
    ops.push(this.op);
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
  upsert(payload: unknown): this {
    this.op.verb = 'upsert';
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
  order(): this {
    return this;
  }
  limit(): this {
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
// create_avatar — brand_id stamped server-side; never caller-supplied
// ---------------------------------------------------------------------------------------
describe('create_avatar tool', () => {
  it('denies anonymous callers before any write', async () => {
    const client = await connect(registerCreateAvatarTool);
    const res = await client.callTool({ name: 'create_avatar', arguments: { name: 'Collector' } });
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.note).toMatch(/unauthenticated/i);
  });

  it('resolves the brand server-side and stamps brand_id on the insert', async () => {
    const stub = install();
    stub.on('brands', 'select', { data: { id: 'brand-1' }, error: null }); // resolveBrandId
    stub.on('avatars', 'insert', {
      data: { id: 'av-9', brand_id: 'brand-1', name: 'Collector', description: null, is_primary: false, created_at: 't', updated_at: 't' },
      error: null,
    });
    const client = await connect(registerCreateAvatarTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'create_avatar', arguments: { name: 'Collector' } }),
    );
    const sc = res.structuredContent as { ok: boolean; avatar: { brand_id: string }; set_current: boolean };
    expect(sc.ok).toBe(true);
    expect(sc.avatar.brand_id).toBe('brand-1');
    expect(sc.set_current).toBe(false);
    const ins = stub.ops.find((o) => o.table === 'avatars' && o.verb === 'insert');
    expect(ins?.payload).toMatchObject({ user_id: 'user-1', brand_id: 'brand-1', name: 'Collector' });
  });

  it('calls set_current_avatar RPC when set_current is true', async () => {
    const stub = install();
    stub.on('brands', 'select', { data: { id: 'brand-1' }, error: null });
    stub.on('avatars', 'insert', {
      data: { id: 'av-9', brand_id: 'brand-1', name: 'C', description: null, is_primary: false, created_at: 't', updated_at: 't' },
      error: null,
    });
    stub.on('set_current_avatar', 'rpc', { data: null, error: null });
    const client = await connect(registerCreateAvatarTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'create_avatar', arguments: { name: 'C', set_current: true } }),
    );
    const sc = res.structuredContent as { set_current: boolean };
    expect(sc.set_current).toBe(true);
    const rpc = stub.ops.find((o) => o.rpc === 'set_current_avatar');
    expect(rpc?.args).toMatchObject({ p_avatar_id: 'av-9' });
  });
});

// ---------------------------------------------------------------------------------------
// list_avatars
// ---------------------------------------------------------------------------------------
describe('list_avatars tool', () => {
  it('lists the caller’s avatars', async () => {
    const stub = install();
    stub.on('avatars', 'select', {
      data: [{ id: 'av-1', brand_id: 'b1', name: 'A', description: null, is_primary: true, created_at: 't', updated_at: 't' }],
      error: null,
    });
    const client = await connect(registerListAvatarsTool);
    const res = await runWithIdentity(authed, () => client.callTool({ name: 'list_avatars', arguments: {} }));
    const sc = res.structuredContent as { ok: boolean; count: number };
    expect(sc.ok).toBe(true);
    expect(sc.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------
// set_current_avatar — the stateless avatar-switch
// ---------------------------------------------------------------------------------------
describe('set_current_avatar tool', () => {
  it('invokes the set_current_avatar RPC with the avatar id', async () => {
    const stub = install();
    stub.on('set_current_avatar', 'rpc', { data: null, error: null });
    const client = await connect(registerSetCurrentAvatarTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'set_current_avatar', arguments: { avatar_id: 'av-1' } }),
    );
    const sc = res.structuredContent as { ok: boolean; current_avatar_id: string };
    expect(sc.ok).toBe(true);
    expect(sc.current_avatar_id).toBe('av-1');
    expect(stub.ops.find((o) => o.rpc === 'set_current_avatar')?.args).toMatchObject({ p_avatar_id: 'av-1' });
  });

  it('surfaces avatar_not_owned from the RPC as a clean denial', async () => {
    const stub = install();
    stub.on('set_current_avatar', 'rpc', { data: null, error: { message: 'avatar_not_owned' } });
    const client = await connect(registerSetCurrentAvatarTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'set_current_avatar', arguments: { avatar_id: 'foreign' } }),
    );
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.note).toMatch(/not owned/i);
  });
});

// ---------------------------------------------------------------------------------------
// set_primary_avatar — pins brands.primary_avatar_id; ownership-gated, RPC errors clean
// ---------------------------------------------------------------------------------------
describe('set_primary_avatar tool', () => {
  it('pins an owned avatar via the set_primary_avatar RPC', async () => {
    const stub = install();
    stub.on('avatars', 'select', { data: { id: 'av-1', brand_id: 'brand-1' }, error: null }); // requireOwnedAvatar
    stub.on('set_primary_avatar', 'rpc', { data: null, error: null });
    const client = await connect(registerSetPrimaryAvatarTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'set_primary_avatar', arguments: { avatar_id: 'av-1' } }),
    );
    const sc = res.structuredContent as { ok: boolean; primary_avatar_id: string };
    expect(sc.ok).toBe(true);
    expect(sc.primary_avatar_id).toBe('av-1');
    expect(stub.ops.find((o) => o.rpc === 'set_primary_avatar')?.args).toMatchObject({ p_avatar_id: 'av-1' });
  });

  it('denies a foreign avatar (requireOwnedAvatar) before the RPC', async () => {
    const stub = install();
    stub.on('avatars', 'select', { data: null, error: null }); // foreign/absent → denial
    const client = await connect(registerSetPrimaryAvatarTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'set_primary_avatar', arguments: { avatar_id: 'foreign' } }),
    );
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.note).toMatch(/not owned/i);
    expect(stub.ops.find((o) => o.rpc === 'set_primary_avatar')).toBeUndefined();
  });

  it('surfaces avatar_has_no_brand from the RPC as a clean denial', async () => {
    const stub = install();
    stub.on('avatars', 'select', { data: { id: 'av-1', brand_id: 'brand-1' }, error: null });
    stub.on('set_primary_avatar', 'rpc', { data: null, error: { message: 'avatar_has_no_brand' } });
    const client = await connect(registerSetPrimaryAvatarTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'set_primary_avatar', arguments: { avatar_id: 'av-1' } }),
    );
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.note).toBe('avatar has no brand');
  });
});

// ---------------------------------------------------------------------------------------
// record_avatar_build — ownership-gated before the upsert
// ---------------------------------------------------------------------------------------
describe('record_avatar_build tool', () => {
  it('returns a generic denial (no raw DB message) when the ownership check errors', async () => {
    const stub = install();
    // requireOwnedAvatar must NOT leak the Postgres message — it returns a generic denial.
    stub.on('avatars', 'select', { data: null, error: { message: 'connection reset by peer' } });
    const client = await connect(registerRecordAvatarBuildTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'record_avatar_build', arguments: { avatar_id: 'av-1', status: 'built' } }),
    );
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.note).toBe('ownership check failed');
    expect(JSON.stringify(res)).not.toMatch(/connection reset/);
    expect(stub.ops.find((o) => o.table === 'avatar_build_state')).toBeUndefined();
  });


  it('denies a foreign avatar (requireOwnedAvatar) before any write', async () => {
    const stub = install();
    stub.on('avatars', 'select', { data: null, error: null }); // foreign/absent → denial
    const client = await connect(registerRecordAvatarBuildTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'record_avatar_build', arguments: { avatar_id: 'foreign', status: 'built' } }),
    );
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.note).toMatch(/not owned/i);
    expect(stub.ops.find((o) => o.table === 'avatar_build_state')).toBeUndefined();
  });

  it('upserts build state for an owned avatar', async () => {
    const stub = install();
    stub.on('avatars', 'select', { data: { id: 'av-1', brand_id: 'b1' }, error: null });
    stub.on('avatar_build_state', 'upsert', {
      data: { avatar_id: 'av-1', stages_done: ['s1', 's2'], status: 'built', approved_at: null, updated_at: 't' },
      error: null,
    });
    const client = await connect(registerRecordAvatarBuildTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({
        name: 'record_avatar_build',
        arguments: { avatar_id: 'av-1', stages_done: ['s1', 's2'], status: 'built' },
      }),
    );
    const sc = res.structuredContent as { ok: boolean; build_state: { status: string } };
    expect(sc.ok).toBe(true);
    expect(sc.build_state.status).toBe('built');
  });
});

// ---------------------------------------------------------------------------------------
// upsert_funnel_touchpoint — brand-level, no avatar
// ---------------------------------------------------------------------------------------
describe('upsert_funnel_touchpoint tool', () => {
  it('inserts a brand-level touchpoint (avatar_id NULL) with server-resolved brand_id', async () => {
    const stub = install();
    stub.on('brands', 'select', { data: { id: 'brand-1' }, error: null }); // resolveBrandId
    stub.on('brand_assets', 'select', { data: null, error: null }); // no existing current row
    stub.on('brand_assets', 'insert', {
      data: { id: 'ba-1', brand_id: 'brand-1', touchpoint_id: 'amazon_listing', stage: 'conversion', context_description: 'PDP', status: 'pending', overall_score: null, created_at: 't' },
      error: null,
    });
    const client = await connect(registerUpsertFunnelTouchpointTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({
        name: 'upsert_funnel_touchpoint',
        arguments: { touchpoint_id: 'amazon_listing', stage: 'conversion', context_description: 'PDP' },
      }),
    );
    const sc = res.structuredContent as { ok: boolean; touchpoint: { brand_id: string } };
    expect(sc.ok).toBe(true);
    expect(sc.touchpoint.brand_id).toBe('brand-1');
    const ins = stub.ops.find((o) => o.table === 'brand_assets' && o.verb === 'insert');
    expect(ins?.payload).toMatchObject({ brand_id: 'brand-1', avatar_id: null, touchpoint_id: 'amazon_listing' });
  });
});

// ---------------------------------------------------------------------------------------
// run_funnel_audit — avatar defaults to brands.primary_avatar_id; never the coach pointer
// ---------------------------------------------------------------------------------------
describe('run_funnel_audit tool', () => {
  it('defaults the avatar to the brand primary and scores via save_asset_audit_atomic', async () => {
    const stub = install();
    stub.on('brands', 'select', { data: { id: 'brand-1' }, error: null }); // resolveBrandId
    stub.on('brands', 'select', { data: { primary_avatar_id: 'av-primary' }, error: null }); // resolvePrimaryAvatarId
    stub.on('avatars', 'select', { data: { id: 'av-primary', brand_id: 'brand-1' }, error: null }); // requireOwnedAvatar
    stub.on('save_asset_audit_atomic', 'rpc', {
      data: { id: 'aud-1', brand_asset_id: 'ba-1', avatar_id: 'av-primary', brand_id: 'brand-1', overall_score: 80, audit_result: null, grounding: 'inference', created_at: 't' },
      error: null,
    });
    const client = await connect(registerRunFunnelAuditTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'run_funnel_audit', arguments: { brand_asset_id: 'ba-1', overall_score: 80 } }),
    );
    const sc = res.structuredContent as { ok: boolean; avatar_id: string };
    expect(sc.ok).toBe(true);
    expect(sc.avatar_id).toBe('av-primary');
    const rpc = stub.ops.find((o) => o.rpc === 'save_asset_audit_atomic');
    expect(rpc?.args).toMatchObject({ p_brand_asset_id: 'ba-1', p_avatar_id: 'av-primary' });
  });

  it('returns needs_input when no avatar is passed and no brand primary is set', async () => {
    const stub = install();
    stub.on('brands', 'select', { data: { id: 'brand-1' }, error: null });
    stub.on('brands', 'select', { data: { primary_avatar_id: null }, error: null });
    const client = await connect(registerRunFunnelAuditTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'run_funnel_audit', arguments: { brand_asset_id: 'ba-1' } }),
    );
    const sc = res.structuredContent as { ok: boolean; needs_input: string };
    expect(sc.ok).toBe(false);
    expect(sc.needs_input).toBe('avatar_id');
    expect(stub.ops.find((o) => o.rpc === 'save_asset_audit_atomic')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------
// get_funnel_audit
// ---------------------------------------------------------------------------------------
describe('get_funnel_audit tool', () => {
  it('reads the per-avatar overlay for an explicit avatar', async () => {
    const stub = install();
    stub.on('brands', 'select', { data: { id: 'brand-1' }, error: null }); // resolveBrandId
    stub.on('avatars', 'select', { data: { id: 'av-1', brand_id: 'brand-1' }, error: null }); // requireOwnedAvatar
    stub.on('brand_asset_audits', 'select', {
      data: [{ id: 'aud-1', brand_asset_id: 'ba-1', avatar_id: 'av-1', brand_id: 'brand-1', overall_score: 70, audit_result: null, grounding: 'inference', created_at: 't' }],
      error: null,
    });
    const client = await connect(registerGetFunnelAuditTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'get_funnel_audit', arguments: { avatar_id: 'av-1' } }),
    );
    const sc = res.structuredContent as { ok: boolean; count: number; avatar_id: string };
    expect(sc.ok).toBe(true);
    expect(sc.count).toBe(1);
    expect(sc.avatar_id).toBe('av-1');
  });
});

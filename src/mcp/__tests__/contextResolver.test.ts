// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolve, type SlotStatus } from '../service/contextResolver.js';
import { storeAnswer, ContextWritebackError } from '../service/contextWriteback.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';
import type { SlotId } from '../contracts/slots.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };
const anon: Identity = { userId: null, token: null, authenticated: false };

const DAY = 86_400_000;
const isoDaysAgo = (n: number): string => new Date(Date.now() - n * DAY).toISOString();

/** One captured PostgREST operation. */
interface Op {
  table: string;
  verb: 'insert' | 'update' | 'select';
  payload?: Record<string, unknown>;
  filters: Array<{ op: string; col: string; val: unknown }>;
}
interface Result {
  data: unknown;
  error: { message: string } | null;
}

/**
 * A per-table queue of results. The resolver issues at most one terminal call per
 * `from(table)` (maybeSingle / single / order / await), so we resolve FIFO per table.
 * Writeback issues a read (maybeSingle) + maybe an update + an insert against the same
 * table, so the queue is keyed by table AND verb to keep them apart.
 */
class Stub {
  readonly ops: Op[] = [];
  private queue: Record<string, Result[]> = {};

  /** Queue a result for the next `verb` call against `table`. */
  on(table: string, verb: Op['verb'], result: Result): this {
    (this.queue[`${table}:${verb}`] ??= []).push(result);
    return this;
  }

  private take(table: string, verb: Op['verb']): Result {
    const key = `${table}:${verb}`;
    const next = this.queue[key]?.shift();
    return next ?? { data: null, error: null };
  }

  from(table: string): Builder {
    return new Builder(table, this.ops, (op) => this.take(op.table, op.verb));
  }
}

/** Chainable query builder mirroring the PostgREST surface the services use. */
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
  insert(payload: Record<string, unknown>): this {
    this.op.verb = 'insert';
    this.op.payload = payload;
    return this;
  }
  update(payload: Record<string, unknown>): this {
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
  order(): Promise<Result> | this {
    // order() is terminal in some readers (no maybeSingle after) and chainable in others.
    // Return a thenable-self: awaiting it OR chaining .limit().maybeSingle() both work.
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

afterEach(() => __setUserSupabaseFactory(null));

/** Helper: resolve one slot and return its status + value. */
async function resolveStatus(slot: SlotId): Promise<{ status: SlotStatus; value: unknown; source: string | null }> {
  const [r] = await runWithIdentity(authed, () => resolve([slot]));
  return { status: r.status, value: r.value, source: r.source };
}

describe('contextResolver.resolve — the six statuses', () => {
  it('missing: every store empty → missing (slot with no static fallback)', async () => {
    install(); // all queues empty → null everywhere
    // Slot 9 (cash constraints, BUSINESS-FACT) resides in business_facts → ask.
    const r = await resolveStatus(9);
    expect(r.status).toBe('missing');
    expect(r.value).toBeNull();
    expect(r.source).toBeNull();
  });

  it('filled-evidence: own reviews resolve from user_product_reviews', async () => {
    const stub = install();
    // Slot 1 residesIn: user_product_reviews → evidence_snapshots → ask.
    // user_product_reviews reader first selects user_products ids, then reviews.
    stub.on('user_products', 'select', { data: [{ id: 'p1' }], error: null });
    stub.on('user_product_reviews', 'select', {
      data: [{ id: 'rev-1', body: 'holds my whole PSA set', rating: 5 }],
      error: null,
    });
    const r = await resolveStatus(1);
    expect(r.status).toBe('filled-evidence');
    expect(r.source).toBe('user_product_reviews');
  });

  it('listing copy (#3) resolves from user_products when evidence_snapshots is empty', async () => {
    const stub = install();
    // Slot 3 residesIn: evidence_snapshots → user_products → ask. evidence_snapshots empty
    // (default null); the app-scraped listing in user_products must now backfill the slot.
    stub.on('user_products', 'select', {
      data: [{ id: 'p1', asin: 'B0CJBN849W', title: 'Diamond Grain Binder', bullets: ['Holds 216 cards'], description: 'Double sided' }],
      error: null,
    });
    const r = await resolveStatus(3);
    expect(r.status).toBe('filled-evidence');
    expect(r.source).toBe('user_products');
  });

  it('brand-level fallback: an avatar-scoped read falls back to avatar_id IS NULL evidence', async () => {
    const stub = install();
    // Slot 3, scoped to an avatar. The avatar-scoped evidence read is empty; the brand-level
    // (avatar_id IS NULL) row — ingested during onboarding before the avatar existed — wins.
    stub.on('evidence_snapshots', 'select', { data: null, error: null }); // avatar-scoped: empty
    stub.on('evidence_snapshots', 'select', { data: { listing: { title: 'Brand-level listing' }, created_at: '2026-06-25T00:00:00Z' }, error: null }); // brand-level
    const [r] = await runWithIdentity(authed, () => resolve([3], { avatarId: 'av-1' }));
    expect(r.status).toBe('filled-evidence');
    expect(r.source).toBe('evidence_snapshots');
    expect(r.value).toEqual({ title: 'Brand-level listing' });
  });

  it('filled-stated: a BUSINESS-FACT fresh in business_facts (within staleness window)', async () => {
    const stub = install();
    // Slot 9 residesIn: business_facts → ask. Fresh updated_at → not stale.
    stub.on('business_facts', 'select', {
      data: { content: '$1K/mo repayment from June', structured_data: { repayment: 1000 }, updated_at: isoDaysAgo(10) },
      error: null,
    });
    const r = await resolveStatus(9);
    expect(r.status).toBe('filled-stated');
    expect(r.source).toBe('business_facts');
    expect(r.value).toEqual({ repayment: 1000 });
  });

  it('stale: a BUSINESS-FACT older than the 90-day window degrades to stale', async () => {
    const stub = install();
    stub.on('business_facts', 'select', {
      data: { content: 'old revenue', structured_data: { revenue: 9000 }, updated_at: isoDaysAgo(120) },
      error: null,
    });
    // Slot 7 (brand asset states, BUSINESS-FACT) residesIn: business_facts → ask.
    const r = await resolveStatus(7);
    expect(r.status).toBe('stale');
    expect(r.value).toEqual({ revenue: 9000 });
  });

  it('filled-inferred: OWNER-INTENT from avatar_field_values with field_source=ai', async () => {
    const stub = install();
    // Slot 12 residesIn: avatar_field_values → user_knowledge_base → ask.
    stub.on('avatar_field_values', 'select', {
      data: { field_value: 'premium anchor', field_source: 'ai', extracted_at: isoDaysAgo(5) },
      error: null,
    });
    // KB fallback would also be tried; leave it empty so avatar wins as the only candidate.
    const r = await runWithIdentity(authed, () => resolve([12]));
    expect(r[0].status).toBe('filled-inferred');
    expect(r[0].source).toBe('avatar_field_values');
  });

  it('conflict: two stores disagree → winner kept, status conflict', async () => {
    const stub = install();
    // Slot 12: avatar_field_values (manual='premium anchor') vs KB canvas (different value).
    stub.on('avatar_field_values', 'select', {
      data: { field_value: 'premium anchor', field_source: 'manual', extracted_at: isoDaysAgo(2) },
      error: null,
    });
    stub.on('user_knowledge_base', 'select', {
      data: { content: 'value anchor', structured_data: null, updated_at: isoDaysAgo(1) },
      error: null,
    });
    const r = await runWithIdentity(authed, () => resolve([12]));
    expect(r[0].status).toBe('conflict');
    // Highest-priority store (avatar_field_values) wins the value.
    expect(r[0].source).toBe('avatar_field_values');
    expect(r[0].value).toBe('premium anchor');
  });

  it('agreeing stores do NOT flag conflict (stay filled-stated)', async () => {
    const stub = install();
    stub.on('avatar_field_values', 'select', {
      data: { field_value: 'same', field_source: 'manual', extracted_at: isoDaysAgo(2) },
      error: null,
    });
    stub.on('user_knowledge_base', 'select', {
      data: { content: 'same', structured_data: null, updated_at: isoDaysAgo(1) },
      error: null,
    });
    const r = await runWithIdentity(authed, () => resolve([12]));
    expect(r[0].status).toBe('filled-stated');
  });

  it('FRAMEWORK slots resolve filled-stated without a user round-trip', async () => {
    install();
    // Slot 18 residesIn: framework_static only.
    const r = await resolveStatus(18);
    expect(r.status).toBe('filled-stated');
    expect(r.source).toBe('framework_static');
  });

  it('resolution order: artifacts win over later stores for a synthesis slot', async () => {
    const stub = install();
    // Slot 14 residesIn: avatar_field_values → user_knowledge_base → ask; but #14 also
    // maps to an avatar_s1_vocab artifact, which the resolver tries first (artifacts not
    // in residesIn for 14 — it is read via the artifact reader only when residesIn lists
    // 'artifacts'). #14 residesIn does NOT include artifacts, so avatar_field_values wins.
    stub.on('avatar_field_values', 'select', {
      data: { field_value: 'wants protection', field_source: 'manual', extracted_at: isoDaysAgo(1) },
      error: null,
    });
    const r = await resolveStatus(14);
    expect(r.source).toBe('avatar_field_values');
    expect(r.status).toBe('filled-stated');
  });

  it('store read errors degrade to null and fall through (no throw)', async () => {
    const stub = install();
    // user_products read errors → user_product_reviews reader returns null → evidence_snapshots empty → missing.
    stub.on('user_products', 'select', { data: null, error: { message: 'rls denied' } });
    const r = await resolveStatus(1);
    expect(r.status).toBe('missing');
  });
});

describe('contextWriteback.storeAnswer — routing per class', () => {
  it('EVIDENCE (reviews) → evidence_snapshots by default', async () => {
    const stub = install();
    stub.on('evidence_snapshots', 'insert', { data: { id: 'snap-1' }, error: null });
    const res = await runWithIdentity(authed, () => storeAnswer(1 as SlotId, [{ body: 'great vault' }]));
    expect(res.store).toBe('evidence_snapshots');
    expect(res.rowId).toBe('snap-1');
    const op = stub.ops.find((o) => o.table === 'evidence_snapshots' && o.verb === 'insert');
    expect(op?.payload).toMatchObject({ user_id: 'user-1', source: 'slot:1' });
    expect((op?.payload as { reviews?: unknown }).reviews).toEqual([{ body: 'great vault' }]);
  });

  it('EVIDENCE listing copy (#3) → evidence_snapshots.listing column', async () => {
    const stub = install();
    stub.on('evidence_snapshots', 'insert', { data: { id: 'snap-2' }, error: null });
    await runWithIdentity(authed, () => storeAnswer(3 as SlotId, { title: 'X', bullets: ['a'] }));
    const op = stub.ops.find((o) => o.table === 'evidence_snapshots');
    expect((op?.payload as { listing?: unknown }).listing).toEqual({ title: 'X', bullets: ['a'] });
    expect((op?.payload as { reviews?: unknown }).reviews).toBeUndefined();
  });

  it('EVIDENCE (#1) with a productId → user_product_reviews', async () => {
    const stub = install();
    stub.on('user_product_reviews', 'insert', { data: { id: 'rev-9' }, error: null });
    const res = await runWithIdentity(authed, () =>
      storeAnswer(1 as SlotId, 'holds my whole set', { productId: 'prod-1' }),
    );
    expect(res.store).toBe('user_product_reviews');
    const op = stub.ops.find((o) => o.table === 'user_product_reviews');
    expect(op?.payload).toMatchObject({ product_id: 'prod-1', body: 'holds my whole set' });
  });

  it('BUSINESS-FACT → business_facts table, field_identifier=slot id, version 1 when none prior', async () => {
    const stub = install();
    stub.on('business_facts', 'select', { data: null, error: null }); // no prior current row
    stub.on('business_facts', 'insert', { data: { id: 'bf-1' }, error: null });
    const res = await runWithIdentity(authed, () => storeAnswer(8 as SlotId, { revenue: 10000 }));
    expect(res.store).toBe('business_facts');
    const ins = stub.ops.find((o) => o.table === 'business_facts' && o.verb === 'insert');
    expect(ins?.payload).toMatchObject({
      field_identifier: '8',
      version: 1,
      is_current: true,
    });
    expect((ins?.payload as { structured_data?: unknown }).structured_data).toEqual({ revenue: 10000 });
  });

  it('BUSINESS-FACT supersedes a prior current row and bumps the version', async () => {
    const stub = install();
    stub.on('business_facts', 'select', { data: { id: 'bf-old', version: 2 }, error: null });
    stub.on('business_facts', 'update', { data: null, error: null });
    stub.on('business_facts', 'insert', { data: { id: 'bf-3' }, error: null });
    await runWithIdentity(authed, () => storeAnswer(8 as SlotId, { revenue: 12000 }));
    const upd = stub.ops.find((o) => o.table === 'business_facts' && o.verb === 'update');
    expect(upd?.payload).toEqual({ is_current: false });
    expect(upd?.filters).toContainEqual({ op: 'eq', col: 'id', val: 'bf-old' });
    const ins = stub.ops.find((o) => o.table === 'business_facts' && o.verb === 'insert');
    expect(ins?.payload).toMatchObject({ version: 3, is_current: true });
  });

  it('OWNER-INTENT → avatar_field_values with field_source=manual', async () => {
    const stub = install();
    stub.on('avatar_field_values', 'insert', { data: { id: 'afv-1' }, error: null });
    const res = await runWithIdentity(authed, () =>
      storeAnswer(12 as SlotId, 'premium anchor', { avatarId: 'av-1' }),
    );
    expect(res.store).toBe('avatar_field_values');
    const op = stub.ops.find((o) => o.table === 'avatar_field_values');
    expect(op?.payload).toMatchObject({
      avatar_id: 'av-1',
      field_id: 'positioningIntent',
      field_value: 'premium anchor',
      field_source: 'manual',
      is_locked: false,
    });
  });

  it('OWNER-INTENT without an avatarId is rejected (avatar-keyed store)', async () => {
    install();
    await expect(
      runWithIdentity(authed, () => storeAnswer(12 as SlotId, 'x')),
    ).rejects.toBeInstanceOf(ContextWritebackError);
  });

  it('PRODUCT-TRUTH confirmation routes to business_facts (owner-confirmed store)', async () => {
    const stub = install();
    stub.on('business_facts', 'select', { data: null, error: null });
    stub.on('business_facts', 'insert', { data: { id: 'bf-pt' }, error: null });
    const res = await runWithIdentity(authed, () => storeAnswer(6 as SlotId, 'Holds 432 cards, side-loading'));
    expect(res.store).toBe('business_facts');
    const ins = stub.ops.find((o) => o.table === 'business_facts' && o.verb === 'insert');
    expect(ins?.payload).toMatchObject({ field_identifier: '6' });
  });

  it('FRAMEWORK slots are not user-answerable (no write-back route)', async () => {
    install();
    await expect(runWithIdentity(authed, () => storeAnswer(17 as SlotId, 'x'))).rejects.toBeInstanceOf(
      ContextWritebackError,
    );
  });

  it('requires an authenticated caller for facts/intent write-backs', async () => {
    install();
    await expect(runWithIdentity(anon, () => storeAnswer(8 as SlotId, { x: 1 }))).rejects.toBeInstanceOf(
      ContextWritebackError,
    );
  });
});

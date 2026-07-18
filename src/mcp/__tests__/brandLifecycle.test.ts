// @vitest-environment node
/**
 * Service tests for brandLifecycle.ensureBrand — idempotent brand bootstrap.
 *
 * Mirrors the campaignService harness: a mocked JWT-bound client (__setUserSupabaseFactory) proves
 * the service-side contract — user_id stamped from identity, brand-row-only (name), idempotent on an
 * existing brand, and race-safe against uq_brands_user_id (a 23505 conflict re-reads the winner).
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureBrand, BrandLifecycleError, type BrandRow } from '../service/brandLifecycle.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

interface Capture {
  table: string;
  op: 'insert';
  payload: Record<string, unknown>;
}

type Resolver = (table: string, op: 'single' | 'maybeSingle') => { data: unknown; error: unknown };

/** Chainable Supabase stub: select/order/limit are no-op links; insert captures its payload; single/maybeSingle terminate. */
function makeClient(resolve: Resolver, captures: Capture[]): SupabaseClient {
  const from = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    const chain = (): Record<string, unknown> => b;
    b.select = chain;
    b.order = chain;
    b.limit = chain;
    b.insert = (payload: Record<string, unknown>) => {
      captures.push({ table, op: 'insert', payload });
      return b;
    };
    b.single = () => Promise.resolve(resolve(table, 'single'));
    b.maybeSingle = () => Promise.resolve(resolve(table, 'maybeSingle'));
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

function brandRow(over: Partial<BrandRow> = {}): BrandRow {
  return {
    id: 'brand-9',
    name: 'My Brand',
    description: null,
    industry: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

afterEach(() => __setUserSupabaseFactory(null));

describe('ensureBrand — idempotent brand bootstrap', () => {
  it('returns the existing brand untouched (created:false, no insert)', async () => {
    const captures: Capture[] = [];
    __setUserSupabaseFactory(() =>
      makeClient(
        (table, op) =>
          table === 'brands' && op === 'maybeSingle'
            ? { data: brandRow({ name: 'RXCUE' }), error: null }
            : { data: null, error: null },
        captures,
      ),
    );

    const res = await runWithIdentity(authed, () => ensureBrand());

    expect(res.created).toBe(false);
    expect(res.brand.name).toBe('RXCUE');
    expect(captures.find((c) => c.op === 'insert')).toBeUndefined();
  });

  it('creates a default "My Brand" when none exists, stamping user_id (created:true)', async () => {
    const captures: Capture[] = [];
    __setUserSupabaseFactory(() =>
      makeClient((table, op) => {
        if (table === 'brands' && op === 'maybeSingle') return { data: null, error: null };
        if (table === 'brands' && op === 'single') return { data: brandRow(), error: null };
        return { data: null, error: null };
      }, captures),
    );

    const res = await runWithIdentity(authed, () => ensureBrand());

    expect(res.created).toBe(true);
    expect(res.brand.id).toBe('brand-9');
    expect(captures.find((c) => c.op === 'insert')?.payload).toEqual({ user_id: 'user-1', name: 'My Brand' });
  });

  it('uses the provided brand_name (trimmed) and seeds nothing else', async () => {
    const captures: Capture[] = [];
    __setUserSupabaseFactory(() =>
      makeClient((table, op) => {
        if (table === 'brands' && op === 'maybeSingle') return { data: null, error: null };
        if (table === 'brands' && op === 'single') return { data: brandRow({ name: 'RXCUE' }), error: null };
        return { data: null, error: null };
      }, captures),
    );

    const res = await runWithIdentity(authed, () => ensureBrand('  RXCUE  '));

    expect(res.created).toBe(true);
    // brand-row only: exactly user_id + name, no avatar/context columns.
    expect(captures.find((c) => c.op === 'insert')?.payload).toEqual({ user_id: 'user-1', name: 'RXCUE' });
  });

  it('is race-safe: a 23505 unique violation degrades to the winning row (created:false)', async () => {
    const captures: Capture[] = [];
    let reads = 0;
    __setUserSupabaseFactory(() =>
      makeClient((table, op) => {
        if (table === 'brands' && op === 'maybeSingle') {
          reads += 1;
          return reads === 1 ? { data: null, error: null } : { data: brandRow({ name: 'RXCUE' }), error: null };
        }
        if (table === 'brands' && op === 'single') return { data: null, error: { code: '23505', message: 'duplicate key' } };
        return { data: null, error: null };
      }, captures),
    );

    const res = await runWithIdentity(authed, () => ensureBrand('RXCUE'));

    expect(res.created).toBe(false);
    expect(res.brand.name).toBe('RXCUE');
  });

  it('throws BrandLifecycleError when the insert errors (non-conflict)', async () => {
    __setUserSupabaseFactory(() =>
      makeClient((table, op) => {
        if (table === 'brands' && op === 'maybeSingle') return { data: null, error: null };
        if (table === 'brands' && op === 'single') return { data: null, error: { code: '500', message: 'boom' } };
        return { data: null, error: null };
      }, []),
    );

    await expect(runWithIdentity(authed, () => ensureBrand())).rejects.toThrow(BrandLifecycleError);
  });
});

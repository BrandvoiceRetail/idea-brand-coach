// @vitest-environment node
/**
 * Service tests for campaignService — CRUD spine + RLS-INTENT owner scoping.
 *
 * RLS itself runs in Postgres; here we prove the service-side half of the contract with a mocked
 * JWT-bound client (the `__setUserSupabaseFactory` seam, same pattern as analyticsIngestService /
 * nativeLedger tests): user_id is stamped from the in-scope identity, brand_id is resolved
 * SERVER-SIDE (never caller-supplied), and an absent/foreign row resolves to a clean null — never a
 * silent success or a cross-brand write.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaignStatus,
} from '../service/campaignService.js';
import type { CampaignRow } from '../service/campaignTypes.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

interface Capture {
  table: string;
  op: 'insert' | 'update';
  payload: Record<string, unknown>;
}

type Resolver = (table: string, op: 'single' | 'maybeSingle' | 'list') => { data: unknown; error: unknown };

/**
 * Chainable Supabase stub. select/eq/gte/lte/order/limit are no-op chain links; insert/update
 * capture their payloads (so we can assert the stamped columns); single/maybeSingle and the
 * thenable (list/await) terminals return whatever `resolve` dictates per table+op.
 */
function makeClient(resolve: Resolver, captures: Capture[]): SupabaseClient {
  const from = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    const chain = (): Record<string, unknown> => b;
    b.select = chain;
    b.eq = chain;
    b.gte = chain;
    b.lte = chain;
    b.order = chain;
    b.limit = chain;
    b.insert = (payload: Record<string, unknown>) => {
      captures.push({ table, op: 'insert', payload });
      return b;
    };
    b.update = (payload: Record<string, unknown>) => {
      captures.push({ table, op: 'update', payload });
      return b;
    };
    b.single = () => Promise.resolve(resolve(table, 'single'));
    b.maybeSingle = () => Promise.resolve(resolve(table, 'maybeSingle'));
    b.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(resolve(table, 'list')).then(onF, onR);
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

function campaignRow(over: Partial<CampaignRow> = {}): CampaignRow {
  return {
    id: 'c1',
    user_id: 'user-1',
    brand_id: 'brand-9',
    name: 'Q3 Launch',
    channel: 'tiktok',
    status: 'draft',
    description: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...over,
  };
}

afterEach(() => __setUserSupabaseFactory(null));

describe('createCampaign — server-stamped ownership', () => {
  it('stamps user_id from identity and a SERVER-resolved brand_id (never caller-supplied)', async () => {
    const captures: Capture[] = [];
    __setUserSupabaseFactory(() =>
      makeClient((table, op) => {
        if (table === 'brands' && op === 'maybeSingle') return { data: { id: 'brand-9' }, error: null };
        if (table === 'campaigns' && op === 'single')
          return { data: campaignRow({ name: 'Q3 Launch', channel: 'tiktok' }), error: null };
        return { data: null, error: null };
      }, captures),
    );

    const row = await runWithIdentity(authed, () =>
      createCampaign({ name: 'Q3 Launch', channel: 'tiktok' }),
    );

    expect(row.brand_id).toBe('brand-9');
    const insert = captures.find((c) => c.table === 'campaigns' && c.op === 'insert');
    expect(insert?.payload).toMatchObject({
      user_id: 'user-1',
      brand_id: 'brand-9',
      channel: 'tiktok',
      status: 'draft', // defaulted when not supplied
    });
  });

  it('throws when the caller has no brand (cannot plant an orphan campaign)', async () => {
    __setUserSupabaseFactory(() =>
      makeClient((table, op) =>
        table === 'brands' && op === 'maybeSingle' ? { data: null, error: null } : { data: null, error: null },
      []),
    );
    await expect(
      runWithIdentity(authed, () => createCampaign({ name: 'x', channel: 'blog' })),
    ).rejects.toThrow(/no brand found/i);
  });

  it('throws CampaignServiceError when the insert errors', async () => {
    __setUserSupabaseFactory(() =>
      makeClient((table, op) => {
        if (table === 'brands' && op === 'maybeSingle') return { data: { id: 'brand-9' }, error: null };
        return { data: null, error: { message: 'rls denied' } };
      }, []),
    );
    await expect(
      runWithIdentity(authed, () => createCampaign({ name: 'x', channel: 'blog' })),
    ).rejects.toThrow(/failed to create campaign/i);
  });
});

describe('getCampaign — RLS-scoped read', () => {
  it('returns the row when present', async () => {
    __setUserSupabaseFactory(() => makeClient(() => ({ data: campaignRow(), error: null }), []));
    const row = await runWithIdentity(authed, () => getCampaign('c1'));
    expect(row?.id).toBe('c1');
  });

  it('returns null for an absent / foreign id (RLS filters it out)', async () => {
    __setUserSupabaseFactory(() => makeClient(() => ({ data: null, error: null }), []));
    const row = await runWithIdentity(authed, () => getCampaign('not-mine'));
    expect(row).toBeNull();
  });
});

describe('listCampaigns', () => {
  it('returns the caller rows newest-first (list terminal)', async () => {
    const rows = [campaignRow({ id: 'c2' }), campaignRow({ id: 'c1' })];
    __setUserSupabaseFactory(() =>
      makeClient((_t, op) => (op === 'list' ? { data: rows, error: null } : { data: null, error: null }), []),
    );
    const out = await runWithIdentity(authed, () => listCampaigns());
    expect(out.map((r) => r.id)).toEqual(['c2', 'c1']);
  });

  it('returns [] (not null) when the caller owns nothing', async () => {
    __setUserSupabaseFactory(() => makeClient(() => ({ data: null, error: null }), []));
    const out = await runWithIdentity(authed, () => listCampaigns({ status: 'active' }));
    expect(out).toEqual([]);
  });
});

describe('updateCampaignStatus', () => {
  it('returns the updated row', async () => {
    __setUserSupabaseFactory(() =>
      makeClient(() => ({ data: campaignRow({ status: 'active' }), error: null }), []),
    );
    const row = await runWithIdentity(authed, () => updateCampaignStatus('c1', 'active'));
    expect(row?.status).toBe('active');
  });

  it('returns null when no row matched (foreign/absent id — clean not-found, no silent success)', async () => {
    __setUserSupabaseFactory(() => makeClient(() => ({ data: null, error: null }), []));
    const row = await runWithIdentity(authed, () => updateCampaignStatus('not-mine', 'paused'));
    expect(row).toBeNull();
  });
});

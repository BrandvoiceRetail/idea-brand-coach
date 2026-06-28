// @vitest-environment node
/**
 * Service tests for emailSequenceService — PURE prebuilt templates + RLS-intent CRUD/perf.
 *
 * `getSequenceTemplate` is pure (no DB / no identity), so its prebuilt skeletons are asserted
 * directly. The DB paths use the mocked JWT-bound client seam to prove ownership verification
 * (a foreign sequence_id is a clean not-found, never a cross-linked write) and HONEST no_data
 * (performance never fabricates email metrics).
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getSequenceTemplate,
  createEmailSequence,
  addEmailStep,
  listSequences,
  getSequencePerformance,
} from '../service/emailSequenceService.js';
import type { EmailSequenceRow, EmailStepRow } from '../service/campaignTypes.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

interface Capture {
  table: string;
  op: 'insert';
  payload: Record<string, unknown>;
}

type Resolver = (table: string, op: 'single' | 'maybeSingle' | 'list') => Record<string, unknown>;

function makeClient(resolve: Resolver, captures: Capture[]): SupabaseClient {
  const from = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    const chain = (): Record<string, unknown> => b;
    b.select = chain;
    b.eq = chain;
    b.order = chain;
    b.limit = chain;
    b.insert = (payload: Record<string, unknown>) => {
      captures.push({ table, op: 'insert', payload });
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

function sequenceRow(over: Partial<EmailSequenceRow> = {}): EmailSequenceRow {
  return {
    id: 's1',
    user_id: 'user-1',
    brand_id: 'brand-9',
    campaign_id: null,
    sequence_type: 'welcome',
    name: 'New subscriber welcome',
    status: 'draft',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...over,
  };
}

function stepRow(over: Partial<EmailStepRow> = {}): EmailStepRow {
  return {
    id: 'st1',
    user_id: 'user-1',
    sequence_id: 's1',
    step_number: 1,
    subject: 'Welcome',
    body: 'Hi',
    delay_hours: 0,
    email_type: 'welcome',
    trigger_event: 'signup',
    created_at: '2026-06-01T00:00:00Z',
    ...over,
  };
}

afterEach(() => __setUserSupabaseFactory(null));

describe('getSequenceTemplate — deterministic prebuilts', () => {
  it('returns the documented step counts: welcome=5 / nurture=7 / abandoned_cart=3', () => {
    expect(getSequenceTemplate('welcome').steps).toHaveLength(5);
    expect(getSequenceTemplate('nurture').steps).toHaveLength(7);
    expect(getSequenceTemplate('abandoned_cart').steps).toHaveLength(3);
  });

  it('prebuilt steps are 1..N contiguous with monotonically non-decreasing delays', () => {
    for (const type of ['welcome', 'nurture', 'abandoned_cart'] as const) {
      const { steps } = getSequenceTemplate(type);
      expect(steps.map((s) => s.step_number)).toEqual(steps.map((_, i) => i + 1));
      for (let i = 1; i < steps.length; i += 1) {
        expect(steps[i].delay_hours).toBeGreaterThanOrEqual(steps[i - 1].delay_hours);
      }
    }
  });

  it('the first step carries the entry trigger; the rest are delay-driven (trigger_event null)', () => {
    expect(getSequenceTemplate('welcome').steps[0].trigger_event).toBe('signup');
    expect(getSequenceTemplate('abandoned_cart').steps[0].trigger_event).toBe('cart_abandoned');
    expect(getSequenceTemplate('nurture').steps.slice(1).every((s) => s.trigger_event === null)).toBe(true);
  });

  it('returns ok:false/no_template for types with no prebuilt (newsletter/upsell/downsell)', () => {
    for (const type of ['newsletter', 'upsell', 'downsell'] as const) {
      const t = getSequenceTemplate(type);
      expect(t).toMatchObject({ ok: false, steps: [], note: 'no_template' });
    }
  });
});

describe('createEmailSequence — server-stamped ownership', () => {
  it('stamps user_id + server-resolved brand_id and defaults status to draft', async () => {
    const captures: Capture[] = [];
    __setUserSupabaseFactory(() =>
      makeClient((table, op) => {
        if (table === 'brands' && op === 'maybeSingle') return { data: { id: 'brand-9' }, error: null };
        if (table === 'email_sequences' && op === 'single') return { data: sequenceRow(), error: null };
        return { data: null, error: null };
      }, captures),
    );

    await runWithIdentity(authed, () =>
      createEmailSequence({ sequence_type: 'welcome', name: 'New subscriber welcome' }),
    );

    const insert = captures.find((c) => c.table === 'email_sequences');
    expect(insert?.payload).toMatchObject({
      user_id: 'user-1',
      brand_id: 'brand-9',
      sequence_type: 'welcome',
      status: 'draft',
      campaign_id: null,
    });
  });
});

describe('addEmailStep — ownership-gated before any write', () => {
  it('refuses (clean not-found) when the parent sequence is not the caller’s — no step inserted', async () => {
    const captures: Capture[] = [];
    __setUserSupabaseFactory(() =>
      makeClient((table, op) =>
        table === 'email_sequences' && op === 'maybeSingle' ? { data: null, error: null } : { data: null, error: null },
      captures),
    );

    await expect(
      runWithIdentity(authed, () =>
        addEmailStep({ sequence_id: 'not-mine', step_number: 1, subject: 's', body: 'b' }),
      ),
    ).rejects.toThrow(/not found or not owned/i);
    expect(captures.find((c) => c.table === 'email_steps')).toBeUndefined();
  });

  it('inserts the step with user_id denormalised when ownership checks out', async () => {
    const captures: Capture[] = [];
    __setUserSupabaseFactory(() =>
      makeClient((table, op) => {
        if (table === 'email_sequences' && op === 'maybeSingle') return { data: sequenceRow(), error: null };
        if (table === 'email_steps' && op === 'single') return { data: stepRow(), error: null };
        return { data: null, error: null };
      }, captures),
    );

    await runWithIdentity(authed, () =>
      addEmailStep({ sequence_id: 's1', step_number: 1, subject: 'Welcome', body: 'Hi' }),
    );
    const insert = captures.find((c) => c.table === 'email_steps');
    expect(insert?.payload).toMatchObject({ user_id: 'user-1', sequence_id: 's1', step_number: 1, delay_hours: 0 });
  });
});

describe('listSequences', () => {
  it('returns [] when none exist', async () => {
    __setUserSupabaseFactory(() => makeClient(() => ({ data: null, error: null }), []));
    const out = await runWithIdentity(authed, () => listSequences());
    expect(out).toEqual([]);
  });
});

describe('getSequencePerformance — honest no_data', () => {
  it('returns no_campaign_linked (empty metrics) when the sequence has no linked campaign', async () => {
    __setUserSupabaseFactory(() =>
      makeClient((table, op) => {
        if (table === 'email_sequences' && op === 'maybeSingle') return { data: sequenceRow({ campaign_id: null }), error: null };
        if (table === 'email_steps') return { count: 5, error: null }; // step count (head:true)
        return { data: null, error: null };
      }, []),
    );

    const res = await runWithIdentity(authed, () => getSequencePerformance('s1'));
    expect(res).toMatchObject({ ok: true, step_count: 5, metrics: [], note: 'no_campaign_linked' });
  });

  it('returns no_data when the linked campaign has no email-channel metrics', async () => {
    __setUserSupabaseFactory(() =>
      makeClient((table, op) => {
        if (table === 'email_sequences' && op === 'maybeSingle') return { data: sequenceRow({ campaign_id: 'c1' }), error: null };
        if (table === 'email_steps') return { count: 3, error: null };
        if (table === 'campaign_metrics') return { data: [], error: null };
        return { data: null, error: null };
      }, []),
    );

    const res = await runWithIdentity(authed, () => getSequencePerformance('s1'));
    expect(res).toMatchObject({ ok: true, step_count: 3, note: 'no_data' });
    expect(res.metrics).toEqual([]);
  });

  it('throws when the sequence is absent / foreign', async () => {
    __setUserSupabaseFactory(() => makeClient(() => ({ data: null, error: null }), []));
    await expect(
      runWithIdentity(authed, () => getSequencePerformance('nope')),
    ).rejects.toThrow(/not found or not owned/i);
  });
});

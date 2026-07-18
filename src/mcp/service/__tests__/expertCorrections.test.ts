import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isExpert, recordCorrection } from '../expertCorrections.js';

type Result = { data: unknown; error: unknown };

/** Minimal fluent-chain mock covering the two shapes the service uses. */
function makeClient(opts: {
  profile?: Result;
  insert?: Result;
  onInsertPayload?: (payload: Record<string, unknown>) => void;
}): SupabaseClient {
  return {
    from(table: string) {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => opts.profile ?? { data: null, error: null },
            }),
          }),
        };
      }
      if (table === 'expert_corrections') {
        return {
          insert: (payload: Record<string, unknown>) => {
            opts.onInsertPayload?.(payload);
            return {
              select: () => ({
                single: async () => opts.insert ?? { data: { id: 'ec_default' }, error: null },
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

describe('expertCorrections service', () => {
  describe('isExpert', () => {
    it('true for an expert email (allowlist)', async () => {
      const c = makeClient({ profile: { data: { email: 'trevor@brandvoice.co.uk' }, error: null } });
      expect(await isExpert('u1', c)).toBe(true);
    });

    it('false for a non-expert email — e.g. an ADMIN who is not the designated expert', async () => {
      const c = makeClient({ profile: { data: { email: 'matthew@icodemybusiness.com' }, error: null } });
      expect(await isExpert('u1', c)).toBe(false);
    });

    it('fails CLOSED (false) on a DB error', async () => {
      const c = makeClient({ profile: { data: null, error: { message: 'boom' } } });
      expect(await isExpert('u1', c)).toBe(false);
    });

    it('false when there is no profile row', async () => {
      const c = makeClient({ profile: { data: null, error: null } });
      expect(await isExpert('u1', c)).toBe(false);
    });
  });

  describe('recordCorrection', () => {
    it('inserts expert_user_id + source=mcp + status=new and returns the id', async () => {
      let payload: Record<string, unknown> = {};
      const c = makeClient({
        insert: { data: { id: 'ec_9' }, error: null },
        onInsertPayload: (p) => (payload = p),
      });
      const r = await recordCorrection(
        'u1',
        { coachClaim: 'led with features', correction: 'lead with emotion', verbatim: 'come on', toolContext: 'listing copy' },
        c,
      );
      expect(r).toEqual({ ok: true, captured: true, id: 'ec_9' });
      expect(payload).toMatchObject({
        user_id: 'u1',
        source: 'mcp',
        status: 'new',
        coach_claim: 'led with features',
        correction: 'lead with emotion',
        verbatim: 'come on',
        tool_context: 'listing copy',
      });
    });

    it('fails SOFT (ok:false, captured:false) on an insert error, never throws', async () => {
      const c = makeClient({ insert: { data: null, error: { message: 'rls' } } });
      const r = await recordCorrection('u1', { coachClaim: 'a', correction: 'b' }, c);
      expect(r.ok).toBe(false);
      expect(r.captured).toBe(false);
    });

    it('nulls optional fields when omitted', async () => {
      let payload: Record<string, unknown> = {};
      const c = makeClient({ onInsertPayload: (p) => (payload = p) });
      await recordCorrection('u1', { coachClaim: 'a', correction: 'b' }, c);
      expect(payload.verbatim).toBeNull();
      expect(payload.avatar_id).toBeNull();
      expect(payload.tool_context).toBeNull();
      expect(payload.session_id).toBeNull();
    });
  });
});

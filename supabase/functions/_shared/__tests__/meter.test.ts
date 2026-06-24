import { describe, it, expect, vi } from 'vitest';
import { modelFamily, gateDecision, meterAndDebit, assertCredits, type CreditClient } from '../meter';

/** A client whose wallet read returns a fixed balance. */
function walletClient(balance: number): CreditClient {
  return {
    rpc: async () => ({ data: null, error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { balance }, error: null }) }),
      }),
    }),
  } as unknown as CreditClient;
}

describe('modelFamily', () => {
  it('maps full model ids to rate families; unknown → sonnet', () => {
    expect(modelFamily('claude-haiku-4-5-20251001')).toBe('haiku');
    expect(modelFamily('claude-sonnet-4-6')).toBe('sonnet');
    expect(modelFamily('claude-opus-4-8')).toBe('opus');
    expect(modelFamily('gpt-4o')).toBe('sonnet');
    expect(modelFamily(null)).toBe('sonnet');
    expect(modelFamily(undefined)).toBe('sonnet');
  });
});

describe('gateDecision', () => {
  it('never blocks when not enforced', () => {
    expect(gateDecision(0, false)).toEqual({ ok: true, needs_upgrade: false });
    expect(gateDecision(-50, false)).toEqual({ ok: true, needs_upgrade: false });
  });
  it('blocks below the floor when enforced', () => {
    expect(gateDecision(0, true, 1)).toEqual({ ok: false, needs_upgrade: true });
    expect(gateDecision(1, true, 1)).toEqual({ ok: true, needs_upgrade: false });
    expect(gateDecision(500, true, 1)).toEqual({ ok: true, needs_upgrade: false });
  });
});

describe('meterAndDebit', () => {
  it('calls debit_credits with mapped family + rounded tokens and returns the result', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { credits: 9, balance: 5991, raw_cost_usd: 0.033, locked: false }, error: null,
    });
    const client = { rpc } as unknown as CreditClient;
    const r = await meterAndDebit(client, {
      userId: 'u1', op: 'audit_asset', model: 'claude-sonnet-4-6',
      usage: { input_tokens: 6000, output_tokens: 1000 },
    });
    expect(rpc).toHaveBeenCalledWith('debit_credits', {
      p_user: 'u1', p_op: 'audit_asset', p_model: 'sonnet', p_in_tok: 6000, p_out_tok: 1000,
    });
    expect(r).toEqual({ credits: 9, balance: 5991, raw_cost_usd: 0.033, locked: false });
  });

  it('returns null (no throw) when the rpc reports an error', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }) } as unknown as CreditClient;
    const r = await meterAndDebit(client, { userId: 'u1', op: 'x', model: 'sonnet', usage: { input_tokens: 1, output_tokens: 1 } });
    expect(r).toBeNull();
  });

  it('returns null (no throw) when the rpc throws', async () => {
    const client = { rpc: vi.fn().mockRejectedValue(new Error('network')) } as unknown as CreditClient;
    const r = await meterAndDebit(client, { userId: 'u1', op: 'x', model: 'sonnet', usage: null });
    expect(r).toBeNull();
  });

  it('coerces missing/negative usage to 0', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { credits: 1, balance: 0, raw_cost_usd: 0, locked: true }, error: null });
    const client = { rpc } as unknown as CreditClient;
    await meterAndDebit(client, { userId: 'u1', op: 'x', model: 'claude-haiku-4-5', usage: { input_tokens: -5 } });
    expect(rpc).toHaveBeenCalledWith('debit_credits', expect.objectContaining({ p_in_tok: 0, p_out_tok: 0, p_model: 'haiku' }));
  });
});

describe('assertCredits', () => {
  it('is a no-op (ok) when not enforced — records but never blocks', async () => {
    const r = await assertCredits({} as CreditClient, 'u1', 'audit_asset', { enforced: false });
    expect(r).toEqual({ ok: true, needs_upgrade: false, balance: 0 });
  });
  it('blocks when enforced and balance is below the floor', async () => {
    const r = await assertCredits(walletClient(0), 'u1', 'audit_asset', { enforced: true, floor: 1 });
    expect(r).toEqual({ ok: false, needs_upgrade: true, balance: 0 });
  });
  it('allows when enforced and balance is at/above the floor', async () => {
    const r = await assertCredits(walletClient(500), 'u1', 'audit_asset', { enforced: true, floor: 1 });
    expect(r).toEqual({ ok: true, needs_upgrade: false, balance: 500 });
  });
  it('fails open if the wallet read throws (never lock out a paying user)', async () => {
    const client = { from: () => { throw new Error('db down'); } } as unknown as CreditClient;
    const r = await assertCredits(client, 'u1', 'x', { enforced: true });
    expect(r.ok).toBe(true);
  });
});

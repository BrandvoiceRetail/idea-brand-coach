// @vitest-environment node
/**
 * PPC audit engine — deterministic math + the bid-vs-conversion split (the Trust-Gap on-ramp).
 *
 * The engine is pure, so this locks the behaviours that must never regress: the RPC bid formula,
 * ACOS/ROAS/CPC/TACoS parity (omitted, never fabricated, when a divisor is zero), the piece
 * classification (insufficient / conversion-problem / bid-problem / healthy), the on-ramp routing,
 * search-term harvest/negate + wasted spend, honest needs_input, and determinism.
 */
import { describe, it, expect } from 'vitest';
import { buildPpcAudit, DEFAULT_TARGET_ACOS, type PpcAuditInput } from '../service/ppcAudit.js';

describe('buildPpcAudit — derivations (calculation parity)', () => {
  it('derives ACOS/ROAS/CPC/CVR/RPC and the RPC-method suggested bid', () => {
    const r = buildPpcAudit({
      targetAcos: 0.25,
      pieces: [{ brandAssetId: 'p1', spend: 30, adSales: 120, clicks: 60, orders: 12 }],
    });
    const p = r.pieces[0];
    expect(p.acos).toBeCloseTo(30 / 120); // 0.25
    expect(p.roas).toBeCloseTo(120 / 30); // 4
    expect(p.cpc).toBeCloseTo(30 / 60); // 0.5
    expect(p.cvr).toBeCloseTo(12 / 60); // 0.2
    expect(p.rpc).toBeCloseTo(120 / 60); // 2
    // suggested bid = RPC × target ACOS = 2 × 0.25
    expect(p.suggested_bid).toBeCloseTo(2 * 0.25);
  });

  it('omits a derivation (never divides by zero / fabricates) when a divisor is zero or missing', () => {
    const r = buildPpcAudit({ pieces: [{ brandAssetId: 'p1', spend: 10, adSales: 0, clicks: 0, orders: 0 }] });
    const p = r.pieces[0];
    expect(p.acos).toBeUndefined(); // spend/adSales — adSales 0 divisor → omitted
    expect(p.roas).toBe(0); // adSales/spend = 0/10 = 0 (defined; divisor 10 is non-zero)
    expect(p.cpc).toBeUndefined(); // spend/clicks — clicks 0 divisor → omitted
    expect(p.rpc).toBeUndefined(); // adSales/clicks — clicks 0 divisor → omitted
  });

  it('defaults the target ACOS to 0.30 when not supplied', () => {
    const r = buildPpcAudit({ pieces: [{ brandAssetId: 'p1', spend: 10, adSales: 50, clicks: 40, orders: 10 }] });
    expect(r.target_acos).toBe(DEFAULT_TARGET_ACOS);
  });
});

describe('buildPpcAudit — piece classification + the on-ramp', () => {
  const base = { brandAssetId: 'p', spend: 40, adSales: 100 };

  it('insufficient_data when clicks are below the judgement threshold', () => {
    const r = buildPpcAudit({ pieces: [{ ...base, clicks: 5, orders: 1 }] });
    expect(r.pieces[0].classification).toBe('insufficient_data');
    expect(r.pieces[0].route_to_trust_gap).toBe(false);
  });

  it('conversion_problem (routes to Trust Gap) when real clicks convert poorly — ads work, listing does not', () => {
    // 100 clicks, 3 orders → cvr 3% (< 8% floor) → the listing, not the bid
    const r = buildPpcAudit({ pieces: [{ ...base, clicks: 100, orders: 3 }] });
    const p = r.pieces[0];
    expect(p.classification).toBe('conversion_problem');
    expect(p.route_to_trust_gap).toBe(true);
    expect(r.on_ramp.length).toBe(1);
    expect(r.on_ramp[0].toLowerCase()).toMatch(/listing|trust gap/);
    expect(p.recommendation.toLowerCase()).toMatch(/run the trust gap|listing/);
  });

  it('bid_problem when it converts acceptably but ACOS is over target', () => {
    // 50 clicks, 10 orders → cvr 20% (healthy); spend 40 / adSales 100 = 40% ACOS > 25% target
    const r = buildPpcAudit({ targetAcos: 0.25, pieces: [{ ...base, clicks: 50, orders: 10 }] });
    const p = r.pieces[0];
    expect(p.classification).toBe('bid_problem');
    expect(p.route_to_trust_gap).toBe(false);
    expect(p.recommendation.toLowerCase()).toMatch(/bid|cpc/);
  });

  it('healthy when ACOS is at/under target with acceptable conversion', () => {
    // 50 clicks, 10 orders, spend 20 / adSales 100 = 20% ACOS ≤ 30% target
    const r = buildPpcAudit({ pieces: [{ ...base, spend: 20, clicks: 50, orders: 10 }] });
    expect(r.pieces[0].classification).toBe('healthy');
  });
});

describe('buildPpcAudit — search-term harvest / negate / wasted spend', () => {
  const input: PpcAuditInput = {
    targetAcos: 0.3,
    pieces: [{ brandAssetId: 'p', spend: 50, adSales: 150, clicks: 100, orders: 20 }],
    searchTerms: [
      { searchTerm: 'winner term', matchType: 'broad', clicks: 40, orders: 6, spend: 12, sales: 60 }, // acos 0.2 ≤ 0.3, orders ≥ 2 → harvest
      { searchTerm: 'leaky term', matchType: 'broad', clicks: 15, orders: 0, spend: 9, sales: 0 }, // 15 clicks, 0 orders → negate
      { searchTerm: 'tiny term', matchType: 'broad', clicks: 3, orders: 0, spend: 1, sales: 0 }, // below negate threshold → ignored
    ],
  };

  it('harvests converting terms with an RPC-method suggested bid', () => {
    const r = buildPpcAudit(input);
    expect(r.harvest.map((h) => h.search_term)).toEqual(['winner term']);
    const h = r.harvest[0];
    expect(h.acos).toBeCloseTo(12 / 60);
    expect(h.suggested_bid).toBeCloseTo((60 / 40) * 0.3); // rpc × target
  });

  it('negates zero-order terms above the click threshold and tallies wasted spend', () => {
    const r = buildPpcAudit(input);
    expect(r.negate.map((n) => n.search_term)).toEqual(['leaky term']);
    expect(r.wasted_spend).toBeCloseTo(9);
  });

  it('structure flags name the harvest, negate, and brand/non-brand split', () => {
    const r = buildPpcAudit(input);
    const joined = r.structure_flags.join(' ').toLowerCase();
    expect(joined).toMatch(/harvest/);
    expect(joined).toMatch(/negate/);
    expect(joined).toMatch(/brand vs non-brand/);
  });
});

describe('buildPpcAudit — TACoS + honest needs_input', () => {
  it('derives TACoS when total sales are present', () => {
    const r = buildPpcAudit({
      pieces: [{ brandAssetId: 'p', spend: 30, adSales: 100, clicks: 50, orders: 10, totalSales: 300 }],
      searchTerms: [{ searchTerm: 'x', clicks: 20, orders: 4, spend: 5, sales: 40 }],
    });
    expect(r.overall.tacos).toBeCloseTo(30 / 300);
    expect(r.needs_input.join(' ')).not.toMatch(/total_sales/);
  });

  it('flags missing total_sales and missing search terms in needs_input', () => {
    const r = buildPpcAudit({ pieces: [{ brandAssetId: 'p', spend: 30, adSales: 100, clicks: 50, orders: 10 }] });
    expect(r.overall.tacos).toBeUndefined();
    expect(r.needs_input.join(' ')).toMatch(/total_sales/);
    expect(r.needs_input.join(' ')).toMatch(/search-term/);
  });

  it('grounds the method in AdLabs (attributed) and carries the RPC bid formula', () => {
    const r = buildPpcAudit({ pieces: [{ brandAssetId: 'p', clicks: 20, orders: 2, spend: 5, adSales: 20 }] });
    expect(r.method_note.toLowerCase()).toContain('adlabs');
    expect(r.bid_method.toLowerCase()).toMatch(/rpc.*target acos|revenue per click/);
  });
});

describe('buildPpcAudit — determinism', () => {
  it('same input → identical output', () => {
    const mk = (): PpcAuditInput => ({
      targetAcos: 0.28,
      pieces: [{ brandAssetId: 'p', spend: 33, adSales: 111, clicks: 70, orders: 9 }],
      searchTerms: [{ searchTerm: 't', clicks: 12, orders: 3, spend: 4, sales: 30 }],
    });
    expect(JSON.stringify(buildPpcAudit(mk()))).toEqual(JSON.stringify(buildPpcAudit(mk())));
  });
});

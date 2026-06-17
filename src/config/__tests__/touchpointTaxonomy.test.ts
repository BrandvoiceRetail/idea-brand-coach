import { describe, it, expect } from 'vitest';
import {
  STAGES,
  TOUCHPOINTS,
  getStages,
  getTouchpoint,
  allTouchpoints,
  getApplicableTouchpoints,
  getAuditBindings,
  touchpointsByStage,
} from '../touchpointTaxonomy';

describe('touchpointTaxonomy', () => {
  it('has 5 funnel stages in order', () => {
    expect(getStages().map((s) => s.id)).toEqual([
      'awareness', 'consideration', 'purchase_decision', 'retention', 'advocacy',
    ]);
  });

  it('every touchpoint references a real stage and has bindings', () => {
    const stageIds = new Set(STAGES.map((s) => s.id));
    for (const t of TOUCHPOINTS) {
      expect(stageIds.has(t.stage)).toBe(true);
      expect(t.appliesWhen.length).toBeGreaterThan(0);
      expect(t.auditAgainst.length).toBeGreaterThan(0);
    }
  });

  it('touchpoint ids are unique', () => {
    const ids = TOUCHPOINTS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getApplicableTouchpoints filters by channel tags', () => {
    const amazonOnly = getApplicableTouchpoints(['amazon']);
    expect(amazonOnly.length).toBeGreaterThan(0);
    expect(amazonOnly.every((t) => t.appliesWhen.includes('amazon'))).toBe(true);
    // An Amazon-only brand must NOT see a Shopify PDP.
    expect(amazonOnly.find((t) => t.id === 'shopify_pdp')).toBeUndefined();
  });

  it('p0Only narrows to the P0 set', () => {
    const p0 = allTouchpoints(true);
    expect(p0.length).toBeGreaterThan(0);
    expect(p0.every((t) => t.p0)).toBe(true);
    expect(p0.length).toBeLessThan(TOUCHPOINTS.length);
  });

  it('getTouchpoint + getAuditBindings resolve', () => {
    const tp = getTouchpoint('amazon_main_image');
    expect(tp?.stage).toBe('awareness');
    expect(getAuditBindings('amazon_main_image')).toContain('psychographics.triggers');
    expect(getAuditBindings('nonexistent')).toEqual([]);
  });

  it('touchpointsByStage groups every touchpoint exactly once', () => {
    const grouped = touchpointsByStage();
    const total = grouped.reduce((n, g) => n + g.touchpoints.length, 0);
    expect(total).toBe(TOUCHPOINTS.length);
  });
});

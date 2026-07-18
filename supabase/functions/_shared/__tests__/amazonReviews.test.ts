import { describe, it, expect } from 'vitest';
import {
  pageSignalsFromJson,
  PAGE_SIGNALS_JSON_OPTIONS,
  REVIEW_JSON_OPTIONS,
} from '../amazonReviews.ts';

describe('pageSignalsFromJson', () => {
  it('maps customers_say (trimmed), aspects, and star_distribution', () => {
    const out = pageSignalsFromJson({
      customers_say: '  Customers find it effective.  ',
      aspects: [{ aspect: 'Effectiveness', sentiment: 'mixed' }],
      star_distribution: { five: 60, four: 14, three: 10, two: 6, one: 10 },
    });
    expect(out.customersSay).toBe('Customers find it effective.');
    expect(out.aspects).toEqual([{ aspect: 'Effectiveness', sentiment: 'mixed' }]);
    expect(out.starDistribution).toEqual({ five: 60, four: 14, three: 10, two: 6, one: 10 });
  });

  it('returns safe defaults for undefined json', () => {
    expect(pageSignalsFromJson(undefined)).toEqual({
      customersSay: '',
      aspects: [],
      starDistribution: null,
    });
  });

  it('coerces missing/wrong-typed fields to safe defaults', () => {
    const out = pageSignalsFromJson({ aspects: undefined, star_distribution: undefined });
    expect(out.customersSay).toBe('');
    expect(out.aspects).toEqual([]);
    expect(out.starDistribution).toBeNull();
  });
});

describe('PAGE_SIGNALS_JSON_OPTIONS', () => {
  it('reuses the reviews sub-schema and adds the page-level signals', () => {
    const props = PAGE_SIGNALS_JSON_OPTIONS.schema.properties as Record<string, unknown>;
    expect(props.reviews).toBe(REVIEW_JSON_OPTIONS.schema.properties.reviews);
    expect(props.customers_say).toBeDefined();
    expect(props.aspects).toBeDefined();
    expect(props.star_distribution).toBeDefined();
    expect(PAGE_SIGNALS_JSON_OPTIONS.schema.required).toEqual(['reviews']);
  });

  it('extends the reviews prompt with the enrichment instructions', () => {
    expect(PAGE_SIGNALS_JSON_OPTIONS.prompt.startsWith(REVIEW_JSON_OPTIONS.prompt)).toBe(true);
    expect(PAGE_SIGNALS_JSON_OPTIONS.prompt).toContain('customers_say');
  });
});

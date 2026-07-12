// @vitest-environment node
/**
 * Zod input-validation tests for the campaign / analytics / email-sequence tool surface.
 *
 * The tool `inputSchema` objects (createCampaign, ingest_*, create_email_sequence, …) are built
 * directly from the exported SSOT schemas in `campaignTypes.ts` — these enums/regex ARE the
 * validation source of truth that the MCP SDK runs on every tool call. Testing them here proves
 * the surface accepts the documented vocab and REJECTS bad input (the security/honesty contract).
 */
import { describe, it, expect } from 'vitest';
import {
  campaignChannelSchema,
  campaignStatusSchema,
  metricNameSchema,
  funnelStageSchema,
  metricGranularitySchema,
  metricSourceSchema,
  sequenceTypeSchema,
  sequenceStatusSchema,
  isoDateSchema,
} from '../service/campaignTypes.js';

interface ParsableSchema {
  safeParse: (v: unknown) => { success: boolean };
}

describe('campaign enum schemas — accept the documented vocab', () => {
  const cases: ReadonlyArray<readonly [string, ParsableSchema, readonly string[]]> = [
    ['channel', campaignChannelSchema, ['blog', 'social', 'email', 'tiktok', 'amazon', 'paid', 'content']],
    ['status', campaignStatusSchema, ['draft', 'active', 'paused', 'completed']],
    ['metric_name', metricNameSchema, ['impressions', 'sessions', 'clicks', 'opens', 'ctr', 'cvr', 'aov', 'spend', 'orders', 'revenue', 'engagement', 'calls_booked', 'views', 'new_to_brand', 'repeat_rate', 'return_rate', 'units_sold', 'subscribe_save']],
    ['funnel_stage', funnelStageSchema, ['visibility', 'clicks', 'orders', 'revenue', 'profitability']],
    ['granularity', metricGranularitySchema, ['daily', 'hourly', 'snapshot']],
    ['source', metricSourceSchema, ['manual', 'spreadsheet', 'warehouse']],
    ['sequence_type', sequenceTypeSchema, ['welcome', 'nurture', 'newsletter', 'upsell', 'downsell', 'abandoned_cart']],
    ['sequence_status', sequenceStatusSchema, ['draft', 'active', 'paused']],
  ];

  for (const [label, schema, values] of cases) {
    it(`${label}: every documented value parses`, () => {
      for (const v of values) expect(schema.safeParse(v).success).toBe(true);
    });
    it(`${label}: rejects an out-of-vocab value`, () => {
      expect(schema.safeParse('definitely-not-a-member').success).toBe(false);
    });
  }
});

describe('metric_name — the 5 non-derivable Windsor metrics (GAP A storage slots)', () => {
  // new_to_brand / repeat_rate / return_rate are fractions 0–1; units_sold / subscribe_save are
  // counts. Each needs its own storage slot (Windsor returns them — they are not derivable), so
  // the ingest tools (which validate against this SSOT enum) must accept them.
  const newMetrics = ['new_to_brand', 'repeat_rate', 'return_rate', 'units_sold', 'subscribe_save'];

  it('accepts every newly-added Windsor metric_name', () => {
    for (const m of newMetrics) expect(metricNameSchema.safeParse(m).success).toBe(true);
  });

  it('still rejects a derivable metric that must NOT be stored (computed at read-time)', () => {
    // acos / roas / cpc are derived in getFunnelPieceMetrics — never stored, so never a valid slot.
    for (const m of ['acos', 'roas', 'cpc', 'tacos']) {
      expect(metricNameSchema.safeParse(m).success).toBe(false);
    }
  });
});

describe('campaign enum schemas — reject wrong-type / empty input', () => {
  it('rejects numbers, null, and empty string where an enum is required', () => {
    for (const bad of [42, null, undefined, '', {}]) {
      expect(campaignChannelSchema.safeParse(bad).success).toBe(false);
      expect(metricNameSchema.safeParse(bad).success).toBe(false);
      expect(sequenceTypeSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('does NOT silently coerce a percentage-style channel typo', () => {
    // a common LLM mistake — "e-mail" / "Amazon" casing — must be refused, not auto-fixed
    expect(campaignChannelSchema.safeParse('Amazon').success).toBe(false);
    expect(campaignChannelSchema.safeParse('e-mail').success).toBe(false);
  });
});

describe('isoDateSchema (measured_date / month / as_of)', () => {
  it('accepts a well-formed YYYY-MM-DD', () => {
    expect(isoDateSchema.safeParse('2026-06-26').success).toBe(true);
  });

  it('rejects non-ISO / partial / wrong-shaped dates', () => {
    for (const bad of ['2026-6-1', '06/26/2026', '2026-06-26T00:00:00Z', 'yesterday', '', 20260626]) {
      expect(isoDateSchema.safeParse(bad).success).toBe(false);
    }
  });
});

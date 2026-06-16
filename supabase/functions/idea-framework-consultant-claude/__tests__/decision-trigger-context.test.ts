import { describe, it, expect } from 'vitest';
import { buildDecisionTriggerSnapshot, type DecisionTriggerClient } from '../decision-trigger-context';

function mockClient(response: { data: unknown; error?: unknown }): DecisionTriggerClient {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data: response.data, error: response.error ?? null }),
  };
  return { from: () => builder };
}

describe('buildDecisionTriggerSnapshot', () => {
  it('formats the latest trigger with name, anchor, verbatim evidence and placement', async () => {
    const out = await buildDecisionTriggerSnapshot(
      mockClient({
        data: {
          dominant_type: 'Recognition',
          brand_anchor: 'like Lego, your customer buys the feeling of being understood',
          evidence_phrases: ['my favorite top loader binder', 'as the collection grows'],
          placement_instruction: 'Open bullet 1 with their own words (Contextual).',
        },
      }),
      'user-1',
    );
    expect(out).toContain('<decision-trigger>');
    expect(out).toContain('Recognition');
    expect(out).toContain('like Lego');
    expect(out).toContain('"my favorite top loader binder"');
    expect(out).toContain('Open bullet 1');
    // must tell the coach not to re-derive or re-explain the method
    expect(out).toMatch(/do NOT re-derive/i);
  });

  it('returns empty string when the seller has no trigger yet', async () => {
    expect(await buildDecisionTriggerSnapshot(mockClient({ data: null }), 'user-1')).toBe('');
  });

  it('returns empty string on a query error (never blocks chat)', async () => {
    expect(
      await buildDecisionTriggerSnapshot(mockClient({ data: null, error: { message: 'boom' } }), 'user-1'),
    ).toBe('');
  });

  it('omits the evidence line when there are no phrases but still names the trigger', async () => {
    const out = await buildDecisionTriggerSnapshot(
      mockClient({
        data: {
          dominant_type: 'Permission',
          brand_anchor: 'like Authority, your customer needs a reason to believe',
          evidence_phrases: [],
          placement_instruction: 'Add Reassurance mid-funnel.',
        },
      }),
      'user-1',
    );
    expect(out).toContain('Permission');
    expect(out).not.toContain('Evidence in their');
  });
});

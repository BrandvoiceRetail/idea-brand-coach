// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { findTierViolations, collectUserFacingStrings, scanResultForViolations } from '../terminologyGuard.js';

describe('terminologyGuard.findTierViolations (Tier-B/C leak detector)', () => {
  it('flags engine stage labels (S1–S4, "Stage 3")', () => {
    expect(findTierViolations('Your S3 triggers show…').map((v) => v.rule)).toContain('stage-label');
    expect(findTierViolations('From Stage 2 of the pipeline').map((v) => v.rule)).toContain('stage-label');
  });

  it('flags the four buyer-state classification names (Tier B, never in primary output)', () => {
    for (const name of ['Assessor', 'Protector', 'Expresser', 'Connector']) {
      expect(findTierViolations(`The dominant state is the ${name}.`).map((v) => v.rule)).toContain('buyer-state');
    }
  });

  it('flags neuroanatomy framing + internal field tokens (Tier C)', () => {
    expect(findTierViolations('driven by the amygdala and limbic system').map((v) => v.rule)).toContain('neuroanatomy');
    expect(findTierViolations('Bolte-Taylor model').length).toBeGreaterThan(0);
    expect(findTierViolations('"dominant_buyer_state":"x"').map((v) => v.rule)).toContain('internal-field');
  });

  it('does NOT false-positive on common English / legitimate Tier-A copy', () => {
    // CAPTURE element words are common English — must NOT be auto-flagged here.
    expect(findTierViolations('Grab attention in the hero; lead with context; name the pain.')).toEqual([]);
    // Tier-A vocabulary (Trust Gap, Decision Trigger, pillar names, trigger names) is allowed.
    expect(findTierViolations('Your Trust Gap is 58. The Decision Trigger is Recognition; lift your Empathetic pillar.')).toEqual([]);
    // lowercase stage_ref METADATA (s3_triggers) is internal traceability, not prose — not matched.
    expect(findTierViolations('stage_ref: s3_triggers, s1_vocab')).toEqual([]);
    // plain prose
    expect(findTierViolations('Lead with the customer’s own words and ship the brief today.')).toEqual([]);
  });
});

describe('terminologyGuard — tool-result scanning', () => {
  it('collects user-facing strings from content text blocks + structuredContent', () => {
    const result = {
      content: [{ type: 'text', text: 'hello' }, { type: 'text', text: 'world' }],
      structuredContent: { a: 'deep', nested: { b: ['x', 'y'] } },
    };
    const strings = collectUserFacingStrings(result);
    expect(strings).toEqual(expect.arrayContaining(['hello', 'world', 'deep', 'x', 'y']));
  });

  it('flags a leak that appears only in structuredContent (the connector-mirror surface)', () => {
    const leaky = {
      content: [{ type: 'text', text: 'Here is your finding.' }],
      structuredContent: { primary_state: 'Protector', stage: 'S3' },
    };
    const v = scanResultForViolations(leaky);
    expect(v.map((x) => x.rule)).toEqual(expect.arrayContaining(['buyer-state', 'stage-label']));
  });

  it('passes a clean, conversion-fixer-framed result', () => {
    const clean = {
      content: [{ type: 'text', text: 'Your conversion gap is Empathetic. Lead the hero with recognition. Here is the brief.' }],
      structuredContent: { trigger: 'Recognition', bullets: ['Lead with the moment of past failure'] },
    };
    expect(scanResultForViolations(clean)).toEqual([]);
  });
});

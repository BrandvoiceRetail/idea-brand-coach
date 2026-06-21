// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ICPS, getICP, icpForPersona } from '../evals/icp/profiles.js';
import {
  DEFAULT_CRITERIA_SET,
  enabledCriteria,
  criteriaSteeringPreamble,
  criteriaJudgeDimensions,
  getCriterion,
} from '../evals/criteria/catalog.js';
import { harvestSweep, classifyConversation } from '../evals/harvest/harvest.js';
import { SAMPLE_CONVERSATIONS } from '../evals/harvest/sampleConversations.js';
import { systemPromptFor } from '../evals/live/replay.js';
import { getEvalCase } from '../evals/cases/catalog.js';

describe('ICP profiles (canonical)', () => {
  it('defines exactly the two ICPs and maps personas', () => {
    expect(ICPS.map((p) => p.id).sort()).toEqual(['busy-brand-owner', 'operational-va']);
    expect(icpForPersona('P1')?.id).toBe('busy-brand-owner');
    expect(icpForPersona('P2')?.id).toBe('operational-va');
    expect(icpForPersona('edge')).toBeUndefined();
    expect(getICP('busy-brand-owner')?.codename).toBe('Maya');
  });
  it('every ICP carries jobs, problems, and coach adaptation', () => {
    for (const p of ICPS) {
      expect(p.jobs.length, p.id).toBeGreaterThan(0);
      expect(p.problems.length, p.id).toBeGreaterThan(0);
      expect(p.coachAdapt.do.length, p.id).toBeGreaterThan(0);
      expect(p.detectionSignals.length, p.id).toBeGreaterThan(0);
    }
  });
});

describe('Coach Criteria', () => {
  it('ships a valid default set with bounded weights', () => {
    expect(DEFAULT_CRITERIA_SET.criteria.length).toBeGreaterThanOrEqual(8);
    for (const c of DEFAULT_CRITERIA_SET.criteria) {
      expect(c.weight, c.id).toBeGreaterThanOrEqual(1);
      expect(c.weight, c.id).toBeLessThanOrEqual(5);
      expect(c.optimizeToward.length, c.id).toBeGreaterThan(0);
      expect(['reward', 'avoid']).toContain(c.polarity);
    }
  });
  it('enabledCriteria sorts by weight desc and respects icp scope', () => {
    const active = enabledCriteria(DEFAULT_CRITERIA_SET);
    expect(active.length).toBeGreaterThan(0);
    for (let i = 1; i < active.length; i++) expect(active[i - 1].weight).toBeGreaterThanOrEqual(active[i].weight);
    // an icp-scoped query never returns a criterion scoped to a different icp
    const owner = enabledCriteria(DEFAULT_CRITERIA_SET, 'busy-brand-owner');
    expect(owner.every((c) => c.icpScope === 'all' || c.icpScope === 'busy-brand-owner')).toBe(true);
  });
  it('compiles a steering preamble with reward + avoid directives', () => {
    const pre = criteriaSteeringPreamble(DEFAULT_CRITERIA_SET);
    expect(pre).toMatch(/COACHING CRITERIA/);
    expect(pre).toMatch(/\[w5\]/); // a top-weight directive
    expect(pre).toMatch(/Avoid:/); // the engine-internals criterion is polarity 'avoid'
    expect(criteriaJudgeDimensions(DEFAULT_CRITERIA_SET)).toContain('end-with-one-next-action');
    expect(getCriterion(DEFAULT_CRITERIA_SET, 'recognition-when-empathetic-gap')?.category).toBe('recommendation');
  });
  it('the live coach system prompt is steered by the criteria + ICP', () => {
    const c = getEvalCase('infinityvault-recognition')!;
    const sp = systemPromptFor(c);
    expect(sp).toMatch(/COACHING CRITERIA/);
    expect(sp).toMatch(/Maya|done-for-you|brand owner/i); // P1 ICP adaptation injected
  });
});

describe('Conversation harvest sweep', () => {
  const sweep = harvestSweep(SAMPLE_CONVERSATIONS);

  it('classifies the ICPs from the sample conversations', () => {
    expect(classifyConversation(SAMPLE_CONVERSATIONS[0]).persona).toBe('P1'); // jargon + data + "don't tell me"
    expect(classifyConversation(SAMPLE_CONVERSATIONS[1]).persona).toBe('P2'); // "explain" + "walk me through" + checklist
    expect(classifyConversation(SAMPLE_CONVERSATIONS[3]).riskFlags).toContain('prompt-injection');
  });

  it('passes wins, fails the unmet ask, and treats a correct refusal as a pass', () => {
    const byConv = (id: string) => sweep.candidates.find((c) => c.sourceConvId === id)!;
    expect(byConv('c1').screen.passed).toBe(true); // P1 win, ended with action
    expect(byConv('c2').screen.passed).toBe(true); // P2 win, taught + checklist
    expect(byConv('c3').screen.passed).toBe(false); // competitor-watch ask the coach can't serve
    expect(byConv('c4').screen.passed).toBe(true); // injection correctly refused
  });

  it('turns failing conversations into feature ideas and aggregates ICP signal', () => {
    expect(sweep.failing).toBeGreaterThanOrEqual(1);
    expect(sweep.featureIdeas.some((f) => f.fromConvId === 'c3')).toBe(true);
    expect(sweep.icpSignals.map((s) => s.icpId).sort()).toEqual(['busy-brand-owner', 'operational-va']);
  });
});

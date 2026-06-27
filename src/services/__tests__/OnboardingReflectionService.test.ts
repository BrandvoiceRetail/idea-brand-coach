import { describe, it, expect } from 'vitest';
import { OnboardingReflectionService } from '../OnboardingReflectionService';
import { parseMegaprompt } from '@/lib/v4/megapromptParse';

const SAMPLE =
  "We're called RestWell. We sell a natural sleep supplement for busy parents who can't switch off at night. We mainly sell on Amazon and want to grow repeat orders.";

/** A read-back that never reaches the network (Trust Gap is exercised separately). */
const service = new OnboardingReflectionService(async () => null);

describe('OnboardingReflectionService.readItBack', () => {
  it('restates the brand in the user\'s own words (the hero line)', () => {
    const slots = parseMegaprompt(SAMPLE);
    const result = service.readItBack(SAMPLE, slots);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.finding).toContain("Here's what I heard:");
    expect(result.finding).toContain('RestWell');
    expect(result.finding).toContain('natural sleep supplement');
    expect(result.finding).toContain('grow repeat orders');
  });

  it('does not repeat overlapping clauses (regression: no duplicated customer/problem)', () => {
    // The conservative probes overlap (customer ⊃ problem); the restatement must
    // de-dupe so "busy parents who can't switch off at night" appears at most once.
    const slots = parseMegaprompt(SAMPLE);
    const result = service.readItBack(SAMPLE, slots);
    if (result.status !== 'ok') throw new Error('expected ok');
    const occurrences = result.finding.toLowerCase().split('busy parents').length - 1;
    expect(occurrences).toBeLessThanOrEqual(1);
  });

  it('asks for more when nothing usable was lifted (never fabricates)', () => {
    const result = service.readItBack('...', []);
    expect(result.status).toBe('needs_input');
  });
});

describe('OnboardingReflectionService.sketchAvatar', () => {
  it('drops the problem clause when the who clause already conveys it (no redundancy)', () => {
    const slots = parseMegaprompt(SAMPLE);
    const result = service.sketchAvatar(slots);
    if (result.status !== 'ok') throw new Error('expected ok');
    // who = "busy parents who can't switch off at night" already contains the problem
    // fragment "switch off at night" → the finding should NOT append "struggling with …".
    expect(result.finding).not.toContain('struggling with');
    expect(result.finding).toContain('busy parents');
  });
});

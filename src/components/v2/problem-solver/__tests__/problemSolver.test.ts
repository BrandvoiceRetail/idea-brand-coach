import { describe, it, expect } from 'vitest';
import { computeSelfReport, PROBLEM_SOLVER_QUESTIONS } from '../diagnosticQuestions';
import { mapDecisionTrigger } from '../forensicMapping';
import { isForensicResponse } from '../types';

const QID = {
  insight: 'hero-headline',
  distinctive: 'name-removed',
  empathetic: 'bullets-aloud',
  authentic: 'trust-signals',
} as const;

const allAt = (v: string): Record<string, string> =>
  Object.fromEntries(Object.values(QID).map((id) => [id, v]));

describe('computeSelfReport (S1 scoring — parity with FreeDiagnostic math)', () => {
  it('has exactly one question per IDEA pillar', () => {
    const cats = PROBLEM_SOLVER_QUESTIONS.map((q) => q.category).sort();
    expect(cats).toEqual(['authentic', 'distinctive', 'empathetic', 'insight']);
  });

  it('all top-score answers → 100 per pillar + 100 overall', () => {
    expect(computeSelfReport(allAt('5'))).toEqual({
      insight: 100, distinctive: 100, empathetic: 100, authentic: 100, overall: 100,
    });
  });

  it('mid answers → 60 per pillar ((3/5)*100), overall 60', () => {
    expect(computeSelfReport(allAt('3'))).toEqual({
      insight: 60, distinctive: 60, empathetic: 60, authentic: 60, overall: 60,
    });
  });

  it('unanswered pillars score 0', () => {
    expect(computeSelfReport({})).toEqual({
      insight: 0, distinctive: 0, empathetic: 0, authentic: 0, overall: 0,
    });
  });
});

describe('mapDecisionTrigger (snake/camel tolerant; rejects junk)', () => {
  const snake = {
    dominant_type: 'Recognition',
    brand_anchor: 'like Dove, your customer buys being seen',
    evidence_phrases: ['flimsy', 'bent my cards'],
    placement_instruction: 'Lead with recognition in your hero headline.',
    why_this_trigger: 'They feel unseen until you mirror their situation.',
  };

  it('maps the internal snake_case shape', () => {
    const r = mapDecisionTrigger(snake);
    expect(r?.dominantType).toBe('Recognition');
    expect(r?.brandAnchor).toMatch(/Dove/);
    expect(r?.evidencePhrases).toEqual(['flimsy', 'bent my cards']);
    expect(r?.placementInstruction).toMatch(/hero headline/);
  });

  it('maps the camelCase variant too', () => {
    const r = mapDecisionTrigger({
      dominantType: 'Identity', brandAnchor: 'like Apple', placementInstruction: 'CTA',
    });
    expect(r?.dominantType).toBe('Identity');
  });

  it('returns undefined on an unknown trigger type', () => {
    expect(mapDecisionTrigger({ ...snake, dominant_type: 'Nonsense' })).toBeUndefined();
  });

  it('returns undefined when required fields are missing', () => {
    expect(mapDecisionTrigger({ dominant_type: 'Recognition' })).toBeUndefined(); // no anchor/placement
    expect(mapDecisionTrigger(null)).toBeUndefined();
    expect(mapDecisionTrigger('x')).toBeUndefined();
  });

  it('drops non-string evidence phrases', () => {
    const r = mapDecisionTrigger({ ...snake, evidence_phrases: ['ok', 42, null, 'fine'] });
    expect(r?.evidencePhrases).toEqual(['ok', 'fine']);
  });
});

describe('isForensicResponse (response guard)', () => {
  const valid = {
    ok: true,
    asin: 'B0CJBQ7F5C',
    reviews_analyzed: 8,
    thin_corpus: false,
    forensic_scores: { insight: 8, distinctive: 9, empathetic: 6, authentic: 11, overall: 34 },
    primary_gap: 'empathetic',
  };

  it('accepts a well-formed response (customer_profile optional)', () => {
    expect(isForensicResponse(valid)).toBe(true);
  });

  it('rejects ok:false / wrong shapes', () => {
    expect(isForensicResponse({ ...valid, ok: false })).toBe(false);
    expect(isForensicResponse({ ...valid, forensic_scores: { insight: 8 } })).toBe(false);
    expect(isForensicResponse({ ...valid, reviews_analyzed: '8' })).toBe(false);
    expect(isForensicResponse(null)).toBe(false);
  });
});

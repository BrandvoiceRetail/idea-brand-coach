import { describe, it, expect } from 'vitest';
import {
  dimensionCitations,
  evidenceByDimension,
  type V5ForensicReport,
  type V5InterpretationDimension,
} from '../forensicReport';

/**
 * The edge engine already sends per-pillar `where_it_shows_up` citations; the app used to drop
 * them at the client boundary. These pure helpers surface them for the "See all the evidence"
 * disclosure — verbatim, grounded, and honest about the no-evidence case.
 */

function report(dimensions: V5InterpretationDimension[]): V5ForensicReport {
  return {
    ok: true,
    asin: 'B0TEST',
    reviews_analyzed: 20,
    thin_corpus: false,
    forensic_scores: { insight: 15, distinctive: 12, empathetic: 10, authentic: 18, overall: 55 },
    primary_gap: 'empathetic',
    interpretation: { dimensions },
    decision_trigger: null,
  };
}

describe('dimensionCitations', () => {
  it('surfaces verbatim citations and trims them', () => {
    const cites = dimensionCitations({
      dimension: 'Insight',
      where_it_shows_up: [{ evidence_type: 'reviews', quote_or_observation: '  it finally stopped my shedding  ' }],
    });
    expect(cites).toEqual([{ evidence_type: 'reviews', quote_or_observation: 'it finally stopped my shedding' }]);
  });

  it('drops empty / whitespace-only entries (never emits a blank quote)', () => {
    expect(
      dimensionCitations({
        dimension: 'Distinctiveness',
        where_it_shows_up: [{ quote_or_observation: '' }, { quote_or_observation: '   ' }, { evidence_type: 'ad_copy' }] as never,
      }),
    ).toEqual([]);
  });

  it('returns [] when the field is absent', () => {
    expect(dimensionCitations({ dimension: 'Authenticity' })).toEqual([]);
  });
});

describe('evidenceByDimension', () => {
  it('returns each pillar with citations, in order, defaulting grounding to inference', () => {
    const out = evidenceByDimension(
      report([
        { dimension: 'Insight', grounding: 'evidence', where_it_shows_up: [{ evidence_type: 'reviews', quote_or_observation: 'q1' }] },
        { dimension: 'Empathy', where_it_shows_up: [{ quote_or_observation: 'q2' }] }, // no grounding → inference
      ]),
    );
    expect(out).toEqual([
      { dimension: 'Insight', grounding: 'evidence', citations: [{ evidence_type: 'reviews', quote_or_observation: 'q1' }] },
      { dimension: 'Empathy', grounding: 'inference', citations: [{ evidence_type: undefined, quote_or_observation: 'q2' }] },
    ]);
  });

  it('omits pillars with no citations (no empty rows in the disclosure)', () => {
    const out = evidenceByDimension(
      report([
        { dimension: 'Insight', where_it_shows_up: [{ quote_or_observation: 'q' }] },
        { dimension: 'Authenticity', where_it_shows_up: [] },
        { dimension: 'Distinctiveness' },
      ]),
    );
    expect(out.map((d) => d.dimension)).toEqual(['Insight']);
  });

  it('returns [] when interpretation is null (degraded run)', () => {
    const r = report([]);
    r.interpretation = null;
    expect(evidenceByDimension(r)).toEqual([]);
  });
});

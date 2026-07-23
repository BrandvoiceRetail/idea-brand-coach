import { describe, it, expect } from 'vitest';
import { mineReviews, normaliseForMatch } from '../reviewCounting.js';
import { reviewMiningResultSchema, type KeywordSpec, type ReviewInput } from '../../contracts/reviewMining.js';

/**
 * The counting engine is pure and deterministic — same inputs, same output — so it is
 * table-/example-tested exhaustively. The cast-iron rule (no fabrication, verbatim only)
 * is a testable property here: every emitted quote MUST be a substring of a real review body.
 */

const HAIR_KEYWORDS: KeywordSpec[] = [
  { term: 'thicker', role: 'hypothesis' },
  { term: 'thick', role: 'hypothesis' },
  { term: 'fuller', role: 'hypothesis' },
  { term: 'volume', role: 'adjacent' },
  { term: 'growth', role: 'comparison' },
  { term: 'soft', role: 'secondary' },
  { term: 'falling', role: 'problem' },
];

function reviews(...bodies: Array<[string, number?, string?]>): ReviewInput[] {
  return bodies.map(([body, rating, reviewer]) => ({ body, rating: rating ?? null, reviewer: reviewer ?? null }));
}

describe('normaliseForMatch', () => {
  it('folds case, typographic punctuation, entities, and whitespace', () => {
    expect(normaliseForMatch('  It’s  “Thicker”—really  ')).toBe('it\'s "thicker"-really');
    expect(normaliseForMatch('hair&amp;more')).toBe('hair&more');
    expect(normaliseForMatch('a\n\nb')).toBe('a b');
  });
});

describe('mineReviews — counting', () => {
  it('counts distinct reviews per term, stem variants separately (thick != thicker)', () => {
    const r = mineReviews({
      hypothesis: 'customers experience this as thickening',
      keywords: HAIR_KEYWORDS,
      reviews: reviews(
        ['My hair looks thicker already', 5, 'A'],
        ['thicker and fuller after a month', 5, 'B'],
        ['nice and thick', 4, 'C'],
        ['no change at all', 2, 'D'],
      ),
    });
    const byTerm = Object.fromEntries(r.themes.map((t) => [t.term, t]));
    expect(byTerm.thicker.mentions).toBe(2);           // A, B
    expect(byTerm.thick.mentions).toBe(1);             // C only — NOT the two "thicker" reviews
    expect(byTerm.fuller.mentions).toBe(1);            // B
    expect(byTerm.volume.mentions).toBe(0);            // zero is a valid finding
    expect(byTerm.thicker.share).toBeCloseTo(2 / 4);
  });

  it('flags name-inflation when a term is in the product title', () => {
    const r = mineReviews({
      hypothesis: 'growth product',
      keywords: HAIR_KEYWORDS,
      reviews: reviews(['great for growth', 5, 'A'], ['thicker hair', 5, 'B']),
      productTitle: 'Guyology Hair Growth Serum',
    });
    const byTerm = Object.fromEntries(r.themes.map((t) => [t.term, t]));
    expect(byTerm.growth.nameInflated).toBe(true);
    expect(byTerm.thicker.nameInflated).toBe(false);
    expect(r.cautions.some((c) => /inflat/i.test(c))).toBe(true);
  });

  it('surfaces negated mentions ("not much volume" is not a positive volume signal)', () => {
    const r = mineReviews({
      hypothesis: 'volume',
      keywords: [{ term: 'volume', role: 'adjacent' }],
      reviews: reviews(['lots of volume', 5, 'A'], ['not seeing much volume honestly', 2, 'B']),
    });
    const vol = r.themes.find((t) => t.term === 'volume')!;
    expect(vol.mentions).toBe(2);
    expect(vol.negatedMentions).toBe(1);               // B only
  });
});

describe('mineReviews — verdict thresholds (on the exact hypothesis union)', () => {
  const kw: KeywordSpec[] = [{ term: 'thicker', role: 'hypothesis' }, { term: 'thick', role: 'hypothesis' }];

  it('computes hypothesisReach as the de-duplicated union, not the sum', () => {
    const r = mineReviews({
      hypothesis: 'thickening',
      keywords: kw,
      // one review contains BOTH terms — a naive sum would double-count it
      reviews: reviews(['thicker and thick', 5, 'A'], ['plain', 3, 'B'], ['plain2', 3, 'C'], ['plain3', 3, 'D'], ['plain4', 3, 'E']),
    });
    expect(r.verdict.hypothesisReach).toBe(1);         // union of {A} — not 2
    expect(r.verdict.share).toBeCloseTo(1 / 5);
  });

  it('≥20% validated, 10–20% supportive, <10% not_felt, 0 absent', () => {
    const mk = (hits: number, total: number) =>
      mineReviews({
        hypothesis: 'thickening', keywords: kw,
        reviews: reviews(
          ...Array.from({ length: total }, (_, i) => [i < hits ? 'thicker' : 'plain', 5, `r${i}`] as [string, number, string]),
        ),
      }).verdict.level;
    expect(mk(3, 10)).toBe('validated');   // 30%
    expect(mk(2, 10)).toBe('validated');   // 20% — inclusive lower bound
    expect(mk(15, 100)).toBe('supportive'); // 15%
    expect(mk(5, 100)).toBe('not_felt');    // 5%
    expect(mk(0, 10)).toBe('absent');
  });
});

describe('mineReviews — voice-of-customer fragments', () => {
  it('emits verbatim substrings only, one per distinct reviewer, max 5', () => {
    const input = {
      hypothesis: 'thickening',
      keywords: HAIR_KEYWORDS,
      reviews: reviews(
        ['My hair is so much thicker now! I am thrilled.', 5, 'A'],
        ['Noticeably thicker after week two.', 5, 'B'],
        ['thicker, honestly.', 4, 'A'],       // same reviewer A — must not double-count
        ['Fuller and thicker every wash.', 5, 'C'],
      ),
    };
    const r = mineReviews(input);
    // every quote is an exact substring of SOME review body — the cast-iron rule
    for (const v of r.voc) {
      expect(input.reviews.some((rv) => rv.body.includes(v.quote))).toBe(true);
    }
    // distinct reviewers only
    const named = r.voc.map((v) => v.reviewer).filter(Boolean);
    expect(new Set(named).size).toBe(named.length);
    expect(r.voc.length).toBeLessThanOrEqual(5);
    expect(r.voc.length).toBeGreaterThan(0);
  });

  it('never invents: a corpus with no hypothesis language yields no VOC and an absent verdict', () => {
    const r = mineReviews({
      hypothesis: 'thickening',
      keywords: HAIR_KEYWORDS,
      reviews: reviews(['smells nice', 5, 'A'], ['good value', 4, 'B']),
    });
    expect(r.voc).toHaveLength(0);
    expect(r.verdict.level).toBe('absent');
  });
});

describe('mineReviews — denominator honesty', () => {
  it('marks a sample (analysed < written total) and cautions about it', () => {
    const r = mineReviews({
      hypothesis: 'thickening', keywords: HAIR_KEYWORDS,
      reviews: reviews(['thicker', 5, 'A'], ['thick', 4, 'B']),
      writtenReviewsTotal: 186,
    });
    expect(r.denominator.reviewsAnalysed).toBe(2);
    expect(r.denominator.writtenReviewsTotal).toBe(186);
    expect(r.denominator.isFullCorpus).toBe(false);
    expect(r.cautions.some((c) => /sample|of the .* we read|186/i.test(c))).toBe(true);
  });

  it('marks full corpus when analysed >= written total', () => {
    const r = mineReviews({
      hypothesis: 'thickening', keywords: HAIR_KEYWORDS,
      reviews: reviews(['thicker', 5, 'A'], ['thick', 4, 'B']),
      writtenReviewsTotal: 2,
    });
    expect(r.denominator.isFullCorpus).toBe(true);
  });
});

describe('mineReviews — contract + edge cases', () => {
  it('output validates against the zod contract, grounding is always evidence', () => {
    const r = mineReviews({
      hypothesis: 'thickening', keywords: HAIR_KEYWORDS,
      reviews: reviews(['thicker and fuller', 5, 'A']),
    });
    expect(() => reviewMiningResultSchema.parse(r)).not.toThrow();
    expect(r.grounding).toBe('evidence');
  });

  it('handles an empty corpus without dividing by zero', () => {
    const r = mineReviews({ hypothesis: 'x', keywords: HAIR_KEYWORDS, reviews: [] });
    expect(r.denominator.reviewsAnalysed).toBe(0);
    expect(r.verdict.level).toBe('absent');
    expect(r.verdict.share).toBe(0);
    expect(r.themes.every((t) => t.share === 0)).toBe(true);
  });
});

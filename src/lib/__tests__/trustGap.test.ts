import { describe, it, expect } from 'vitest';
import {
  buildTrustGap,
  rescaleDimension,
  getTrustGapBand,
  trustGapPositioningStatement,
  TRUST_GAP_DIMENSIONS,
  TRUST_GAP_DIMENSION_META,
  type TrustGapInputScores,
} from '../trustGap';

const lowScores: TrustGapInputScores = {
  insight: 20,
  distinctive: 32,
  empathetic: 12,
  authentic: 24,
  overall: 22,
};

const mixedScores: TrustGapInputScores = {
  insight: 84,
  distinctive: 40,
  empathetic: 60,
  authentic: 92,
  overall: 69,
};

const highScores: TrustGapInputScores = {
  insight: 92,
  distinctive: 88,
  empathetic: 96,
  authentic: 84,
  overall: 90,
};

describe('trustGap', () => {
  describe('rescaleDimension', () => {
    it('divides a 0-100 score by 4 to land on the /25 scale', () => {
      expect(rescaleDimension(100)).toBe(25);
      expect(rescaleDimension(80)).toBe(20);
      expect(rescaleDimension(50)).toBe(13); // 12.5 rounds to 13
      expect(rescaleDimension(0)).toBe(0);
    });

    it('clamps out-of-range and non-finite input', () => {
      expect(rescaleDimension(140)).toBe(25);
      expect(rescaleDimension(-10)).toBe(0);
      expect(rescaleDimension(Number.NaN)).toBe(0);
      // @ts-expect-error guarding against bad runtime data
      expect(rescaleDimension(undefined)).toBe(0);
    });
  });

  describe('getTrustGapBand', () => {
    it('bands /25 scores into weak / mixed / strong', () => {
      expect(getTrustGapBand(0)).toBe('weak');
      expect(getTrustGapBand(9)).toBe('weak');
      expect(getTrustGapBand(10)).toBe('mixed');
      expect(getTrustGapBand(17)).toBe('mixed');
      expect(getTrustGapBand(18)).toBe('strong');
      expect(getTrustGapBand(25)).toBe('strong');
    });
  });

  describe('buildTrustGap', () => {
    it('returns four dimensions in canonical order', () => {
      const result = buildTrustGap(mixedScores);
      expect(result.dimensions.map((d) => d.key)).toEqual([...TRUST_GAP_DIMENSIONS]);
    });

    it('rescales each dimension to /25 and keeps overall on /100', () => {
      const result = buildTrustGap(mixedScores);
      const byKey = Object.fromEntries(result.dimensions.map((d) => [d.key, d]));
      expect(byKey.insight.score).toBe(21);
      expect(byKey.distinctive.score).toBe(10);
      expect(byKey.empathetic.score).toBe(15);
      expect(byKey.authentic.score).toBe(23);
      expect(result.overall).toBe(69);
    });

    it('the four /25 dimensions sum to roughly the overall /100', () => {
      for (const scores of [lowScores, mixedScores, highScores]) {
        const result = buildTrustGap(scores);
        const sum = result.dimensions.reduce((acc, d) => acc + d.score, 0);
        // Sum of rounded /25 values is within rounding tolerance of overall.
        expect(Math.abs(sum - result.overall)).toBeLessThanOrEqual(2);
      }
    });

    it('names the lowest dimension as the primary gap (all-low distribution)', () => {
      const result = buildTrustGap(lowScores);
      expect(result.primaryGap).toBe('empathetic');
      expect(result.primaryGapMeta.route).toBe('/v1/idea/empathy');
    });

    it('names the primary gap in a mixed distribution', () => {
      const result = buildTrustGap(mixedScores);
      expect(result.primaryGap).toBe('distinctive');
      expect(result.primaryGapMeta.route).toBe('/v1/idea/distinctive');
    });

    it('still names a primary gap when every dimension is high', () => {
      const result = buildTrustGap(highScores);
      expect(result.primaryGap).toBe('authentic');
      expect(result.dimensions.every((d) => d.band === 'strong')).toBe(true);
    });

    it('breaks ties by canonical order (all-equal -> insight)', () => {
      const flat: TrustGapInputScores = {
        insight: 60,
        distinctive: 60,
        empathetic: 60,
        authentic: 60,
        overall: 60,
      };
      expect(buildTrustGap(flat).primaryGap).toBe('insight');
    });

    it('survives missing / malformed score fields', () => {
      const result = buildTrustGap({} as TrustGapInputScores);
      expect(result.overall).toBe(0);
      expect(result.dimensions).toHaveLength(4);
      expect(result.dimensions.every((d) => d.score === 0)).toBe(true);
      expect(result.primaryGap).toBe('insight');
    });

    it('every gap maps to a known IDEA route', () => {
      for (const key of TRUST_GAP_DIMENSIONS) {
        expect(TRUST_GAP_DIMENSION_META[key].route).toMatch(/^\/v1\/idea\//);
      }
    });
  });

  describe('trustGapPositioningStatement', () => {
    it('is stable for identical scores and differs when scores change', () => {
      expect(trustGapPositioningStatement(mixedScores)).toBe(trustGapPositioningStatement({ ...mixedScores }));
      expect(trustGapPositioningStatement(mixedScores)).not.toBe(trustGapPositioningStatement(highScores));
    });
  });
});

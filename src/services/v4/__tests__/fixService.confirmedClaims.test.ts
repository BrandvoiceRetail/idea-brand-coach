import { describe, it, expect } from 'vitest';
import { brandNameFromTitle, normalizeBullets } from '../fixService';

// The two real Guyology Labs listing titles the D3 fix must parse correctly — the
// serum run that produced the "Pea Sprout" / "[Brand Name]" bug (root cause 2026-07-15).
const SERUM_TITLE =
  'Hair Growth Serum for Men & Women | DHT Blocker for Hair Loss & Regrowth | ' +
  'Thickening Thinning Hair | 4% AnaGain™, Biotin & Caffeine | Dermatologist Recommended | ' +
  'Minoxidil Compatible | Guyology Labs';
const SHAMPOO_TITLE =
  'Hair Growth Shampoo & Conditioner for Men & Women | DHT Blocker for Hair Loss & Regrowth | ' +
  'Thickening Thinning Hair | 2% AnaGain™, Biotin & Caffeine | Minoxidil Compatible | by Guyology Labs';

describe('brandNameFromTitle', () => {
  it('pulls the brand from the final pipe segment', () => {
    expect(brandNameFromTitle(SERUM_TITLE)).toBe('Guyology Labs');
  });

  it('strips a leading "by "', () => {
    expect(brandNameFromTitle(SHAMPOO_TITLE)).toBe('Guyology Labs');
  });

  it('returns null for a title with no pipe-delimited brand', () => {
    expect(brandNameFromTitle('Just A Plain Product Title')).toBeNull();
  });

  it('rejects an over-long final segment (likely a spec, not a brand)', () => {
    expect(
      brandNameFromTitle('Product | A very long trailing marketing phrase that is clearly not a brand name'),
    ).toBeNull();
  });
});

describe('normalizeBullets', () => {
  it('passes through a string[]', () => {
    expect(normalizeBullets(['  4% AnaGain™ ', 'Biotin & Caffeine'])).toEqual([
      '4% AnaGain™',
      'Biotin & Caffeine',
    ]);
  });

  it('extracts .text from a {text}[] and drops empties/non-strings', () => {
    expect(normalizeBullets([{ text: ' DHT blocker ' }, { text: '' }, { nope: 1 }, 42])).toEqual([
      'DHT blocker',
    ]);
  });

  it('returns [] for non-array input', () => {
    expect(normalizeBullets(null)).toEqual([]);
    expect(normalizeBullets('not an array')).toEqual([]);
  });
});

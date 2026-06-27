import { describe, it, expect } from 'vitest';
import {
  parseMegaprompt,
  portraitFromSlots,
  findTierViolations,
} from '../megapromptParse';

const SAMPLE =
  "We're called RestWell. We sell a natural sleep supplement for busy parents who can't switch off at night. We mainly sell on Amazon and want to grow repeat orders.";

describe('parseMegaprompt', () => {
  it('extracts verbatim slot values from the paste (the user\'s own words)', () => {
    const slots = parseMegaprompt(SAMPLE);
    const by = (k: string) => slots.find((s) => s.key === k)?.value;
    expect(by('brand_name')).toContain('RestWell');
    expect(by('product')).toContain('natural sleep supplement');
    expect(by('customer')).toContain('busy parents');
    expect(by('channel')?.toLowerCase()).toContain('amazon');
    // every extracted value must be a substring of the source — never synthesised
    for (const s of slots) {
      if (s.key === 'channel') continue; // channel keyword may be re-cased
      expect(SAMPLE).toContain(s.value);
    }
  });

  it('returns nothing usable for an empty or content-free paste (never guesses)', () => {
    expect(parseMegaprompt('')).toEqual([]);
    expect(parseMegaprompt('...')).toEqual([]);
  });

  it('stops the product capture at the customer boundary (no over-capture into "for …")', () => {
    // Regression: the product probe used to grab "a natural sleep supplement for busy
    // parents who can't switch" (capped mid-word), which then duplicated the customer
    // clause in the read-back restatement. Product must end at the " for " boundary.
    const product = parseMegaprompt(SAMPLE).find((s) => s.key === 'product')?.value ?? '';
    expect(product).toBe('a natural sleep supplement');
    expect(product.toLowerCase()).not.toContain('for busy parents');
  });
});

describe('portraitFromSlots', () => {
  it('builds a portrait only when customer + problem are present', () => {
    const slots = parseMegaprompt(SAMPLE);
    const portrait = portraitFromSlots(slots);
    expect(portrait).not.toBeNull();
    expect(portrait?.who).toContain('busy parents');
  });

  it('returns null when the minimum is missing (no fabrication)', () => {
    expect(portraitFromSlots([{ key: 'brand_name', value: 'RestWell' }])).toBeNull();
  });
});

describe('findTierViolations (frontend Tier-C guard)', () => {
  it('is clean on grounded, user-facing copy', () => {
    expect(findTierViolations('Trust Gap 62/100 — buyers hesitate at the price.')).toEqual([]);
    expect(findTierViolations('For busy parents — struggling with poor sleep.')).toEqual([]);
  });

  it('flags Tier-C engine tokens if they ever leak', () => {
    expect(findTierViolations('Running S3 for the Protectors via the amygdala model').length).toBeGreaterThan(0);
  });
});

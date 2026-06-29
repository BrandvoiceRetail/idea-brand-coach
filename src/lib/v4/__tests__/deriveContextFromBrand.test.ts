import { describe, it, expect } from 'vitest';
import { deriveContextFromBrand } from '../deriveContextFromBrand';
import type { Avatar } from '@/types/avatar';
import type { BrandData } from '@/contexts/BrandContext';

const ALL = new Set(['brand_name', 'product', 'customer', 'problem', 'channel', 'goal']);

const avatar = (over: Partial<Avatar> = {}): Avatar => ({
  id: 'a1',
  user_id: 'u1',
  name: 'Maya',
  is_template: false,
  ...over,
}) as Avatar;

const get = (out: ReturnType<typeof deriveContextFromBrand>, key: string) => out.find((a) => a.key === key);

describe('deriveContextFromBrand', () => {
  it('derives customer + problem from an onboarded avatar (fears → problem)', () => {
    const out = deriveContextFromBrand(
      avatar({
        description: 'Busy parents who can’t switch off at night',
        psychographics: { fears: ['poor sleep', 'wasting money'], desires: ['rest'] },
      }),
      null,
      ALL,
    );
    expect(get(out, 'problem')?.value).toBe('poor sleep, wasting money');
    expect(get(out, 'customer')?.value).toBe('Busy parents who can’t switch off at night');
    // Sourced from the user's own confirmed avatar → stated (satisfies the gate).
    expect(get(out, 'customer')).toMatchObject({ source: 'profile', confirm: true });
  });

  it('falls back problem → desires → voice_of_customer → decision_factors', () => {
    expect(get(deriveContextFromBrand(avatar({ psychographics: { desires: ['status'] } }), null, ALL), 'problem')?.value)
      .toBe('status');
    expect(get(deriveContextFromBrand(avatar({ voice_of_customer: 'I never trust cheap cards' }), null, ALL), 'problem')?.value)
      .toBe('I never trust cheap cards');
    expect(get(deriveContextFromBrand(avatar({ buying_behavior: { decision_factors: ['reviews', 'price'] } }), null, ALL), 'problem')?.value)
      .toBe('reviews, price');
  });

  it('composes a customer from name + demographics when there is no description', () => {
    const out = deriveContextFromBrand(
      avatar({ name: 'Maya', demographics: { age: '35-44', location: 'urban' }, psychographics: { fears: ['x'] } }),
      null,
      ALL,
    );
    expect(get(out, 'customer')?.value).toBe('Maya — 35-44, urban');
  });

  it('returns NOTHING for a skeleton/default avatar (no derivable problem → no junk customer)', () => {
    const out = deriveContextFromBrand(
      avatar({ name: 'Default Avatar', demographics: {}, psychographics: {} }),
      null,
      ALL,
    );
    expect(out).toEqual([]);
  });

  it('never overwrites already-filled slots (only emits for empty keys)', () => {
    const onlyProblemEmpty = new Set(['problem']);
    const out = deriveContextFromBrand(
      avatar({ description: 'Parents', psychographics: { fears: ['poor sleep'] } }),
      null,
      onlyProblemEmpty,
    );
    expect(out.map((a) => a.key)).toEqual(['problem']); // customer skipped (already filled)
  });

  it('opportunistically maps brand-level slots from BrandData', () => {
    const brand = {
      userInfo: { company: 'RestWell' },
      brandCanvas: { valueProposition: 'Natural sleep that works', brandMission: 'Help parents rest' },
      distinctive: { uniqueValue: 'Non-habit-forming' },
      avatar: { preferredChannels: ['Amazon', 'DTC'], goals: ['grow repeat orders'] },
    } as unknown as BrandData;
    const out = deriveContextFromBrand(null, brand, ALL);
    expect(get(out, 'brand_name')?.value).toBe('RestWell');
    expect(get(out, 'product')?.value).toBe('Natural sleep that works');
    expect(get(out, 'channel')?.value).toBe('Amazon, DTC');
    expect(get(out, 'goal')?.value).toBe('grow repeat orders');
  });

  it('emits nothing when there is neither an avatar nor brand data', () => {
    expect(deriveContextFromBrand(null, null, ALL)).toEqual([]);
  });
});

// @vitest-environment node
/**
 * generate_listing_image_brief — Amazon listing image-SET design brief director.
 *
 * Proves the framework encodes the conventions the coach was missing in live sessions:
 * the MAIN image is white-bg product photography with NO added text/badges (Amazon
 * policy), the IDEA/lifestyle/badge work lives in the gallery, photoreal slots route AWAY
 * from Canva layout-gen, the empathetic line leads the lifestyle slot, claims are pinned,
 * and Tier-C jargon is forbidden. Trigger direction tailors when a trigger is supplied.
 */
import { describe, it, expect } from 'vitest';
import { buildListingImageBrief, LISTING_IMAGE_SLOTS, TRIGGER_IMAGE_DIRECTION } from '../service/listingImageBrief.js';

describe('buildListingImageBrief', () => {
  it('main image is white-bg product photography with NO added text/badges (Amazon policy)', () => {
    const main = LISTING_IMAGE_SLOTS.find((s) => s.key === 'main');
    expect(main).toBeTruthy();
    expect(main?.engine).toBe('photoreal');
    expect(main?.amazonRules.toLowerCase()).toContain('white background');
    expect(main?.amazonRules.toLowerCase()).toMatch(/no text|no .*badges/);
  });

  it('the lifestyle slot is empathetic-led and photoreal (Trevor: "I see you" before the science)', () => {
    const life = LISTING_IMAGE_SLOTS.find((s) => s.key === 'lifestyle');
    expect(life?.ideaPillar).toBe('Empathetic');
    expect(life?.engine).toBe('photoreal');
  });

  it('routes photoreal slots away from Canva layout-gen', () => {
    const r = buildListingImageBrief({ product: 'Trading card binder 2-pack' });
    expect(r.execution_routing.photoreal.toLowerCase()).toContain('not use canva');
    expect(r.execution_routing.photoreal.toLowerCase()).toMatch(/midjourney|dall-e|genrupt|photography/);
    // infographic slots are explicitly where Canva IS the right tool
    expect(r.execution_routing.infographic.toLowerCase()).toContain('canva');
  });

  it('tailors the image direction to a supplied Decision Trigger', () => {
    const r = buildListingImageBrief({ product: 'X', decisionTrigger: 'recognition' });
    expect(r.decision_trigger).toBe('recognition');
    expect(r.trigger_image_direction).toBe(TRIGGER_IMAGE_DIRECTION.recognition);
    // null when no trigger supplied
    expect(buildListingImageBrief({ product: 'X' }).decision_trigger).toBeNull();
  });

  it('carries the claim gate + pins claims/sizing (Genrupt distorted both)', () => {
    const r = buildListingImageBrief({ product: 'X' });
    expect(r.claim_gate.toLowerCase()).toMatch(/confirm/);
    expect(r.rules.join(' ').toLowerCase()).toMatch(/preserve every user-confirmed fact|sizing/);
  });

  it('forbids Tier-C / framework jargon in the composed brief', () => {
    const r = buildListingImageBrief({ product: 'X' });
    const joined = r.never_contain.join(' ');
    for (const banned of ['Trust Gap', 'Decision Trigger', 'buyer state', 'Assessor']) {
      expect(joined).toContain(banned);
    }
  });

  it('instructs the coach to compose per-slot briefs and wire the split-test', () => {
    const r = buildListingImageBrief({ product: 'X' });
    const joined = r.instructions.join(' ').toLowerCase();
    expect(joined).toContain('log_asset');
    expect(joined).toContain('design_test');
    expect(joined).toContain('update_test_milestone');
    expect(r.slots.length).toBe(LISTING_IMAGE_SLOTS.length);
  });
});

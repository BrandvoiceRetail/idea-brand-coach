import { describe, it, expect } from 'vitest';
import { capabilitiesFor, isGeneratable } from '../capabilityRegistry';

describe('capabilitiesFor', () => {
  it('routes the Amazon listing to Pixii images + Claude copy', () => {
    const caps = capabilitiesFor('amazon_listing_copy');
    expect(caps.map((c) => `${c.provider}:${c.capability}`)).toEqual(['pixii:listing_images', 'claude:generic_copy']);
    expect(caps[0].pixiiListingType).toBe('amazon_listing');
    expect(caps[0].outputKind).toBe('image');
    expect(caps[1].outputKind).toBe('copy');
  });

  it('routes A+ (brand story) to Pixii a_plus + Claude copy', () => {
    const caps = capabilitiesFor('amazon_brand_story');
    expect(caps.map((c) => `${c.provider}:${c.capability}`)).toEqual(['pixii:a_plus', 'claude:generic_copy']);
    expect(caps[0].pixiiTypes).toEqual(['A+ Basic']);
  });

  it('routes the Amazon main image to Pixii only (no copy on an image-only piece)', () => {
    const caps = capabilitiesFor('amazon_main_image');
    expect(caps.map((c) => `${c.provider}:${c.capability}`)).toEqual(['pixii:main_image']);
    expect(caps[0].pixiiListingType).toBe('amazon_main_images');
  });

  it('routes email touchpoints to Claude email copy (Pixii has no email capability)', () => {
    for (const tp of ['welcome_series', 'order_confirmation_email', 'winback_replenishment']) {
      const caps = capabilitiesFor(tp);
      expect(caps.map((c) => `${c.provider}:${c.capability}`)).toEqual(['claude:email_copy']);
    }
  });

  it('routes the Shopify PDP to Pixii (shopify_listing) + Claude copy', () => {
    const caps = capabilitiesFor('shopify_pdp');
    expect(caps[0]).toMatchObject({ provider: 'pixii', capability: 'listing_images', pixiiListingType: 'shopify_listing' });
    expect(caps[1]).toMatchObject({ provider: 'claude', capability: 'generic_copy' });
  });

  it('routes a non-Pixii copy touchpoint to Claude generic copy only', () => {
    expect(capabilitiesFor('organic_social_profile').map((c) => `${c.provider}:${c.capability}`)).toEqual(['claude:generic_copy']);
  });

  it('returns [] for an unknown touchpoint', () => {
    expect(capabilitiesFor('does_not_exist')).toEqual([]);
    expect(isGeneratable('does_not_exist')).toBe(false);
  });

  it('reports generatable touchpoints', () => {
    expect(isGeneratable('amazon_listing_copy')).toBe(true);
    expect(isGeneratable('welcome_series')).toBe(true);
  });
});

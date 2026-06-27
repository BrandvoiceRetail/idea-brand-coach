import { describe, it, expect } from 'vitest';
import { capabilitiesFor, isGeneratable } from '../capabilityRegistry';

/**
 * Palmier (video) routing — kept in a separate file from capabilityRegistry.test.ts
 * so the pixii/claude cases and the video cases evolve independently.
 */
describe('capabilitiesFor — Palmier video', () => {
  it('routes paid social ad creative to Palmier video + Claude copy', () => {
    const caps = capabilitiesFor('paid_social_creative');
    expect(caps.map((c) => `${c.provider}:${c.capability}`)).toEqual(['palmier:social_video', 'claude:generic_copy']);
    const video = caps[0];
    expect(video.outputKind).toBe('video');
    expect(video.palmierAspect).toBe('9:16');
    expect(video.palmierDurationS).toBe(8);
  });

  it('routes influencer/UGC to Palmier video + Claude copy', () => {
    const caps = capabilitiesFor('influencer_ugc');
    expect(caps.map((c) => `${c.provider}:${c.capability}`)).toEqual(['palmier:ugc_video', 'claude:generic_copy']);
    expect(caps[0].outputKind).toBe('video');
  });

  it('does not add a video capability to non-video touchpoints', () => {
    expect(capabilitiesFor('amazon_listing_copy').some((c) => c.provider === 'palmier')).toBe(false);
    expect(capabilitiesFor('welcome_series').some((c) => c.provider === 'palmier')).toBe(false);
  });

  it('marks the video touchpoints generatable', () => {
    expect(isGeneratable('paid_social_creative')).toBe(true);
    expect(isGeneratable('influencer_ugc')).toBe(true);
  });
});

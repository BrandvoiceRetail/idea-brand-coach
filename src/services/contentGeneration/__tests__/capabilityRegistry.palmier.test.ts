import { describe, it, expect } from 'vitest';
import { capabilitiesFor, isGeneratable } from '../capabilityRegistry';

/**
 * Video routing (fal cloud + local Palmier) — kept in a separate file from
 * capabilityRegistry.test.ts so the pixii/claude cases and the video cases evolve
 * independently.
 */
describe('capabilitiesFor — video (fal + Palmier)', () => {
  it('routes paid social ad creative to fal video (default) + Palmier video + Claude copy', () => {
    const caps = capabilitiesFor('paid_social_creative');
    expect(caps.map((c) => `${c.provider}:${c.capability}`)).toEqual([
      'fal:social_video',
      'palmier:social_video',
      'claude:generic_copy',
    ]);
    const fal = caps[0];
    expect(fal.outputKind).toBe('video');
    expect(fal.videoAspect).toBe('9:16');
    expect(fal.videoDurationS).toBe(8);
    expect(caps[1].label).toBe('Video ad (Palmier)');
  });

  it('routes influencer/UGC to fal video + Palmier video + Claude copy', () => {
    const caps = capabilitiesFor('influencer_ugc');
    expect(caps.map((c) => `${c.provider}:${c.capability}`)).toEqual([
      'fal:ugc_video',
      'palmier:ugc_video',
      'claude:generic_copy',
    ]);
    expect(caps[0].outputKind).toBe('video');
  });

  it('does not add a video capability to non-video touchpoints', () => {
    for (const tp of ['amazon_listing_copy', 'welcome_series']) {
      const providers = capabilitiesFor(tp).map((c) => c.provider);
      expect(providers).not.toContain('fal');
      expect(providers).not.toContain('palmier');
    }
  });

  it('marks the video touchpoints generatable', () => {
    expect(isGeneratable('paid_social_creative')).toBe(true);
    expect(isGeneratable('influencer_ugc')).toBe(true);
  });
});

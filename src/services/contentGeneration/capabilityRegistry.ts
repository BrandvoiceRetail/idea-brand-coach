/**
 * Capability registry — maps a funnel touchpoint to the ways its content can be
 * generated/updated. This is the router that makes the generate interface work
 * for EACH piece of the funnel, derived from the canonical taxonomy rather than
 * hand-maintained per touchpoint.
 *
 * Routing rules (honest about what each engine can actually do):
 *  - PIXII generates product IMAGES only, for the specific Amazon/Shopify visual
 *    touchpoints it cleanly maps to (listing gallery, main image, A+ modules).
 *  - PALMIER generates short-form VIDEO for the native-video touchpoints (paid
 *    social ad creative, influencer/UGC). It runs as a LOCAL app, so the video
 *    capability is offered everywhere but only fulfils where Palmier is reachable;
 *    otherwise the funnel hands back a ready-to-run brief.
 *  - CLAUDE generates on-brand COPY for any touchpoint whose assetKind includes
 *    copy. Email touchpoints get the email-copy capability; everything else gets
 *    generic on-brand copy. (Pixii/Palmier have no copy capability.)
 *
 * A touchpoint can therefore expose more than one capability — e.g. paid-social
 * ad creative offers a Palmier video AND Claude ad copy.
 */
import { getTouchpoint } from '@/config/touchpointTaxonomy';
import type { PalmierAspect, PieceCapability, PixiiListingType } from './types';

/** Touchpoints with a clean Pixii (image) mapping. */
const PIXII_TOUCHPOINTS: Record<
  string,
  { capability: string; label: string; hint: string; pixiiListingType?: PixiiListingType; pixiiTypes?: string[] }
> = {
  amazon_listing_copy: {
    capability: 'listing_images',
    label: 'Listing images',
    hint: 'Main + gallery images for the Amazon listing',
    pixiiListingType: 'amazon_listing',
  },
  amazon_main_image: {
    capability: 'main_image',
    label: 'Main image',
    hint: 'A conversion-ready Amazon main image',
    pixiiListingType: 'amazon_main_images',
  },
  amazon_brand_story: {
    capability: 'a_plus',
    label: 'A+ content',
    hint: 'A+ module visuals for the brand story',
    pixiiTypes: ['A+ Basic'],
  },
  shopify_pdp: {
    capability: 'listing_images',
    label: 'Product images',
    hint: 'Gallery images for the Shopify product page',
    pixiiListingType: 'shopify_listing',
  },
};

/** Touchpoints with a native-video (Palmier) mapping. */
const PALMIER_TOUCHPOINTS: Record<
  string,
  { capability: string; label: string; hint: string; aspect: PalmierAspect; durationS: number }
> = {
  paid_social_creative: {
    capability: 'social_video',
    label: 'Video ad',
    hint: 'A short paid-social video ad (TikTok / Reels / Meta)',
    aspect: '9:16',
    durationS: 8,
  },
  influencer_ugc: {
    capability: 'ugc_video',
    label: 'UGC video',
    hint: 'A UGC-style short-form video for organic / paid social',
    aspect: '9:16',
    durationS: 8,
  },
};

/** Asset kinds that carry copy (so Claude can generate/update them). */
function hasCopy(assetKind: string): boolean {
  return assetKind === 'copy' || assetKind === 'image+copy';
}

/**
 * All the ways a given touchpoint can be generated, Pixii (visual) first, then
 * Claude (copy). Returns [] for an unknown touchpoint.
 */
export function capabilitiesFor(touchpointId: string): PieceCapability[] {
  const tp = getTouchpoint(touchpointId);
  if (!tp) return [];

  const caps: PieceCapability[] = [];

  const px = PIXII_TOUCHPOINTS[touchpointId];
  if (px) {
    caps.push({
      provider: 'pixii',
      capability: px.capability,
      outputKind: 'image',
      label: px.label,
      hint: px.hint,
      pixiiListingType: px.pixiiListingType,
      pixiiTypes: px.pixiiTypes,
    });
  }

  const pa = PALMIER_TOUCHPOINTS[touchpointId];
  if (pa) {
    caps.push({
      provider: 'palmier',
      capability: pa.capability,
      outputKind: 'video',
      label: pa.label,
      hint: pa.hint,
      palmierAspect: pa.aspect,
      palmierDurationS: pa.durationS,
    });
  }

  if (hasCopy(tp.assetKind)) {
    const isEmail = tp.appliesWhen.includes('email');
    caps.push(
      isEmail
        ? { provider: 'claude', capability: 'email_copy', outputKind: 'copy', label: 'Email copy', hint: 'On-brand email written to your avatar + Signature' }
        : { provider: 'claude', capability: 'generic_copy', outputKind: 'copy', label: 'On-brand copy', hint: 'Copy written to your avatar + Signature' },
    );
  }

  return caps;
}

/** Whether a touchpoint can be generated at all (has at least one capability). */
export function isGeneratable(touchpointId: string): boolean {
  return capabilitiesFor(touchpointId).length > 0;
}

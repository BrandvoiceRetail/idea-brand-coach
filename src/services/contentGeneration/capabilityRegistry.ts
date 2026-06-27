/**
 * Capability registry — maps a funnel touchpoint to the ways its content can be
 * generated/updated. This is the router that makes the generate interface work
 * for EACH piece of the funnel, derived from the canonical taxonomy rather than
 * hand-maintained per touchpoint.
 *
 * Routing rules (honest about what each engine can actually do):
 *  - PIXII generates product IMAGES only, for the specific Amazon/Shopify visual
 *    touchpoints it cleanly maps to (listing gallery, main image, A+ modules).
 *  - FAL generates short-form VIDEO via the fal.ai cloud queue for the native-video
 *    touchpoints (paid social ad creative, influencer/UGC). This is the DEFAULT
 *    video path — it returns a real MP4 and works in prod for every user.
 *  - PALMIER generates the same VIDEO via the LOCAL Palmier desktop app, offered as
 *    a second option for hands-on editing; it fulfils only where Palmier is
 *    reachable, otherwise the funnel hands back a ready-to-run brief.
 *  - CLAUDE generates on-brand COPY for any touchpoint whose assetKind includes
 *    copy. Email touchpoints get the email-copy capability; everything else gets
 *    generic on-brand copy. (Pixii/fal/Palmier have no copy capability.)
 *
 * A touchpoint can therefore expose more than one capability — e.g. paid-social
 * ad creative offers a fal video, a Palmier video AND Claude ad copy.
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

/** Touchpoints with a native-video mapping (offered via fal cloud + local Palmier). */
const VIDEO_TOUCHPOINTS: Record<
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

  const vt = VIDEO_TOUCHPOINTS[touchpointId];
  if (vt) {
    // fal (cloud) first — the default video path that works for every user in prod.
    caps.push({
      provider: 'fal',
      capability: vt.capability,
      outputKind: 'video',
      label: vt.label,
      hint: `${vt.hint} — generated in the cloud`,
      videoAspect: vt.aspect,
      videoDurationS: vt.durationS,
    });
    // Palmier (local) second — hands-on editing in the desktop app.
    caps.push({
      provider: 'palmier',
      capability: vt.capability,
      outputKind: 'video',
      label: `${vt.label} (Palmier)`,
      hint: `${vt.hint} — in your local Palmier`,
      videoAspect: vt.aspect,
      videoDurationS: vt.durationS,
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

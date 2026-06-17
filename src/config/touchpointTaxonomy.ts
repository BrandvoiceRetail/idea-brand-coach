/**
 * Brand Funnel Tracker — canonical touchpoint taxonomy (loader).
 *
 * Source of truth: ./touchpoint-taxonomy.v0.json (Matthew + Trevor edit that doc).
 * This module embeds it as typed data so it loads in both the app (vite) and the
 * MCP (tsconfig.mcp) builds without depending on resolveJsonModule. Keep in sync
 * with the JSON when the taxonomy changes.
 */

export type StageId =
  | 'awareness'
  | 'consideration'
  | 'purchase_decision'
  | 'retention'
  | 'advocacy';

export type ApplicabilityTag =
  | 'amazon' | 'shopify' | 'dtc_site' | 'email' | 'organic_social'
  | 'paid_social' | 'packaging' | 'founder' | 'support' | 'loyalty';

/** Field paths the audit scores an asset against (avatar fields + 'signature'). */
export type AuditField = string;

export interface Touchpoint {
  id: string;
  label: string;
  stage: StageId;
  appliesWhen: ApplicabilityTag[];
  p0: boolean;
  assetKind: string;
  personalBrand: boolean;
  auditAgainst: AuditField[];
}

export interface Stage {
  id: StageId;
  label: string;
  emotionalTrigger: string;
  brandTask: string;
}

export const TAXONOMY_VERSION = '0.1.0';

export const STAGES: Stage[] = [
  { id: 'awareness', label: 'Awareness', emotionalTrigger: 'curiosity / frustration', brandTask: 'interrupt the pattern, name the problem' },
  { id: 'consideration', label: 'Consideration', emotionalTrigger: 'hope / anticipation', brandTask: 'demonstrate understanding, build credibility' },
  { id: 'purchase_decision', label: 'Purchase decision', emotionalTrigger: 'trust / relief', brandTask: 'remove risk, provide social proof, reduce friction' },
  { id: 'retention', label: 'Retention', emotionalTrigger: 'satisfaction / validation', brandTask: 'confirm the right choice, deliver on the promise' },
  { id: 'advocacy', label: 'Advocacy', emotionalTrigger: 'pride / belonging', brandTask: 'create shareable moments, build community' },
];

export const TOUCHPOINTS: Touchpoint[] = [
  // Awareness
  { id: 'paid_social_creative', label: 'Paid social ad creative + copy', stage: 'awareness', appliesWhen: ['paid_social'], p0: true, assetKind: 'image+copy', personalBrand: false, auditAgainst: ['psychographics.fears', 'psychographics.triggers', 'voice_of_customer'] },
  { id: 'organic_social_profile', label: 'Organic social profile', stage: 'awareness', appliesWhen: ['organic_social'], p0: true, assetKind: 'copy', personalBrand: false, auditAgainst: ['psychographics.values', 'signature'] },
  { id: 'influencer_ugc', label: 'Influencer / UGC', stage: 'awareness', appliesWhen: ['organic_social', 'paid_social'], p0: false, assetKind: 'image+copy', personalBrand: false, auditAgainst: ['psychographics.values', 'voice_of_customer'] },
  { id: 'amazon_main_image', label: 'Amazon main image', stage: 'awareness', appliesWhen: ['amazon'], p0: true, assetKind: 'image', personalBrand: false, auditAgainst: ['psychographics.triggers', 'psychographics.desires', 'buying_behavior.decision_factors'] },
  { id: 'seo_content', label: 'SEO / blog content', stage: 'awareness', appliesWhen: ['dtc_site'], p0: false, assetKind: 'copy', personalBrand: false, auditAgainst: ['psychographics.fears', 'demographics.lifestyle'] },
  { id: 'founder_social', label: 'Founder social (LinkedIn / TikTok)', stage: 'awareness', appliesWhen: ['founder'], p0: false, assetKind: 'copy', personalBrand: true, auditAgainst: ['psychographics.values', 'signature'] },
  // Consideration
  { id: 'amazon_listing_copy', label: 'Amazon listing (title, bullets, A+)', stage: 'consideration', appliesWhen: ['amazon'], p0: true, assetKind: 'copy', personalBrand: false, auditAgainst: ['buying_behavior.decision_factors', 'psychographics.desires', 'signature'] },
  { id: 'amazon_brand_story', label: 'Amazon brand story / A+ module', stage: 'consideration', appliesWhen: ['amazon'], p0: true, assetKind: 'copy', personalBrand: false, auditAgainst: ['psychographics.values', 'signature', 'voice_of_customer'] },
  { id: 'shopify_pdp', label: 'Shopify product page (PDP)', stage: 'consideration', appliesWhen: ['shopify', 'dtc_site'], p0: true, assetKind: 'copy', personalBrand: false, auditAgainst: ['buying_behavior.decision_factors', 'psychographics.desires', 'signature'] },
  { id: 'brand_store_about', label: 'Brand store / About page', stage: 'consideration', appliesWhen: ['shopify', 'dtc_site'], p0: true, assetKind: 'copy', personalBrand: false, auditAgainst: ['psychographics.values', 'signature', 'voice_of_customer'] },
  { id: 'displayed_reviews', label: 'Displayed reviews / testimonials', stage: 'consideration', appliesWhen: ['amazon', 'shopify', 'dtc_site'], p0: false, assetKind: 'copy', personalBrand: false, auditAgainst: ['voice_of_customer', 'buying_behavior.decision_factors'] },
  { id: 'founder_content', label: 'Founder content (story, POV)', stage: 'consideration', appliesWhen: ['founder'], p0: false, assetKind: 'copy', personalBrand: true, auditAgainst: ['psychographics.values', 'signature'] },
  // Purchase decision
  { id: 'cart_checkout_flow', label: 'Cart / checkout flow', stage: 'purchase_decision', appliesWhen: ['shopify', 'dtc_site'], p0: true, assetKind: 'copy', personalBrand: false, auditAgainst: ['buying_behavior.price_consciousness', 'psychographics.fears'] },
  { id: 'shipping_returns_policy', label: 'Shipping & returns policy', stage: 'purchase_decision', appliesWhen: ['amazon', 'shopify', 'dtc_site'], p0: true, assetKind: 'copy', personalBrand: false, auditAgainst: ['psychographics.fears', 'buying_behavior.decision_factors'] },
  { id: 'trust_badges_social_proof', label: 'Trust badges / social proof', stage: 'purchase_decision', appliesWhen: ['shopify', 'dtc_site'], p0: true, assetKind: 'image+copy', personalBrand: false, auditAgainst: ['psychographics.fears', 'voice_of_customer'] },
  { id: 'urgency_messaging', label: 'Urgency / scarcity messaging', stage: 'purchase_decision', appliesWhen: ['amazon', 'shopify', 'email'], p0: false, assetKind: 'copy', personalBrand: false, auditAgainst: ['psychographics.triggers', 'buying_behavior.intent'] },
  // Retention
  { id: 'order_confirmation_email', label: 'Order confirmation email', stage: 'retention', appliesWhen: ['email'], p0: true, assetKind: 'copy', personalBrand: false, auditAgainst: ['signature', 'psychographics.desires'] },
  { id: 'shipping_email', label: 'Shipping / tracking email', stage: 'retention', appliesWhen: ['email'], p0: false, assetKind: 'copy', personalBrand: false, auditAgainst: ['signature', 'psychographics.fears'] },
  { id: 'packaging_unboxing', label: 'Packaging / unboxing', stage: 'retention', appliesWhen: ['packaging'], p0: true, assetKind: 'image+copy', personalBrand: false, auditAgainst: ['psychographics.values', 'psychographics.desires', 'signature'] },
  { id: 'insert_cards', label: 'Insert / thank-you cards', stage: 'retention', appliesWhen: ['packaging'], p0: false, assetKind: 'copy', personalBrand: false, auditAgainst: ['psychographics.values', 'signature'] },
  { id: 'welcome_series', label: 'Email welcome series', stage: 'retention', appliesWhen: ['email'], p0: true, assetKind: 'copy', personalBrand: false, auditAgainst: ['signature', 'psychographics.values', 'psychographics.desires'] },
  { id: 'winback_replenishment', label: 'Win-back / replenishment flow', stage: 'retention', appliesWhen: ['email'], p0: false, assetKind: 'copy', personalBrand: false, auditAgainst: ['buying_behavior.shopping_style', 'psychographics.triggers'] },
  { id: 'support_voice', label: 'Support / service voice', stage: 'retention', appliesWhen: ['support'], p0: false, assetKind: 'copy', personalBrand: false, auditAgainst: ['signature', 'voice_of_customer'] },
  // Advocacy
  { id: 'review_request_flow', label: 'Review request flow', stage: 'advocacy', appliesWhen: ['email', 'amazon'], p0: true, assetKind: 'copy', personalBrand: false, auditAgainst: ['voice_of_customer', 'psychographics.desires'] },
  { id: 'referral_program', label: 'Referral program', stage: 'advocacy', appliesWhen: ['email', 'dtc_site'], p0: false, assetKind: 'copy', personalBrand: false, auditAgainst: ['psychographics.values', 'buying_behavior.decision_factors'] },
  { id: 'ugc_repost_permissions', label: 'UGC repost / permissions', stage: 'advocacy', appliesWhen: ['organic_social'], p0: false, assetKind: 'copy', personalBrand: false, auditAgainst: ['psychographics.values'] },
  { id: 'loyalty_community', label: 'Loyalty / community', stage: 'advocacy', appliesWhen: ['loyalty'], p0: false, assetKind: 'copy', personalBrand: false, auditAgainst: ['psychographics.values', 'psychographics.desires'] },
];

const BY_ID: Record<string, Touchpoint> = TOUCHPOINTS.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {} as Record<string, Touchpoint>);

/** All stages in funnel order. */
export function getStages(): Stage[] {
  return STAGES;
}

/** Look up a single touchpoint by id. */
export function getTouchpoint(id: string): Touchpoint | undefined {
  return BY_ID[id];
}

/** Every touchpoint (optionally only the P0 set). */
export function allTouchpoints(p0Only = false): Touchpoint[] {
  return p0Only ? TOUCHPOINTS.filter((t) => t.p0) : TOUCHPOINTS;
}

/**
 * Touchpoints applicable to a brand given its channel tags.
 * A touchpoint applies if any of its appliesWhen tags is in the brand's set.
 */
export function getApplicableTouchpoints(
  brandTags: ApplicabilityTag[],
  opts: { p0Only?: boolean } = {},
): Touchpoint[] {
  const tags = new Set(brandTags);
  return allTouchpoints(opts.p0Only).filter((t) => t.appliesWhen.some((w) => tags.has(w)));
}

/** The avatar/Signature field paths the audit should score this touchpoint against. */
export function getAuditBindings(touchpointId: string): AuditField[] {
  return BY_ID[touchpointId]?.auditAgainst ?? [];
}

/** Touchpoints grouped by stage, in funnel order — for the Funnel Map. */
export function touchpointsByStage(): Array<{ stage: Stage; touchpoints: Touchpoint[] }> {
  return STAGES.map((stage) => ({
    stage,
    touchpoints: TOUCHPOINTS.filter((t) => t.stage === stage.id),
  }));
}

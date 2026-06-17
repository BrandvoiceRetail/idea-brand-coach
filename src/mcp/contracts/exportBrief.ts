/**
 * Contract — `export_brief` (gold Workbook A, sheet 6 "Export Brief").
 *
 * §2 sheet 6 + §6 fabrication gate: the title formula and bullets carry PRODUCT-TRUTH
 * claims (capacity 216/432, side-loading, PSA-slab compatibility) and a POLICY claim
 * (the "30-DAY GUARANTEE" bullet, which gold likely invented and which is an Amazon-TOS
 * hazard). The contract therefore tags every bullet with a `stage_ref` (which avatar
 * stage / canvas element drove it — Phase 4 spec) and an explicit
 * `product_truth_claims[]` list so the generator's fabrication gate can verify each
 * claim is filled-evidence/owner-confirmed before the brief is emitted; otherwise the
 * generator returns needs_input instead of this artifact.
 *
 * Schema covers gold sheet-6 sections: Listing Copy Brief (title formula + 5 bullets,
 * each with Element/Brief/Example output), Image Brief (7 slots: Slot/Intent/Brief),
 * and the PPC Keyword Brief (Tier A/B/C keyword lists).
 */
import { z } from 'zod';
import type { ArtifactContract } from './types.js';
import { groundingEnvelope } from './grounding.js';

/** The avatar/canvas element a brief element traces back to. */
export const stageRefSchema = z.enum([
  's1_vocab',
  's2_jobmap',
  's3_triggers',
  's4_objections',
  'signature',
  'canvas',
]);
export type StageRef = z.infer<typeof stageRefSchema>;

/** A PRODUCT-TRUTH / policy claim surfaced in copy — fabrication-gated (§6). */
export const productTruthClaimSchema = z.object({
  /** The claim text as it appears in the example output (e.g. "Holds 432 Cards"). */
  claim: z.string().min(1),
  /** Slot the claim must resolve against: #6 product claims/policies. */
  slot: z.literal(6),
  /** Whether the claim is backed (filled-evidence/owner-confirmed) at emit time. */
  confirmed: z.boolean(),
});
export type ProductTruthClaim = z.infer<typeof productTruthClaimSchema>;

/** One bullet from the Listing Copy Brief grid. */
export const listingBulletSchema = z.object({
  /** "Element" (e.g. "BULLET 1 — Lead with Decision Trigger"). */
  element: z.string().min(1),
  /** "Brief" — the instruction for this element. */
  brief: z.string().min(1),
  /** "Example output" — the concrete copy. */
  example_output: z.string().min(1),
  /** Which avatar/canvas stage drove this element (Phase 4 stage_ref). */
  stage_ref: stageRefSchema,
  /** PRODUCT-TRUTH/policy claims this element makes; gated before emit. */
  product_truth_claims: z.array(productTruthClaimSchema),
});
export type ListingBullet = z.infer<typeof listingBulletSchema>;

/** One slot from the 7-slot Image Brief. */
export const imageBriefSlotSchema = z.object({
  /** "Slot" (Hero, Image 2..7). */
  slot: z.string().min(1),
  /** "Intent". */
  intent: z.string().min(1),
  /** "Brief". */
  brief: z.string().min(1),
});
export type ImageBriefSlot = z.infer<typeof imageBriefSlotSchema>;

/** The PPC keyword tiers (A trigger-state, B identity-state, C category/defensive). */
export const ppcKeywordTiersSchema = z.object({
  tier_a: z.array(z.string().min(1)).min(1),
  tier_b: z.array(z.string().min(1)).min(1),
  tier_c: z.array(z.string().min(1)).min(1),
});
export type PpcKeywordTiers = z.infer<typeof ppcKeywordTiersSchema>;

export const exportBriefOutputSchema = z.object({
  /** "TITLE FORMULA" element (Element/Brief/Example output). */
  title_formula: z.object({
    brief: z.string().min(1),
    example_output: z.string().min(1),
    product_truth_claims: z.array(productTruthClaimSchema),
  }),
  /** The 5 listing bullets. */
  bullets: z.array(listingBulletSchema).length(5),
  /** The 7-slot image brief. */
  image_brief: z.array(imageBriefSlotSchema).length(7),
  /** PPC keyword tiers (A/B/C). */
  ppc_keywords: ppcKeywordTiersSchema,
  ...groundingEnvelope,
});
export type ExportBriefOutput = z.infer<typeof exportBriefOutputSchema>;

const kind = 'export_brief' as const;

/**
 * §2 sheet 6: canvas (#1 evidence root via chain) + PRODUCT-TRUTH product claims (#6,
 * fabrication-gated) + product catalog (#5) + S3 triggers (#1) for the PPC tiers +
 * brand-asset/photography state (#7) for the image brief.
 */
const requiredContext = [1, 5, 6, 7] as const;

export const exportBriefContract: ArtifactContract<typeof exportBriefOutputSchema> = {
  kind,
  outputSchema: exportBriefOutputSchema,
  requiredContext,
};

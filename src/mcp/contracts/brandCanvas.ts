/**
 * Contract — `brand_canvas` (gold Workbook A, sheet 5 "Brand Canvas").
 *
 * §2 sheet 5: SYNTHESIS over the chosen Positioning Statement + S1–S4 artifacts + voice
 * preferences (OWNER-INTENT #13) + brand story/origin (OWNER-INTENT, KB canvas/insights).
 *
 * The gold renders the canvas as an interleaved 2-pane grid (Positioning block on
 * the left, Voice block on the right); the contract normalizes it into the two
 * semantic blocks plus the Positioning Statement line and the brand-story spine, capturing every
 * gold cell: positioning statement; category; position; promise; villain; identity_payoff;
 * voice_attributes; tone_dos; tone_donts; words_we_use; words_we_dont; story_spine.
 */
import { z } from 'zod';
import type { ArtifactContract } from './types.js';
import { groundingEnvelope } from './grounding.js';

/** Left pane — "Positioning". */
export const positioningBlockSchema = z.object({
  /** "Category" (gold: Premium trading card binders & accessories). */
  category: z.string().min(1),
  /** "Position". */
  position: z.string().min(1),
  /** "Promise". */
  promise: z.string().min(1),
  /** "Villain". */
  villain: z.string().min(1),
  /** "Identity payoff". */
  identity_payoff: z.string().min(1),
});
export type PositioningBlock = z.infer<typeof positioningBlockSchema>;

/** Right pane — voice rules. */
export const voiceBlockSchema = z.object({
  /** "Voice attributes". */
  voice_attributes: z.string().min(1),
  /** "Tone do's". */
  tone_dos: z.string().min(1),
  /** "Tone don'ts". */
  tone_donts: z.string().min(1),
  /** "Words we use". */
  words_we_use: z.array(z.string().min(1)).min(1),
  /** "Words we don't". */
  words_we_dont: z.array(z.string().min(1)).min(1),
});
export type VoiceBlock = z.infer<typeof voiceBlockSchema>;

export const brandCanvasOutputSchema = z.object({
  /** "The Positioning Statement" line at the top of the canvas. */
  positioning_statement: z.string().min(1),
  positioning: positioningBlockSchema,
  voice: voiceBlockSchema,
  /** "Brand story spine (for A+ content, About section, ad lead-ins)". */
  story_spine: z.string().min(1),
  ...groundingEnvelope,
});
export type BrandCanvasOutput = z.infer<typeof brandCanvasOutputSchema>;

const kind = 'brand_canvas' as const;

/**
 * §2 sheet 5: chosen Positioning Statement artifact (#1 evidence root) + positioning intent (#12)
 * + voice preferences & brand story (#13) + target-customer beliefs (#14).
 */
const requiredContext = [1, 12, 13, 14] as const;

export const brandCanvasContract: ArtifactContract<typeof brandCanvasOutputSchema> = {
  kind,
  outputSchema: brandCanvasOutputSchema,
  requiredContext,
};

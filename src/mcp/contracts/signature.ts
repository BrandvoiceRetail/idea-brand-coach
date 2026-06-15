/**
 * Contract — `signature` (gold Workbook A, sheet 4, Stage 5 "The Signature").
 *
 * §2 sheet 4 S5: SYNTHESIS over S1–S4 artifacts (+ optional conversation). The gold
 * renders N candidate one-sentence Signatures ("Option 1..4"); the user picks the one
 * that lands hardest. This contract is the schema the reveal-signature edge fn output
 * is validated against (Phase 1 wraps reveal-signature verbatim), so it preserves the
 * options list and an optional chosen index.
 *
 * Schema covers gold S5 columns: Option N → Signature sentence.
 */
import { z } from 'zod';
import type { ArtifactContract } from './types.js';
import { groundingEnvelope } from './grounding.js';

export const signatureOptionSchema = z.object({
  /** 1-based option number as rendered in gold ("Option 1".."Option 4"). */
  option: z.number().int().min(1),
  /** The candidate Signature sentence. */
  sentence: z.string().min(1),
});
export type SignatureOption = z.infer<typeof signatureOptionSchema>;

export const signatureOutputSchema = z.object({
  options: z.array(signatureOptionSchema).min(1),
  /** 1-based option the user chose, when one has been selected. */
  chosen_option: z.number().int().min(1).optional(),
  ...groundingEnvelope,
});
export type SignatureOutput = z.infer<typeof signatureOutputSchema>;

const kind = 'signature' as const;

/**
 * §2 sheet 4 S5: derived from the S1–S4 artifact chain (#1 reviews as evidence root)
 * + owner voice/positioning intent (#12, #13) so candidates speak in-brand.
 */
const requiredContext = [1, 12, 13] as const;

export const signatureContract: ArtifactContract<typeof signatureOutputSchema> = {
  kind,
  outputSchema: signatureOutputSchema,
  requiredContext,
};

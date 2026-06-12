/**
 * Contract — `avatar_s4_objections` (gold Workbook A, sheet 4, Stage 4 "Hesitations & Objections").
 *
 * §2 sheet 4 S4: EVIDENCE + BUSINESS-FACT. The "Verbatim signal" MUST be a real
 * low-star review/Q&A quote (§6: "verbatim MUST be a real quote") — so the schema
 * requires evidence grounding when populated. The resolution column may reference
 * price points vs competitor prices (#16) and the competitor set (Ultra Pro, Vault X).
 *
 * Schema covers gold S4 columns: Hesitation, Verbatim signal, What resolves it in
 * copy/image/A+.
 */
import { z } from 'zod';
import type { ArtifactContract } from './types.js';
import { groundingEnvelope } from './grounding.js';

export const objectionSchema = z.object({
  /** "Hesitation" — the purchase blocker. */
  hesitation: z.string().min(1),
  /** "Verbatim signal" — a REAL review/Q&A quote evidencing the hesitation. */
  verbatim_signal: z.string().min(1),
  /** "What resolves it in copy / image / A+". */
  resolution: z.string().min(1),
});
export type Objection = z.infer<typeof objectionSchema>;

export const avatarS4ObjectionsOutputSchema = z.object({
  objections: z.array(objectionSchema).min(1),
  ...groundingEnvelope,
});
export type AvatarS4ObjectionsOutput = z.infer<typeof avatarS4ObjectionsOutputSchema>;

const kind = 'avatar_s4_objections' as const;

/**
 * §2 sheet 4 S4: low-star review verbatims (#1) + Q&A, price points vs competitor
 * prices and competitor set (#16) + product catalog prices (#5).
 */
const requiredContext = [1, 16, 5] as const;

export const avatarS4ObjectionsContract: ArtifactContract<typeof avatarS4ObjectionsOutputSchema> = {
  kind,
  outputSchema: avatarS4ObjectionsOutputSchema,
  requiredContext,
};

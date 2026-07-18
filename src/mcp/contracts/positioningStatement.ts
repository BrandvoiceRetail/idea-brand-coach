/**
 * Contract — `positioning_statement` (gold Workbook A, sheet 4, Stage 5 "The Positioning Statement").
 *
 * HISTORY: this artifact was called the "Signature" until the 2026-07 rename (kind `signature`,
 * table `signatures`, tools `generate_signature`/`persist_signature`, edge fn `reveal-signature`).
 * "Signature" was never part of Trevor's taxonomy; it is now folded into the Brand Canvas
 * Positioning Statement (Canvas element #5). Grep for "positioning_statement" for the current names.
 *
 * §2 sheet 4 S5: SYNTHESIS over S1–S4 artifacts (+ optional conversation). The gold
 * renders N candidate one-sentence Positioning Statements ("Option 1..4"); the user picks the one
 * that lands hardest. This contract is the schema the reveal-positioning-statement edge fn output
 * is validated against (Phase 1 wraps reveal-positioning-statement verbatim), so it preserves the
 * options list and an optional chosen index.
 *
 * Schema covers gold S5 columns: Option N → Positioning Statement sentence.
 */
import { z } from 'zod';
import type { ArtifactContract } from './types.js';
import { groundingEnvelope } from './grounding.js';

export const positioningStatementOptionSchema = z.object({
  /** 1-based option number as rendered in gold ("Option 1".."Option 4"). */
  option: z.number().int().min(1),
  /** The candidate Positioning Statement sentence. */
  sentence: z.string().min(1),
});
export type PositioningStatementOption = z.infer<typeof positioningStatementOptionSchema>;

export const positioningStatementOutputSchema = z.object({
  options: z.array(positioningStatementOptionSchema).min(1),
  /** 1-based option the user chose, when one has been selected. */
  chosen_option: z.number().int().min(1).optional(),
  ...groundingEnvelope,
});
export type PositioningStatementOutput = z.infer<typeof positioningStatementOutputSchema>;

const kind = 'positioning_statement' as const;

/**
 * §2 sheet 4 S5: derived from the S1–S4 artifact chain (#1 reviews as evidence root)
 * + owner voice/positioning intent (#12, #13) so candidates speak in-brand.
 */
const requiredContext = [1, 12, 13] as const;

export const positioningStatementContract: ArtifactContract<typeof positioningStatementOutputSchema> = {
  kind,
  outputSchema: positioningStatementOutputSchema,
  requiredContext,
};

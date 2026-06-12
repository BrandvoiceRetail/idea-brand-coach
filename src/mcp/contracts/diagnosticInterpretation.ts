/**
 * Contract — `diagnostic_interpretation` (gold Workbook A, sheet 3 "Trust Gap™ Diagnostic").
 *
 * Gold self-flag: "Mocked output. Scores reflect my best estimate from prior context
 * — real diagnostic would derive from your reviews + intake answers." The runtime
 * version derives scores from intake (§4 #15) + evidence (#1 reviews, #3 listing copy)
 * and labels residual inference via the grounding envelope (§6 row 1).
 *
 * Schema covers every gold-sheet-3 column: overall score + primary gap; the four
 * dimensions (Insight/Distinctiveness/Empathy/Authenticity) each with score/25,
 * what-it-measures, brand-specific read, and where-it-shows-up; the interpretation
 * line; and the triage recommendation (route + rationale).
 */
import { z } from 'zod';
import type { ArtifactContract } from './types.js';
import { groundingEnvelope } from './grounding.js';

/** The four fixed IDEA dimensions (FRAMEWORK, §4 #18). */
export const ideaDimensionSchema = z.enum(['Insight', 'Distinctiveness', 'Empathy', 'Authenticity']);
export type IdeaDimension = z.infer<typeof ideaDimensionSchema>;

/** One dimension row from the "four dimensions" grid. */
export const diagnosticDimensionSchema = z.object({
  dimension: ideaDimensionSchema,
  /** Score / 25 (gold column "Score / 25"). */
  score: z.number().int().min(0).max(25),
  /** "What it measures" — the rubric question for this dimension. */
  what_it_measures: z.string().min(1),
  /** "InfinityVault read" — brand-specific interpretation. */
  brand_read: z.string().min(1),
  /** "Where it shows up" — evidence citation into real listing copy / reviews. */
  where_it_shows_up: z.string().min(1),
});
export type DiagnosticDimension = z.infer<typeof diagnosticDimensionSchema>;

export const diagnosticInterpretationOutputSchema = z.object({
  /** "Overall Trust Gap™ Score" (gold: 58 / 100). */
  overall_score: z.number().int().min(0).max(100),
  /** "Primary gap" (gold: Empathy). */
  primary_gap: ideaDimensionSchema,
  /** The interpretation paragraph above the dimensions grid. */
  interpretation: z.string().min(1),
  /** Exactly the four IDEA dimensions. */
  dimensions: z.array(diagnosticDimensionSchema).length(4),
  /** Triage: which module the diagnostic routes into next. */
  recommended_next_module: z.string().min(1),
  /** "What the Diagnostic recommends next" rationale (the triage prose). */
  recommendation_rationale: z.string().min(1),
  ...groundingEnvelope,
});
export type DiagnosticInterpretationOutput = z.infer<typeof diagnosticInterpretationOutputSchema>;

const kind = 'diagnostic_interpretation' as const;

/**
 * §2 sheet 3: scores from intake (#15) + evidence (#1 reviews, #3 listing copy,
 * #4 ad/support samples); distinctiveness read needs positioning intent (#12);
 * authenticity read needs voice/business-fact (#13); rubrics are framework (#18).
 */
const requiredContext = [15, 1, 3, 4, 12, 13, 18] as const;

export const diagnosticInterpretationContract: ArtifactContract<
  typeof diagnosticInterpretationOutputSchema
> = {
  kind,
  outputSchema: diagnosticInterpretationOutputSchema,
  requiredContext,
};

/**
 * Contract — `avatar_s2_jobmap` (gold Workbook A, sheet 4, Stage 2 "Functional vs Emotional Job Map").
 *
 * §2 sheet 4 S2: SYNTHESIS over S1 output + category knowledge. Grounded in S1, so
 * its grounding mode follows S1 (evidence when S1 was evidence-filled).
 *
 * Schema covers gold S2 columns: Functional job, Emotional job, Identity job,
 * Villain (what they're hiring against). Gold renders one job-map row; the schema
 * allows ≥1 to support multi-segment maps.
 */
import { z } from 'zod';
import type { ArtifactContract } from './types.js';
import { groundingEnvelope } from './grounding.js';

export const jobMapRowSchema = z.object({
  /** "Functional job" — what the product does. */
  functional_job: z.string().min(1),
  /** "Emotional job" — what the customer is hiring it to do emotionally. */
  emotional_job: z.string().min(1),
  /** "Identity job" — the identity the purchase reinforces. */
  identity_job: z.string().min(1),
  /** "Villain (what they're hiring against)". */
  villain: z.string().min(1),
});
export type JobMapRow = z.infer<typeof jobMapRowSchema>;

export const avatarS2JobmapOutputSchema = z.object({
  job_map: z.array(jobMapRowSchema).min(1),
  ...groundingEnvelope,
});
export type AvatarS2JobmapOutput = z.infer<typeof avatarS2JobmapOutputSchema>;

const kind = 'avatar_s2_jobmap' as const;

/** §2 sheet 4 S2: S1 vocab artifact (#1 evidence chain) + target-customer beliefs (#14) for category read. */
const requiredContext = [1, 14] as const;

export const avatarS2JobmapContract: ArtifactContract<typeof avatarS2JobmapOutputSchema> = {
  kind,
  outputSchema: avatarS2JobmapOutputSchema,
  requiredContext,
};

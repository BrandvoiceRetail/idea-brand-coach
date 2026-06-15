/**
 * Contract — `avatar_s1_vocab` (gold Workbook A, sheet 4, Stage 1 "Vocabulary Forensics").
 *
 * Gold self-flag (sheet 4): "populated with reasonable inference. The real version
 * would derive every cell from forensic review analysis." Runtime rule (§2 sheet 4
 * S1, §6 row 2): every cluster's customer words MUST trace to a real review quote —
 * grounding=evidence with non-empty evidence_refs, else the generator returns
 * needs_input rather than inventing vocabulary.
 *
 * Schema covers gold S1 columns: Cluster, Customer words (unprompted), Frequency
 * signal, Why it matters.
 */
import { z } from 'zod';
import type { ArtifactContract } from './types.js';
import { groundingEnvelope } from './grounding.js';

/** "Frequency signal" — the gold's labeled band, not a fabricated number. */
export const frequencySignalSchema = z.enum([
  'Very high',
  'High',
  'Medium-high',
  'Medium',
  'Low-medium',
  'Low',
]);
export type FrequencySignal = z.infer<typeof frequencySignalSchema>;

export const vocabClusterSchema = z.object({
  /** "Cluster" — emotion grouping name. */
  cluster: z.string().min(1),
  /** "Customer words (unprompted)" — verbatim terms pulled from reviews. */
  customer_words: z.array(z.string().min(1)).min(1),
  /** "Frequency signal" — labeled band. */
  frequency_signal: frequencySignalSchema,
  /** "Why it matters" — the strategic read of the cluster. */
  why_it_matters: z.string().min(1),
});
export type VocabCluster = z.infer<typeof vocabClusterSchema>;

export const avatarS1VocabOutputSchema = z.object({
  clusters: z.array(vocabClusterSchema).min(1),
  ...groundingEnvelope,
});
export type AvatarS1VocabOutput = z.infer<typeof avatarS1VocabOutputSchema>;

const kind = 'avatar_s1_vocab' as const;

/** §2 sheet 4 S1: own reviews (#1) + competitor reviews (#2), verbatim — pure EVIDENCE. */
const requiredContext = [1, 2] as const;

export const avatarS1VocabContract: ArtifactContract<typeof avatarS1VocabOutputSchema> = {
  kind,
  outputSchema: avatarS1VocabOutputSchema,
  requiredContext,
};

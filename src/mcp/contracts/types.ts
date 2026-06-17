/**
 * Layer 0 (contract) — the artifact-contract envelope shape.
 *
 * Per manifest §7: each artifact kind pairs an output zod schema with the list of
 * context slots required to produce it. Tools, the resolver, and the workbook
 * assembler all import these contracts as the single source of truth.
 */
import type { z } from 'zod';
import type { SlotId } from './slots.js';

/** The set of artifact kinds the engine produces (manifest §7 enumeration). */
export type ArtifactKind =
  | 'diagnostic_interpretation'
  | 'avatar_s1_vocab'
  | 'avatar_s2_jobmap'
  | 'avatar_s3_triggers'
  | 'avatar_s4_objections'
  | 'signature'
  | 'brand_canvas'
  | 'export_brief'
  | 'audit_x_idea'
  | 'marketing_audit'
  | 'rollout_plan';

/**
 * An artifact contract: the kind, its validated output shape, and the context
 * slots (§4 ids) the resolver must fill before a generator may run in evidence mode.
 */
export interface ArtifactContract<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  readonly kind: ArtifactKind;
  readonly outputSchema: TSchema;
  readonly requiredContext: readonly SlotId[];
}

/** Infer the parsed output type from a contract. */
export type ContractOutput<C extends ArtifactContract> = z.infer<C['outputSchema']>;

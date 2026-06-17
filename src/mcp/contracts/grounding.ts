/**
 * Layer 0 (contract) — shared grounding primitives every generator output carries.
 *
 * Generalizes reveal-signature's `usedReviews`/`inference` discipline (guardrail #4):
 * each generated artifact records whether it was produced in `evidence` mode (slots
 * were evidence-filled) or `inference` mode, plus the references it leaned on. The
 * fabrication gate (manifest §6) is expressed by `needs_input`: when a PRODUCT-TRUTH
 * or policy slot is unconfirmed, a generator returns `needs_input` instead of an
 * artifact.
 */
import { z } from 'zod';

/**
 * Grounding mode for a generated artifact.
 * - `evidence`  — synthesized over evidence-filled slots (quotes trace to real input).
 * - `inference` — produced from owner-intent / inferred slots; must be labeled.
 */
export const groundingSchema = z.enum(['evidence', 'inference']);
export type Grounding = z.infer<typeof groundingSchema>;

/**
 * A single evidence reference backing a generated cell/claim. `kind` says which
 * store the reference points at; `ref` is the opaque id/quote-key within it.
 */
export const evidenceRefSchema = z.object({
  kind: z.enum(['review', 'listing_copy', 'ad_copy', 'business_fact', 'artifact', 'intake']),
  ref: z.string().min(1).describe('Opaque id, snapshot key, or verbatim quote anchor for the source.'),
});
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

/**
 * The grounding envelope mixed into every generator outputSchema.
 * `evidence_refs` MUST be non-empty when grounding is `evidence`.
 */
export const groundingEnvelope = {
  grounding: groundingSchema.describe('evidence = slots were evidence-filled; inference = labeled model inference.'),
  evidence_refs: z
    .array(evidenceRefSchema)
    .describe('References backing this artifact; non-empty when grounding=evidence.'),
} as const;

/**
 * One unfilled-context demand returned in place of a fabricated artifact
 * (manifest §5 step 4 / §6 gate). `current_guess` is optional and, when present,
 * is shown as an inferred default the user can confirm or correct.
 */
export const needsInputItemSchema = z.object({
  slot: z.number().int().min(1).max(18).describe('Manifest §4 slot id that is missing/unconfirmed.'),
  question: z.string().min(1),
  why: z.string().min(1).describe('Why this slot blocks the generation (which cell/claim depends on it).'),
  current_guess: z.string().optional(),
});
export type NeedsInputItem = z.infer<typeof needsInputItemSchema>;

export const needsInputSchema = z.array(needsInputItemSchema);

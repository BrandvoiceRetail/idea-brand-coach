/**
 * Contract — `messaging_perception` (multi-avatar messaging-perception workbook).
 *
 * The SET view of message resonance: for ONE planned strategic message, how does EACH
 * selected customer avatar perceive it — judged ONLY from that avatar's real Avatar 2.0
 * forensics (S1 vocabulary, S2 jobs, S3 decision trigger, S4 objections). Distinct from
 * the single-avatar Workbook A (`export_workbook` which='A', one avatar): this is
 * `message × avatar`, the same message read through each avatar's eyes, rolled up to a
 * weakest-link set verdict. See `.claude/skills/multi-avatar-messaging-workbook`.
 *
 * STRUCTURALLY DIFFERENT from the generator contracts (diagnostic / avatar S1–S4 /
 * signature / canvas / brief / audit / marketing): this is a Layer-3 WORKBOOK-ASSEMBLY
 * perception artifact, not a §4-resolver-driven generator, so —
 *   1. it does NOT carry the §6 grounding envelope (`grounding` + `evidence_refs`):
 *      grounding is held INLINE. `analysable` is the honest "not yet analysable" flag,
 *      and each dimension carries the avatar's own quoted `evidence`. (AGENTS.md
 *      invariant #2 governs GENERATOR outputs; this kind is not one of them.)
 *   2. `requiredContext` is `[]` — it is assembled from already-persisted forensic
 *      artifacts + the resolved planned message, never from the context resolver.
 *
 * No-fabrication bar: a verdict is INFERRED from that avatar's evidence, never invented;
 * an avatar with no Avatar 2.0 built is `analysable:false` (empty dimensions evidence /
 * objections / adjustments) and counts against the set's reach as an UNKNOWN — never a
 * guessed score, never silently a pass.
 */
import { z } from 'zod';
import type { ArtifactContract } from './types.js';

/** A perception verdict, best → worst: the message `lands`, `partial`(ly lands), or `misses`. */
export const messagingVerdictSchema = z.enum(['lands', 'partial', 'misses']);
export type MessagingVerdict = z.infer<typeof messagingVerdictSchema>;

/**
 * Severity for the weakest-link rollup (higher = worse / needs more work). The single
 * source for the verdict scale — reused by {@link weakestVerdict} and the assembler's
 * ranked-adjustments sort. Mirrors `fixService.weakestLinkVerdict`'s severity idiom.
 */
export const MESSAGING_VERDICT_SEVERITY: Readonly<Record<MessagingVerdict, number>> = {
  lands: 0,
  partial: 1,
  misses: 2,
};

/**
 * The weakest-link rollup across a set of verdicts: the WORST verdict wins, so a message
 * reads `lands` only when it lands on EVERY input. Deterministic — no invented consensus
 * (preserves the no-fabrication bar). An empty input defaults to `lands`.
 */
export function weakestVerdict(verdicts: readonly MessagingVerdict[]): MessagingVerdict {
  let worst: MessagingVerdict = 'lands';
  for (const v of verdicts) {
    if (MESSAGING_VERDICT_SEVERITY[v] > MESSAGING_VERDICT_SEVERITY[worst]) worst = v;
  }
  return worst;
}

/** One dimension's verdict + the avatar's own quoted evidence backing it (`Dim`). */
export const messagingDimSchema = z.object({
  verdict: messagingVerdictSchema,
  /** The avatar's own words / forensic reference backing the verdict (empty only when not analysable). */
  evidence: z.string(),
});
/** `Dim` — a single perception dimension. */
export type MessagingPerceptionDim = z.infer<typeof messagingDimSchema>;

/** The four perception dimensions, each read ONLY from that avatar's S1–S4. */
export const messagingDimensionsSchema = z.object({
  /** Does the message use words this avatar uses / would recognise (S1)? */
  vocabulary_fit: messagingDimSchema,
  /** Does it hit this avatar's functional AND emotional jobs (S2)? */
  job_resonance: messagingDimSchema,
  /** Does it land on / near this avatar's named Decision Trigger (S3)? */
  trigger_hit: messagingDimSchema,
  /** Does it pre-empt this avatar's known objections (S4) — or accidentally provoke one? */
  objection_handling: messagingDimSchema,
});

/** The four dimension keys, in render order. */
export const MESSAGING_DIMENSION_KEYS = [
  'vocabulary_fit',
  'job_resonance',
  'trigger_hit',
  'objection_handling',
] as const;
export type MessagingDimensionKey = (typeof MESSAGING_DIMENSION_KEYS)[number];

/**
 * Per-avatar messaging-perception content. The EXACT shape phase 2/3 emit and the
 * assembler consumes verbatim. `overall_verdict` is the WEAKEST of the four dimensions
 * (never an average that hides a miss); when `analysable` is false the avatar is "not
 * yet analysable" and nothing is scored.
 */
export const messagingPerceptionContentSchema = z
  .object({
    /** Avatar id (null = brand-level / not yet persisted). */
    avatar_id: z.string().nullable().optional(),
    avatar_name: z.string().min(1),
    /** The ONE planned strategic message judged through this avatar's eyes. */
    message: z.string().min(1),
    dimensions: messagingDimensionsSchema,
    /** Weakest of the four dimensions (lands > partial > misses severity). */
    overall_verdict: messagingVerdictSchema,
    /** Objections this message accidentally provokes / leaves unmet (S4). */
    provoked_objections: z.array(z.string().min(1)),
    /** Per-avatar message tweaks, expressed as hypotheses to TEST (route to design_test). */
    adjustments: z.array(z.string().min(1)),
    /** False ⇒ no Avatar 2.0 forensics → honest "not yet analysable", never scored. */
    analysable: z.boolean(),
  })
  .superRefine((c, ctx) => {
    const dims = MESSAGING_DIMENSION_KEYS.map((k) => c.dimensions[k]);
    if (c.analysable) {
      // Analysable ⇒ overall IS the weakest dimension, and every verdict cites evidence.
      const expected = weakestVerdict(dims.map((d) => d.verdict));
      if (c.overall_verdict !== expected) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['overall_verdict'],
          message: `overall_verdict must equal the weakest dimension ('${expected}'), got '${c.overall_verdict}'`,
        });
      }
      for (const k of MESSAGING_DIMENSION_KEYS) {
        if (c.dimensions[k].evidence.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dimensions', k, 'evidence'],
            message: `analysable perception must cite ${k} evidence (no-fabrication bar)`,
          });
        }
      }
    } else {
      // Not analysable ⇒ nothing scored: empty evidence + no objections / adjustments.
      for (const k of MESSAGING_DIMENSION_KEYS) {
        if (c.dimensions[k].evidence.trim().length !== 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dimensions', k, 'evidence'],
            message: `not-analysable perception must leave ${k} evidence empty`,
          });
        }
      }
      if (c.provoked_objections.length !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['provoked_objections'],
          message: 'not-analysable perception must have no provoked_objections',
        });
      }
      if (c.adjustments.length !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['adjustments'],
          message: 'not-analysable perception must have no adjustments',
        });
      }
    }
  });

/** The EXACT per-avatar content type phase 2/3 emit + the assembler consumes. */
export type MessagingPerceptionContent = z.infer<typeof messagingPerceptionContentSchema>;

/** Parse/validate raw content into a {@link MessagingPerceptionContent} (throws on mismatch). */
export function parseMessagingPerception(input: unknown): MessagingPerceptionContent {
  return messagingPerceptionContentSchema.parse(input);
}

/** Non-throwing variant — returns the zod SafeParse result. */
export function safeParseMessagingPerception(
  input: unknown,
): z.SafeParseReturnType<unknown, MessagingPerceptionContent> {
  return messagingPerceptionContentSchema.safeParse(input);
}

/**
 * The canonical "not yet analysable" content for an avatar with no Avatar 2.0 built.
 * Placeholder verdicts are `misses` (conservative — an unknown is never a pass) and all
 * evidence is empty; the assembler branches on `analysable` and renders the honest "not
 * yet analysable" line, never a score. Gives phase 2/3 one verbatim constructor so the
 * not-analysable shape can never drift.
 */
export function notAnalysablePerception(input: {
  avatar_id?: string | null;
  avatar_name: string;
  message: string;
}): MessagingPerceptionContent {
  const blank: MessagingPerceptionDim = { verdict: 'misses', evidence: '' };
  return {
    avatar_id: input.avatar_id ?? null,
    avatar_name: input.avatar_name,
    message: input.message,
    dimensions: {
      vocabulary_fit: { ...blank },
      job_resonance: { ...blank },
      trigger_hit: { ...blank },
      objection_handling: { ...blank },
    },
    overall_verdict: 'misses',
    provoked_objections: [],
    adjustments: [],
    analysable: false,
  };
}

const kind = 'messaging_perception' as const;

/**
 * No context slots: a messaging-perception artifact is assembled from already-persisted
 * Avatar 2.0 forensics + the resolved planned message, NOT from the §4 context resolver.
 */
const requiredContext = [] as const;

export const messagingPerceptionContract: ArtifactContract<typeof messagingPerceptionContentSchema> = {
  kind,
  outputSchema: messagingPerceptionContentSchema,
  requiredContext,
};

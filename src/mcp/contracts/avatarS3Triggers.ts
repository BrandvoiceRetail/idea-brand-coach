/**
 * Contract — `avatar_s3_triggers` (gold Workbook A, sheet 4, Stage 3 "The Decision Trigger™").
 *
 * RECONCILIATION (Trevor 2026-06-25 — the "two Decision Triggers" decision): this S3 artifact is
 * the WORKBOOK / SEARCH-INTENT feed — trigger moment + what-they-search + labeled volume bands
 * (gold sheet 4, for PPC + the export). It is NOT the product's primary, user-facing Decision
 * Trigger. THE single canonical Decision Trigger™ — the named six-type lever (dominant type,
 * brand anchor, verbatim evidence, placement) — is the `identify_decision_trigger` tool (the
 * identify-decision-trigger engine). Keep them distinct: this stays the search/keyword feed; that
 * is the hero lever. (Demoting these bands to a pure Workbook export column is the deeper
 * follow-up; this declaration removes the naming conflict now.)
 *
 * §2 sheet 4 S3: SYNTHESIS + ESTIMATE. The "Estimated volume" column is a LABELED
 * band, never a fabricated number (§6 row: "S3 search-volume estimates ... Always
 * labeled bands"). The schema therefore models volume as free-text band labels
 * (gold uses "High", "Very high", "High and growing (TCG comeback wave)", etc.) —
 * not a numeric type — so the engine cannot smuggle in a fake exact figure.
 *
 * Schema covers gold S3 columns: Trigger moment, What they feel, What they search,
 * Estimated volume.
 */
import { z } from 'zod';
import type { ArtifactContract } from './types.js';
import { groundingEnvelope } from './grounding.js';

export const decisionTriggerSchema = z.object({
  /** "Trigger moment" — the moment that turns interest into a search. */
  trigger_moment: z.string().min(1),
  /** "What they feel" — emotional state at the trigger. */
  what_they_feel: z.string().min(1),
  /** "What they search" — the search terms (may be several). */
  search_terms: z.array(z.string().min(1)).min(1),
  /** "Estimated volume" — labeled band only (never a fabricated exact number). */
  estimated_volume_band: z.string().min(1),
});
export type DecisionTrigger = z.infer<typeof decisionTriggerSchema>;

export const avatarS3TriggersOutputSchema = z.object({
  triggers: z.array(decisionTriggerSchema).min(1),
  ...groundingEnvelope,
});
export type AvatarS3TriggersOutput = z.infer<typeof avatarS3TriggersOutputSchema>;

const kind = 'avatar_s3_triggers' as const;

/** §2 sheet 4 S3: S1/S2 chain (#1 reviews) + search-term knowledge from target beliefs (#14); volume band is ESTIMATE. */
const requiredContext = [1, 14] as const;

export const avatarS3TriggersContract: ArtifactContract<typeof avatarS3TriggersOutputSchema> = {
  kind,
  outputSchema: avatarS3TriggersOutputSchema,
  requiredContext,
};

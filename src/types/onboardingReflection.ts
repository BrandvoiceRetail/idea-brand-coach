/**
 * Loop-1 reflection (read-it-back build-theatre) domain types.
 *
 * The reflection run is the SAME contract as the forensic build (§4.2 of
 * docs/COACH_TRANSPARENCY.md): a live per-step timeline whose output is
 * grounded-only — a `finding` exists ONLY on a step that returned `done`, and
 * is null on `pending`/`running`/`failed`/`needs_input`. Nothing is fabricated.
 *
 * `ReflectionStepStatus` is the SAME five-state union the forensic stepper uses
 * (re-exported from the forensic hook so the two surfaces share one contract).
 */
import type { StageStatus } from '@/hooks/useForensicAvatarBuild';
import type { NeedsInputItem } from '@/types/forensicBuild';

/** Reuse the forensic five-state union verbatim (one shared contract). */
export type ReflectionStepStatus = StageStatus;

export type { NeedsInputItem };

/** One step the coach runs during the read-it-back reflection. */
export interface ReflectionStep {
  /** Stable id for keys + telemetry (e.g. 'read_back', 'trust_gap'). */
  id: string;
  /** User-facing everyday label — Tier-A only ("Reading it back", "Trust Gap"). */
  label: string;
  /** Everyday tool name announced ("review read-back", "Trust Gap"); never a raw tool id. */
  tool: string;
  /** Why this step runs — the one-line "why" shown under the label. */
  rationale: string;
  /** Live status — the shared five-state union. */
  status: ReflectionStepStatus;
  /**
   * The ONE real finding this step produced, grounded in the step's result.
   * MUST be null until the step returns `done`; MUST stay null on every other
   * state. Never a placeholder, never fabricated.
   */
  finding: string | null;
}

/** A four-field Avatar-2.0 portrait, restated ONLY from what the user provided. */
export interface AvatarPortrait {
  /** Who the customer is — verbatim/derived from the user's own words. */
  who: string;
  /** The problem they're trying to solve. */
  problem: string;
  /** What they want instead (the outcome). */
  desire: string;
  /** Where the brand reaches them. */
  channel: string;
}

/**
 * Outcome of running one reflection step. Mirrors `StageRunResult`'s no-fabrication
 * shape: `ok` carries a real `finding`; `failed` carries an `error`; `needs_input`
 * carries the grounding demand. Only `ok` may produce a finding.
 */
export type ReflectionStepResult =
  | { status: 'ok'; finding: string }
  | { status: 'needs_input'; needs_input: NeedsInputItem[] }
  | { status: 'failed'; error: string };

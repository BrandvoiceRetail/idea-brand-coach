/**
 * Coach Criteria — non-technical, Trevor-authorable definitions of "what good looks like".
 *
 * A criterion is one plain-language behaviour or recommendation Trevor (or his team) wants
 * the coach to optimise toward. Criteria do double duty:
 *   1. STEERING — `optimizeToward` directives are compiled into a preamble that nudges the
 *      live coach toward the desired behaviour/recommendation (see catalog.criteriaSteeringPreamble).
 *   2. SCORING — each enabled criterion becomes a dimension the live judge scores, and the
 *      weights set how much each matters.
 *
 * This is the data contract. The defaults live in catalog.ts; the admin Criteria Studio lets a
 * non-technical user add/edit/weight/toggle them (persisted to localStorage + exported to commit).
 * Pure data — imported by the engine, the live judge, and the SPA.
 */

export type CriterionPolarity = 'reward' | 'avoid';
export type CriterionCategory = 'framing' | 'evidence' | 'persona' | 'recommendation' | 'output' | 'safety' | 'voice';
/** 'all' or a specific ICP id (busy-brand-owner | operational-va). */
export type CriterionScope = string;

export interface CoachCriterion {
  id: string;
  /** Plain-language name a non-technical author writes, e.g. "Always end with one next action". */
  title: string;
  /** What good looks like, in Trevor's words. */
  description: string;
  category: CriterionCategory;
  /** Which ICP this applies to ('all' or an ICP id). */
  icpScope: CriterionScope;
  /** Importance 1..5 (drives steering emphasis + scoring weight). */
  weight: number;
  /** 'reward' = do this; 'avoid' = never do this. */
  polarity: CriterionPolarity;
  /** The steering directive injected to optimise the coach toward this behaviour/recommendation. */
  optimizeToward: string;
  /** Optional link to an oracle dimension this maps onto (skill-faithful | persona-adapt | safety | …). */
  evalDimension?: string;
  enabled: boolean;
}

export interface CriteriaSet {
  version: number;
  /** Free-text note from the author (e.g. "tuned for the supplements vertical, June"). */
  note?: string;
  criteria: CoachCriterion[];
}

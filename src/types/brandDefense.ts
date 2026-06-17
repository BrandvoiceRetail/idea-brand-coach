/**
 * Brand Defense Types (Competitor-Agents P6 — Track B)
 *
 * Feature-local type definitions for the Brand Defense & retention track:
 *  - trust_gap_snapshots (migration 20260618000300) — periodic avatar-scoped
 *    health snapshot rolled up from three feeds.
 *  - brand_defense_alerts (migration 20260618000400) — the in-app alert inbox
 *    behind the funnel unread badge.
 *
 * The generated src/integrations/supabase/types.ts does NOT include these tables
 * yet; cast at the supabase boundary with a "// TODO(types-regen)" note until the
 * migrations are applied to prod and types are regenerated.
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md (Track B)
 */

import type { IdeaDimension } from './competitorInsights';

// ── trust_gap_snapshots ──────────────────────────────────────────────────────

/**
 * Avatar-accuracy drift feed. `signal:'stub'` flags that the drift detector is
 * unbuilt on this branch (the score is a neutral placeholder, never a fabricated
 * measurement); `signal:'measured'` once a real drift signal exists.
 * TODO(competitor-agents:avatar-drift): wire a real drift detector.
 */
export interface AvatarDriftFeed {
  /** 0-100; higher = less drift (healthier). */
  score: number;
  signal: 'stub' | 'measured';
  detail: string;
  drifted_fields: string[];
}

/**
 * Decision-Trigger health feed, derived from the asset ledger's
 * pass/needs-work/fail history. `source:'unavailable'` when the ledger read could
 * not run (best-effort; never fabricated).
 */
export interface DecisionTriggerHealthFeed {
  /** 0-100; pass-weighted share of graded assets. */
  score: number;
  pass: number;
  needs_work: number;
  fail: number;
  total: number;
  source: 'asset-ledger' | 'unavailable';
}

/**
 * Competitive-pressure feed, derived from brand_asset_competitive_insights.
 * Higher score = lower competitive pressure (healthier).
 */
export interface CompetitivePressureFeed {
  /** 0-100; higher = less competitive pressure. */
  score: number;
  competitor_count: number;
  insight_count: number;
  /** Average competitor overall IDEA strength (0-100) seen across insights. */
  avg_competitor_strength: number;
  /** The single most-cited gap, if any (grounded in the persisted insights). */
  top_gap: string | null;
}

/** Row of trust_gap_snapshots — one avatar-scoped brand-defense snapshot. */
export interface TrustGapSnapshot {
  id: string;
  avatar_id: string;
  captured_at: string;
  avatar_drift: AvatarDriftFeed;
  decision_trigger_health: DecisionTriggerHealthFeed;
  competitive_pressure: CompetitivePressureFeed;
  /** 0-100 roll-up across the three feeds. */
  composite_score: number;
  created_at: string;
}

/** Insert payload for trust_gap_snapshots. */
export interface TrustGapSnapshotCreate {
  avatar_id: string;
  avatar_drift: AvatarDriftFeed;
  decision_trigger_health: DecisionTriggerHealthFeed;
  competitive_pressure: CompetitivePressureFeed;
  composite_score: number;
}

// ── brand_defense_alerts ─────────────────────────────────────────────────────

/**
 * Threat categories the brand-defense monitor raises. `trademark` is phase 2
 * (left out of the enum for now — see the edge fn TODO).
 */
export type BrandDefenseCategory =
  | 'listing-integrity'
  | 'buy-box'
  | 'compliance'
  | 'reputation';

export type BrandDefenseSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Row of brand_defense_alerts — one in-app alert. */
export interface BrandDefenseAlert {
  id: string;
  avatar_id: string;
  category: BrandDefenseCategory;
  /** The IDEA dimension this threat puts at risk. */
  threatened_dimension: IdeaDimension | null;
  severity: BrandDefenseSeverity;
  title: string;
  interpretation: string | null;
  source_payload: Record<string, unknown>;
  drafted_response: Record<string, unknown> | null;
  ledger_request_id: string | null;
  read_at: string | null;
  created_at: string;
}

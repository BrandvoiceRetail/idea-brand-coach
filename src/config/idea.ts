/**
 * Canonical IDEA pillar enum — single source of truth (frontend).
 *
 * IDEA = Insight-Driven, Distinctive, Empathetic, Authentic. This corrects the
 * stale "Identify / Discover / Execute / Analyze" loop that the deprecated
 * brand-level `competitive-analysis-orchestrator` monolith still hard-codes
 * (supabase/functions/competitive-analysis-orchestrator/index.ts lines ~288-291,
 * `identify/discover/execute/analyze`). See MEMORY `project_idea_framework_meaning.md`.
 *
 * NOTE: that legacy orchestrator is DEPRECATED (gpt-4o, broken contract, hidden
 * behind the P2 COMPETITIVE_ANALYSIS feature) and is intentionally NOT modified
 * here (surgical-change rule). New Competitor-Agents / Brand-Defense code MUST
 * import the pillars from this module, never re-declare them.
 *
 * Lifted from supabase/functions/diagnostic-interpretation (the authoritative
 * IDEA-scoring contract). The edge functions carry their own Deno-importable copy
 * at supabase/functions/_shared/idea.ts (URL-import boundary), kept in lockstep
 * with this one.
 */

/** The four IDEA pillars, in canonical order. */
export type IdeaDimension = 'insight' | 'distinctive' | 'empathetic' | 'authentic';

/** Canonical pillar ordering (Insight, Distinctive, Empathetic, Authentic). */
export const IDEA_DIMENSIONS: readonly IdeaDimension[] = [
  'insight',
  'distinctive',
  'empathetic',
  'authentic',
] as const;

/** Human-readable labels for each pillar. */
export const IDEA_DIMENSION_LABELS: Record<IdeaDimension, string> = {
  insight: 'Insight',
  distinctive: 'Distinctive',
  empathetic: 'Empathetic',
  authentic: 'Authentic',
};

/**
 * The compact `{i,d,e,a}` score key used in `idea_scores` jsonb (one per pillar).
 * Keeping this map next to the enum keeps the short keys and the full pillar names
 * from drifting apart.
 */
export const IDEA_SCORE_KEY_BY_DIMENSION: Record<IdeaDimension, 'i' | 'd' | 'e' | 'a'> = {
  insight: 'i',
  distinctive: 'd',
  empathetic: 'e',
  authentic: 'a',
};

/** Ordered rows for rendering a four-pillar score widget (label + `{i,d,e,a}` key). */
export const IDEA_SCORE_ROWS: ReadonlyArray<{ key: 'i' | 'd' | 'e' | 'a'; label: string }> =
  IDEA_DIMENSIONS.map((dim) => ({
    key: IDEA_SCORE_KEY_BY_DIMENSION[dim],
    label: IDEA_DIMENSION_LABELS[dim],
  }));

/**
 * Canonical IDEA pillar enum — single source of truth (edge functions).
 *
 * IDEA = Insight-Driven, Distinctive, Empathetic, Authentic. This is the
 * Deno-importable twin of src/config/idea.ts (the URL/relative-import boundary
 * means the frontend and the edge functions cannot share one physical module;
 * the two are kept in lockstep). Lifted from diagnostic-interpretation, the
 * authoritative IDEA-scoring contract.
 *
 * NOTE: the deprecated brand-level `competitive-analysis-orchestrator` monolith
 * still hard-codes the stale "identify/discover/execute/analyze" loop
 * (competitive-analysis-orchestrator/index.ts ~lines 288-291). That monolith is
 * DEPRECATED (gpt-4o, broken contract) and is intentionally NOT modified here.
 * New Competitor-Agents / Brand-Defense edge code imports the pillars from this
 * module rather than re-declaring them.
 */

/** The four IDEA pillars, in canonical order. */
export type Dimension = 'insight' | 'distinctive' | 'empathetic' | 'authentic';

/** Canonical pillar ordering (Insight, Distinctive, Empathetic, Authentic). */
export const DIMENSIONS: Dimension[] = ['insight', 'distinctive', 'empathetic', 'authentic'];

/** Human-readable labels for each pillar. */
export const DIMENSION_LABELS: Record<Dimension, string> = {
  insight: 'Insight',
  distinctive: 'Distinctive',
  empathetic: 'Empathetic',
  authentic: 'Authentic',
};

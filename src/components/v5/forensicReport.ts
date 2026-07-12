/**
 * forensicReport — parsing + narrowing for the `run-forensic-analysis` edge
 * response on the /v5 surface.
 *
 * The response contract (verified against supabase/functions/run-forensic-analysis
 * and the existing ForensicAnalysisPanel consumer):
 *   { ok: true, asin, reviews_analyzed, thin_corpus,
 *     forensic_scores: { insight, distinctive, empathetic, authentic (0-25 each),
 *                        overall (0-100) },
 *     primary_gap, interpretation | null, decision_trigger | null,
 *     customer_profile: { how_they_talk, why_buying_now, what_builds_trust,
 *                         what_stops_them }, emailed, listing, notes? }
 *
 * `decision_trigger` arrives in the engine's snake_case shape; we map it and
 * DROP `brand_anchor` entirely — brand anchors never render (Amendment v1.1).
 * Unusable shapes are omitted, never rendered as junk.
 */

import { DECISION_TRIGGER_TYPES, type DecisionTriggerType } from '@/lib/decisionTrigger';

export type PillarKey = 'insight' | 'distinctive' | 'empathetic' | 'authentic';

export interface V5ForensicScores {
  insight: number;
  distinctive: number;
  empathetic: number;
  authentic: number;
  overall: number;
}

export interface V5InterpretationDimension {
  dimension: string;
  brand_read?: string;
  grounding?: 'evidence' | 'inference';
}

export interface V5Interpretation {
  dimensions?: V5InterpretationDimension[];
  primaryGapSummary?: string;
}

export interface V5CustomerProfile {
  how_they_talk: string;
  why_buying_now: string;
  what_builds_trust: string;
  what_stops_them: string;
}

export interface V5ForensicReport {
  ok: true;
  asin: string;
  reviews_analyzed: number;
  thin_corpus: boolean;
  forensic_scores: V5ForensicScores;
  primary_gap: PillarKey;
  interpretation: V5Interpretation | null;
  decision_trigger: unknown;
  /** Tolerated as partial at runtime — normalise via `normalizeProfile`. */
  customer_profile?: Partial<V5CustomerProfile>;
  emailed?: boolean;
  listing?: { title?: string; bullets?: string[] };
  notes?: string[];
}

/** Coerce the profile to the four-string shape (absent fields = empty, honest). */
export function normalizeProfile(profile: Partial<V5CustomerProfile> | undefined): V5CustomerProfile {
  return {
    how_they_talk: typeof profile?.how_they_talk === 'string' ? profile.how_they_talk : '',
    why_buying_now: typeof profile?.why_buying_now === 'string' ? profile.why_buying_now : '',
    what_builds_trust: typeof profile?.what_builds_trust === 'string' ? profile.what_builds_trust : '',
    what_stops_them: typeof profile?.what_stops_them === 'string' ? profile.what_stops_them : '',
  };
}

/** The trigger as /v5 renders it — plain commercial copy, no brand anchor. */
export interface V5DecisionTrigger {
  name: DecisionTriggerType;
  why: string;
  evidencePhrases: string[];
  placement: string;
}

const PILLARS: readonly PillarKey[] = ['insight', 'distinctive', 'empathetic', 'authentic'];

/** Narrow an unknown edge response to the success contract. */
export function isForensicReport(data: unknown): data is V5ForensicReport {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.ok !== true || typeof d.asin !== 'string') return false;
  if (typeof d.reviews_analyzed !== 'number' || typeof d.thin_corpus !== 'boolean') return false;
  const s = d.forensic_scores as Record<string, unknown> | undefined;
  if (!s) return false;
  if (!(['insight', 'distinctive', 'empathetic', 'authentic', 'overall'] as const)
    .every((k) => typeof s[k] === 'number')) return false;
  return typeof d.primary_gap === 'string' && PILLARS.includes(d.primary_gap as PillarKey);
}

/**
 * Map the snake_case `decision_trigger` to the /v5 render shape (tolerating the
 * camelCase variant), dropping `brand_anchor`. Undefined when unusable.
 */
export function mapTrigger(raw: unknown): V5DecisionTrigger | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const dominant = (r.dominant_type ?? r.dominantType) as unknown;
  const phrases = (r.evidence_phrases ?? r.evidencePhrases) as unknown;
  const placement = (r.placement_instruction ?? r.placementInstruction) as unknown;
  const why = (r.why_this_trigger ?? r.whyThisTrigger) as unknown;

  if (typeof dominant !== 'string'
    || !DECISION_TRIGGER_TYPES.includes(dominant as DecisionTriggerType)) return undefined;
  if (typeof placement !== 'string') return undefined;

  return {
    name: dominant as DecisionTriggerType,
    why: typeof why === 'string' ? why : '',
    evidencePhrases: Array.isArray(phrases)
      ? phrases.filter((p): p is string => typeof p === 'string')
      : [],
    placement,
  };
}

/**
 * The finding shown as Component 0 — the interpretation's primary-gap summary,
 * else the primary-gap dimension's brand read. Null when the interpretation
 * degraded server-side (the caller shows an honest note, never invented copy).
 */
export function findingText(report: V5ForensicReport): string | null {
  const interp = report.interpretation;
  if (!interp) return null;
  if (interp.primaryGapSummary) return interp.primaryGapSummary;
  const dims = Array.isArray(interp.dimensions) ? interp.dimensions : [];
  const primary = dims.find(
    (d) => typeof d.dimension === 'string'
      && d.dimension.toLowerCase().startsWith(report.primary_gap.slice(0, 6)),
  );
  return primary?.brand_read ?? dims.find((d) => d.brand_read)?.brand_read ?? null;
}

/**
 * The persisted outcome of one completed v5 run, stored per-listing on
 * user_products.last_run (latest only, overwritten each run) so the brief is
 * instantly available whenever the customer returns — no engine re-run.
 */
export interface V5RunSnapshot {
  report: V5ForensicReport;
  trigger: V5DecisionTrigger | null;
  brief: unknown; // BriefSlots — typed at the read site to avoid a v4-type dependency here
  claims: unknown[]; // ClaimGateItem[]
  listingTitle: string | null;
  finishedAt: string;
  /** Count of reviews consumed in the build (optional for backward compatibility with old snapshots). */
  reviewCount?: number;
}

/** Conservative shape guard for a stored last_run payload. */
export function isV5RunSnapshot(data: unknown): data is V5RunSnapshot {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    isForensicReport(d.report) &&
    !!d.brief &&
    typeof d.brief === 'object' &&
    Array.isArray(d.claims) &&
    typeof d.finishedAt === 'string'
  );
}

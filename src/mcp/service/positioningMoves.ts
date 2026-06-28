/**
 * Layer 1 (service) — positioning-move generation + criteria scoring.
 *
 * WHAT: given an avatar, a Decision Trigger™, and brand context, produce 2–3 candidate
 * positioning MOVES, each scored against the live Coach Criteria with a transparent,
 * per-criterion rationale. The composite is the deterministic average of the criterion
 * scores the judge actually returned.
 *
 * WHY: the generation seam is `generate_concepts` (the existing consultant-engine wrap,
 * Calculation Parity) — we compose a positioning brief and reuse `buildConceptPrompt` /
 * `parseConcepts` rather than inventing a second generator. The scoring reuses the Coach
 * Criteria module (`evals/criteria`) — the same plain-language criteria Trevor authors and
 * the live judge scores against — rather than inventing a new scoring system. Scores are
 * NEVER fabricated: when the engine is unreachable or returns no usable scores, the move is
 * returned unscored (composite = null) with an honest note. The composite math is computed
 * here deterministically, never by the model.
 */
import type { ConceptCandidate } from './concepts.js';
import { buildConceptPrompt, parseConcepts } from './concepts.js';
import type { EdgeFnClient } from '../edgeFn/client.js';
import { DEFAULT_CRITERIA_SET, enabledCriteria } from '../evals/criteria/catalog.js';
import type { CoachCriterion } from '../evals/criteria/types.js';

interface ConsultantResponse {
  response: string;
}

export interface PositioningMoveRequest {
  /** The customer avatar this positioning must resonate with. */
  avatar: string;
  /** The named Decision Trigger™ the move should activate. */
  decisionTrigger: string;
  /** Brand context — product, promise, category, evidence the move can lean on. */
  brandContext: string;
  /** How many candidate moves to generate (2–3). */
  count: number;
}

/** One criterion's score for a single move (0..1) with the judge's rationale. */
export interface CriterionScore {
  id: string;
  title: string;
  weight: number;
  score: number;
  rationale: string;
}

/** A candidate positioning move with its transparent criteria scoring. */
export interface ScoredPositioningMove {
  /** The move's short name. */
  title: string;
  /** The one-sentence positioning statement. */
  statement: string;
  /** The strategic angle behind the move. */
  angle: string;
  /** Why this move activates the Decision Trigger™ for this avatar. */
  rationale: string;
  /** True when at least one criterion was scored by the judge. */
  scored: boolean;
  /** Deterministic average of the returned criterion scores (null when unscored). */
  composite: number | null;
  /** Per-criterion scores the judge actually returned (never fabricated). */
  criteria: CriterionScore[];
  /** Honest note when scoring was unavailable/partial. */
  note?: string;
}

export type PositioningMovesResult =
  | { status: 'ok'; moves: ScoredPositioningMove[]; criteriaVersion: number }
  | { status: 'unavailable'; note: string };

/** Injectable seams so the tool is deterministically testable (mirrors identifyDecisionTrigger). */
export interface PositioningMovesDeps {
  /** Generate raw candidate moves (default: the generate_concepts consultant-engine seam). */
  generate: (req: PositioningMoveRequest) => Promise<ConceptCandidate[] | null>;
  /** Score one move against the supplied criteria (default: a judge call to the same engine). */
  score: (move: ConceptCandidate, criteria: CoachCriterion[]) => Promise<RawCriterionScore[] | null>;
}

/** The judge's raw per-criterion reply before it is matched + clamped against the catalog. */
export interface RawCriterionScore {
  id: string;
  score: number;
  rationale: string;
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/** Compose the positioning brief that feeds the generate_concepts generation seam. */
export function buildPositioningBrief({ avatar, decisionTrigger, brandContext }: PositioningMoveRequest): string {
  return [
    'Produce candidate POSITIONING MOVES for this brand (each "concept" is one positioning move).',
    `Customer avatar: ${avatar}`,
    `Decision Trigger™ to activate: ${decisionTrigger}`,
    `Brand context: ${brandContext}`,
    '',
    'Map the fields to the positioning move: title = the move name; hook = the single-sentence',
    'positioning statement; angle = the strategic angle; rationale = why this move activates the',
    'Decision Trigger™ for this specific avatar, grounded in the brand context.',
  ].join('\n');
}

/** Build the judge prompt that scores one move against the live Coach Criteria. */
export function buildScoringPrompt(move: ConceptCandidate, criteria: CoachCriterion[]): string {
  const lines = criteria.map((c) => `- ${c.id} — ${c.title}: ${c.optimizeToward}`);
  return [
    'You are scoring ONE positioning move against the coaching criteria below. For each criterion,',
    'return a score from 0.0 (fails it) to 1.0 (fully meets it) and a one-sentence rationale grounded',
    'in the move. Do not invent facts about the brand; judge only what the move asserts.',
    '',
    `Positioning move title: ${move.title}`,
    `Positioning statement: ${move.hook}`,
    `Strategic angle: ${move.angle}`,
    `Move rationale: ${move.rationale}`,
    '',
    'Criteria:',
    ...lines,
    '',
    'Respond with ONLY a JSON array (no prose before or after), one element per criterion:',
    '[{"id": string, "score": number, "rationale": string}]. Use the exact criterion ids above.',
  ].join('\n');
}

/** Extract the first JSON array embedded in a (possibly fenced / chatty) reply. */
function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf('[');
  if (start === -1) return null;
  for (let end = text.lastIndexOf(']'); end > start; end = text.lastIndexOf(']', end - 1)) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* keep shrinking */
    }
  }
  return null;
}

/** Parse the judge reply into raw per-criterion scores (defensive, never throws). */
export function parseScores(text: string): RawCriterionScore[] | null {
  const arr = extractJsonArray(text);
  if (!arr) return null;
  const rows = arr
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({ id: String(r.id ?? '').trim(), score: Number(r.score), rationale: String(r.rationale ?? '').trim() }))
    .filter((r) => r.id.length > 0 && Number.isFinite(r.score));
  return rows.length ? rows : null;
}

/**
 * Match the judge's raw scores against the enabled criteria, clamp, and compute the
 * deterministic composite. Only criteria the judge actually returned are counted —
 * unscored criteria are dropped, never defaulted, so the composite is never fabricated.
 */
export function applyScores(
  move: ConceptCandidate,
  criteria: CoachCriterion[],
  raw: RawCriterionScore[] | null,
): ScoredPositioningMove {
  const base: Omit<ScoredPositioningMove, 'scored' | 'composite' | 'criteria' | 'note'> = {
    title: move.title,
    statement: move.hook,
    angle: move.angle,
    rationale: move.rationale,
  };
  if (!raw || raw.length === 0) {
    return { ...base, scored: false, composite: null, criteria: [], note: 'scoring unavailable — the criteria judge returned no usable scores' };
  }
  const byId = new Map(raw.map((r) => [r.id, r]));
  const scored: CriterionScore[] = criteria
    .filter((c) => byId.has(c.id))
    .map((c) => {
      const r = byId.get(c.id) as RawCriterionScore;
      return { id: c.id, title: c.title, weight: c.weight, score: clamp01(r.score), rationale: r.rationale };
    });
  if (scored.length === 0) {
    return { ...base, scored: false, composite: null, criteria: [], note: 'scoring unavailable — no returned scores matched the active criteria' };
  }
  const composite = scored.reduce((sum, s) => sum + s.score, 0) / scored.length;
  const note = scored.length < criteria.length
    ? `partial — ${scored.length} of ${criteria.length} active criteria scored`
    : undefined;
  return { ...base, scored: true, composite: Number(composite.toFixed(4)), criteria: scored, note };
}

/** Default generation seam: compose a positioning brief and reuse the generate_concepts engine. */
export function defaultGenerate(edgeFn: EdgeFnClient): PositioningMovesDeps['generate'] {
  return async (req) => {
    const prompt = buildConceptPrompt({ brief: buildPositioningBrief(req), count: req.count });
    const res = await edgeFn.invoke<ConsultantResponse>('idea-framework-consultant-claude', {
      message: prompt,
      hasUploadedDocuments: false,
      stream: false,
    });
    if (!res.ok || !res.data?.response) return null;
    const moves = parseConcepts(res.data.response, req.count);
    return moves.length ? moves : null;
  };
}

/** Default scoring seam: judge one move against the criteria via the same engine. */
export function defaultScore(edgeFn: EdgeFnClient): PositioningMovesDeps['score'] {
  return async (move, criteria) => {
    const res = await edgeFn.invoke<ConsultantResponse>('idea-framework-consultant-claude', {
      message: buildScoringPrompt(move, criteria),
      hasUploadedDocuments: false,
      stream: false,
    });
    if (!res.ok || !res.data?.response) return null;
    return parseScores(res.data.response);
  };
}

/**
 * Orchestrate generation → per-move criteria scoring → deterministic composite.
 * Pure of MCP plumbing; the tool layer supplies the deps (or the edge-fn defaults).
 */
export async function generatePositioningMoves(
  req: PositioningMoveRequest,
  deps: PositioningMovesDeps,
): Promise<PositioningMovesResult> {
  const candidates = await deps.generate(req);
  if (!candidates || candidates.length === 0) {
    return { status: 'unavailable', note: 'could not generate positioning moves (engine empty or unreachable)' };
  }
  const criteria = enabledCriteria(DEFAULT_CRITERIA_SET);
  const moves: ScoredPositioningMove[] = [];
  for (const candidate of candidates) {
    const raw = await deps.score(candidate, criteria);
    moves.push(applyScores(candidate, criteria, raw));
  }
  // Rank scored moves highest-composite first; unscored moves trail (honest, not dropped).
  moves.sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1));
  return { status: 'ok', moves, criteriaVersion: DEFAULT_CRITERIA_SET.version };
}

/**
 * analyseService — Layer-3 execution seam for Loop-2 (Analyse).
 *
 * WHAT: Thin, typed wrappers around the deployed edge functions and owner-scoped
 * Supabase reads that power the Analyse loop — buildAvatar, getGapAndTrigger,
 * generatePositioningMoves, expandMoveToBrief, plus a runAnalyse orchestrator.
 * Each returns an `AnalyseResult<T>` discriminated `ok | needs_input | error`.
 *
 * WHY: This is the single seam the Analyse screens and the run-hook integrator
 * share, so they never call edge functions directly or drift on payload shapes.
 * Modeled on `OnboardingReflectionService`: the edge invoker is INJECTABLE so
 * tests drive the reachable / unreachable / empty / needs_input branches without
 * a network.
 *
 * NO FABRICATION: every method degrades to `needs_input` (ask the user) or
 * `error` rather than synthesising an avatar, a score, a trigger, a move, or a
 * claim. A move engine that isn't deployed yet returns `needs_input`, never a
 * made-up move; a Trust Gap without real scores returns `needs_input`, never a
 * made-up number. This mirrors Loop-1's honest degradation.
 */
import { supabase } from '@/integrations/supabase/client';
import { parseMegaprompt, portraitFromSlots } from '@/lib/v4/megapromptParse';
import type {
  AnalyseBundle,
  AnalyseResult,
  AvatarPortrait,
  BriefSlot,
  BriefSlots,
  ClaimGateItem,
  DecisionTriggerType,
  DecisionTriggerView,
  GapTriggerBundle,
  GapTriggerInput,
  MoveCriterionScore,
  PositioningMove,
  TrustGapView,
  TrustPillar,
  TrustPillarView,
} from '@/types/v4Analyse';

/** Injectable edge invoker (defaults to the deployed Supabase edge functions). */
export type EdgeInvoke = (
  fn: string,
  body: unknown,
) => Promise<{ data: unknown; error: unknown }>;

const defaultEdgeInvoke: EdgeInvoke = async (fn, body) => {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  return { data, error };
};

const PILLARS: readonly TrustPillar[] = ['insight', 'distinctive', 'empathetic', 'authentic'];
const TRIGGER_TYPES: readonly DecisionTriggerType[] = [
  'Identity',
  'Belonging',
  'Permission',
  'Fear-of-Loss',
  'Recognition',
  'Momentum',
];

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const asNumber = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/**
 * A `needs_input` short-circuit can arrive as the edge body (HTTP 200) for
 * several of these functions. Extract it if present.
 */
const extractNeedsInput = (
  rec: Record<string, unknown>,
): AnalyseResult<never> | null => {
  if (!Array.isArray(rec.needs_input)) return null;
  const items = rec.needs_input
    .map((x) => {
      const r = asRecord(x);
      if (!r) return null;
      return {
        slot: asNumber(r.slot) ?? 0,
        question: asString(r.question) ?? '',
        why: asString(r.why) ?? '',
      };
    })
    .filter((x): x is { slot: number; question: string; why: string } => x !== null);
  return { status: 'needs_input', needs_input: items };
};

const errResult = (e: unknown, fallback: string): AnalyseResult<never> => ({
  status: 'error',
  error: e instanceof Error ? e.message : fallback,
});

export class AnalyseService {
  constructor(private readonly invoke: EdgeInvoke = defaultEdgeInvoke) {}

  /**
   * Build the active four-field avatar STRICTLY from the user's confirmed words.
   * Deterministic (no network): restates who/problem/desire/channel via the
   * shared megaprompt parser. `needs_input` when the context lacks a customer +
   * problem to restate honestly — never invents a buyer.
   */
  buildAvatar(megaprompt: string): AnalyseResult<AvatarPortrait> {
    const portrait = portraitFromSlots(parseMegaprompt(megaprompt));
    if (!portrait) {
      return {
        status: 'needs_input',
        needs_input: [
          {
            slot: 0,
            question: 'Who is your customer, and what problem are you solving for them?',
            why: 'I only build an avatar from what you have told me — I will not invent your buyer.',
          },
        ],
      };
    }
    return { status: 'ok', data: portrait };
  }

  /**
   * Score the Trust Gap and derive the dominant Decision Trigger from REAL
   * evidence. Requires the four pillar scores (produced by the Trust Gap
   * diagnostic); without them it returns `needs_input` rather than a made-up
   * number. The trigger is best-effort — if its engine is unreachable the Trust
   * Gap still returns, with `decisionTrigger: null`.
   */
  async getGapAndTrigger(
    input: GapTriggerInput,
  ): Promise<AnalyseResult<GapTriggerBundle>> {
    const scores = input.scores ?? {};
    const complete = PILLARS.every((p) => typeof scores[p] === 'number');
    if (!complete) {
      return {
        status: 'needs_input',
        needs_input: [
          {
            slot: 0,
            question:
              'Run the Trust Gap diagnostic first — I need your real pillar scores (and ideally your listing or reviews) before I can read the gap.',
            why: 'I never score a brand without real evidence; the number has to come from the diagnostic, not a guess.',
          },
        ],
      };
    }

    const full = scores as Record<TrustPillar, number>;
    const overall = PILLARS.reduce((sum, p) => sum + full[p], 0);
    const primaryGap = PILLARS.reduce((lo, p) => (full[p] < full[lo] ? p : lo), PILLARS[0]);

    let interpretations: Partial<Record<TrustPillar, string>> = {};
    let primaryGapSummary = '';
    try {
      const { data, error } = await this.invoke('diagnostic-interpretation', {
        scores: full,
        overall,
        primaryGap,
        evidence: input.evidence,
      });
      const rec = error ? null : asRecord(data);
      const interp = rec ? asRecord(rec.interpretations) : null;
      if (interp) {
        interpretations = Object.fromEntries(
          PILLARS.map((p) => [p, asString(interp[p]) ?? '']),
        ) as Partial<Record<TrustPillar, string>>;
      }
      primaryGapSummary = (rec && asString(rec.primaryGapSummary)) ?? '';
    } catch {
      // Scores are real; an unreachable interpretation engine just leaves the
      // coaching read blank rather than fabricating one.
    }

    const pillars: TrustPillarView[] = PILLARS.map((p) => ({
      pillar: p,
      score: full[p],
      interpretation: interpretations[p] ?? '',
    }));

    const trustGap: TrustGapView = { overall, pillars, primaryGap, primaryGapSummary };
    const decisionTrigger = await this.deriveTrigger(full, input.evidence);
    return { status: 'ok', data: { trustGap, decisionTrigger } };
  }

  /**
   * Trust Gap + Decision Trigger across a SET of customers (multi-avatar Analyse).
   * SET-INVARIANT: the Analyse gap + Decision Trigger are derived from the SHARED
   * brand-level /v4 context (one megaprompt, not avatar-keyed), so they are
   * IDENTICAL for every selected customer — like business metrics. We therefore read
   * ONCE and never fan out to N identical calls or fabricate a per-customer strip of
   * repeated numbers. The optional `perAvatar` field + `GapAvatarSummary` type stay
   * in place, ready to carry real per-customer gaps the day per-avatar evidence is
   * wired into `GapTriggerInput`.
   */
  async getGapAndTriggerForSet(
    avatarIds: string[],
    avatarNames: Record<string, string>,
    input: GapTriggerInput,
  ): Promise<AnalyseResult<GapTriggerBundle>> {
    // Read once — gap/trigger is set-invariant (shared brand-level input). avatarIds/
    // avatarNames are accepted for call-site symmetry with the other getXForSet seams.
    void avatarIds;
    void avatarNames;
    return this.getGapAndTrigger(input);
  }

  /** Best-effort Decision Trigger derivation; null (not error) when unavailable. */
  private async deriveTrigger(
    scores: Record<TrustPillar, number>,
    evidence: string | undefined,
  ): Promise<DecisionTriggerView | null> {
    try {
      const { data, error } = await this.invoke('identify-decision-trigger', { scores, evidence });
      if (error) return null;
      const rec = asRecord(data);
      if (!rec) return null;
      const typeRaw = asString(rec.dominant_type);
      const type = TRIGGER_TYPES.find((t) => t === typeRaw);
      const placement = asString(rec.placement_instruction);
      const why = asString(rec.why_this_trigger);
      if (!type || !placement || !why) return null;
      return {
        type,
        brandAnchor: asString(rec.brand_anchor) ?? '',
        evidencePhrases: asStringArray(rec.evidence_phrases),
        placementInstruction: placement,
        whyThisTrigger: why,
        confidence: asNumber(rec.confidence) ?? 0,
      };
    } catch {
      return null;
    }
  }

  /**
   * Generate candidate positioning moves scored against the live coach criteria.
   * The move engine (`generate_positioning_moves`) is net-new and may not be
   * deployed yet — when it is unreachable or returns nothing, this returns
   * `needs_input`, NEVER a fabricated move.
   */
  async generatePositioningMoves(
    avatar: AvatarPortrait,
    decisionTrigger: DecisionTriggerView | null,
  ): Promise<AnalyseResult<PositioningMove[]>> {
    try {
      const { data, error } = await this.invoke('generate-positioning-moves', {
        avatar,
        decisionTrigger,
      });
      if (error) return this.moveEngineUnavailable();
      const rec = asRecord(data);
      if (rec) {
        const ni = extractNeedsInput(rec);
        if (ni) return ni;
      }
      const rawMoves = rec && Array.isArray(rec.moves) ? rec.moves : Array.isArray(data) ? data : [];
      const moves = rawMoves
        .map((m, i) => this.parseMove(m, i))
        .filter((m): m is PositioningMove => m !== null);
      if (moves.length === 0) return this.moveEngineUnavailable();
      return { status: 'ok', data: moves };
    } catch {
      return this.moveEngineUnavailable();
    }
  }

  private moveEngineUnavailable(): AnalyseResult<never> {
    return {
      status: 'needs_input',
      needs_input: [
        {
          slot: 0,
          question:
            'The positioning-move engine is not available yet. Confirm your avatar and Decision Trigger and I will draft moves to test once it is connected.',
          why: 'I will not invent positioning angles — each move has to be generated and scored against your real criteria.',
        },
      ],
    };
  }

  private parseMove(raw: unknown, index: number): PositioningMove | null {
    const rec = asRecord(raw);
    if (!rec) return null;
    const headline = asString(rec.headline);
    if (!headline) return null;
    const criteriaScores: MoveCriterionScore[] = Array.isArray(rec.criteriaScores)
      ? rec.criteriaScores
          .map((c) => {
            const cr = asRecord(c);
            if (!cr) return null;
            const criterion = asString(cr.criterion);
            const score = asNumber(cr.score);
            if (criterion == null || score == null) return null;
            return { criterion, score, why: asString(cr.why) ?? '' };
          })
          .filter((c): c is MoveCriterionScore => c !== null)
      : [];
    return {
      id: asString(rec.id) ?? `move-${index}`,
      headline,
      rationale: asString(rec.rationale) ?? '',
      criteriaScores,
      composite: asNumber(rec.composite) ?? 0,
    };
  }

  /**
   * Expand the chosen move into the 7-slot brief via `export-brief`, running
   * every product claim through the fabrication gate. Passes through the edge
   * fn's `needs_input` (e.g. "compile the Brand Canvas first") unchanged — never
   * fabricates a brief or asserts an unconfirmed claim as fact.
   */
  async expandMoveToBrief(move: PositioningMove): Promise<AnalyseResult<BriefSlots>> {
    try {
      const { data, error } = await this.invoke('export-brief', { move });
      if (error) return errResult(error, 'Could not reach the brief engine.');
      const rec = asRecord(data);
      if (!rec) return errResult(null, 'The brief engine returned nothing usable.');
      const ni = extractNeedsInput(rec);
      if (ni) return ni;
      const brief = this.parseBrief(rec);
      if (!brief) return errResult(null, 'The brief came back incomplete.');
      return { status: 'ok', data: brief };
    } catch (e) {
      return errResult(e, 'Could not reach the brief engine.');
    }
  }

  private parseBrief(rec: Record<string, unknown>): BriefSlots | null {
    const titleRec = asRecord(rec.title_formula);
    const imageRaw = Array.isArray(rec.image_brief) ? rec.image_brief : [];
    const imageBrief: BriefSlot[] = imageRaw
      .map((s) => {
        const sr = asRecord(s);
        if (!sr) return null;
        return {
          slot: asString(sr.slot) ?? '',
          intent: asString(sr.intent) ?? '',
          brief: asString(sr.brief) ?? '',
        };
      })
      .filter((s): s is BriefSlot => s !== null);
    if (imageBrief.length === 0) return null;

    const bulletsRaw = Array.isArray(rec.bullets) ? rec.bullets : [];
    const bullets = bulletsRaw
      .map((b) => {
        const br = asRecord(b);
        if (!br) return null;
        return {
          element: asString(br.element) ?? '',
          brief: asString(br.brief) ?? '',
          exampleOutput: asString(br.example_output) ?? '',
        };
      })
      .filter((b): b is { element: string; brief: string; exampleOutput: string } => b !== null);

    const ppc = asRecord(rec.ppc_keywords);
    return {
      titleFormula: {
        brief: (titleRec && asString(titleRec.brief)) ?? '',
        exampleOutput: (titleRec && asString(titleRec.example_output)) ?? '',
      },
      bullets,
      imageBrief,
      ppcKeywords: {
        tierA: ppc ? asStringArray(ppc.tier_a) : [],
        tierB: ppc ? asStringArray(ppc.tier_b) : [],
        tierC: ppc ? asStringArray(ppc.tier_c) : [],
      },
      claimGate: this.parseClaimGate(rec),
    };
  }

  private parseClaimGate(rec: Record<string, unknown>): ClaimGateItem[] {
    const raw = Array.isArray(rec.product_truth_claims)
      ? rec.product_truth_claims
      : Array.isArray(rec.claims)
        ? rec.claims
        : [];
    return raw
      .map((c) => {
        const cr = asRecord(c);
        if (!cr) return null;
        const claim = asString(cr.claim);
        if (!claim) return null;
        const confirmed = cr.confirmed === true;
        const item: ClaimGateItem = {
          claim,
          status: confirmed ? 'confirmed' : 'unconfirmed',
        };
        const slot = asNumber(cr.slot);
        if (slot != null) item.slot = slot;
        if (!confirmed) item.reason = 'Not yet confirmed against your real product facts.';
        return item;
      })
      .filter((c): c is ClaimGateItem => c !== null);
  }

  /**
   * Orchestrate the Analyse core: build the avatar, then read the gap + trigger.
   * Surfaces the first non-`ok` step (avatar is the hard gate); the gap/trigger
   * step degrades to its own `needs_input` when evidence is missing.
   */
  async runAnalyse(
    megaprompt: string,
    gapInput: GapTriggerInput,
  ): Promise<AnalyseResult<AnalyseBundle>> {
    const avatarResult = this.buildAvatar(megaprompt);
    if (avatarResult.status !== 'ok') return avatarResult;

    const gap = await this.getGapAndTrigger(gapInput);
    if (gap.status === 'error') return gap;
    if (gap.status === 'needs_input') {
      return {
        status: 'ok',
        data: { avatar: avatarResult.data, trustGap: null, decisionTrigger: null },
      };
    }
    return {
      status: 'ok',
      data: {
        avatar: avatarResult.data,
        trustGap: gap.data.trustGap,
        decisionTrigger: gap.data.decisionTrigger,
      },
    };
  }
}

/** Default instance the screens + integrator import. */
export const analyseService = new AnalyseService();

// Standalone function seam (delegates to the default instance) for ergonomic
// imports in screens that don't need a custom invoker.
export const buildAvatar = (megaprompt: string): AnalyseResult<AvatarPortrait> =>
  analyseService.buildAvatar(megaprompt);
export const getGapAndTrigger = (
  input: GapTriggerInput,
): Promise<AnalyseResult<GapTriggerBundle>> => analyseService.getGapAndTrigger(input);
export const getGapAndTriggerForSet = (
  avatarIds: string[],
  avatarNames: Record<string, string>,
  input: GapTriggerInput,
): Promise<AnalyseResult<GapTriggerBundle>> =>
  analyseService.getGapAndTriggerForSet(avatarIds, avatarNames, input);
export const generatePositioningMoves = (
  avatar: AvatarPortrait,
  decisionTrigger: DecisionTriggerView | null,
): Promise<AnalyseResult<PositioningMove[]>> =>
  analyseService.generatePositioningMoves(avatar, decisionTrigger);
export const expandMoveToBrief = (move: PositioningMove): Promise<AnalyseResult<BriefSlots>> =>
  analyseService.expandMoveToBrief(move);
export const runAnalyse = (
  megaprompt: string,
  gapInput: GapTriggerInput,
): Promise<AnalyseResult<AnalyseBundle>> => analyseService.runAnalyse(megaprompt, gapInput);

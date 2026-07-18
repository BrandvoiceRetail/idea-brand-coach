/**
 * Layer 3 (service) — the Avatar 2.0 forensic pipeline orchestrator (gold Workbook A,
 * sheet 4). Clones MarkdownExportService's batch/dependsOn/retry shape:
 *
 *   s1 (vocabulary) → s2 (job map) → [s3 (triggers), s4 (objections) in parallel]
 *                                  → s5 (positioning statement, D2/R-015 gated)
 *
 * Each stage:
 *   1. RESOLVES its grounding inputs — own/competitor reviews (slot #1) via the context
 *      resolver, and any prior-stage artifacts via the artifact store.
 *   2. SHORT-CIRCUITS to `needs_input` when reviews are unresolved. The engine never runs
 *      ungrounded: S1 vocabulary/S4 verbatims MUST trace to a real review (manifest §6).
 *   3. INVOKES the stage's edge fn (cloned from the reveal-positioning-statement skeleton) verbatim
 *      via the shared EdgeFnClient, passing `{ reviews, prior }`.
 *   4. VALIDATES the engine reply against the stage's Phase-0 zod contract; a bad shape
 *      is a retryable failure (the model produced an invalid artifact).
 *   5. PERSISTS the validated artifact via the JWT-bound artifact store, carrying the
 *      grounding envelope (`evidence` + the review evidence_refs).
 *   Retries on transient edge/validation failure (max 2, exponential backoff).
 *
 * Dependencies (resolver / store / edge fn) are injected so the orchestration is unit
 * testable against stubs; they default to the live module functions in production.
 *
 * D2 / R-015: s5 feeds the persisted evidence artifacts into the Positioning Statement engine. Per
 * the manifest argument this preserves no-parroting (customer review vocabulary is not
 * the founder's own words) — the OPERATOR must sign off the R-015 reading before the
 * pipeline auto-feeds S5. `runStage('s5')`/`runPipeline()` therefore require an explicit
 * `allowPositioningStatement` flag; without it the chain stops after S4 and reports the gate.
 */
import {
  CONTRACTS,
  needsInputSchema,
  type ArtifactKind,
  type EvidenceRef,
  type Grounding,
  type NeedsInputItem,
} from '../contracts/index.js';
import type { SlotId } from '../contracts/slots.js';
import { resolve as resolveSlots, type ResolvedSlot } from './contextResolver.js';
import {
  getCurrentArtifact as getCurrentArtifactLive,
  saveArtifact as saveArtifactLive,
  type ArtifactRow,
  type SaveArtifactOptions,
} from './artifactStore.js';
import { EdgeFnClient } from '../edgeFn/client.js';

/** The forensic stages this pipeline runs (S5 = positioning statement, gated). */
export type AvatarStage = 's1' | 's2' | 's3' | 's4' | 's5';

/** A stage spec: contract kind, edge fn, and the prior stages it grounds on. */
interface StageSpec {
  readonly stage: AvatarStage;
  readonly kind: ArtifactKind;
  readonly edgeFn: string;
  /** Prior stages whose current artifacts are fed in as `prior` (dependsOn). */
  readonly dependsOn: readonly AvatarStage[];
}

/**
 * The four forensic stages + the gated positioning statement stage. Edge-fn names follow the P3-A
 * ledger interface (avatar-vocabulary / -jobmap / -triggers / -objections); S5 reuses
 * the frozen reveal-positioning-statement engine. Order is s1 → s2 → {s3,s4} → s5 — s3 and s4 share
 * batch 3 (both depend only on s1/s2) and run in parallel in pipeline mode.
 */
const STAGES: Readonly<Record<AvatarStage, StageSpec>> = {
  s1: { stage: 's1', kind: 'avatar_s1_vocab', edgeFn: 'avatar-vocabulary', dependsOn: [] },
  s2: { stage: 's2', kind: 'avatar_s2_jobmap', edgeFn: 'avatar-jobmap', dependsOn: ['s1'] },
  s3: { stage: 's3', kind: 'avatar_s3_triggers', edgeFn: 'avatar-triggers', dependsOn: ['s1', 's2'] },
  s4: { stage: 's4', kind: 'avatar_s4_objections', edgeFn: 'avatar-objections', dependsOn: ['s1', 's2'] },
  s5: { stage: 's5', kind: 'positioning_statement', edgeFn: 'reveal-positioning-statement', dependsOn: ['s1', 's2', 's3', 's4'] },
};

/** Slot #1 = own product reviews (verbatim) — the grounding gate for every stage. */
const REVIEWS_SLOT: SlotId = 1;

/** Max retries per stage on a transient edge/validation failure (clone: export retry). */
const MAX_STAGE_RETRIES = 2;
/** Base backoff between retries, in ms (doubles each attempt). */
const STAGE_RETRY_BASE_MS = 500;

/** Statuses that count as an evidence-filled reviews slot. */
const EVIDENCE_FILLED: ReadonlySet<ResolvedSlot['status']> = new Set([
  'filled-evidence',
  'filled-stated',
]);

/** Injectable collaborators (default to the live module functions). */
export interface AvatarPipelineDeps {
  resolve: typeof resolveSlots;
  getCurrentArtifact: typeof getCurrentArtifactLive;
  saveArtifact: typeof saveArtifactLive;
  edgeFn: EdgeFnClient;
  /** Sleep seam so tests don't wait on real backoff. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function withDefaults(deps?: Partial<AvatarPipelineDeps>): AvatarPipelineDeps {
  return {
    resolve: deps?.resolve ?? resolveSlots,
    getCurrentArtifact: deps?.getCurrentArtifact ?? getCurrentArtifactLive,
    saveArtifact: deps?.saveArtifact ?? saveArtifactLive,
    edgeFn: deps?.edgeFn ?? new EdgeFnClient(),
    sleep: deps?.sleep ?? defaultSleep,
  };
}

/** A persisted stage outcome (summary the tool surfaces). */
export interface StageArtifactSummary {
  stage: AvatarStage;
  kind: ArtifactKind;
  artifact_id: string;
  grounding: Grounding;
  evidence_ref_count: number;
}

/** Result of running one stage: either a persisted artifact, needs_input, or a failure. */
export type StageResult =
  | { ok: true; status: 'persisted'; summary: StageArtifactSummary }
  | { ok: false; status: 'needs_input'; needs_input: NeedsInputItem[] }
  | { ok: false; status: 'positioning_statement_gated'; note: string }
  | { ok: false; status: 'failed'; note: string };

/** Result of running the full chain: per-stage summaries + any short-circuit. */
export interface PipelineResult {
  ok: boolean;
  stages: StageArtifactSummary[];
  /** Set when the chain stopped early on an unresolved reviews slot. */
  needs_input?: NeedsInputItem[];
  /** Set when the chain stopped at the S5 positioning statement gate (D2/R-015 not signed off). */
  positioning_statement_gated?: string;
  /** Set when a stage failed after retries. */
  failed?: { stage: AvatarStage; note: string };
}

/** Options for a stage/pipeline run. */
export interface RunOptions {
  avatarId?: string | null;
  /** D2/R-015 operator sign-off: required for the S5 positioning statement stage. */
  allowPositioningStatement?: boolean;
}

/** Build the needs_input demand for an unresolved reviews slot (manifest §5 step 4). */
function reviewsNeedsInput(): NeedsInputItem[] {
  return [
    {
      slot: REVIEWS_SLOT,
      question:
        'Paste your product reviews verbatim (or ingest an ASIN/listing). Avatar forensics quote these directly and cannot be invented.',
      why: 'Every S1 vocabulary cluster and S4 verbatim must trace to a real review (manifest §6). Without reviews the engine cannot run in evidence mode.',
    },
  ];
}

/**
 * Detect a `needs_input` body an edge fn returns on HTTP 200 (the fns short-circuit
 * with `{ needs_input: [...] }` when a prior stage is missing — EdgeFnClient wraps
 * that 200 as `ok:true`). Returns the parsed items, or null when the body is a real
 * artifact. Surfacing this (vs letting contract validation fail it as a generic
 * 'failed' and burning retries) turns a genuine grounding gap into the correct
 * short-circuit and makes any future prior-key drift diagnosable.
 */
function extractNeedsInput(data: Record<string, unknown>): NeedsInputItem[] | null {
  const raw = (data as { needs_input?: unknown }).needs_input;
  if (!Array.isArray(raw)) return null;
  const parsed = needsInputSchema.safeParse(raw);
  return parsed.success && parsed.data.length > 0 ? parsed.data : null;
}

/** Pull pasteable review text out of a resolved slot value (string or row array). */
function reviewsToText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  const parts: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      parts.push(entry);
    } else if (entry && typeof entry === 'object') {
      const e = entry as { body?: unknown; text?: unknown; review?: unknown };
      const text = e.body ?? e.text ?? e.review;
      if (typeof text === 'string' && text.trim()) parts.push(text.trim());
    }
  }
  return parts.join('\n\n');
}

/** Resolve the reviews slot; null when unresolved/empty (drives the grounding gate). */
async function resolveReviews(
  deps: AvatarPipelineDeps,
  avatarId: string | null,
): Promise<{ text: string; source: string } | null> {
  const [resolved] = await deps.resolve([REVIEWS_SLOT], { avatarId });
  if (!resolved || !EVIDENCE_FILLED.has(resolved.status) || resolved.value == null) return null;
  const text = reviewsToText(resolved.value);
  if (!text.trim()) return null;
  return { text, source: resolved.source ?? 'evidence' };
}

/**
 * Gather the `prior` bundle for a stage from its dependency artifacts' content.
 *
 * KEYED BY STAGE ID (`s1`/`s2`), NOT artifact kind. The S2/S3/S4 edge fns read prior
 * by stage id (`body.prior.s1`, `body.prior.s2`) — keying by `depSpec.kind`
 * (`avatar_s1_vocab`) made the fns never find s1/s2, return `needs_input`, and the
 * chain short-circuit at S2 (S3/S4/S5 never ran — the "Avatar sheet has only S1+S5"
 * symptom). The artifact `content` IS the shape the fns' `formatS1`/`formatS2` expect
 * (`content.clusters` / `content.job_map`), so `prior[dep] = row.content` is correct.
 */
async function gatherPrior(
  deps: AvatarPipelineDeps,
  spec: StageSpec,
  avatarId: string | null,
): Promise<Record<string, unknown>> {
  const prior: Record<string, unknown> = {};
  for (const dep of spec.dependsOn) {
    const depSpec = STAGES[dep];
    const row = await deps.getCurrentArtifact(depSpec.kind, avatarId);
    if (row) prior[dep] = row.content;
  }
  return prior;
}

/**
 * Strip the grounding envelope the engine echoes back: the artifact store re-derives
 * grounding/evidence_refs authoritatively, so we persist the engine's domain payload
 * with our own envelope. Returns the content the contract validates plus persists.
 */
function withGroundingEnvelope(
  payload: Record<string, unknown>,
  grounding: Grounding,
  evidenceRefs: EvidenceRef[],
): Record<string, unknown> {
  const { grounding: _g, evidence_refs: _e, ...rest } = payload;
  return { ...rest, grounding, evidence_refs: evidenceRefs };
}

/**
 * Run a single forensic stage (s1..s4). Resolves reviews + prior artifacts, invokes the
 * stage edge fn, validates against the contract, and persists with grounding. Retries on
 * transient failure. Returns needs_input when reviews are unresolved (never runs ungrounded).
 */
async function runForensicStage(
  spec: StageSpec,
  opts: RunOptions,
  deps: AvatarPipelineDeps,
): Promise<StageResult> {
  const avatarId = opts.avatarId ?? null;

  const reviews = await resolveReviews(deps, avatarId);
  if (!reviews) {
    return { ok: false, status: 'needs_input', needs_input: reviewsNeedsInput() };
  }

  const grounding: Grounding = 'evidence';
  const evidenceRefs: EvidenceRef[] = [
    { kind: 'review', ref: `reviews slot #${REVIEWS_SLOT} (${reviews.source})` },
  ];
  const contract = CONTRACTS[spec.kind];

  let lastNote = 'no attempt made';
  for (let attempt = 0; attempt <= MAX_STAGE_RETRIES; attempt++) {
    if (attempt > 0) await deps.sleep!(STAGE_RETRY_BASE_MS * 2 ** (attempt - 1));

    const prior = await gatherPrior(deps, spec, avatarId);
    const res = await deps.edgeFn.invoke<Record<string, unknown>>(spec.edgeFn, {
      reviews: reviews.text,
      prior,
    });
    if (!res.ok || !res.data) {
      lastNote = res.note ?? `edge fn ${spec.edgeFn} returned no data`;
      continue;
    }

    // An edge fn that short-circuits with needs_input (HTTP 200, e.g. a missing prior
    // stage) is a grounding gap, not a transient failure: surface it immediately rather
    // than failing the contract and burning retries.
    const needs = extractNeedsInput(res.data);
    if (needs) {
      return { ok: false, status: 'needs_input', needs_input: needs };
    }

    const candidate = withGroundingEnvelope(res.data, grounding, evidenceRefs);
    const parsed = contract.outputSchema.safeParse(candidate);
    if (!parsed.success) {
      lastNote = `engine output failed contract '${spec.kind}': ${parsed.error.message}`;
      continue;
    }

    try {
      const saveOpts: SaveArtifactOptions = { grounding, evidenceRefs, avatarId };
      const row: ArtifactRow = await deps.saveArtifact(spec.kind, parsed.data, saveOpts);
      return {
        ok: true,
        status: 'persisted',
        summary: {
          stage: spec.stage,
          kind: spec.kind,
          artifact_id: row.id,
          grounding,
          evidence_ref_count: evidenceRefs.length,
        },
      };
    } catch (err) {
      lastNote = err instanceof Error ? err.message : 'persist failed';
      continue;
    }
  }

  return { ok: false, status: 'failed', note: lastNote };
}

/**
 * Run the S5 positioning statement stage (D2/R-015 gated). Feeds the persisted evidence reviews into
 * the reveal-positioning-statement engine, maps the flat options into the positioning statement contract shape,
 * and persists. Requires `allowPositioningStatement` (operator sign-off); otherwise reports the gate.
 */
async function runPositioningStatementStage(opts: RunOptions, deps: AvatarPipelineDeps): Promise<StageResult> {
  if (!opts.allowPositioningStatement) {
    return {
      ok: false,
      status: 'positioning_statement_gated',
      note:
        'S5 positioning statement auto-feed is D2/R-015 gated — pass allowPositioningStatement:true only after the operator signs off that customer review vocabulary is not the founder\'s own words (no-parroting preserved).',
    };
  }

  const avatarId = opts.avatarId ?? null;
  const reviews = await resolveReviews(deps, avatarId);
  if (!reviews) {
    return { ok: false, status: 'needs_input', needs_input: reviewsNeedsInput() };
  }

  const spec = STAGES.s5;
  const grounding: Grounding = 'evidence';
  const evidenceRefs: EvidenceRef[] = [
    { kind: 'review', ref: `reviews slot #${REVIEWS_SLOT} (${reviews.source})` },
  ];

  let lastNote = 'no attempt made';
  for (let attempt = 0; attempt <= MAX_STAGE_RETRIES; attempt++) {
    if (attempt > 0) await deps.sleep!(STAGE_RETRY_BASE_MS * 2 ** (attempt - 1));

    const res = await deps.edgeFn.invoke<{ options: unknown }>('reveal-positioning-statement', {
      conversation: [],
      fields: {},
      reviews: reviews.text,
    });
    const options = res.ok && res.data ? res.data.options : null;
    if (!Array.isArray(options) || options.length === 0) {
      lastNote = res.note ?? 'reveal-positioning-statement returned no options';
      continue;
    }

    const content = {
      options: options.map((sentence, index) => ({ option: index + 1, sentence: String(sentence) })),
      grounding,
      evidence_refs: evidenceRefs,
    };
    const parsed = CONTRACTS[spec.kind].outputSchema.safeParse(content);
    if (!parsed.success) {
      lastNote = `positioning statement output failed contract: ${parsed.error.message}`;
      continue;
    }

    try {
      const row = await deps.saveArtifact(spec.kind, parsed.data, { grounding, evidenceRefs, avatarId });
      return {
        ok: true,
        status: 'persisted',
        summary: {
          stage: spec.stage,
          kind: spec.kind,
          artifact_id: row.id,
          grounding,
          evidence_ref_count: evidenceRefs.length,
        },
      };
    } catch (err) {
      lastNote = err instanceof Error ? err.message : 'persist failed';
      continue;
    }
  }
  return { ok: false, status: 'failed', note: lastNote };
}

/** Run a single stage by id (s1..s5). Public entry for the build_avatar_stage tool. */
export async function runStage(
  stage: AvatarStage,
  opts: RunOptions = {},
  deps?: Partial<AvatarPipelineDeps>,
): Promise<StageResult> {
  const resolved = withDefaults(deps);
  if (stage === 's5') return runPositioningStatementStage(opts, resolved);
  return runForensicStage(STAGES[stage], opts, resolved);
}

/**
 * Run the full chain in dependency order: s1 → s2 → {s3, s4} → s5.
 *
 * Stops on the first short-circuit: an unresolved reviews slot surfaces `needs_input`
 * (the whole chain is grounding-blocked); a stage failure surfaces `failed`; the S5 gate
 * (without `allowPositioningStatement`) surfaces `positioning_statement_gated` after S1-S4 persist. S3 and S4
 * run in parallel (both depend only on s1/s2), mirroring the export service's batch shape.
 */
export async function runPipeline(
  opts: RunOptions = {},
  deps?: Partial<AvatarPipelineDeps>,
): Promise<PipelineResult> {
  const resolved = withDefaults(deps);
  const summaries: StageArtifactSummary[] = [];

  // Sequential batches: [s1], [s2], then [s3, s4] in parallel.
  const sequential: AvatarStage[] = ['s1', 's2'];
  for (const stage of sequential) {
    const r = await runForensicStage(STAGES[stage], opts, resolved);
    if (r.status === 'needs_input') return { ok: false, stages: summaries, needs_input: r.needs_input };
    if (r.status === 'failed') return { ok: false, stages: summaries, failed: { stage, note: r.note } };
    if (r.ok) summaries.push(r.summary);
  }

  const parallel: AvatarStage[] = ['s3', 's4'];
  const parallelResults = await Promise.all(parallel.map((s) => runForensicStage(STAGES[s], opts, resolved)));
  for (let i = 0; i < parallel.length; i++) {
    const r = parallelResults[i];
    if (r.status === 'needs_input') return { ok: false, stages: summaries, needs_input: r.needs_input };
    if (r.status === 'failed') return { ok: false, stages: summaries, failed: { stage: parallel[i], note: r.note } };
    if (r.ok) summaries.push(r.summary);
  }

  // S5 positioning statement — D2/R-015 gated. Without sign-off the chain reports the gate and stops.
  const sig = await runPositioningStatementStage(opts, resolved);
  if (sig.status === 'positioning_statement_gated') {
    return { ok: true, stages: summaries, positioning_statement_gated: sig.note };
  }
  if (sig.status === 'needs_input') return { ok: false, stages: summaries, needs_input: sig.needs_input };
  if (sig.status === 'failed') return { ok: false, stages: summaries, failed: { stage: 's5', note: sig.note } };
  if (sig.ok) summaries.push(sig.summary);

  return { ok: true, stages: summaries };
}

/**
 * Layer 2 (tool) — `run_diagnostic_evidence` (OWNED, WRITE, gateWrite — gold Workbook A,
 * sheet 3 "Trust Gap™ Diagnostic", evidence-grounded).
 *
 * C1 — BIND IDENTITY BEFORE THE INTERPRETATION LEG: the first thing this tool does is
 * `gateWrite()`. Resolving slots, invoking the engine, and persisting the artifact all run
 * only for an authenticated caller; the resolver + artifact store then use the JWT-bound
 * RLS client, so every read and write is scoped to `auth.uid()`.
 *
 * Flow:
 *   1. gateWrite() — deny anonymous before any leg runs (C1).
 *   2. Resolve the intake slot (#15, diagnostic_submissions). The diagnostic must actually
 *      have been taken: no intake -> needs_input (never fabricate a diagnostic).
 *   3. Resolve the evidence slots — listing copy (#3) and reviews (#1) — KB-first. Whatever
 *      is evidence-filled is passed to the engine as the `evidence` block; absent slots make
 *      the engine grade that dimension in `inference` mode.
 *   4. Invoke the NEW `diagnostic-interpretation-evidence` edge fn (verbatim wrap) with the
 *      caller-supplied scores + the resolved evidence + owner-intent fields.
 *   5. Validate against the Phase-0 `diagnostic_interpretation` contract (mapping the engine's
 *      rich `where_it_shows_up` citation array into the contract's string column) and persist
 *      the artifact with the engine's grounding envelope.
 *
 * The engine's per-dimension `grounding` flag (evidence when a citation traced to supplied
 * evidence, inference otherwise) is preserved verbatim in `structuredContent` so the caller
 * can surface which reads are evidence-backed; the persisted artifact's top-level grounding
 * follows the engine.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { groundingPreamble } from '../skills/skillLoader.js';
import { EdgeFnClient } from '../edgeFn/client.js';
import { resolve as resolveSlots, type ResolvedSlot } from '../service/contextResolver.js';
import {
  saveArtifact as saveArtifactLive,
  ArtifactStoreError,
  type ArtifactRow,
  type SaveArtifactOptions,
} from '../service/artifactStore.js';
import {
  diagnosticInterpretationOutputSchema,
  ideaDimensionSchema,
  type DiagnosticInterpretationOutput,
  type EvidenceRef,
  type Grounding,
  type NeedsInputItem,
} from '../contracts/index.js';
import type { SlotId } from '../contracts/slots.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag, type Identity } from '../context/identity.js';
import { captureMcpEvent, captureMcpException } from '../posthog.js';

/** Slots this tool resolves: #1 reviews, #3 listing copy, #15 intake answers. */
const REVIEWS_SLOT: SlotId = 1;
const LISTING_SLOT: SlotId = 3;
const INTAKE_SLOT: SlotId = 15;

/** Statuses that count as an evidence/stated fill (enough to cite / to confirm intake). */
const FILLED: ReadonlySet<ResolvedSlot['status']> = new Set(['filled-evidence', 'filled-stated']);

/**
 * Extra engine attempts on a transient failure (a 500 from a JSON shape the fn's tolerant
 * parser could not reconstruct). 2 retries ⇒ up to 3 total attempts, mirroring avatarPipeline.
 */
const MAX_ENGINE_RETRIES = 2;

/** The four IDEA score dimensions the engine takes (its own snake/short keys). */
const fnDimensionSchema = z.enum(['insight', 'distinctive', 'empathetic', 'authentic']);

const inputSchema = {
  scores: z
    .object({
      insight: z.number().min(0).max(25),
      distinctive: z.number().min(0).max(25),
      empathetic: z.number().min(0).max(25),
      authentic: z.number().min(0).max(25),
    })
    .describe('Per-dimension Trust Gap scores out of 25 (same shape the existing diagnostic-interpretation fn takes).'),
  overall: z.number().min(0).max(100).optional().describe('Overall score out of 100; derived from the four if omitted.'),
  primary_gap: fnDimensionSchema.optional().describe('The weakest pillar; derived from the scores if omitted.'),
  avatar_id: z.string().optional().describe('Avatar scope; omit for the brand-level chain.'),
};

/** The engine's response shape (the NEW diagnostic-interpretation-evidence fn). */
interface DiagnosticEvidenceResponse {
  overall_score: number;
  primary_gap: string;
  interpretation: string;
  dimensions: Array<{
    dimension: string;
    score: number;
    what_it_measures: string;
    brand_read: string;
    where_it_shows_up: Array<{ evidence_type: string; quote_or_observation: string }>;
    grounding: 'evidence' | 'inference';
  }>;
  primaryGapSummary: string;
  triage: { recommended_next_module: string; rationale: string };
  grounding: 'evidence' | 'inference';
  evidence_refs: EvidenceRef[];
  error?: string;
  needs_input?: NeedsInputItem[];
}

/** needs_input demand for a missing intake (the diagnostic was never taken). */
function intakeNeedsInput(): NeedsInputItem[] {
  return [
    {
      slot: INTAKE_SLOT,
      question:
        'Complete the Trust Gap intake first. The evidence-grounded diagnostic interprets the scores it produces, so there is nothing to interpret without it.',
      why: 'The diagnostic_interpretation artifact derives from intake answers (slot #15); without a submission there is no diagnostic to ground.',
    },
  ];
}

/** Pull pasteable text out of a resolved evidence slot value (string, row[], or object). */
function evidenceToText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const entry of value) {
      if (typeof entry === 'string') {
        parts.push(entry.trim());
      } else if (entry && typeof entry === 'object') {
        const e = entry as Record<string, unknown>;
        // listing rows (title/bullets/description) or review rows (body/text/review).
        const chunks: string[] = [];
        for (const k of ['title', 'bullets', 'description', 'body', 'text', 'review', 'content']) {
          const v = e[k];
          if (typeof v === 'string' && v.trim()) chunks.push(v.trim());
          else if (Array.isArray(v)) chunks.push(v.filter((x) => typeof x === 'string').join('\n'));
        }
        if (chunks.length) parts.push(chunks.join('\n'));
      }
    }
    return parts.filter(Boolean).join('\n\n').trim();
  }
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
}

/** Resolve a slot and return its evidence text only when it is evidence/stated-filled. */
function filledText(resolved: ResolvedSlot | undefined): string | null {
  if (!resolved || !FILLED.has(resolved.status) || resolved.value == null) return null;
  const text = evidenceToText(resolved.value);
  return text ? text : null;
}

/**
 * Map the engine's rich `where_it_shows_up` citation array into the Phase-0 contract's
 * string column (the committed contract carries `where_it_shows_up: string`, owned by
 * Phase 0 — not editable here), preserving the evidence_type prefix so provenance survives.
 */
function citationsToString(
  citations: Array<{ evidence_type: string; quote_or_observation: string }>,
): string {
  const joined = citations
    .map((c) => `[${c.evidence_type}] ${c.quote_or_observation}`)
    .filter((s) => s.trim())
    .join(' | ');
  return joined || 'No evidence cited for this dimension.';
}

/** Coerce the engine reply into the contract shape (string where_it_shows_up + envelope). */
function toContractArtifact(
  reply: DiagnosticEvidenceResponse,
  grounding: Grounding,
  evidenceRefs: EvidenceRef[],
): DiagnosticInterpretationOutput {
  const dimensions = reply.dimensions.map((d) => ({
    dimension: ideaDimensionSchema.parse(d.dimension),
    score: Math.max(0, Math.min(25, Math.round(d.score))),
    what_it_measures: d.what_it_measures,
    brand_read: d.brand_read,
    where_it_shows_up: citationsToString(d.where_it_shows_up),
  }));
  return diagnosticInterpretationOutputSchema.parse({
    overall_score: reply.overall_score,
    primary_gap: ideaDimensionSchema.parse(reply.primary_gap),
    interpretation: reply.interpretation,
    dimensions,
    recommended_next_module: reply.triage.recommended_next_module,
    recommendation_rationale: reply.triage.rationale,
    grounding,
    evidence_refs: evidenceRefs,
  });
}

/** Injectable collaborators (default to live module fns) so the tool is unit testable. */
export interface RunDiagnosticEvidenceDeps {
  resolve: typeof resolveSlots;
  saveArtifact: typeof saveArtifactLive;
  edgeFn: EdgeFnClient;
}

function withDefaults(deps?: Partial<RunDiagnosticEvidenceDeps>): RunDiagnosticEvidenceDeps {
  return {
    resolve: deps?.resolve ?? resolveSlots,
    saveArtifact: deps?.saveArtifact ?? saveArtifactLive,
    edgeFn: deps?.edgeFn ?? new EdgeFnClient(),
  };
}

/**
 * Register the `run_diagnostic_evidence` tool. `deps` is injectable for tests; production
 * leaves it undefined to bind the live resolver / artifact store / edge client.
 */
export function registerRunDiagnosticEvidenceTool(server: McpServer, deps?: Partial<RunDiagnosticEvidenceDeps>): void {
  const d = withDefaults(deps);
  server.registerTool(
    'run_diagnostic_evidence',
    {
      title: 'Run the evidence-grounded Trust Gap diagnostic',
      description:
        'Write tool: produce the evidence-grounded Trust Gap diagnostic interpretation. Binds identity first (C1), resolves intake (#15) — needs_input if the diagnostic was never taken — plus listing copy (#3) and reviews (#1) KB-first, invokes the diagnostic-interpretation-evidence engine (every where_it_shows_up cites real evidence; dimensions with no evidence are flagged inference), validates against the diagnostic_interpretation contract, and persists the artifact RLS-scoped to the caller. Requires an authenticated Supabase JWT.' + groundingPreamble('run_diagnostic_evidence'),
      inputSchema,
    },
    async ({ scores, overall, primary_gap, avatar_id }) => {
      // C1: bind identity BEFORE any leg (resolve / engine / persist) runs.
      const { identity, denied } = gateWrite();
      if (denied) return denied;
      const avatarId = avatar_id ?? null;

      try {
        // Resolve intake (gate) + evidence slots in one pass.
        const [intake, reviews, listing] = await d.resolve([INTAKE_SLOT, REVIEWS_SLOT, LISTING_SLOT], { avatarId });

        if (!intake || !FILLED.has(intake.status)) {
          safeLog({ event: 'tool.run_diagnostic_evidence.needs_input', caller: userTag(identity), slot: INTAKE_SLOT });
          return needsInputResult(intakeNeedsInput());
        }

        const reviewsText = filledText(reviews);
        const listingText = filledText(listing);
        const evidence: Record<string, string> = {};
        if (listingText) evidence.listing_copy = listingText;
        if (reviewsText) evidence.reviews = reviewsText;

        // Invoke the engine with a bounded retry: Sonnet occasionally emits a JSON shape the
        // fn's tolerant parser cannot reconstruct, surfacing as a transient 500. A needs_input
        // reply is NOT transient and short-circuits immediately (never retried/fabricated).
        const engineBody = { scores, overall, primaryGap: primary_gap, evidence };
        let res = await d.edgeFn.invoke<DiagnosticEvidenceResponse>('diagnostic-interpretation-evidence', engineBody);
        let attempt = 0;
        while (attempt < MAX_ENGINE_RETRIES) {
          if (res.ok && res.data && Array.isArray(res.data.needs_input) && res.data.needs_input.length > 0) break;
          const usable = res.ok && res.data && !res.data.error && Array.isArray(res.data.dimensions) && res.data.dimensions.length > 0;
          if (usable) break;
          attempt += 1;
          res = await d.edgeFn.invoke<DiagnosticEvidenceResponse>('diagnostic-interpretation-evidence', engineBody);
        }

        if (!res.ok || !res.data) {
          return engineUnavailable(identity, res.note);
        }
        // The engine itself may surface needs_input (defensive parity).
        if (Array.isArray(res.data.needs_input) && res.data.needs_input.length > 0) {
          return needsInputResult(res.data.needs_input);
        }
        if (res.data.error || !Array.isArray(res.data.dimensions) || res.data.dimensions.length === 0) {
          return engineUnavailable(identity, res.data.error ?? 'engine returned no dimensions');
        }

        // Grounding follows the engine; evidence mode requires non-empty evidence_refs.
        const grounding: Grounding = res.data.grounding === 'evidence' ? 'evidence' : 'inference';
        const evidenceRefs: EvidenceRef[] =
          grounding === 'evidence' && res.data.evidence_refs.length > 0
            ? res.data.evidence_refs
            : grounding === 'evidence'
              ? [{ kind: 'intake', ref: 'diagnostic_submissions intake + supplied evidence' }]
              : [];

        const artifactContent = toContractArtifact(res.data, grounding, evidenceRefs);
        const saveOpts: SaveArtifactOptions = { grounding, evidenceRefs, avatarId };
        const row: ArtifactRow = await d.saveArtifact('diagnostic_interpretation', artifactContent, saveOpts);

        safeLog({
          event: 'tool.run_diagnostic_evidence',
          caller: userTag(identity),
          grounding,
          has_listing: !!listingText,
          has_reviews: !!reviewsText,
        });
        captureMcpEvent(identity.userId as string, 'mcp_diagnostic_evidence_completed', {
          grounding,
          has_evidence: !!(listingText || reviewsText),
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Evidence-grounded diagnostic persisted (artifact id ${row.id}, grounding ${grounding}). Primary gap: ${res.data.primary_gap}.`,
            },
          ],
          structuredContent: {
            ok: true,
            artifact_id: row.id,
            grounding,
            overall_score: res.data.overall_score,
            primary_gap: res.data.primary_gap,
            // Preserve the engine's per-dimension grounding so the caller can show which
            // reads are evidence-backed vs labeled inference.
            dimensions: res.data.dimensions.map((dim) => ({
              dimension: dim.dimension,
              score: dim.score,
              grounding: dim.grounding,
              where_it_shows_up: dim.where_it_shows_up,
            })),
            primaryGapSummary: res.data.primaryGapSummary,
            triage: res.data.triage,
          },
        };
      } catch (err) {
        const note = err instanceof ArtifactStoreError ? err.message : 'failed to run evidence diagnostic';
        safeLog({ level: 'warn', event: 'tool.run_diagnostic_evidence.failed', caller: userTag(identity) });
        captureMcpException(err, identity.userId as string, { tool: 'run_diagnostic_evidence' });
        return {
          content: [{ type: 'text' as const, text: `run_diagnostic_evidence failed: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}

/** Structured needs_input result (manifest §5 step 4): the calling agent relays it. */
function needsInputResult(needs_input: NeedsInputItem[]) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `run_diagnostic_evidence needs input: ${needs_input.length} unresolved context slot(s).`,
      },
    ],
    structuredContent: { ok: false, needs_input },
  };
}

/** Engine-unavailable result (never-fail shape; no artifact persisted). */
function engineUnavailable(identity: Identity, note?: string) {
  safeLog({ level: 'warn', event: 'tool.run_diagnostic_evidence.unavailable', caller: userTag(identity) });
  return {
    content: [{ type: 'text' as const, text: `run_diagnostic_evidence unavailable: ${note ?? 'empty engine reply'}` }],
    structuredContent: { ok: false, note: note ?? 'empty engine reply' },
    isError: true,
  };
}

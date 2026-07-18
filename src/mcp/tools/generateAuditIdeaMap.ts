/**
 * Layer 2 (tool) — `generate_audit_idea_map` (OWNED, WRITE, gateWrite — gold sheet 7).
 *
 * Produces the "Audit × IDEA" map (Workbook A, sheet 7): for each marketing-audit
 * investment move, the without-IDEA baseline, the with-IDEA upgrade, and a LABELED lift
 * multiplier band. SYNTHESIS over the persisted Brand Canvas (#5 chain) + Export Brief
 * (#6 chain) + (optionally) the current Marketing Audit's investment rows.
 *
 * Resolution / grounding gate (manifest §6 / guardrail #4): the map upgrades IDEA inputs
 * into lift, so it requires the canvas AND brief artifacts to exist. If either is absent
 * the tool returns a structured `needs_input` block (chain incomplete) and never runs the
 * engine ungrounded. The investment rows are optional: when the marketing_audit artifact
 * exists they ground each row in a real move; otherwise the engine uses the canonical
 * IDEA-relevant move set.
 *
 * The lift multiplier is an ESTIMATE: the edge fn enforces a labeled band/range (a single
 * precise figure is replaced) so a fabricated exact multiplier can never leak through.
 *
 * Identity-gated (gateWrite, D5): a write runs only for an authenticated caller; the
 * artifact store's RLS-bound client then scopes every row to `auth.uid()`. Deps are
 * injectable so the orchestration is unit-testable against stubs; they default to the
 * live module functions in production.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CONTRACTS,
  type ArtifactKind,
  type AuditXIdeaOutput,
  type EvidenceRef,
  type Grounding,
  type NeedsInputItem,
} from '../contracts/index.js';
import {
  getCurrentArtifact as getCurrentArtifactLive,
  saveArtifact as saveArtifactLive,
  type ArtifactRow,
  type SaveArtifactOptions,
} from '../service/artifactStore.js';
import { EdgeFnClient, type EdgeFnResult } from '../edgeFn/client.js';
import { gateWrite } from './writeAuth.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';

/** The edge fn that synthesises the map (cloned from the reveal-positioning-statement skeleton). */
const AUDIT_IDEA_EDGE_FN = 'audit-idea-map';
/** The kind this tool persists. */
const KIND: ArtifactKind = 'audit_x_idea';
/** Upstream chain artifacts this map maps over. */
const CANVAS_KIND: ArtifactKind = 'brand_canvas';
const BRIEF_KIND: ArtifactKind = 'export_brief';
const AUDIT_KIND: ArtifactKind = 'marketing_audit';

/** The edge fn's reply, before contract validation. */
interface AuditIdeaEdgeReply {
  rows?: unknown;
  needs_input?: NeedsInputItem[];
  grounding?: Grounding;
  evidence_refs?: EvidenceRef[];
}

/** Injectable collaborators (default to the live module functions). */
export interface AuditIdeaMapDeps {
  getCurrentArtifact: typeof getCurrentArtifactLive;
  saveArtifact: typeof saveArtifactLive;
  edgeFn: EdgeFnClient;
  /** Sleep seam so retry-backoff tests don't wait on real time. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function withDefaults(deps?: Partial<AuditIdeaMapDeps>): AuditIdeaMapDeps {
  return {
    getCurrentArtifact: deps?.getCurrentArtifact ?? getCurrentArtifactLive,
    saveArtifact: deps?.saveArtifact ?? saveArtifactLive,
    edgeFn: deps?.edgeFn ?? new EdgeFnClient(),
    sleep: deps?.sleep ?? defaultSleep,
  };
}

/** Max retries on a TRANSIENT edge-fn failure (mirrors avatarPipeline's stage retry). */
const MAX_EDGE_RETRIES = 2;
/** Base backoff between retries, in ms (doubles each attempt). */
const EDGE_RETRY_BASE_MS = 500;

/**
 * Invoke the map edge fn with bounded retry on a TRANSIENT transport failure (HTTP 5xx /
 * parse error / unreachable — surfaced by EdgeFnClient as `ok:false`). A successful
 * (`ok:true`) reply is returned immediately even when it carries a `needs_input` body:
 * needs_input is a correct refusal the caller relays, NOT a transient failure, so it is
 * never retried. Mirrors the avatarPipeline retry shape (max 2, exponential backoff).
 */
async function invokeWithRetry(
  d: AuditIdeaMapDeps,
  body: unknown,
): Promise<EdgeFnResult<AuditIdeaEdgeReply>> {
  let res = await d.edgeFn.invoke<AuditIdeaEdgeReply>(AUDIT_IDEA_EDGE_FN, body);
  for (let attempt = 1; attempt <= MAX_EDGE_RETRIES && !res.ok; attempt++) {
    await d.sleep!(EDGE_RETRY_BASE_MS * 2 ** (attempt - 1));
    res = await d.edgeFn.invoke<AuditIdeaEdgeReply>(AUDIT_IDEA_EDGE_FN, body);
  }
  return res;
}

/** Outcome of a map run: persisted artifact, needs_input, or a failure. */
export type AuditIdeaMapResult =
  | { ok: true; status: 'persisted'; artifact_id: string; grounding: Grounding; row_count: number }
  | { ok: false; status: 'needs_input'; needs_input: NeedsInputItem[] }
  | { ok: false; status: 'failed'; note: string };

/** needs_input for an incomplete chain (canvas/brief not yet built). */
function chainNeedsInput(missing: string[]): NeedsInputItem[] {
  return [
    {
      slot: 1,
      question: `Build the ${missing.join(' and ')} first. The Audit × IDEA map shows how IDEA inputs upgrade each marketing move, so it needs those artifacts to exist.`,
      why: 'Every with_idea cell and its lift estimate must reference the actual Positioning Statement, vocabulary clusters, and keywords from the canvas/brief. Without them the mapping has nothing to upgrade.',
    },
  ];
}

const inputSchema = {
  avatar_id: z.string().optional().describe('Avatar scope; omit for the brand-level chain.'),
};

/**
 * Run the map: resolve canvas + brief (+ optional investments), invoke the edge fn,
 * validate against the `audit_x_idea` contract, and persist. Pure orchestration over the
 * injected deps so it is unit-testable; the tool wraps it with the gateWrite check.
 */
export async function runAuditIdeaMap(
  avatarId: string | null,
  deps?: Partial<AuditIdeaMapDeps>,
): Promise<AuditIdeaMapResult> {
  const d = withDefaults(deps);

  // Resolve the upstream chain artifacts. Canvas AND brief are required.
  const canvasRow = await d.getCurrentArtifact(CANVAS_KIND, avatarId);
  const briefRow = await d.getCurrentArtifact(BRIEF_KIND, avatarId);
  const missing: string[] = [];
  if (!canvasRow) missing.push('Brand Canvas');
  if (!briefRow) missing.push('Export Brief');
  if (missing.length > 0) {
    return { ok: false, status: 'needs_input', needs_input: chainNeedsInput(missing) };
  }

  // Optional: the marketing_audit's investment rows ground each mapped move in a real move.
  const auditRow = await d.getCurrentArtifact(AUDIT_KIND, avatarId);

  // Bounded retry on transient transport failure; needs_input is relayed, not retried.
  const res = await invokeWithRetry(d, {
    canvas: canvasRow!.content,
    brief: briefRow!.content,
    investments: auditRow ? auditRow.content : null,
  });

  if (!res.ok || !res.data) {
    return { ok: false, status: 'failed', note: res.note ?? `edge fn ${AUDIT_IDEA_EDGE_FN} returned no data` };
  }
  // The edge fn returns needs_input when it judges the chain incomplete; relay it.
  if (Array.isArray(res.data.needs_input) && res.data.needs_input.length > 0) {
    return { ok: false, status: 'needs_input', needs_input: res.data.needs_input };
  }

  // Grounding: the brief is built on the avatar evidence chain, so a brief-backed map is
  // evidence-grounded; evidence_refs cite the upstream artifacts.
  const grounding: Grounding = res.data.grounding === 'inference' ? 'inference' : 'evidence';
  const evidenceRefs: EvidenceRef[] = [
    { kind: 'artifact', ref: CANVAS_KIND },
    { kind: 'artifact', ref: BRIEF_KIND },
  ];

  const candidate = {
    rows: res.data.rows,
    grounding,
    evidence_refs: evidenceRefs,
  };
  const parsed = CONTRACTS[KIND].outputSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, status: 'failed', note: `engine output failed contract '${KIND}': ${parsed.error.message}` };
  }

  try {
    const saveOpts: SaveArtifactOptions = { grounding, evidenceRefs, avatarId };
    const row: ArtifactRow = await d.saveArtifact(KIND, parsed.data, saveOpts);
    const rowCount = (parsed.data as AuditXIdeaOutput).rows.length;
    return { ok: true, status: 'persisted', artifact_id: row.id, grounding, row_count: rowCount };
  } catch (err) {
    return { ok: false, status: 'failed', note: err instanceof Error ? err.message : 'persist failed' };
  }
}

export function registerGenerateAuditIdeaMapTool(server: McpServer, deps?: Partial<AuditIdeaMapDeps>): void {
  server.registerTool(
    'generate_audit_idea_map',
    {
      title: 'Generate the Audit × IDEA map',
      description:
        'Write tool: produce the Audit × IDEA map (gold sheet 7) — for each marketing-audit move, the without-IDEA baseline, the with-IDEA upgrade, and a LABELED lift multiplier band. Synthesises over the persisted Brand Canvas + Export Brief (+ optional Marketing Audit investment rows), validates against the audit_x_idea contract, and persists an artifact (RLS-scoped). Returns needs_input when the canvas/brief chain is incomplete (never runs ungrounded). Lift multipliers are labeled estimate bands, never precise fabrications. Requires an authenticated Supabase JWT.',
      inputSchema,
    },
    async ({ avatar_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;
      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      const result = await runAuditIdeaMap(avatar_id ?? null, deps);

      safeLog({
        event: 'tool.generate_audit_idea_map',
        caller: userTag(identity),
        status: result.status,
      });

      if (result.status === 'persisted') {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Audit × IDEA map persisted (${result.row_count} row(s), artifact id ${result.artifact_id}, grounding ${result.grounding}).`,
            },
          ],
          structuredContent: {
            ok: true,
            artifact_id: result.artifact_id,
            grounding: result.grounding,
            row_count: result.row_count,
          },
        };
      }

      if (result.status === 'needs_input') {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Audit × IDEA map needs input: ${result.needs_input.length} unresolved item(s) (chain incomplete).`,
            },
          ],
          structuredContent: { ok: false, needs_input: result.needs_input },
        };
      }

      // failed
      return {
        content: [{ type: 'text' as const, text: `generate_audit_idea_map failed: ${result.note}` }],
        structuredContent: { ok: false, note: result.note },
        isError: true,
      };
    },
  );
}

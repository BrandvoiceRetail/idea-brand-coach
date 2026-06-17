/**
 * Layer 2 (tool) — `generate_canvas` (OWNED, WRITE, gateWrite — gold Workbook A sheet 5).
 *
 * Compiles the Brand Canvas from the persisted artifact chain: the chosen `signature`
 * artifact + the Avatar 2.0 S1-S4 forensic artifacts + the owner-intent slots (positioning
 * intent #12, voice preferences #13, target-customer beliefs #14). It invokes the
 * `brand-canvas` edge fn verbatim (Calculation Parity), validates the reply against the
 * Phase-0 `brand_canvas` contract, and persists it as a `brand_canvas` artifact (RLS-scoped).
 *
 * Grounding gate (manifest §6 / guardrail #4): without a chosen Signature artifact the tool
 * NEVER calls the engine — it returns a structured `needs_input` block the calling agent
 * relays (the avatar pipeline / persist_signature fills it). The canvas carries positioning
 * and voice only (no PRODUCT-TRUTH claims), so no claim gate runs here; the gate lives in
 * generate_brief.
 *
 * Identity-gated (gateWrite, D5): a write runs only for an authenticated caller; the
 * artifact store's RLS-bound client then scopes the row to `auth.uid()`.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { EdgeFnClient, type EdgeFnResult } from '../edgeFn/client.js';
import {
  brandCanvasContract,
  type BrandCanvasOutput,
  type EvidenceRef,
  type Grounding,
  type NeedsInputItem,
} from '../contracts/index.js';
import { resolve as resolveSlots } from '../service/contextResolver.js';
import {
  getCurrentArtifact as getCurrentArtifactLive,
  saveArtifact as saveArtifactLive,
} from '../service/artifactStore.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

/** Injectable collaborators (default to the live module functions; stubbed in tests). */
export interface GenerateCanvasDeps {
  resolve: typeof resolveSlots;
  getCurrentArtifact: typeof getCurrentArtifactLive;
  saveArtifact: typeof saveArtifactLive;
  edgeFn: EdgeFnClient;
  /** Sleep seam so retry-backoff tests don't wait on real time. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function withDefaults(deps?: Partial<GenerateCanvasDeps>): GenerateCanvasDeps {
  return {
    resolve: deps?.resolve ?? resolveSlots,
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
 * Invoke an edge fn with bounded retry on a TRANSIENT transport failure (HTTP 5xx /
 * parse error / unreachable — surfaced by EdgeFnClient as `ok:false`). A successful
 * (`ok:true`) reply is returned immediately even when it carries a `needs_input` body:
 * needs_input is a correct refusal the caller handles, NOT a transient failure, so it is
 * never retried. Mirrors the avatarPipeline retry shape (max 2, exponential backoff).
 */
async function invokeWithRetry(
  deps: GenerateCanvasDeps,
  fn: string,
  body: unknown,
): Promise<EdgeFnResult<Record<string, unknown>>> {
  let res = await deps.edgeFn.invoke<Record<string, unknown>>(fn, body);
  for (let attempt = 1; attempt <= MAX_EDGE_RETRIES && !res.ok; attempt++) {
    await deps.sleep!(EDGE_RETRY_BASE_MS * 2 ** (attempt - 1));
    res = await deps.edgeFn.invoke<Record<string, unknown>>(fn, body);
  }
  return res;
}

const inputSchema = {
  avatar_id: z.string().optional().describe('Avatar scope; omit for the brand-level chain.'),
};

/** needs_input demand for a missing chosen Signature (the canvas root). */
function signatureNeedsInput(): NeedsInputItem[] {
  return [
    {
      slot: 1,
      question:
        'Choose a Signature first: run the Avatar chain through S5 (build_avatar_stage with allow_signature) and persist your pick with persist_signature. The Brand Canvas is built around the chosen Signature.',
      why: 'The canvas signature line, positioning, promise, and story spine all derive from the chosen Signature artifact.',
    },
  ];
}

/** Pull the owner-intent value out of a resolved slot, or undefined when unfilled. */
function intentValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = Array.isArray(value) ? value.join(', ') : String(value);
  return text.trim() ? text.trim() : undefined;
}

/**
 * Run the canvas generation: resolve the chain + owner-intent, short-circuit to needs_input
 * if the Signature is absent, invoke the engine, validate, and persist. Exported so the test
 * can drive it with stubs without the MCP transport.
 */
export async function runGenerateCanvas(
  avatarId: string | null,
  deps: GenerateCanvasDeps,
): Promise<
  | { status: 'persisted'; artifactId: string; grounding: Grounding; content: BrandCanvasOutput }
  | { status: 'needs_input'; needs_input: NeedsInputItem[] }
  | { status: 'failed'; note: string }
> {
  // 1. The chosen Signature is the canvas root — without it, ask (never run ungrounded).
  const signatureRow = await deps.getCurrentArtifact('signature', avatarId);
  if (!signatureRow) {
    return { status: 'needs_input', needs_input: signatureNeedsInput() };
  }

  // 2. Gather the forensic chain artifacts (best-effort; the engine grounds on what exists).
  const [s1, s2, s3, s4] = await Promise.all([
    deps.getCurrentArtifact('avatar_s1_vocab', avatarId),
    deps.getCurrentArtifact('avatar_s2_jobmap', avatarId),
    deps.getCurrentArtifact('avatar_s3_triggers', avatarId),
    deps.getCurrentArtifact('avatar_s4_objections', avatarId),
  ]);

  // 3. Resolve owner-intent slots (#12 positioning, #13 voice, #14 beliefs) KB-first.
  const [positioning, voice, beliefs] = await deps.resolve([12, 13, 14], { avatarId });
  const ownerIntent: Record<string, unknown> = {};
  const pv = intentValue(positioning?.value);
  const vv = intentValue(voice?.value);
  const bv = intentValue(beliefs?.value);
  if (pv) ownerIntent.positioning_intent = pv;
  if (vv) ownerIntent.voice_preferences = vv;
  if (bv) ownerIntent.target_customer_beliefs = bv;

  // 4. Invoke the engine verbatim (bounded retry on transient transport failure).
  const res = await invokeWithRetry(deps, 'brand-canvas', {
    signature: signatureRow.content,
    s1: s1?.content ?? null,
    s2: s2?.content ?? null,
    s3: s3?.content ?? null,
    s4: s4?.content ?? null,
    owner_intent: Object.keys(ownerIntent).length > 0 ? ownerIntent : undefined,
  });

  if (!res.ok || !res.data) {
    return { status: 'failed', note: res.note ?? 'brand-canvas engine returned no data' };
  }

  // The engine may itself return needs_input (e.g. no usable signature text).
  if (Array.isArray((res.data as { needs_input?: unknown }).needs_input)) {
    return { status: 'needs_input', needs_input: (res.data as { needs_input: NeedsInputItem[] }).needs_input };
  }

  // 5. Derive grounding/evidence_refs authoritatively (the store re-validates the invariant).
  const grounding: Grounding =
    (res.data.grounding === 'inference' ? 'inference' : 'evidence') as Grounding;
  const evidenceRefs: EvidenceRef[] = Array.isArray(res.data.evidence_refs)
    ? (res.data.evidence_refs as EvidenceRef[])
    : [{ kind: 'artifact', ref: 'signature' }];

  // 6. Validate against the Phase-0 contract before persisting.
  const candidate = { ...res.data, grounding, evidence_refs: evidenceRefs };
  const parsed = brandCanvasContract.outputSchema.safeParse(candidate);
  if (!parsed.success) {
    return { status: 'failed', note: `engine output failed contract 'brand_canvas': ${parsed.error.message}` };
  }

  // 7. Persist (RLS-scoped, insert-then-supersede).
  try {
    const row = await deps.saveArtifact('brand_canvas', parsed.data, { grounding, evidenceRefs, avatarId });
    return { status: 'persisted', artifactId: row.id, grounding, content: parsed.data };
  } catch (err) {
    return { status: 'failed', note: err instanceof Error ? err.message : 'persist failed' };
  }
}

export function registerGenerateCanvasTool(server: McpServer, deps?: Partial<GenerateCanvasDeps>): void {
  const resolved = withDefaults(deps);
  server.registerTool(
    'generate_canvas',
    {
      title: 'Generate the Brand Canvas',
      description:
        'Write tool: compile the Brand Canvas (gold sheet 5) from the chosen Signature + the Avatar 2.0 S1-S4 artifacts + owner-intent slots. Invokes the brand-canvas engine verbatim, validates against the brand_canvas contract, and persists an artifact (RLS-scoped). Returns needs_input when no chosen Signature exists (never runs ungrounded). Requires an authenticated Supabase JWT.',
      inputSchema,
    },
    async ({ avatar_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const result = await runGenerateCanvas(avatar_id ?? null, resolved);
      safeLog({ event: 'tool.generate_canvas', caller: userTag(identity), status: result.status });

      if (result.status === 'persisted') {
        captureMcpEvent(identity.userId as string, 'mcp_canvas_generated', { grounding: result.grounding });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Brand Canvas persisted (artifact id ${result.artifactId}, grounding ${result.grounding}).`,
            },
          ],
          structuredContent: { ok: true, artifact_id: result.artifactId, grounding: result.grounding, canvas: result.content },
        };
      }

      if (result.status === 'needs_input') {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Brand Canvas needs input: ${result.needs_input.length} unresolved context slot(s).`,
            },
          ],
          structuredContent: { ok: false, needs_input: result.needs_input },
        };
      }

      return {
        content: [{ type: 'text' as const, text: `generate_canvas failed: ${result.note}` }],
        structuredContent: { ok: false, note: result.note },
        isError: true,
      };
    },
  );
}

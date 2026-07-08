/**
 * Layer 2 (tool) — `generate_brief` (OWNED, WRITE, gateWrite — gold Workbook A sheet 6).
 *
 * Compiles the Export Brief (title formula + 5 bullets + 7-slot image brief + PPC tiers)
 * from the persisted `brand_canvas` artifact + the Avatar 2.0 S1/S3/S4 artifacts + the
 * PRODUCT-TRUTH product-claims slot (#6). It invokes the `export-brief` edge fn verbatim,
 * validates against the Phase-0 `export_brief` contract, then runs the DETERMINISTIC
 * claim gate (manifest §6) before persisting.
 *
 * TWO grounding gates (manifest §6 / guardrail #4):
 *  1. Pre-call: the product-claims slot (#6) MUST resolve to filled-evidence/filled-stated.
 *     If it is missing/inferred/conflict/stale, the tool returns needs_input asking the
 *     owner to confirm the product facts and policies — the engine never runs without a
 *     confirmed-claims allowlist (so it cannot be tempted to invent capacity/guarantees).
 *  2. Post-call: even with an allowlist, the produced copy is re-scanned by `scanBrief`.
 *     Any PRODUCT-TRUTH / policy claim NOT covered by the confirmed allowlist (the gold
 *     "30-DAY GUARANTEE" / "Holds 432 Cards" / "PSA-slab compatible" hazard) BLOCKS the
 *     persist and is surfaced as a needs_input question per claim. With the claim confirmed
 *     the next run passes.
 *
 * Identity-gated (gateWrite, D5); the artifact store's RLS-bound client scopes the row.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { appGroundingPreamble } from '../skills/appSkills.js';
import { EdgeFnClient, type EdgeFnResult } from '../edgeFn/client.js';
import {
  exportBriefContract,
  type ExportBriefOutput,
  type EvidenceRef,
  type Grounding,
  type NeedsInputItem,
} from '../contracts/index.js';
import { resolve as resolveSlots, type ResolvedSlot } from '../service/contextResolver.js';
import {
  getCurrentArtifact as getCurrentArtifactLive,
  saveArtifact as saveArtifactLive,
} from '../service/artifactStore.js';
import { getLatestDecisionTrigger as getLatestDecisionTriggerLive } from '../service/decisionTriggerStore.js';
import { scanBrief, detectBriefClaims, type ConfirmedClaim, type ClaimViolation } from '../service/claimGate.js';
import { gateWrite } from './writeAuth.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

/** Slot #6 — product claims (capacity, materials, compatibility, guarantees/policies). */
const PRODUCT_CLAIMS_SLOT = 6 as const;

/** Statuses that count as a confirmed product-claims slot (filled-evidence/owner-stated). */
const CONFIRMED_STATUSES: ReadonlySet<ResolvedSlot['status']> = new Set(['filled-evidence', 'filled-stated']);

/** Injectable collaborators (default to the live module functions; stubbed in tests). */
export interface GenerateBriefDeps {
  resolve: typeof resolveSlots;
  getCurrentArtifact: typeof getCurrentArtifactLive;
  saveArtifact: typeof saveArtifactLive;
  getLatestDecisionTrigger: typeof getLatestDecisionTriggerLive;
  edgeFn: EdgeFnClient;
  /** Sleep seam so retry-backoff tests don't wait on real time. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function withDefaults(deps?: Partial<GenerateBriefDeps>): GenerateBriefDeps {
  return {
    resolve: deps?.resolve ?? resolveSlots,
    getCurrentArtifact: deps?.getCurrentArtifact ?? getCurrentArtifactLive,
    saveArtifact: deps?.saveArtifact ?? saveArtifactLive,
    getLatestDecisionTrigger: deps?.getLatestDecisionTrigger ?? getLatestDecisionTriggerLive,
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
 * (`ok:true`) reply is returned immediately even when it carries a `needs_input` body or
 * triggers the claim gate downstream: those are correct refusals the caller handles, NOT
 * transient failures, so they are never retried. Mirrors the avatarPipeline retry shape.
 */
async function invokeWithRetry(
  deps: GenerateBriefDeps,
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

/** needs_input demand when no positioning root exists (canvas, trigger, or signature). */
function canvasNeedsInput(): NeedsInputItem[] {
  return [
    {
      slot: 1,
      question:
        'Create a Brand Canvas (generate_canvas) for the fullest positioning, or identify a Decision Trigger (identify_decision_trigger), or generate a Signature (generate_signature) first. The Export Brief needs at least one positioning root.',
      why: 'The title formula, bullets, image brief, and PPC tiers all derive from your brand positioning — held in the Brand Canvas, Decision Trigger, or Signature.',
    },
  ];
}

/** needs_input demand for an unconfirmed product-claims slot (#6). */
function claimsNeedsInput(status: string): NeedsInputItem[] {
  return [
    {
      slot: PRODUCT_CLAIMS_SLOT,
      question:
        'Confirm your exact product facts and policies before we write copy: capacity, materials, compatibility (e.g. PSA-slab fit), and return/guarantee terms. FABRICATION-GATED — these may never appear in copy unconfirmed.',
      why: `The bullets assert PRODUCT-TRUTH claims (capacity numbers, compatibility, guarantees). Slot #6 is currently '${status}', not owner-confirmed, so the brief cannot be written without inventing facts.`,
    },
  ];
}

/** Turn each claim-gate violation into a per-claim confirmation question (manifest §6). */
function violationsToNeedsInput(violations: ClaimViolation[]): NeedsInputItem[] {
  return violations.map((v) => ({
    slot: PRODUCT_CLAIMS_SLOT,
    question: `Confirm or remove this ${v.category.replace('_', '/')} claim before we publish it: "${v.fragment}". Is it accurate, and is it a policy you can stand behind?`,
    why: `${v.reason} It appeared in ${v.location} but is not covered by a confirmed claim.`,
    current_guess: v.fragment,
  }));
}

/**
 * Normalise the resolved product-claims slot value into a ConfirmedClaim[] allowlist.
 * Accepts a string (one claim per line / blank-line separated), a string[], or an array of
 * `{claim, source}` / `{text}` objects. Source defaults to the resolved store name.
 */
function toConfirmedClaims(value: unknown, source: string): ConfirmedClaim[] {
  const out: ConfirmedClaim[] = [];
  const push = (claim: string, src?: string): void => {
    const c = claim.trim();
    if (c) out.push({ claim: c, source: src?.trim() || source });
  };
  if (typeof value === 'string') {
    for (const line of value.split(/\n{2,}|\n|;/)) push(line);
  } else if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string') push(entry);
      else if (entry && typeof entry === 'object') {
        const e = entry as { claim?: unknown; text?: unknown; source?: unknown };
        const claim = typeof e.claim === 'string' ? e.claim : typeof e.text === 'string' ? e.text : '';
        push(claim, typeof e.source === 'string' ? e.source : undefined);
      }
    }
  } else if (value && typeof value === 'object') {
    // A structured_data object: take every string-valued field as a claim.
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'string') push(v, k);
    }
  }
  return out;
}

/** The discriminated result of a brief generation run. */
export type GenerateBriefResult =
  | { status: 'persisted'; artifactId: string; grounding: Grounding; content: ExportBriefOutput; needs_confirmation: string[] }
  | { status: 'needs_input'; needs_input: NeedsInputItem[]; reason: 'no_canvas' | 'claims_unconfirmed' | 'claim_violations' }
  | { status: 'failed'; note: string };

/**
 * Run brief generation: resolve canvas + product-claims, gate, invoke, validate, claim-scan,
 * persist. Exported so the test can drive it with stubs without the MCP transport.
 */
export async function runGenerateBrief(avatarId: string | null, deps: GenerateBriefDeps): Promise<GenerateBriefResult> {
  // 1. The brief root priority: Brand Canvas > Decision Trigger > Signature.
  //    Canvas is the fullest positioning; trigger is weaker but evidence-derived;
  //    signature is the fallback. Only ask when NO positioning source exists.
  const [canvasRow, signatureRow, decisionTriggerRow] = await Promise.all([
    deps.getCurrentArtifact('brand_canvas', avatarId),
    deps.getCurrentArtifact('signature', avatarId),
    deps.getLatestDecisionTrigger(avatarId),
  ]);
  if (!canvasRow && !decisionTriggerRow && !signatureRow) {
    return { status: 'needs_input', needs_input: canvasNeedsInput(), reason: 'no_canvas' };
  }

  // 2. The product-claims slot (#6) MUST be owner-confirmed BEFORE the engine runs.
  const [claimsSlot] = await deps.resolve([PRODUCT_CLAIMS_SLOT], { avatarId });
  if (!claimsSlot || !CONFIRMED_STATUSES.has(claimsSlot.status)) {
    return { status: 'needs_input', needs_input: claimsNeedsInput(claimsSlot?.status ?? 'missing'), reason: 'claims_unconfirmed' };
  }
  const confirmedClaims = toConfirmedClaims(claimsSlot.value, claimsSlot.source ?? 'evidence');

  // 3. Gather the supporting forensic artifacts (best-effort).
  const [s1, s3, s4] = await Promise.all([
    deps.getCurrentArtifact('avatar_s1_vocab', avatarId),
    deps.getCurrentArtifact('avatar_s3_triggers', avatarId),
    deps.getCurrentArtifact('avatar_s4_objections', avatarId),
  ]);

  // 4. Invoke the engine verbatim, passing the confirmed-claims allowlist and trigger
  //    (bounded retry on transient transport failure; needs_input / claim-gate blocks are not retried).
  const res = await invokeWithRetry(deps, 'export-brief', {
    canvas: canvasRow?.content ?? null,
    signature: signatureRow?.content ?? null,
    trigger: decisionTriggerRow?.content ?? null,
    s1: s1?.content ?? null,
    s3: s3?.content ?? null,
    s4: s4?.content ?? null,
    confirmed_claims: confirmedClaims,
  });

  if (!res.ok || !res.data) {
    return { status: 'failed', note: res.note ?? 'export-brief engine returned no data' };
  }
  if (Array.isArray((res.data as { needs_input?: unknown }).needs_input)) {
    return {
      status: 'needs_input',
      needs_input: (res.data as { needs_input: NeedsInputItem[] }).needs_input,
      reason: 'no_canvas',
    };
  }

  // 5. Validate against the Phase-0 contract.
  const grounding: Grounding = (res.data.grounding === 'inference' ? 'inference' : 'evidence') as Grounding;
  const evidenceRefs: EvidenceRef[] = Array.isArray(res.data.evidence_refs)
    ? (res.data.evidence_refs as EvidenceRef[])
    : [{ kind: 'artifact', ref: canvasRow ? 'brand_canvas' : decisionTriggerRow ? 'decision_trigger' : 'signature' }];
  const candidate = { ...res.data, grounding, evidence_refs: evidenceRefs };
  const parsed = exportBriefContract.outputSchema.safeParse(candidate);
  if (!parsed.success) {
    return { status: 'failed', note: `engine output failed contract 'export_brief': ${parsed.error.message}` };
  }

  // 6. DETERMINISTIC claim gate (manifest §6). Any ungated PRODUCT-TRUTH/policy claim in the
  //    produced copy BLOCKS the persist and is surfaced as a per-claim confirmation question.
  const verdict = scanBrief(parsed.data, confirmedClaims);
  if (!verdict.ok) {
    return { status: 'needs_input', needs_input: violationsToNeedsInput(verdict.violations), reason: 'claim_violations' };
  }

  // 7. Persist (RLS-scoped, insert-then-supersede).
  try {
    const row = await deps.saveArtifact('export_brief', parsed.data, { grounding, evidenceRefs, avatarId });
    return { status: 'persisted', artifactId: row.id, grounding, content: parsed.data, needs_confirmation: detectBriefClaims(parsed.data, confirmedClaims) };
  } catch (err) {
    return { status: 'failed', note: err instanceof Error ? err.message : 'persist failed' };
  }
}

export function registerGenerateBriefTool(server: McpServer, deps?: Partial<GenerateBriefDeps>): void {
  const resolved = withDefaults(deps);
  server.registerTool(
    'generate_brief',
    {
      title: 'Generate the Export Brief',
      description:
        'Write tool: compile the Export Brief (gold sheet 6 — title formula, 5 bullets, 7-slot image brief, PPC tiers) from the Brand Canvas — or, when no canvas exists yet, your chosen Signature (so the owner gets a shippable brief today, not canvas homework) — plus Avatar S1/S3/S4 + the product-claims slot (#6). The product-claims slot MUST be owner-confirmed (filled-evidence/filled-stated) or the tool returns needs_input. After generation a deterministic claim gate re-scans the copy: any PRODUCT-TRUTH/policy claim (capacity, compatibility, guarantee) not in the confirmed allowlist BLOCKS persistence and is surfaced as a confirmation question (the gold 30-DAY GUARANTEE hazard). CONNECTOR (conversational) mode: address the brief TO THE DESIGNER OR VA so the owner can paste-and-forward it without rewriting (not a note back to the owner); open with "Here is a brief you can send directly to your designer or VA. It does not require any additional explanation from you." — plain commercial language only, no framework terms or buyer-state names. If the owner asks for ONE component (image brief, a headline, a single bullet, or the placement line), produce ONLY that component — one component done precisely beats a full brief done approximately. A compliance net flags warranty/guarantee, health/medical, and unverifiable-superlative phrasing (returned as needs_confirmation in structuredContent) so the owner confirms each claim before forwarding. Requires an authenticated Supabase JWT.' + appGroundingPreamble('generate_brief'),
      inputSchema,
    },
    async ({ avatar_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;
      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      const result = await runGenerateBrief(avatar_id ?? null, resolved);
      safeLog({
        event: 'tool.generate_brief',
        caller: userTag(identity),
        status: result.status,
        reason: result.status === 'needs_input' ? result.reason : undefined,
      });

      if (result.status === 'persisted') {
        captureMcpEvent(identity.userId as string, 'mcp_brief_generated', { grounding: result.grounding });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Export Brief persisted (artifact id ${result.artifactId}, grounding ${result.grounding}).`,
            },
          ],
          structuredContent: { ok: true, artifact_id: result.artifactId, grounding: result.grounding, brief: result.content, needs_confirmation: result.needs_confirmation },
        };
      }

      if (result.status === 'needs_input') {
        if (result.reason === 'claim_violations') {
          captureMcpEvent(identity.userId as string, 'mcp_brief_claim_blocked', {
            violations: result.needs_input.length,
          });
        }
        return {
          content: [
            {
              type: 'text' as const,
              text:
                result.reason === 'claim_violations'
                  ? `Export Brief blocked by the fabrication gate: ${result.needs_input.length} unconfirmed product/policy claim(s) must be confirmed before publishing.`
                  : `Export Brief needs input: ${result.needs_input.length} unresolved context slot(s).`,
            },
          ],
          structuredContent: { ok: false, reason: result.reason, needs_input: result.needs_input },
        };
      }

      return {
        content: [{ type: 'text' as const, text: `generate_brief failed: ${result.note}` }],
        structuredContent: { ok: false, note: result.note },
        isError: true,
      };
    },
  );
}

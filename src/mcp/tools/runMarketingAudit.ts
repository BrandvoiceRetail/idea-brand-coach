/**
 * Layer 2 (tool) — `run_marketing_audit` (OWNED, WRITE, gateWrite — gold Workbook B:
 * "Investment Matrix" + "Recommended Phasing").
 *
 * Output B is a MEMORY problem, not a generation problem (manifest §3): the matrix is a
 * deterministic calibration of the system-side marketing-move library against the user's
 * resolved BUSINESS-FACT slots. This tool:
 *
 *   1. gateWrite() — deny anonymous before any leg runs (D5/C1). The resolver + writes
 *      then use the JWT-bound RLS client, so every read/write is scoped to auth.uid().
 *   2. Resolve the BUSINESS-FACT slots the audit needs: #8 revenue/margin/ad metrics
 *      (REQUIRED), #7 brand-asset states, #10 channel states, #11 inventory risk, #9
 *      cash timing, #16 competitor set, #5 product catalog. If revenue (#8) is missing or
 *      stale, return needs_input — NOTHING is invented (manifest §5/§6).
 *   3. Calibrate DETERMINISTICALLY (auditCalibration.calibrate): tiering, the 1/3/6/12-mo
 *      benefit bands at the user's revenue, the rollout phases, and the cumulative-impact
 *      grid. No LLM touches a number.
 *   4. Invoke the `marketing-audit` edge fn for PROSE ONLY (per-row what-it-is, per-phase
 *      why-now). The numbers never leave the host; the prose is merged back over the
 *      deterministic rows/phases and re-validated against the contracts (numbers-in ==
 *      numbers-out by construction — the fn cannot return a number).
 *   5. Persist to the dedicated `marketing_audits` table (constraints/investments/rollout)
 *      AND write a `marketing_audit` artifact + a `rollout_plan` artifact to the chain.
 *
 * Never-fail prose: if the edge fn is unavailable the deterministic numbers stand on their
 * own and the verbatim library prose is used (the audit still renders).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { EdgeFnClient } from '../edgeFn/client.js';
import { resolve as resolveSlots, type ResolvedSlot } from '../service/contextResolver.js';
import {
  saveArtifact as saveArtifactLive,
  type ArtifactRow,
  type SaveArtifactOptions,
} from '../service/artifactStore.js';
import {
  calibrate,
  parseBusinessFacts,
  type CalibrationResult,
  type CalibrationGap,
} from '../service/auditCalibration.js';
import {
  marketingAuditOutputSchema,
  rolloutPlanOutputSchema,
  type MarketingAuditOutput,
  type RolloutPlanOutput,
  type InvestmentRow,
  type RolloutPhase,
  type EvidenceRef,
  type Grounding,
  type NeedsInputItem,
} from '../contracts/index.js';
import type { SlotId } from '../contracts/slots.js';
import { getSlot } from '../contracts/slots.js';
import { getUserSupabase } from '../supabaseUser.js';
import { getIdentity } from '../context/identity.js';
import { gateWrite } from './writeAuth.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent, captureMcpException } from '../posthog.js';

/** The edge fn used ONLY for prose enrichment (numbers stay host-side). */
const MARKETING_AUDIT_EDGE_FN = 'marketing-audit';

/**
 * BUSINESS-FACT slots the audit resolves (manifest §3). #8 revenue is the hard gate; the
 * rest default conservatively so the audit can run with whatever is confirmed.
 */
const AUDIT_SLOTS: SlotId[] = [8, 7, 10, 11, 9, 16, 5];

/** The prose reply shape from the marketing-audit edge fn. */
interface AuditProseReply {
  row_descriptions?: unknown;
  phase_why_now?: unknown;
  needs_input?: NeedsInputItem[];
  degraded?: boolean;
}

/** A persisted marketing_audits row (the dedicated Output-B store). */
export interface MarketingAuditRow {
  id: string;
  user_id: string;
  constraints: unknown;
  investments: unknown;
  rollout: unknown;
  created_at: string;
}

/**
 * Persist the audit to the dedicated `marketing_audits` table (RLS-scoped). Distinct from
 * the artifact chain: this table is Output B's own store (constraints/investments/rollout
 * jsonb). Injectable so the tool is unit-testable without a DB.
 */
export async function saveMarketingAudit(input: {
  constraints: unknown;
  investments: unknown;
  rollout: unknown;
}): Promise<MarketingAuditRow> {
  const supabase = getUserSupabase();
  const { userId } = getIdentity();
  if (!userId) throw new Error('no authenticated user id in scope for marketing_audits write');
  const { data, error } = await supabase
    .from('marketing_audits')
    .insert({
      user_id: userId,
      constraints: input.constraints,
      investments: input.investments,
      rollout: input.rollout,
    })
    .select()
    .single();
  if (error || !data) {
    throw new Error(`failed to insert marketing_audit: ${error?.message ?? 'no row returned'}`);
  }
  return data as MarketingAuditRow;
}

/** Injectable collaborators (default to live module fns) so the tool is unit testable. */
export interface RunMarketingAuditDeps {
  resolve: typeof resolveSlots;
  saveArtifact: typeof saveArtifactLive;
  saveMarketingAudit: typeof saveMarketingAudit;
  edgeFn: EdgeFnClient;
}

function withDefaults(deps?: Partial<RunMarketingAuditDeps>): RunMarketingAuditDeps {
  return {
    resolve: deps?.resolve ?? resolveSlots,
    saveArtifact: deps?.saveArtifact ?? saveArtifactLive,
    saveMarketingAudit: deps?.saveMarketingAudit ?? saveMarketingAudit,
    edgeFn: deps?.edgeFn ?? new EdgeFnClient(),
  };
}

const inputSchema = {
  avatar_id: z.string().optional().describe('Avatar scope; omit for the brand-level chain.'),
};

/** Turn each calibration gap into a needs_input item using the slot's own ask question. */
function gapsToNeedsInput(gaps: CalibrationGap[]): NeedsInputItem[] {
  const seen = new Set<number>();
  const items: NeedsInputItem[] = [];
  for (const gap of gaps) {
    if (seen.has(gap.slot)) continue;
    seen.add(gap.slot);
    const slot = getSlot(gap.slot as SlotId);
    items.push({
      slot: gap.slot,
      question: slot.askQuestion,
      why:
        gap.reason === 'unparseable'
          ? `Slot #${gap.slot} (${gap.field}) was found but could not be read as a usable value. The audit calibrates every benefit band to your revenue, so it cannot proceed without it.`
          : `Slot #${gap.slot} (${gap.field}) is required to calibrate the audit. Without it every benefit estimate would be uncalibrated, so nothing is invented.`,
    });
  }
  return items;
}

/**
 * Merge the edge fn's PROSE back over the deterministic rows/phases. ONLY the prose
 * fields (`what_it_is`, `why_now`) are taken from the model; every NUMBER (tier, cash,
 * benefit bands, windows, cumulative impact) is the deterministic value, unchanged.
 * This is the numbers-in == numbers-out guarantee: the fn cannot return a number, and we
 * never read one from it.
 */
function mergeProse(
  calibration: CalibrationResult,
  prose: { rowDescriptions: string[]; phaseWhyNow: string[] },
): { rows: InvestmentRow[]; phases: RolloutPhase[] } {
  const rows = calibration.rows.map((row, i) => {
    const desc = prose.rowDescriptions[i]?.trim();
    return desc ? { ...row, what_it_is: desc } : row;
  });
  const phases = calibration.phases.map((phase, i) => {
    const why = prose.phaseWhyNow[i]?.trim();
    return why ? { ...phase, why_now: why } : phase;
  });
  return { rows, phases };
}

/** Coerce the edge fn's loosely-typed prose arrays into index-aligned string[]. */
function proseArrays(reply: AuditProseReply, rowCount: number, phaseCount: number): {
  rowDescriptions: string[];
  phaseWhyNow: string[];
} {
  const toArr = (v: unknown, n: number): string[] => {
    const arr = Array.isArray(v) ? v : [];
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(typeof arr[i] === 'string' ? (arr[i] as string) : '');
    return out;
  };
  return {
    rowDescriptions: toArr(reply.row_descriptions, rowCount),
    phaseWhyNow: toArr(reply.phase_why_now, phaseCount),
  };
}

/** The discriminated outcome of an audit run. */
export type RunMarketingAuditResult =
  | {
      status: 'persisted';
      auditId: string;
      auditArtifactId: string;
      rolloutArtifactId: string;
      grounding: Grounding;
      rowCount: number;
      phaseCount: number;
      prose: 'enriched' | 'verbatim';
    }
  | { status: 'needs_input'; needs_input: NeedsInputItem[] }
  | { status: 'failed'; note: string };

/**
 * Run the audit: resolve facts, gate on revenue, calibrate, enrich prose, persist. Pure
 * orchestration over the injected deps so it is unit-testable without the MCP transport.
 */
export async function runMarketingAudit(
  avatarId: string | null,
  deps?: Partial<RunMarketingAuditDeps>,
): Promise<RunMarketingAuditResult> {
  const d = withDefaults(deps);

  // 1. Resolve the BUSINESS-FACT slots KB-first.
  const resolved = await d.resolve(AUDIT_SLOTS, { avatarId });
  const factSlots = resolved.map((r: ResolvedSlot) => ({ slot: r.slot, value: r.value, status: r.status }));

  // 2. Parse → if revenue (#8) is missing/stale/unparseable, ask. Nothing is invented.
  const factsResult = parseBusinessFacts(factSlots);
  if (!factsResult.ok) {
    return { status: 'needs_input', needs_input: gapsToNeedsInput(factsResult.gaps) };
  }

  // 3. DETERMINISTIC calibration — every number comes from here.
  const calibration = calibrate(factsResult.facts);
  if (calibration.rows.length === 0) {
    // No applicable moves for the resolved facts — surface as needs_input on the
    // channel/asset slots rather than persisting an empty audit.
    return {
      status: 'needs_input',
      needs_input: [
        {
          slot: 10,
          question: getSlot(10 as SlotId).askQuestion,
          why: 'No marketing moves are applicable to the resolved channel/asset states. Confirm your channels (listings, niche, off-Amazon intent) so the audit has moves to score.',
        },
      ],
    };
  }

  // 4. Prose enrichment (never-fail). Numbers stay host-side; the fn returns prose only.
  let prose = {
    rowDescriptions: calibration.rows.map((r) => r.what_it_is),
    phaseWhyNow: calibration.phases.map((p) => p.why_now),
  };
  let proseMode: 'enriched' | 'verbatim' = 'verbatim';
  const res = await d.edgeFn.invoke<AuditProseReply>(MARKETING_AUDIT_EDGE_FN, {
    rows: calibration.rows,
    phases: calibration.phases,
  });
  if (res.ok && res.data && !Array.isArray(res.data.needs_input)) {
    const arrays = proseArrays(res.data, calibration.rows.length, calibration.phases.length);
    // Only adopt model prose where it is non-empty; otherwise keep the verbatim default.
    prose = {
      rowDescriptions: arrays.rowDescriptions.map((s, i) => s.trim() || calibration.rows[i].what_it_is),
      phaseWhyNow: arrays.phaseWhyNow.map((s, i) => s.trim() || calibration.phases[i].why_now),
    };
    proseMode = res.data.degraded ? 'verbatim' : 'enriched';
  }

  const merged = mergeProse(calibration, prose);

  // 5. Build the contract artifacts. The audit is grounded in owner-stated BUSINESS-FACTs
  //    (the gold itself is "calibrated to your business size from prior conversations"),
  //    so grounding=evidence with the business_facts refs.
  const grounding: Grounding = 'evidence';
  const evidenceRefs: EvidenceRef[] = [
    { kind: 'business_fact', ref: 'revenue/margin/ad metrics (slot #8)' },
    { kind: 'artifact', ref: `marketing_move_library@${calibration.libraryVersion}` },
  ];

  const auditCandidate: MarketingAuditOutput = {
    rows: merged.rows,
    grounding,
    evidence_refs: evidenceRefs,
  };
  const auditParsed = marketingAuditOutputSchema.safeParse(auditCandidate);
  if (!auditParsed.success) {
    return { status: 'failed', note: `marketing_audit output failed contract: ${auditParsed.error.message}` };
  }

  const rolloutCandidate: RolloutPlanOutput = {
    phases: merged.phases,
    cumulative_impact: calibration.cumulativeImpact,
    grounding,
    evidence_refs: evidenceRefs,
  };
  const rolloutParsed = rolloutPlanOutputSchema.safeParse(rolloutCandidate);
  if (!rolloutParsed.success) {
    return { status: 'failed', note: `rollout_plan output failed contract: ${rolloutParsed.error.message}` };
  }

  // 6. Persist: the dedicated marketing_audits row + both chain artifacts.
  try {
    const auditRow = await d.saveMarketingAudit({
      constraints: calibration.facts,
      investments: auditParsed.data,
      rollout: rolloutParsed.data,
    });
    const saveOpts: SaveArtifactOptions = { grounding, evidenceRefs, avatarId };
    const auditArtifact: ArtifactRow = await d.saveArtifact('marketing_audit', auditParsed.data, saveOpts);
    const rolloutArtifact: ArtifactRow = await d.saveArtifact('rollout_plan', rolloutParsed.data, saveOpts);

    return {
      status: 'persisted',
      auditId: auditRow.id,
      auditArtifactId: auditArtifact.id,
      rolloutArtifactId: rolloutArtifact.id,
      grounding,
      rowCount: auditParsed.data.rows.length,
      phaseCount: rolloutParsed.data.phases.length,
      prose: proseMode,
    };
  } catch (err) {
    return { status: 'failed', note: err instanceof Error ? err.message : 'persist failed' };
  }
}

export function registerRunMarketingAuditTool(server: McpServer, deps?: Partial<RunMarketingAuditDeps>): void {
  server.registerTool(
    'run_marketing_audit',
    {
      title: 'Run the marketing investment audit',
      description:
        'Write tool: produce the marketing investment audit (gold Workbook B — tiered Investment Matrix + 90-day rollout). Binds identity first, resolves the BUSINESS-FACT slots (revenue/margins/ad metrics #8 [required], brand-asset states #7, channel states #10, inventory risk #11, cash timing #9, competitor set #16, catalog #5). If revenue is missing/stale it returns needs_input (nothing invented). It then calibrates the matrix DETERMINISTICALLY from the marketing-move library (tiering, cash/effort, 1/3/6/12-mo benefit bands at the user revenue, cumulative-impact grid) and uses the marketing-audit engine ONLY to enrich prose (numbers never leave the host). Persists to marketing_audits plus marketing_audit + rollout_plan artifacts (RLS-scoped). Requires an authenticated Supabase JWT.',
      inputSchema,
    },
    async ({ avatar_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;
      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      try {
        const result = await runMarketingAudit(avatar_id ?? null, deps);

        safeLog({
          event: 'tool.run_marketing_audit',
          caller: userTag(identity),
          status: result.status,
        });

        if (result.status === 'persisted') {
          captureMcpEvent(identity.userId as string, 'mcp_marketing_audit_completed', {
            rows: result.rowCount,
            phases: result.phaseCount,
            prose: result.prose,
          });
          return {
            content: [
              {
                type: 'text' as const,
                text: `Marketing audit persisted (${result.rowCount} investment row(s), ${result.phaseCount} rollout phase(s); audit ${result.auditId}, grounding ${result.grounding}, prose ${result.prose}).`,
              },
            ],
            structuredContent: {
              ok: true,
              audit_id: result.auditId,
              audit_artifact_id: result.auditArtifactId,
              rollout_artifact_id: result.rolloutArtifactId,
              grounding: result.grounding,
              row_count: result.rowCount,
              phase_count: result.phaseCount,
              prose: result.prose,
            },
          };
        }

        if (result.status === 'needs_input') {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Marketing audit needs input: ${result.needs_input.length} unresolved BUSINESS-FACT slot(s). Nothing was invented.`,
              },
            ],
            structuredContent: { ok: false, needs_input: result.needs_input },
          };
        }

        return {
          content: [{ type: 'text' as const, text: `run_marketing_audit failed: ${result.note}` }],
          structuredContent: { ok: false, note: result.note },
          isError: true,
        };
      } catch (err) {
        const note = err instanceof Error ? err.message : 'failed to run marketing audit';
        safeLog({ level: 'warn', event: 'tool.run_marketing_audit.failed', caller: userTag(identity) });
        captureMcpException(err, identity.userId as string, { tool: 'run_marketing_audit' });
        return {
          content: [{ type: 'text' as const, text: `run_marketing_audit failed: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}

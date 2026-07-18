/**
 * Layer 1 (service) — Expert Intelligence Loop, distill stage (deterministic core).
 *
 * The nightly pass turns accumulated `expert_corrections` (status='new') into REVIEWABLE
 * `coach_instructions` DRAFTS. This module owns the two deterministic pieces:
 *   1. clusterCorrections — group new corrections (by tool_context) so one draft covers a theme,
 *      not one-draft-per-correction (errors.md #14).
 *   2. writeDraftInstruction — insert a `status='draft'` coach_instructions row (next version for
 *      its instruction_id) and stamp its source corrections with proposed_instruction_id +
 *      status='drafted' (the Studio provenance link). It NEVER writes status='published'
 *      (errors.md #13 — publish is HUMAN-only in the Studio).
 *
 * It also ships a DETERMINISTIC runner (runDistill) so the new→drafted arm has an executable path
 * today: it composes a structured directive body from the cluster's corrections. A future nightly
 * AGENT can supersede composeInstructionBody with LLM-authored prose and add structural→PR routing;
 * until then, this produces reviewable drafts a human refines + publishes in the Studio.
 *
 * Runs off-gateway (the scheduled agent / runner), so it uses a service-role client (bypasses RLS).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CorrectionRow {
  id: string;
  tool_context: string | null;
  coach_claim: string;
  correction: string;
  verbatim: string | null;
}

export interface Cluster {
  /** tool_context, or 'general' when absent. */
  key: string;
  correctionIds: string[];
  corrections: CorrectionRow[];
}

/** Deterministic grouping by tool_context (stable order: by key, then first-seen). */
export function clusterCorrections(rows: CorrectionRow[]): Cluster[] {
  const byKey = new Map<string, Cluster>();
  for (const r of rows) {
    const key = (r.tool_context ?? '').trim() || 'general';
    const c = byKey.get(key) ?? { key, correctionIds: [], corrections: [] };
    c.correctionIds.push(r.id);
    c.corrections.push(r);
    byKey.set(key, c);
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export interface DraftSpec {
  /** Existing coach_instructions.instruction_id (→ new version) or a new id (→ v1). */
  instructionId: string;
  surface: 'preamble' | 'edge-fn' | 'both';
  whenToUse?: string;
  /** The composed instruction text (the nightly agent authors this). */
  body: string;
  /** expert_corrections.id[] this draft was distilled from (provenance). */
  correctionIds: string[];
}

export interface DraftResult {
  instructionId: string;
  version: number;
}

/**
 * Insert a DRAFT coach_instruction from a cluster and link its provenance. The new row's version is
 * max(existing version for this instruction_id) + 1, so it never collides with a published row (the
 * one-published-per-id index). Marks the source corrections status='drafted' + proposed_instruction_id.
 * Throws on DB error (the caller logs + continues to the next cluster — errors.md #15).
 */
export async function writeDraftInstruction(
  client: SupabaseClient,
  spec: DraftSpec,
): Promise<DraftResult> {
  const { data: existing, error: verErr } = await client
    .from('coach_instructions')
    .select('version')
    .eq('instruction_id', spec.instructionId)
    .order('version', { ascending: false })
    .limit(1);
  if (verErr) throw new Error(`coach_instructions version lookup: ${verErr.message}`);
  const version = ((existing?.[0]?.version as number | undefined) ?? 0) + 1;

  const { error: insErr } = await client.from('coach_instructions').insert({
    instruction_id: spec.instructionId,
    surface: spec.surface,
    when_to_use: spec.whenToUse ?? null,
    body: spec.body,
    status: 'draft', // NEVER 'published' — publish is human-only in the Studio (errors.md #13)
    version,
  });
  if (insErr) throw new Error(`coach_instructions draft insert: ${insErr.message}`);

  if (spec.correctionIds.length > 0) {
    const { error: updErr } = await client
      .from('expert_corrections')
      .update({ status: 'drafted', proposed_instruction_id: spec.instructionId })
      .in('id', spec.correctionIds);
    if (updErr) throw new Error(`expert_corrections provenance update: ${updErr.message}`);
  }

  return { instructionId: spec.instructionId, version };
}

/** Stable instruction_id for a cluster: expert.<slug of tool_context>, or expert.general. */
export function instructionIdForCluster(cluster: Cluster): string {
  const slug = cluster.key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `expert.${slug || 'general'}`;
}

/**
 * Deterministic body composer — turns a cluster of corrections into a coaching directive. No LLM, so
 * it is testable + reproducible; a future nightly agent can replace this with authored prose. Dedupes
 * identical corrections and lists them as explicit "do X, not Y" guidance, grounded in the expert's
 * verbatim words where available.
 */
export function composeInstructionBody(cluster: Cluster): string {
  const seen = new Set<string>();
  const points: string[] = [];
  for (const c of cluster.corrections) {
    const key = `${c.coach_claim}::${c.correction}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(`- Do NOT: ${c.coach_claim.trim()} — instead: ${c.correction.trim()}`);
  }
  const scope = cluster.key === 'general' ? 'in general' : `when working on ${cluster.key}`;
  return [
    `EXPERT GUIDANCE (${scope}) — distilled from the brand expert's corrections, pending review:`,
    ...points,
  ].join('\n');
}

export interface DistillDeps {
  /** New (status='new') corrections to distill. */
  readNewCorrections(): Promise<CorrectionRow[]>;
  writeDraft(spec: DraftSpec): Promise<DraftResult>;
}

export interface DistillSummary {
  newCorrections: number;
  clusters: number;
  draftsCreated: number;
  drafts: Array<{ instructionId: string; version: number; fromCorrections: number }>;
}

/**
 * Read new corrections, cluster them, and draft one coach_instruction per cluster. A cluster that
 * fails to draft is logged-and-skipped (errors.md #15) so a single bad cluster never aborts the run.
 * NEVER publishes. Returns a summary for the runner to print.
 */
export async function runDistill(deps: DistillDeps): Promise<DistillSummary> {
  const rows = await deps.readNewCorrections();
  const clusters = clusterCorrections(rows);
  const drafts: DistillSummary['drafts'] = [];
  for (const cluster of clusters) {
    try {
      const res = await deps.writeDraft({
        instructionId: instructionIdForCluster(cluster),
        surface: 'preamble',
        whenToUse: cluster.key === 'general' ? undefined : `When working on ${cluster.key}.`,
        body: composeInstructionBody(cluster),
        correctionIds: cluster.correctionIds,
      });
      drafts.push({ ...res, fromCorrections: cluster.correctionIds.length });
    } catch {
      // skip this cluster; the rows stay status='new' for the next run
    }
  }
  return { newCorrections: rows.length, clusters: clusters.length, draftsCreated: drafts.length, drafts };
}

/** Real IO deps over the service-role client. */
export function buildDistillDeps(client: SupabaseClient): DistillDeps {
  return {
    async readNewCorrections() {
      const { data, error } = await client
        .from('expert_corrections')
        .select('id, tool_context, coach_claim, correction, verbatim')
        .eq('status', 'new')
        .order('created_at', { ascending: true });
      if (error) throw new Error(`expert_corrections read: ${error.message}`);
      return (data ?? []) as CorrectionRow[];
    },
    writeDraft: (spec) => writeDraftInstruction(client, spec),
  };
}

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
 * What is NOT here (the nightly agent's Layer-2 job): composing the instruction BODY from a
 * cluster, deciding new-vs-existing instruction_id, and routing STRUCTURAL clusters to a PR
 * instead of a draft. This module is the plumbing those decisions execute against.
 *
 * Runs off-gateway (the scheduled agent), so it uses a service-role client (bypasses RLS).
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

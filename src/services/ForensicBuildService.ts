/**
 * ForensicBuildService — the SPA forensic-build orchestrator (§4.2).
 *
 * Mirrors the MCP `build_avatar_stage` / `avatarPipeline` contracts WITHOUT
 * calling /mcp: it invokes the deployed edge fns directly via the JWT-bound
 * Supabase client (`supabase.functions.invoke`), persists stage artifacts via
 * the `save_artifact_atomic` RPC (the artifact chain — a re-run supersedes the
 * prior current row), and tracks S1→S4 progress in `avatar_build_state` over
 * RLS. S5/signature is D2/R-015 gated and intentionally NOT surfaced here.
 *
 * Contract parity with avatarPipeline.ts:
 *   - stage order s1 → s2 → {s3, s4}; each stage feeds `prior` keyed BY STAGE ID
 *     (`prior.s1`, `prior.s2`) — keying by artifact kind broke the chain (see
 *     avatarPipeline.ts gatherPrior comment).
 *   - edge body is `{ reviews, prior }`; reviews is the verbatim corpus string.
 *   - an edge fn that returns `{ needs_input: [...] }` on HTTP 200 is a grounding
 *     gap (surfaced as needs_input), not a transient failure.
 *   - retry max 2 with exponential backoff on transient edge failure.
 *
 * Manual-edit override: forensic re-runs persist artifacts (machine writes); a
 * user's manual edit of an avatar field is a `field_source='manual'` write that
 * the `enforce_avatar_field_lock` DB trigger protects from being overwritten by
 * a subsequent non-manual (forensic) write. The builder therefore never clears a
 * locked field — it writes its own artifact rows and leaves locked fields intact.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  ForensicStage,
  StageRunResult,
  StageArtifact,
  NeedsInputItem,
  AvatarBuildState,
} from '@/types/forensicBuild';

/** Stage → edge fn name + artifact kind + prior dependencies (mirrors avatarPipeline STAGES). */
interface StageSpec {
  edgeFn: string;
  kind: string;
  dependsOn: ForensicStage[];
}

const STAGE_SPECS: Readonly<Record<ForensicStage, StageSpec>> = {
  s1: { edgeFn: 'avatar-vocabulary', kind: 'avatar_s1_vocab', dependsOn: [] },
  s2: { edgeFn: 'avatar-jobmap', kind: 'avatar_s2_jobmap', dependsOn: ['s1'] },
  s3: { edgeFn: 'avatar-triggers', kind: 'avatar_s3_triggers', dependsOn: ['s1', 's2'] },
  s4: { edgeFn: 'avatar-objections', kind: 'avatar_s4_objections', dependsOn: ['s1', 's2'] },
};

const MAX_STAGE_RETRIES = 2;
const STAGE_RETRY_BASE_MS = 500;

/** A zero UUID placeholder is never needed client-side — avatar_id is always a real id here. */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class ForensicBuildService {
  /** Resolve the current authenticated user id (RLS owner). */
  private async getUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return user.id;
  }

  /** Resolve the avatar's brand id (required by save_artifact_atomic's brand cross-check). */
  private async getBrandId(avatarId: string): Promise<string> {
    const { data, error } = await supabase
      .from('avatars')
      .select('brand_id')
      .eq('id', avatarId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.brand_id) throw new Error('Avatar has no brand');
    return data.brand_id as string;
  }

  /**
   * Read the current (non-superseded) artifact content for a stage's kind/avatar,
   * keyed for the `prior` bundle BY STAGE ID. Returns null when the stage hasn't run.
   */
  private async getCurrentArtifactContent(
    stage: ForensicStage,
    avatarId: string,
  ): Promise<unknown | null> {
    const { data, error } = await supabase
      .from('artifacts')
      .select('content')
      .eq('kind', STAGE_SPECS[stage].kind)
      .eq('avatar_id', avatarId)
      .is('superseded_by', null)
      .maybeSingle();
    if (error) throw error;
    return data?.content ?? null;
  }

  /** Gather the `prior` bundle (keyed by stage id) for a stage from its dependencies. */
  private async gatherPrior(
    stage: ForensicStage,
    avatarId: string,
  ): Promise<Record<string, unknown>> {
    const prior: Record<string, unknown> = {};
    for (const dep of STAGE_SPECS[stage].dependsOn) {
      const content = await this.getCurrentArtifactContent(dep, avatarId);
      if (content != null) prior[dep] = content;
    }
    return prior;
  }

  /** Detect an edge-fn `{ needs_input: [...] }` HTTP-200 short-circuit. */
  private extractNeedsInput(data: unknown): NeedsInputItem[] | null {
    if (!data || typeof data !== 'object') return null;
    const raw = (data as { needs_input?: unknown }).needs_input;
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw as NeedsInputItem[];
  }

  /** Pull the stage's domain payload out of the edge response (strips the grounding envelope). */
  private extractContent(stage: ForensicStage, data: Record<string, unknown>): StageArtifact['content'] {
    switch (stage) {
      case 's1':
        return { clusters: (data.clusters as never) ?? [] };
      case 's2':
        return { job_map: (data.job_map as never) ?? [] };
      case 's3':
        return { triggers: (data.triggers as never) ?? [] };
      case 's4':
        return { objections: (data.objections as never) ?? [] };
    }
  }

  /** True when the stage payload has at least one row (a real artifact, not an empty shape). */
  private hasRows(stage: ForensicStage, content: StageArtifact['content']): boolean {
    switch (stage) {
      case 's1':
        return (content as { clusters: unknown[] }).clusters.length > 0;
      case 's2':
        return (content as { job_map: unknown[] }).job_map.length > 0;
      case 's3':
        return (content as { triggers: unknown[] }).triggers.length > 0;
      case 's4':
        return (content as { objections: unknown[] }).objections.length > 0;
    }
  }

  /**
   * Run a single forensic stage: gather prior, invoke the edge fn with `{ reviews, prior }`,
   * surface needs_input, persist the artifact via the chain on success. Retries transient failures.
   */
  async runStage(
    stage: ForensicStage,
    avatarId: string,
    reviews: string,
  ): Promise<StageRunResult> {
    const spec = STAGE_SPECS[stage];
    let lastError = 'no attempt made';

    for (let attempt = 0; attempt <= MAX_STAGE_RETRIES; attempt++) {
      if (attempt > 0) await sleep(STAGE_RETRY_BASE_MS * 2 ** (attempt - 1));

      const prior = await this.gatherPrior(stage, avatarId);
      const { data, error } = await supabase.functions.invoke(spec.edgeFn, {
        body: { reviews, prior },
      });

      if (error || !data) {
        lastError = error?.message ?? `${spec.edgeFn} returned no data`;
        continue;
      }

      const needs = this.extractNeedsInput(data);
      if (needs) return { status: 'needs_input', stage, needs_input: needs };

      // An edge fn error surfaced inside a 200 body (e.g. 'insufficient grounding').
      const dataObj = data as Record<string, unknown>;
      if (typeof dataObj.error === 'string') {
        lastError = dataObj.error;
        continue;
      }

      const content = this.extractContent(stage, dataObj);
      if (!this.hasRows(stage, content)) {
        lastError = `${spec.edgeFn} returned an empty artifact`;
        continue;
      }

      try {
        await this.persistArtifact(stage, avatarId, content);
        return { status: 'ok', stage, content };
      } catch (persistErr) {
        lastError = persistErr instanceof Error ? persistErr.message : 'persist failed';
        continue;
      }
    }

    return { status: 'failed', stage, error: lastError };
  }

  /**
   * Persist a stage artifact via `save_artifact_atomic` (the artifact chain) — a re-run
   * supersedes the prior current row of the same kind/avatar (re-run supersedes, §4.2).
   * Grounding is always 'evidence' (forensics never runs ungrounded; reviews are the source).
   */
  private async persistArtifact(
    stage: ForensicStage,
    avatarId: string,
    content: StageArtifact['content'],
  ): Promise<void> {
    const userId = await this.getUserId();
    const brandId = await this.getBrandId(avatarId);
    const { error } = await supabase.rpc('save_artifact_atomic', {
      p_user_id: userId,
      p_brand_id: brandId,
      p_avatar_id: avatarId,
      p_kind: STAGE_SPECS[stage].kind,
      p_content: { ...content, grounding: 'evidence', evidence_refs: [{ kind: 'review', ref: 'pasted-review-corpus' }] },
      p_grounding: 'evidence',
      p_evidence_refs: [{ kind: 'review', ref: 'pasted-review-corpus' }],
    });
    if (error) throw error;
  }

  /** Read the current (non-superseded) artifact for a stage (review/read-only step). */
  async getStageArtifact(stage: ForensicStage, avatarId: string): Promise<StageArtifact['content'] | null> {
    const content = await this.getCurrentArtifactContent(stage, avatarId);
    return content == null ? null : (content as StageArtifact['content']);
  }

  // ── avatar_build_state (RLS upsert; mirrors MCP record_avatar_build) ──────

  /** Read the avatar's build state (null when no build has started). */
  async getBuildState(avatarId: string): Promise<AvatarBuildState | null> {
    const { data, error } = await supabase
      .from('avatar_build_state')
      .select('avatar_id, stages_done, status, approved_at, updated_at')
      .eq('avatar_id', avatarId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      avatar_id: data.avatar_id as string,
      stages_done: (data.stages_done as ForensicStage[]) ?? [],
      status: data.status as AvatarBuildState['status'],
      approved_at: data.approved_at as string | null,
      updated_at: data.updated_at as string,
    };
  }

  /**
   * Upsert the build state: replace `stages_done`, set status, stamp `approved_at`
   * when approving. Mirrors the MCP `record_avatar_build` semantics over RLS.
   */
  async recordBuildState(
    avatarId: string,
    stagesDone: ForensicStage[],
    status: AvatarBuildState['status'],
  ): Promise<void> {
    const userId = await this.getUserId();
    const row: Record<string, unknown> = {
      avatar_id: avatarId,
      user_id: userId,
      stages_done: stagesDone,
      status,
      updated_at: new Date().toISOString(),
      approved_at: status === 'approved' ? new Date().toISOString() : null,
    };
    const { error } = await supabase
      .from('avatar_build_state')
      .upsert(row, { onConflict: 'avatar_id' });
    if (error) throw error;
  }
}

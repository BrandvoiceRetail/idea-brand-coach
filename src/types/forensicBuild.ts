/**
 * Forensic-build domain types (SPA side, §4.2).
 *
 * The SPA forensic builder drives the same S1→S4 avatar pipeline the MCP
 * `build_avatar_stage` tool drives, but WITHOUT calling /mcp — it invokes the
 * deployed edge fns (avatar-vocabulary/-jobmap/-triggers/-objections) directly
 * via the JWT-bound Supabase client. These types mirror the Phase-0 artifact
 * contracts (src/mcp/contracts/avatarS{1..4}*.ts) for the SPA build, kept local
 * so the SPA does not import the MCP/edge `.js` ESM contract modules.
 */

/** The four forensic stages the SPA surfaces (S5/signature is D2/R-015 gated, out of SPA scope). */
export type ForensicStage = 's1' | 's2' | 's3' | 's4';

/** Ordered stage list for the stepper / pipeline run. */
export const FORENSIC_STAGES: readonly ForensicStage[] = ['s1', 's2', 's3', 's4'] as const;

/** Human labels for each stage (stepper + review headings). */
export const FORENSIC_STAGE_LABELS: Readonly<Record<ForensicStage, string>> = {
  s1: 'Vocabulary forensics',
  s2: 'Job map',
  s3: 'Decision triggers',
  s4: 'Objections',
};

// ── Stage artifact payloads (mirror the Phase-0 contracts) ──────────────────

export interface VocabCluster {
  cluster: string;
  customer_words: string[];
  frequency_signal: string;
  why_it_matters: string;
}
export interface S1Vocab {
  clusters: VocabCluster[];
}

export interface JobMapRow {
  functional_job: string;
  emotional_job: string;
  identity_job: string;
  villain: string;
}
export interface S2Jobmap {
  job_map: JobMapRow[];
}

export interface DecisionTrigger {
  trigger_moment: string;
  what_they_feel: string;
  search_terms: string[];
  estimated_volume_band: string;
}
export interface S3Triggers {
  triggers: DecisionTrigger[];
}

export interface Objection {
  hesitation: string;
  verbatim_signal: string;
  resolution: string;
}
export interface S4Objections {
  objections: Objection[];
}

/** A stage's persisted artifact content, discriminated by stage. */
export type StageArtifact =
  | { stage: 's1'; content: S1Vocab }
  | { stage: 's2'; content: S2Jobmap }
  | { stage: 's3'; content: S3Triggers }
  | { stage: 's4'; content: S4Objections };

/** A `needs_input` demand surfaced by an edge fn (HTTP 200 short-circuit). */
export interface NeedsInputItem {
  slot: number;
  question: string;
  why: string;
}

/** Outcome of running one forensic stage via the edge fn. */
export type StageRunResult =
  | { status: 'ok'; stage: ForensicStage; content: StageArtifact['content'] }
  | { status: 'needs_input'; stage: ForensicStage; needs_input: NeedsInputItem[] }
  | { status: 'failed'; stage: ForensicStage; error: string };

/** Persisted build-state row (avatar_build_state). */
export interface AvatarBuildState {
  avatar_id: string;
  stages_done: ForensicStage[];
  status: 'draft' | 'built' | 'approved';
  approved_at: string | null;
  updated_at: string;
}

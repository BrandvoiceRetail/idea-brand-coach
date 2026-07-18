/**
 * Layer 0 (contract) — barrel for the artifact contracts.
 *
 * Per manifest §7: contracts are the single source of truth imported by tools, the
 * context resolver, and the workbook assembler. `CONTRACTS` is the registry keyed by
 * artifact kind so downstream code can look up `{outputSchema, requiredContext}` for
 * any kind without hard-wiring each import.
 */
export * from './slots.js';
export * from './grounding.js';
export * from './types.js';

export * from './diagnosticInterpretation.js';
export * from './avatarS1Vocab.js';
export * from './avatarS2Jobmap.js';
export * from './avatarS3Triggers.js';
export * from './avatarS4Objections.js';
export * from './positioningStatement.js';
export * from './brandCanvas.js';
export * from './exportBrief.js';
export * from './auditXIdea.js';
export * from './marketingAudit.js';
export * from './rolloutPlan.js';
export * from './messagingPerception.js';

import type { ArtifactContract, ArtifactKind } from './types.js';
import { diagnosticInterpretationContract } from './diagnosticInterpretation.js';
import { avatarS1VocabContract } from './avatarS1Vocab.js';
import { avatarS2JobmapContract } from './avatarS2Jobmap.js';
import { avatarS3TriggersContract } from './avatarS3Triggers.js';
import { avatarS4ObjectionsContract } from './avatarS4Objections.js';
import { positioningStatementContract } from './positioningStatement.js';
import { brandCanvasContract } from './brandCanvas.js';
import { exportBriefContract } from './exportBrief.js';
import { auditXIdeaContract } from './auditXIdea.js';
import { marketingAuditContract } from './marketingAudit.js';
import { rolloutPlanContract } from './rolloutPlan.js';
import { messagingPerceptionContract } from './messagingPerception.js';

/** Registry of every artifact contract, keyed by kind. */
export const CONTRACTS: Readonly<Record<ArtifactKind, ArtifactContract>> = {
  diagnostic_interpretation: diagnosticInterpretationContract,
  avatar_s1_vocab: avatarS1VocabContract,
  avatar_s2_jobmap: avatarS2JobmapContract,
  avatar_s3_triggers: avatarS3TriggersContract,
  avatar_s4_objections: avatarS4ObjectionsContract,
  positioning_statement: positioningStatementContract,
  brand_canvas: brandCanvasContract,
  export_brief: exportBriefContract,
  audit_x_idea: auditXIdeaContract,
  marketing_audit: marketingAuditContract,
  rollout_plan: rolloutPlanContract,
  messaging_perception: messagingPerceptionContract,
};

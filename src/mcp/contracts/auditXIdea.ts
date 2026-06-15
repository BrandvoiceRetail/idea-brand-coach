/**
 * Contract — `audit_x_idea` (gold Workbook A, sheet 7 "Audit × IDEA").
 *
 * §2 sheet 7: SYNTHESIS — the cross-product of Output B's investment rows × the IDEA
 * artifacts. Requires both Output B (marketing_audit) and the avatar/canvas chain to
 * exist; for each audit investment it states the without-IDEA baseline, the with-IDEA
 * upgrade, and a LABELED lift multiplier (ESTIMATE → free-text band, never a fake
 * exact figure).
 *
 * Schema covers gold sheet-7 columns: Audit investment, Without IDEA, With IDEA inputs,
 * Estimated lift multiplier.
 */
import { z } from 'zod';
import type { ArtifactContract } from './types.js';
import { groundingEnvelope } from './grounding.js';

export const auditIdeaRowSchema = z.object({
  /** "Audit investment" — the move from Output B. */
  audit_investment: z.string().min(1),
  /** "Without IDEA". */
  without_idea: z.string().min(1),
  /** "With IDEA inputs". */
  with_idea: z.string().min(1),
  /** "Estimated lift multiplier" — labeled band/text, not a fabricated exact number. */
  estimated_lift: z.string().min(1),
});
export type AuditIdeaRow = z.infer<typeof auditIdeaRowSchema>;

export const auditXIdeaOutputSchema = z.object({
  rows: z.array(auditIdeaRowSchema).min(1),
  ...groundingEnvelope,
});
export type AuditXIdeaOutput = z.infer<typeof auditXIdeaOutputSchema>;

const kind = 'audit_x_idea' as const;

/**
 * §2 sheet 7: needs both the marketing-move library (#17, the audit rows) and the
 * avatar evidence chain (#1) to map IDEA lift onto each investment.
 */
const requiredContext = [17, 1] as const;

export const auditXIdeaContract: ArtifactContract<typeof auditXIdeaOutputSchema> = {
  kind,
  outputSchema: auditXIdeaOutputSchema,
  requiredContext,
};

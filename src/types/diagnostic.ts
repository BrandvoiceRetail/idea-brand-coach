/**
 * Diagnostic Types
 * Type definitions for Brand Diagnostic feature
 */

export interface DiagnosticAnswers {
  insight: number;
  distinctive: number;
  empathetic: number;
  authentic: number;
  [key: string]: number;
}

export interface DiagnosticScores {
  overall: number;
  insight: number;
  distinctive: number;
  empathetic: number;
  authentic: number;
}

export interface DiagnosticSubmission {
  id: string;
  user_id: string;
  answers: DiagnosticAnswers;
  scores: DiagnosticScores;
  /** Brand this submission belongs to (one brand per user). NULL for legacy rows. */
  brand_id?: string | null;
  /**
   * Avatar overlay this submission scores. NULL = brand baseline (locked #5);
   * set = a per-avatar overlay diagnostic.
   */
  avatar_id?: string | null;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export interface DiagnosticCreate {
  answers: DiagnosticAnswers;
  scores: DiagnosticScores;
  /**
   * Avatar overlay this diagnostic scores. Omit / NULL = brand baseline (locked #5).
   * `brand_id` is resolved server-side from the authenticated user — never passed by the caller.
   */
  avatar_id?: string | null;
}

export interface DiagnosticUpdate {
  answers?: DiagnosticAnswers;
  scores?: DiagnosticScores;
}

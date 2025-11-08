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
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export interface DiagnosticCreate {
  answers: DiagnosticAnswers;
  scores: DiagnosticScores;
}

export interface DiagnosticUpdate {
  answers?: DiagnosticAnswers;
  scores?: DiagnosticScores;
}

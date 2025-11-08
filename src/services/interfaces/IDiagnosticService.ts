/**
 * IDiagnosticService Interface
 * Contract for diagnostic data operations
 */

import { DiagnosticCreate, DiagnosticScores, DiagnosticSubmission } from '@/types/diagnostic';

export interface IDiagnosticService {
  /**
   * Save diagnostic results to database
   * Updates both profiles.latest_diagnostic_data and creates diagnostic_submissions record
   */
  saveDiagnostic(data: DiagnosticCreate): Promise<DiagnosticSubmission>;

  /**
   * Get the latest diagnostic submission for the authenticated user
   */
  getLatestDiagnostic(): Promise<DiagnosticSubmission | null>;

  /**
   * Get all diagnostic submissions for the authenticated user, ordered by date
   */
  getDiagnosticHistory(): Promise<DiagnosticSubmission[]>;

  /**
   * Sync diagnostic data from localStorage to database
   * Used during post-diagnostic authentication flow
   */
  syncFromLocalStorage(): Promise<DiagnosticSubmission | null>;

  /**
   * Calculate scores from raw answers
   */
  calculateScores(answers: Record<string, number>): DiagnosticScores;
}

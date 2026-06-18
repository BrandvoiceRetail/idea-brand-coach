/**
 * IDiagnosticService Interface
 * Contract for diagnostic data operations
 */

import { DiagnosticCreate, DiagnosticScores, DiagnosticSubmission } from '@/types/diagnostic';

export interface IDiagnosticService {
  /**
   * Save diagnostic results to database
   * Updates both profiles.latest_diagnostic_data and creates diagnostic_submissions record.
   * Stamps brand_id (resolved server-side) and avatar_id (NULL = brand baseline, locked #5).
   */
  saveDiagnostic(data: DiagnosticCreate): Promise<DiagnosticSubmission>;

  /**
   * Get the latest diagnostic submission for the authenticated user.
   * Scope (locked #5):
   *  - `avatarId` omitted → latest of ANY scope (back-compat: brand baseline + overlays).
   *  - `avatarId === null` → latest BRAND BASELINE only (avatar_id IS NULL).
   *  - `avatarId === '<uuid>'` → latest OVERLAY for that avatar only.
   */
  getLatestDiagnostic(avatarId?: string | null): Promise<DiagnosticSubmission | null>;

  /**
   * Get all diagnostic submissions for the authenticated user, ordered by date
   */
  getDiagnosticHistory(): Promise<DiagnosticSubmission[]>;

  /**
   * Sync diagnostic data from localStorage to database.
   * Used during the post-diagnostic authentication flow and on the results page.
   * `avatarId` scopes the resulting write (locked #5): omitted/null = brand
   * baseline; a uuid = the overlay for the avatar that was current when the
   * diagnostic was (re)taken — this is the authored entry point that creates an
   * overlay row so compare-mode can render the avatar-vs-baseline delta.
   */
  syncFromLocalStorage(avatarId?: string | null): Promise<DiagnosticSubmission | null>;

  /**
   * Calculate scores from raw answers
   */
  calculateScores(answers: Record<string, number>): DiagnosticScores;
}

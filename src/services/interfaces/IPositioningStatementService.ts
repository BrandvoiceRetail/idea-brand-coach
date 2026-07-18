/**
 * Positioning Statement persistence contract.
 *
 * The Positioning Statement reveal names the deeper truth of what a customer is really
 * buying. When the user picks one of the revealed options, the pick is saved
 * so it survives reloads and is usable downstream (coach context, strategy
 * docs, exports). Rows live in the `positioning_statements` table (RLS: owner-only).
 */

export interface SavedPositioningStatement {
  id: string;
  positioningStatementText: string;
  allOptions: string[];
  chosenIndex: number;
  usedReviews: boolean;
  inference: boolean;
  createdAt: string;
}

export interface SavePositioningStatementInput {
  positioningStatementText: string;
  allOptions: string[];
  chosenIndex: number;
  usedReviews: boolean;
  inference: boolean;
}

export interface IPositioningStatementService {
  /**
   * Persist the user's chosen Positioning Statement. Auth-guarded; rejects when no user
   * is signed in.
   */
  savePositioningStatement(input: SavePositioningStatementInput): Promise<SavedPositioningStatement>;

  /**
   * Latest saved Positioning Statement for the signed-in user, or null when none exists
   * (or no user is signed in).
   */
  getLatestPositioningStatement(): Promise<SavedPositioningStatement | null>;
}

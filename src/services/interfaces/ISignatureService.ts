/**
 * Signature persistence contract.
 *
 * The Signature reveal names the deeper truth of what a customer is really
 * buying. When the user picks one of the revealed options, the pick is saved
 * so it survives reloads and is usable downstream (coach context, strategy
 * docs, exports). Rows live in the `signatures` table (RLS: owner-only).
 */

export interface SavedSignature {
  id: string;
  signatureText: string;
  allOptions: string[];
  chosenIndex: number;
  usedReviews: boolean;
  inference: boolean;
  createdAt: string;
}

export interface SaveSignatureInput {
  signatureText: string;
  allOptions: string[];
  chosenIndex: number;
  usedReviews: boolean;
  inference: boolean;
}

export interface ISignatureService {
  /**
   * Persist the user's chosen Signature. Auth-guarded; rejects when no user
   * is signed in.
   */
  saveSignature(input: SaveSignatureInput): Promise<SavedSignature>;

  /**
   * Latest saved Signature for the signed-in user, or null when none exists
   * (or no user is signed in).
   */
  getLatestSignature(): Promise<SavedSignature | null>;
}

/**
 * SupabaseSignatureService
 * Implements ISignatureService for the Supabase backend.
 *
 * Persists the user's chosen Signature from the reveal dialog and reads the
 * latest pick back so it survives reloads and is visible outside the dialog.
 * Auth-guarded via `supabase.auth.getUser()` like SupabaseDiagnosticService;
 * RLS on `signatures` enforces owner-only access.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  ISignatureService,
  SavedSignature,
  SaveSignatureInput,
} from './interfaces/ISignatureService';

interface SignatureRow {
  id: string;
  signature_text: string | null;
  all_options: unknown;
  chosen_index: number | null;
  used_reviews: boolean | null;
  inference: boolean | null;
  created_at: string;
}

function toSavedSignature(row: SignatureRow): SavedSignature {
  return {
    id: row.id,
    signatureText: row.signature_text ?? '',
    allOptions: Array.isArray(row.all_options)
      ? (row.all_options as unknown[]).filter((o): o is string => typeof o === 'string')
      : [],
    chosenIndex: row.chosen_index ?? 0,
    usedReviews: row.used_reviews ?? false,
    inference: row.inference ?? false,
    createdAt: row.created_at,
  };
}

export class SupabaseSignatureService implements ISignatureService {
  async saveSignature(input: SaveSignatureInput): Promise<SavedSignature> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('signatures')
      .insert({
        user_id: user.id,
        signature_text: input.signatureText,
        all_options: input.allOptions,
        chosen_index: input.chosenIndex,
        used_reviews: input.usedReviews,
        inference: input.inference,
      })
      .select()
      .single();

    if (error) throw error;
    return toSavedSignature(data as SignatureRow);
  }

  async getLatestSignature(): Promise<SavedSignature | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('signatures')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return toSavedSignature(data[0] as SignatureRow);
  }
}

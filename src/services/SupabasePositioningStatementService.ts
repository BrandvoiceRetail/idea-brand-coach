/**
 * SupabasePositioningStatementService
 * Implements IPositioningStatementService for the Supabase backend.
 *
 * Persists the user's chosen Positioning Statement from the reveal dialog and reads the
 * latest pick back so it survives reloads and is visible outside the dialog.
 * Auth-guarded via `supabase.auth.getUser()` like SupabaseDiagnosticService;
 * RLS on `positioning_statements` enforces owner-only access.
 */

import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { getPostHogDistinctId } from '@/lib/posthogClient';
import {
  IPositioningStatementService,
  SavedPositioningStatement,
  SavePositioningStatementInput,
} from './interfaces/IPositioningStatementService';

interface PositioningStatementRow {
  id: string;
  positioning_statement_text: string | null;
  all_options: unknown;
  chosen_index: number | null;
  used_reviews: boolean | null;
  inference: boolean | null;
  created_at: string;
}

function toSavedPositioningStatement(row: PositioningStatementRow): SavedPositioningStatement {
  return {
    id: row.id,
    positioningStatementText: row.positioning_statement_text ?? '',
    allOptions: Array.isArray(row.all_options)
      ? (row.all_options as unknown[]).filter((o): o is string => typeof o === 'string')
      : [],
    chosenIndex: row.chosen_index ?? 0,
    usedReviews: row.used_reviews ?? false,
    inference: row.inference ?? false,
    createdAt: row.created_at,
  };
}

export class SupabasePositioningStatementService implements IPositioningStatementService {
  async savePositioningStatement(input: SavePositioningStatementInput): Promise<SavedPositioningStatement> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // posthog_distinct_id threads this pick back to the user's PostHog funnel +
    // session replay (parity with feedback_events). Column added in migration
    // 20260617000000; typed locally because types.ts is intentionally not
    // regenerated (it carries repo/live drift).
    const row: TablesInsert<'positioning_statements'> & { posthog_distinct_id: string } = {
      user_id: user.id,
      positioning_statement_text: input.positioningStatementText,
      all_options: input.allOptions,
      chosen_index: input.chosenIndex,
      used_reviews: input.usedReviews,
      inference: input.inference,
      posthog_distinct_id: getPostHogDistinctId(),
    };
    const { data, error } = await supabase
      .from('positioning_statements')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return toSavedPositioningStatement(data as PositioningStatementRow);
  }

  async getLatestPositioningStatement(): Promise<SavedPositioningStatement | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('positioning_statements')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return toSavedPositioningStatement(data[0] as PositioningStatementRow);
  }
}

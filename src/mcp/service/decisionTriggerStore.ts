/**
 * Decision Trigger Store — read persisted decision triggers from the database.
 *
 * The `decision_triggers` table is written by the identify-decision-trigger edge function
 * and stores the derived decision trigger content with avatar_id scoping. This service
 * provides RLS-scoped read access to fetch the latest trigger for brief generation.
 */

import { getUserSupabase } from '../supabaseUser.js';

export interface DecisionTriggerRow {
  id: string;
  user_id: string;
  session_id: string | null;
  avatar_id: string | null;
  content: {
    dominant_type: string;
    brand_anchor: string;
    evidence_phrases: string[];
    placement_instruction: string;
    why_this_trigger: string;
    [key: string]: unknown;
  };
  generated_at: string;
  created_at: string;
}

/**
 * Get the latest decision trigger for an avatar, with brand-level fallback.
 *
 * Uses RLS-scoped client to ensure user can only read their own triggers.
 * First tries exact avatar_id match, then falls back to avatar_id IS NULL
 * (brand-level) if no avatar-specific trigger exists.
 *
 * @param avatarId - The avatar ID to scope to, or null for brand-level only
 * @returns The latest trigger row, or null if none exists
 */
export async function getLatestDecisionTrigger(
  avatarId: string | null
): Promise<DecisionTriggerRow | null> {
  const supabase = getUserSupabase();

  // Try avatar-specific first if avatarId provided
  if (avatarId) {
    const { data: avatarTrigger, error: avatarError } = await supabase
      .from('decision_triggers')
      .select('*')
      .eq('avatar_id', avatarId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (avatarError) {
      console.error('[decisionTriggerStore] Error fetching avatar trigger:', avatarError);
      // Surface the error instead of silently falling through
      throw avatarError;
    }

    if (avatarTrigger) {
      return avatarTrigger as DecisionTriggerRow;
    }
  }

  // Fall back to brand-level (avatar_id IS NULL)
  const { data: brandTrigger, error: brandError } = await supabase
    .from('decision_triggers')
    .select('*')
    .is('avatar_id', null)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (brandError) {
    console.error('[decisionTriggerStore] Error fetching brand trigger:', brandError);
    throw brandError;
  }

  return brandTrigger as DecisionTriggerRow | null;
}
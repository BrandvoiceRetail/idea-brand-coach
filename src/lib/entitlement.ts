/**
 * Entitlement — the free-trial vs membership signal for the funnel.
 *
 * MODEL (Matthew, 2026-06-29): the free trial gives a brand owner ONE funnel piece
 * to iterate on; membership unlocks the WHOLE funnel + ongoing monitoring. This is
 * the gate that holds a non-member to that one piece.
 *
 * Membership is read from `user_subscriptions` (the existing Stripe-backed table):
 * an active/trialing row = a member. Stripe checkout is still Phase-2/stubbed, so
 * the table is typically empty today → everyone is on the free trial and the gate
 * applies; a member appears the moment a subscription row exists. No new schema.
 */
import { supabase } from '@/integrations/supabase/client';

/** How many funnel pieces a non-member may have. The free-trial limit. */
export const FREE_TRIAL_PIECE_LIMIT = 1;

/** Subscription statuses that count as an active membership. */
const ACTIVE_STATUSES = ['active', 'trialing'] as const;

/**
 * Whether the signed-in user has an active membership. Defaults to `false` (free
 * trial) — signed-out, no row, or a read error all mean "not a member", so the gate
 * fails safe (never silently grants paid access).
 */
export async function isMember(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .in('status', ACTIVE_STATUSES as unknown as string[])
      .limit(1)
      .maybeSingle();
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

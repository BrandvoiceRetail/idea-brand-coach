/**
 * Profile provisioning for Clerk users (create-on-first-load).
 *
 * Today `public.profiles` is auto-created by the `handle_new_user` trigger on
 * `auth.users`. Clerk users never hit `auth.users`, so that trigger never fires.
 * This is the no-secrets provisioning option: on first authenticated load we
 * INSERT the profile (keyed by the Clerk user id). The alternative is a Clerk
 * `user.created` webhook → edge function (see CLERK_CUTOVER_RUNBOOK.md) — swap to
 * that if you prefer server-side provisioning.
 *
 * Insert-only (ON CONFLICT DO NOTHING): we never overwrite an existing profile,
 * so a user's later edits to full_name etc. are preserved. Runs under the Clerk
 * bearer, so the profiles INSERT RLS policy (`(auth.jwt()->>'sub') = id`) authorises
 * the user to create exactly their own row. Failures are non-fatal (logged).
 */

import { supabase } from '@/integrations/supabase/client';

interface EnsureClerkProfileParams {
  id: string;
  email: string | null | undefined;
  fullName: string | null | undefined;
}

export async function ensureClerkProfile({
  id,
  email,
  fullName,
}: EnsureClerkProfileParams): Promise<void> {
  // profiles.email is NOT NULL — can't provision without it.
  if (!email) {
    console.warn('[clerk] skipping profile provisioning: no email on the Clerk user');
    return;
  }

  // ignoreDuplicates => INSERT ... ON CONFLICT (id) DO NOTHING: create once, never clobber.
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id, email, full_name: fullName ?? null },
      { onConflict: 'id', ignoreDuplicates: true }
    );

  if (error) {
    console.error('[clerk] profile provisioning failed:', error.message);
  }
}

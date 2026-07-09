/**
 * consentService — appends consent decisions to the durable `user_consents`
 * ledger (GDPR Art. 7(1): the controller must be able to demonstrate consent).
 *
 * The client-side source of truth stays `src/lib/consent.ts` (works for
 * anonymous visitors); this service adds the server-side audit row whenever a
 * signed-in user decides. Silently no-ops when signed out — an anonymous
 * banner choice is recorded in localStorage only, which is the demonstrable
 * record for a visitor we cannot otherwise identify.
 */
import { supabase } from '@/integrations/supabase/client';
import { CONSENT_POLICY_VERSION } from '@/lib/consent';

export type ConsentType = 'analytics' | 'policy_acceptance' | 'marketing_email';
export type ConsentSource = 'consent_banner' | 'signup_form' | 'settings' | 'lead_capture';

/** Append one decision row. Background bookkeeping — never surfaces a toast. */
export async function recordConsentDecision(
  consentType: ConsentType,
  granted: boolean,
  source: ConsentSource,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('user_consents').insert({
      user_id: user.id,
      consent_type: consentType,
      granted,
      policy_version: CONSENT_POLICY_VERSION,
      source,
    });
    if (error) {
      console.error('[consentService] failed to record consent decision:', error);
    }
  } catch (err) {
    console.error('[consentService] failed to record consent decision:', err);
  }
}

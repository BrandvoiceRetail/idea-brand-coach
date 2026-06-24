/**
 * useEntitlement — the user's credit/subscription state for the paywall (Step 5 of
 * docs/PAYWALL_CREDIT_METERING_DESIGN.md).
 *
 * Reads the user's own `credit_wallets` (balance) + `user_subscriptions` (tier, status) over the
 * RLS-scoped client. `hasAccess` (balance > 0) is the gate truth used by <RequirePaid>; the paywall
 * stays dark behind VITE_PAYWALL_ENABLED regardless. Tables aren't in the generated types yet, so we
 * cast at the Supabase boundary (TODO(types-regen)).
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type EntitlementTier = 'starter' | 'pro' | 'studio' | 'scale' | null;

export interface Entitlement {
  loading: boolean;
  balance: number;
  tier: EntitlementTier;
  status: string | null;
  hasActiveSub: boolean;
  hasAccess: boolean;
  refresh: () => void;
}

/** Pure derivation (unit-tested): credits available = access; active/trialing = an active sub. */
export function deriveEntitlement(
  balance: number,
  status: string | null,
): { hasActiveSub: boolean; hasAccess: boolean } {
  return {
    hasActiveSub: status === 'active' || status === 'trialing',
    hasAccess: balance > 0,
  };
}

// TODO(types-regen): credit_wallets / user_subscriptions are not in the generated Database type yet.
interface LooseQuery {
  select(cols: string): {
    eq(col: string, val: string): {
      maybeSingle(): Promise<{ data: unknown; error: unknown }>;
    };
  };
}
const db = supabase as unknown as { from(table: string): LooseQuery };

export function useEntitlement(): Entitlement {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [tier, setTier] = useState<EntitlementTier>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setBalance(0);
      setTier(null);
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [walletRes, subRes] = await Promise.all([
        db.from('credit_wallets').select('balance').eq('user_id', user.id).maybeSingle(),
        db.from('user_subscriptions').select('tier, status').eq('user_id', user.id).maybeSingle(),
      ]);
      const wallet = walletRes.data as { balance?: number } | null;
      const sub = subRes.data as { tier?: string | null; status?: string | null } | null;
      setBalance(wallet?.balance ?? 0);
      setTier((sub?.tier ?? null) as EntitlementTier);
      setStatus(sub?.status ?? null);
    } catch (e) {
      console.error('[useEntitlement] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const { hasActiveSub, hasAccess } = deriveEntitlement(balance, status);

  return { loading, balance, tier, status, hasActiveSub, hasAccess, refresh: () => void load() };
}

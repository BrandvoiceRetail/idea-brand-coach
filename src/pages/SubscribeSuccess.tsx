/**
 * SubscribeSuccess — Stripe checkout return page (Step 6 of docs/PAYWALL_CREDIT_METERING_DESIGN.md).
 *
 * Polls entitlement until the webhook grant lands (credits appear), then routes into the app. Degrades
 * gracefully if the grant is slow.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntitlement } from '@/hooks/useEntitlement';

const MAX_TRIES = 10;

export default function SubscribeSuccess(): JSX.Element {
  const navigate = useNavigate();
  const { hasAccess, refresh } = useEntitlement();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (hasAccess) {
      navigate('/', { replace: true });
      return;
    }
    if (tries >= MAX_TRIES) return;
    const t = setTimeout(() => {
      refresh();
      setTries((n) => n + 1);
    }, 2000);
    return () => clearTimeout(t);
  }, [hasAccess, tries, refresh, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-bold mb-2">Thanks — finalizing your plan…</h1>
        <p className="text-muted-foreground">
          {tries >= MAX_TRIES
            ? 'Your payment went through. Credits can take a moment to appear — refresh shortly.'
            : 'Confirming your subscription and adding your credits.'}
        </p>
      </div>
    </div>
  );
}

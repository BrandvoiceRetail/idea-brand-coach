/**
 * ConsentBanner — the analytics opt-in prompt (GDPR Art. 6(1)(a) / ePrivacy).
 *
 * Shown until the visitor makes a choice; before that, PostHog is NOT
 * initialised (no cookies, no events — see posthogClient.initPostHog).
 * Accept and Decline carry equal visual weight on purpose: regulators treat
 * a buried decline as invalid consent. The choice is changeable any time in
 * Settings → Privacy.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getStoredConsent, setStoredConsent, type ConsentDecision } from '@/lib/consent';
import { recordConsentDecision } from '@/services/consentService';

export function ConsentBanner(): JSX.Element | null {
  const [decided, setDecided] = useState<boolean>(() => getStoredConsent() !== null);

  if (decided) return null;

  const choose = (decision: ConsentDecision): void => {
    setStoredConsent(decision);
    setDecided(true);
    // Durable ledger row when signed in; no-op for anonymous visitors.
    void recordConsentDecision('analytics', decision === 'granted', 'consent_banner');
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6" role="dialog" aria-label="Cookie and analytics consent">
      <Card className="mx-auto max-w-2xl shadow-lg border-border">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Optional analytics.</span>{' '}
            We&apos;d like to use PostHog (EU-hosted) cookies to understand how the coach is used and
            fix what breaks. Nothing is tracked unless you accept, and you can change your mind any
            time in Settings → Privacy. Details in our{' '}
            <Link to="/privacy" className="underline">Privacy Policy</Link>.
          </p>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => choose('granted')}>
              Accept analytics
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => choose('denied')}>
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

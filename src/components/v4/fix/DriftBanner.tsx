/**
 * DriftBanner (S-15) — Loop-3 Signature-drift alert.
 *
 * WHAT: When the brand's Signature changes, any funnel asset that was last
 * aligned to an OLDER Signature is now out of date. This banner names how many
 * assets drifted and offers a one-tap re-check. It SELF-HIDES when nothing has
 * drifted (zero items → renders null), so it never nags without cause.
 *
 * WHY: The Fix leg of the Diagnose→Analyse→Fix spine keeps the funnel true to
 * the current Signature. A Signature edit silently invalidates prior audits;
 * without a prompt the user wouldn't know their "aligned" assets are now stale.
 * The banner shows ONLY real drift the service computed (DriftItem[]) — it never
 * fabricates a count, and renders nothing when there's no drift.
 */
import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { DriftItem } from '@/types/v4Fix';

export interface DriftBannerProps {
  /** Assets that drifted from the current Signature. Empty → banner self-hides. */
  driftItems: DriftItem[];
  /** Start a re-check of the drifted assets against the current Signature. */
  onRecheck: () => void;
}

/**
 * Emit a v4-namespaced PostHog event through the shared client. The cast threads
 * the v4 name through the shared union without editing the shared client; the
 * client is a safe no-op when PostHog is unconfigured.
 */
function emit(
  name: 'v4_fix_drift_banner_shown',
  props?: Record<string, string | number | boolean | null>,
): void {
  captureAlphaEvent(name, props);
}

export function DriftBanner({ driftItems, onRecheck }: DriftBannerProps): JSX.Element | null {
  const count = driftItems.length;
  const hasDrift = count > 0;
  const shownRef = useRef(false);

  // Emit once per appearance; reset when drift clears so a re-drift re-emits.
  useEffect(() => {
    if (!hasDrift) {
      shownRef.current = false;
      return;
    }
    if (shownRef.current) return;
    shownRef.current = true;
    emit('v4_fix_drift_banner_shown', { count });
  }, [hasDrift, count]);

  // Self-hide at zero drift.
  if (!hasDrift) return null;

  const noun = count === 1 ? 'asset' : 'assets';

  return (
    <Alert
      data-testid="v4-drift-banner"
      className="border-gold-warm/40 bg-gold-warm/10 text-foreground"
    >
      <AlertTriangle className="h-4 w-4 text-gold-warm" aria-hidden="true" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <AlertTitle className="text-foreground">Your Signature changed</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {count} {noun} {count === 1 ? 'was' : 'were'} built against an older
            Signature and may no longer match. Re-check {count === 1 ? 'it' : 'them'}{' '}
            to see what needs a refresh.
          </AlertDescription>
        </div>
        <Button
          data-testid="v4-drift-banner-recheck"
          onClick={onRecheck}
          className="min-h-[40px] shrink-0"
        >
          Re-check {count} {noun}
        </Button>
      </div>
    </Alert>
  );
}

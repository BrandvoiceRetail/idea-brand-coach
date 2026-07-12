/**
 * Focus Surface — the single-focus "what needs you" workspace for the busy brand owner.
 *
 * Thin page shell: loads the owner's REAL brand state via useBrandSnapshot (Trust Gap diagnostic +
 * Avatar 2.0 + reviews), shows loading / seeded-example / needs-diagnostic banners, then renders the
 * interactive FocusWorkspace keyed by the snapshot so a live load remounts with fresh queue state.
 * The coach uses the Trust Gap™ to surface the ONE highest-leverage thing; the owner steers; the
 * coach produces a stage-adaptive deliverable.
 */
import { Link } from 'react-router-dom';
import { Info, FlaskConical } from 'lucide-react';
import { FocusWorkspace } from '@/components/v2/focus/FocusWorkspace';
import { useBrandSnapshot } from '@/components/v2/focus/useBrandSnapshot';
import { ROUTES } from '@/config/routes';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const BRAND_GOLD = '#D4960A';

export default function FocusSurface() {
  const { snapshot, isLive, isLoading, needsDiagnostic } = useBrandSnapshot();

  // A stable signature so the workspace remounts (fresh queue/active state) when the snapshot
  // meaningfully changes — e.g. the live diagnostic finishes loading after first paint.
  const sig = `${snapshot.brand}|${snapshot.trustGap?.overall ?? 'none'}|${snapshot.evidence.length}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5">
        <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: BRAND_GOLD }}>
          Brand HQ · {snapshot.brand}
        </div>
        <p className="text-sm text-muted-foreground">
          One focus at a time. The coach points you at what moves the needle — you steer, it produces.{' '}
          <span className="text-slate-500">It remembers your brand between visits.</span>
        </p>
      </header>

      {!isLive && (
        <Alert className="mb-5" style={{ borderColor: BRAND_GOLD, background: '#FEF5DC' }}>
          <FlaskConical className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-2">
            You’re seeing a worked example (InfinityVault). Run your Trust Gap™ to make this your brand.
            <Button asChild size="sm" variant="outline" className="ml-auto">
              <Link to={ROUTES.FREE_DIAGNOSTIC}>Start my diagnostic</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLive && needsDiagnostic && (
        <Alert className="mb-5">
          <Info className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-2">
            We’ve got your brand, but no Trust Gap™ yet — run it so the coach can point you at the highest-leverage fix.
            <Button asChild size="sm" variant="outline" className="ml-auto">
              <Link to={ROUTES.FREE_DIAGNOSTIC}>Run the diagnostic</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-60 w-full rounded-2xl" />
        </div>
      ) : (
        <FocusWorkspace key={sig} snapshot={snapshot} />
      )}
    </div>
  );
}

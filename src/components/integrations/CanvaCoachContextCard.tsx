/**
 * CanvaCoachContextCard — shows how the user's imported Canva designs feed the
 * Brand Coach, and lets them re-sync that context on demand.
 *
 * Imports already re-sync the coach context server-side (canva-imports calls
 * canva-sync); this card makes that ingestion visible and gives an explicit
 * "Sync now" control. Presentational — state lives in `useCanvaConnection`.
 */

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import type { CanvaSyncResponse } from '@/services/canva/types';

export interface CanvaCoachContextCardProps {
  /** Number of designs the user has imported (drives the default count display). */
  importsCount: number;
  /** Result of the most recent explicit sync, or null if not synced this session. */
  coachContext: CanvaSyncResponse | null;
  /** True while a sync is in flight. */
  isSyncing: boolean;
  /** Trigger an explicit re-sync of imported designs into the coach context. */
  onSync: () => void;
}

export function CanvaCoachContextCard({
  importsCount,
  coachContext,
  isSyncing,
  onSync,
}: CanvaCoachContextCardProps): JSX.Element {
  const syncedCount = coachContext?.count ?? importsCount;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-secondary" aria-hidden="true" />
          <CardTitle className="text-xl">Brand Coach context</CardTitle>
          {coachContext?.coachUpdated && (
            <span className="ml-auto inline-flex items-center gap-1 text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              Synced
            </span>
          )}
        </div>
        <CardDescription>
          Your imported Canva designs are summarized into your Brand Coach&apos;s knowledge so it
          can reference your real collateral when advising on visual identity and consistency.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        <p className="text-sm">
          {syncedCount > 0 ? (
            <>
              <span className="font-semibold">{syncedCount}</span> imported design
              {syncedCount === 1 ? '' : 's'} {coachContext?.coachUpdated ? 'are' : 'will be'} part of
              your coach context.
            </>
          ) : (
            <span className="text-muted-foreground">
              Import a design above to add it to your Brand Coach context.
            </span>
          )}
        </p>
        {coachContext?.coachUpdated && (
          <p className="text-xs text-muted-foreground">
            Open the Brand Coach and ask about your visual brand — it now knows about these designs.
          </p>
        )}
      </CardContent>

      <CardFooter>
        <Button variant="outline" onClick={onSync} disabled={isSyncing}>
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Syncing…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Sync to Brand Coach
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

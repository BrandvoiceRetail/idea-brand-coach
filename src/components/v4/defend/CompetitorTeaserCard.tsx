/**
 * CompetitorTeaserCard (S-17) — Loop-5 competitive-pressure teaser.
 *
 * WHAT: An honest "coming" teaser for competitive monitoring. Competitor reads
 * are DEFERRED in Alpha, so this card explains what the watch WILL do and is
 * explicit that no competitor data is shown until it is actually pulled. It shows
 * NO numbers, charts, or competitor names — there is nothing real to show yet.
 *
 * WHY: Defending the gains eventually means watching rivals copy your move. We
 * tell the user it is coming rather than fabricating a competitor feed — the same
 * no-fabrication bar as the rest of /v4 (this replaces any temptation to reuse
 * the old fabricated competitor lift teaser).
 *
 * Tier-A vocabulary only; v23 semantic tokens (no hex); 0 horizontal overflow at
 * 375px. Purely presentational — fires one view event.
 */
import { useEffect, useRef } from 'react';
import { Swords, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  captureAlphaEvent,
} from '@/lib/posthogClient';

type V4CompetitorEvent = 'v4_defend_competitor_teaser_viewed';

function captureV4(name: V4CompetitorEvent): void {
  captureAlphaEvent(name, {});
}

export function CompetitorTeaserCard(): JSX.Element {
  const shownRef = useRef(false);
  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    captureV4('v4_defend_competitor_teaser_viewed');
  }, []);

  return (
    <Card data-testid="v4-defend-competitor-teaser" className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Swords className="h-4 w-4 text-idea-d" />
          Competitive pressure
          <Badge variant="outline" className="ml-1 gap-1 border-idea-d/40 text-idea-d">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Coming
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm"
          data-testid="v4-defend-competitor-coming"
        >
          <p className="font-medium text-foreground">
            Watch rivals copy your move — coming soon.
          </p>
          <p className="mt-1 text-muted-foreground">
            Competitor monitoring will flag when a rival shifts toward your
            positioning so you can defend it. It is not live yet — and until it is,
            I won&apos;t show competitor data I haven&apos;t actually pulled.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

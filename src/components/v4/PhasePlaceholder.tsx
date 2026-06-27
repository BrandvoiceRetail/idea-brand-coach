/**
 * PhasePlaceholder — the shared "coming in build phase N" frame used by every
 * Loop-2 and Loop-3 scaffold screen. Renders a labelled, v23-tokened card that
 * names the screen, what it will do, and which backend tools it will lean on, so
 * the shell/spine/nav are fully wired today while the real build lands later.
 *
 * This is intentionally inert: no data fetching, no fabricated values — only a
 * description of the screen-to-come and its dependencies.
 */
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface PhasePlaceholderProps {
  /** Screen title (e.g. "Decision Board"). */
  title: string;
  /** One-line description of what the finished screen does. */
  summary: string;
  /** The build phase this screen lands in (2 = Loop 2, 3 = Loop 3). */
  phase: 2 | 3;
  /** Lucide icon shown beside the title. */
  icon: LucideIcon;
  /** MCP / backend tools the screen will call when built (names only). */
  deps?: readonly string[];
  /** Optional test id for the wrapping card. */
  testId?: string;
}

export function PhasePlaceholder({
  title,
  summary,
  phase,
  icon: Icon,
  deps = [],
  testId,
}: PhasePlaceholderProps): JSX.Element {
  return (
    <Card data-testid={testId} className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-gold-warm" />
            {title}
          </CardTitle>
          <Badge variant="outline" className="shrink-0 text-[11px] font-medium">
            Coming in build phase {phase}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>{summary}</p>
        {deps.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
              Backend
            </span>
            {deps.map((d) => (
              <Badge key={d} variant="secondary" className="font-mono text-[11px]">
                {d}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

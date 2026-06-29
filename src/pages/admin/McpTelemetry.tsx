/**
 * MCP Tool Telemetry — admin tab (next to the evals).
 *
 * Surfaces the brand-coach MCP server's per-tool telemetry: latency, errors, and the
 * bounce signal (`outcome` = delivered vs needs_input/error/empty). Every tool call emits
 * one `mcp_tool_latency` event (uniform via `src/mcp/instrument.ts`), with `session_id`
 * correlation and an `arg_keys` shape — all flowing to PostHog in prod.
 *
 * The charts live in PostHog (the analytics store); this tab is the in-app entry point —
 * it explains each signal and deep-links to the live dashboard + each insight. (We link
 * rather than iframe so internal ops data stays behind PostHog's auth, not a public embed.)
 */
import { ExternalLink, Activity, Timer, AlertTriangle, Split } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const POSTHOG = 'https://eu.posthog.com/project/203641';
const DASHBOARD_URL = `${POSTHOG}/dashboard/780607`;

interface InsightCard {
  title: string;
  icon: typeof Activity;
  what: string;
  why: string;
  shortId: string;
}

const INSIGHTS: InsightCard[] = [
  {
    title: 'Tool outcomes over time',
    icon: Split,
    what: 'Daily tool calls split by outcome: delivered vs needs_input / error / empty.',
    why: 'A rising share of non-delivered outcomes is the bounce signal — the coach is asking or failing more than it is delivering.',
    shortId: 'XJDpU0VG',
  },
  {
    title: 'Per-tool latency, errors & dead-ends',
    icon: Timer,
    what: 'One row per tool: call volume, p95 latency, hard errors, and dead-end rate.',
    why: 'Find the slowest and most dead-end-prone tools — the first places to iterate.',
    shortId: 'XDUp9GYK',
  },
  {
    title: 'Bounce points — where sessions end',
    icon: AlertTriangle,
    what: "Each session's terminal tool call, grouped by the outcome it ended on.",
    why: 'A session ending on a non-delivered outcome is a bounce; the terminal tool is where the user dropped off.',
    shortId: 'HyH70HWZ',
  },
];

const SIGNALS: { label: string; tone: string }[] = [
  { label: 'delivered', tone: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { label: 'needs_input', tone: 'bg-amber-100 text-amber-800 border-amber-300' },
  { label: 'error', tone: 'bg-red-100 text-red-800 border-red-300' },
  { label: 'empty', tone: 'bg-slate-100 text-slate-700 border-slate-300' },
];

export default function McpTelemetry(): JSX.Element {
  return (
    <div className="space-y-6">
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertTitle>Every MCP tool call is instrumented</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            One <code>mcp_tool_latency</code> event per call (uniform via <code>instrument.ts</code>) carries{' '}
            <code>duration_ms</code>, <code>ok</code>, <code>error_name</code>, <code>session_id</code>,{' '}
            <code>arg_keys</code>, and the bounce signal <code>outcome</code>:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SIGNALS.map((s) => (
              <Badge key={s.label} variant="outline" className={s.tone}>
                {s.label}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            A session whose terminal call is not <code>delivered</code> is a bounce candidate. The charts live in
            PostHog; this tab links you straight to them.
          </p>
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Bounce & performance dashboard</h3>
          <p className="text-sm text-muted-foreground">Latency, errors and bounce patterns for every tool, live in prod.</p>
        </div>
        <Button asChild>
          <a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer">
            Open dashboard in PostHog <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {INSIGHTS.map((ins) => {
          const Icon = ins.icon;
          return (
            <Card key={ins.shortId} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {ins.title}
                </CardTitle>
                <CardDescription>{ins.what}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <p className="text-sm text-muted-foreground">{ins.why}</p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <a href={`${POSTHOG}/insights/${ins.shortId}`} target="_blank" rel="noopener noreferrer">
                    View insight <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

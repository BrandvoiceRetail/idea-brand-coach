/**
 * Coach Evals — internal admin dashboard.
 *
 * Renders the generated MCP evals report: the current coach's user-value scorecard,
 * the configuration comparison (skill set × tool grounding), static guardrail checks,
 * corpus coverage, and operator flags. Data comes from the committed, deterministic
 * report literal (regenerate with `npm run evals`). Route is wrapped in <AdminGate>.
 */
import { useMemo } from 'react';
import { ShieldCheck, ShieldX, CircleCheck, FlaskConical, Info } from 'lucide-react';
import { EVAL_REPORT } from '@/admin/coachEvals/report.generated';
import type { CoachValueKpi, KpiCategory } from '@/mcp/evals/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import EvalBench from './EvalBench';
import CriteriaStudio from './CriteriaStudio';
import CoachInstructionsStudio from './CoachInstructionsStudio';
import McpTelemetry from './McpTelemetry';

const BRAND_BLUE = '#111111';
const BRAND_GOLD = '#FFB627';

const pct = (n: number) => `${Math.round(n * 100)}%`;

function gradeClasses(grade: string): string {
  if (grade === 'A') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  if (grade === 'B') return 'bg-sky-100 text-sky-800 border-sky-300';
  if (grade === 'C') return 'bg-amber-100 text-amber-800 border-amber-300';
  return 'bg-red-100 text-red-800 border-red-300';
}

const CATEGORY_LABELS: Record<KpiCategory, string> = {
  grounding: 'Grounding & faithfulness',
  safety: 'Safety & guardrails',
  persona: 'Persona adaptation',
  actionability: 'Actionability (does it deliver value)',
  coverage: 'Coverage',
};

export default function CoachEvalsAdmin() {
  const report = EVAL_REPORT;
  const current = report.configs.find((c) => c.id === report.currentConfigId) ?? report.configs[0];
  const metricIds = report.configs[0]?.metrics.map((m) => m.id) ?? [];
  const metricLabel = (id: string) =>
    report.configs[0]?.metrics.find((m) => m.id === id)?.label ?? id;

  const kpisByCategory = useMemo(() => {
    const groups: Record<string, CoachValueKpi[]> = {};
    for (const k of report.coachValue) (groups[k.category] ??= []).push(k);
    return groups;
  }, [report.coachValue]);

  const heroPct = Math.round(report.coachValueScore * 100);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header / hero */}
      <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <img
              src="/lovable-uploads/717bf765-c54a-4447-9685-6c5a3ee84297.png"
              alt="IDEA Brand Coach"
              className="h-10 w-auto"
            />
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: BRAND_GOLD }}>
              <FlaskConical className="h-4 w-4" /> Internal · MCP Evals
            </div>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight" style={{ color: BRAND_BLUE }}>
            Brand Coach — Performance
          </h1>
          <p className="mt-1 text-muted-foreground max-w-xl">
            How the live coach is configured and how well it delivers user value, scored against the
            golden conversation corpus. {report.corpus.fixtures} fixtures · {report.corpus.journeys} journeys.
          </p>
        </div>
        <div
          className="rounded-2xl px-7 py-5 text-center shadow-md min-w-[170px]"
          style={{ backgroundColor: BRAND_BLUE }}
        >
          <div className="text-5xl font-extrabold leading-none text-white">{heroPct}<span className="text-2xl" style={{ color: BRAND_GOLD }}>%</span></div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-white/70">Coach value score</div>
          <Badge className={`mt-3 border ${gradeClasses(current?.grade ?? 'C')}`}>
            Current: {current?.label} · {current?.grade}
          </Badge>
        </div>
      </header>

      <Tabs defaultValue="value">
        <TabsList>
          <TabsTrigger value="value">Current coach</TabsTrigger>
          <TabsTrigger value="compare">Config comparison</TabsTrigger>
          <TabsTrigger value="guardrails">Guardrails &amp; flags</TabsTrigger>
          <TabsTrigger value="bench">Eval bench</TabsTrigger>
          <TabsTrigger value="criteria">Criteria studio</TabsTrigger>
          <TabsTrigger value="instructions">Coach instructions</TabsTrigger>
          <TabsTrigger value="telemetry">MCP telemetry</TabsTrigger>
        </TabsList>

        {/* ── Current coach value scorecard ── */}
        <TabsContent value="value" className="mt-6 space-y-8">
          {Object.entries(kpisByCategory).map(([cat, kpis]) => (
            <section key={cat} className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: BRAND_BLUE }}>
                {CATEGORY_LABELS[cat as KpiCategory] ?? cat}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {kpis.map((k) => (
                  <Card key={k.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between gap-2">
                        <span>{k.label}</span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: BRAND_BLUE }}>{k.display}</span>
                      </CardTitle>
                      <CardDescription className="text-xs">{k.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Progress value={Math.round(k.value * 100)} />
                      {k.detail && <p className="mt-2 text-xs text-muted-foreground">{k.detail}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </TabsContent>

        {/* ── Configuration comparison ── */}
        <TabsContent value="compare" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle style={{ color: BRAND_BLUE }}>Configuration comparison</CardTitle>
              <CardDescription>
                Each configuration grounds the MCP tools in a different skill set. Scores are
                deterministic (no model required).
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Configuration</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                    {metricIds.map((id) => (
                      <TableHead key={id} className="text-center whitespace-nowrap">{metricLabel(id)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.configs.map((c) => (
                    <TableRow key={c.id} className={c.current ? 'bg-amber-50' : undefined}>
                      <TableCell className="font-medium">
                        {c.label}
                        {c.current && (
                          <Badge className="ml-2 border" style={{ borderColor: BRAND_GOLD, color: BRAND_BLUE }}>live</Badge>
                        )}
                        <div className="text-xs text-muted-foreground max-w-xs">{c.description}</div>
                      </TableCell>
                      <TableCell className="text-center font-bold tabular-nums" style={{ color: BRAND_BLUE }}>{pct(c.composite)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`border ${gradeClasses(c.grade)}`}>{c.grade}</Badge>
                      </TableCell>
                      {metricIds.map((id) => {
                        const m = c.metrics.find((x) => x.id === id);
                        return (
                          <TableCell key={id} className="text-center text-sm tabular-nums">
                            <div className="font-medium">{pct(m?.value ?? 0)}</div>
                            <div className="text-[11px] text-muted-foreground">{m?.display}</div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {current?.metrics.map((m) => (
              <div key={m.id} className="rounded-lg border p-3 text-xs">
                <div className="font-semibold" style={{ color: BRAND_BLUE }}>{m.label}</div>
                <div className="text-muted-foreground">{m.description}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Guardrails, corpus, flags, live tier ── */}
        <TabsContent value="guardrails" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle style={{ color: BRAND_BLUE }}>Hard-rule guardrails</CardTitle>
              <CardDescription>Static checks of the App Skill Architecture hard rules.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {report.guardrails.map((g) => (
                <div key={g.id} className="flex items-start gap-3 rounded-md border p-3">
                  {g.passed ? (
                    <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <ShieldX className="h-5 w-5 shrink-0 text-red-600" />
                  )}
                  <div>
                    <div className="font-medium">{g.label}</div>
                    <div className="text-xs text-muted-foreground">{g.detail}</div>
                  </div>
                  <Badge className={`ml-auto border ${g.passed ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                    {g.passed ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle style={{ color: BRAND_BLUE }}>Corpus coverage</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6 text-sm">
              <Stat label="Fixtures" value={String(report.corpus.fixtures)} />
              <Stat label="Journeys" value={String(report.corpus.journeys)} />
              <Stat label="P1 / P2" value={`${report.corpus.personas.P1 ?? 0} / ${report.corpus.personas.P2 ?? 0}`} />
              <Stat label="Tool labels" value={String(report.corpus.uniqueToolLabels)} />
              <Stat label="Skill paths" value={String(report.corpus.uniqueSkillPaths)} />
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: BRAND_BLUE }}>
                <FlaskConical className="h-4 w-4" /> Live behavioural tier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={report.liveTier.available ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700 border border-slate-300'}>
                {report.liveTier.available ? 'Available' : 'Gated'}
              </Badge>
              <p className="mt-2 text-sm text-muted-foreground">{report.liveTier.reason}</p>
            </CardContent>
          </Card>

          {report.flags.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Operator flags</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {report.flags.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CircleCheck className="h-3 w-3" /> {report.generatedNote}
          </p>
        </TabsContent>

        {/* ── Trevor's curated test bench ── */}
        <TabsContent value="bench" className="mt-6">
          <EvalBench />
        </TabsContent>

        {/* ── Non-technical criteria authoring ── */}
        <TabsContent value="criteria" className="mt-6">
          <CriteriaStudio />
        </TabsContent>

        {/* ── Runtime-editable coach instructions (Phase B substrate) ── */}
        <TabsContent value="instructions" className="mt-6">
          <CoachInstructionsStudio />
        </TabsContent>

        <TabsContent value="telemetry" className="mt-6">
          <McpTelemetry />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-extrabold tabular-nums" style={{ color: BRAND_BLUE }}>{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

/**
 * Eval Bench — Trevor's admin test environment.
 *
 * Each curated case bundles supplied context, seeded memory, sample uploads, a practice
 * conversation, and the expected tools/skills/trigger/outcome. Trevor selects a case to
 * evaluate the coach's skill/tool performance; "Run live" is gated on the live tier.
 * Data: the pure-data catalog (`@/mcp/evals/cases/catalog`) + the generated report's live tier.
 */
import { useState } from 'react';
import { FileText, Brain, Upload, Wrench, Sparkles, Play, ShieldAlert } from 'lucide-react';
import { EVAL_CASES } from '@/mcp/evals/cases/catalog';
import type { EvalCase, Persona } from '@/mcp/evals/cases/types';
import { EVAL_REPORT } from '@/admin/coachEvals/report.generated';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const BRAND_BLUE = '#111111';
const BRAND_GOLD = '#D4960A';

function personaBadge(p: Persona) {
  if (p === 'P1') return { label: 'P1 · Brand owner', cls: 'bg-[#111111] text-white' };
  if (p === 'P2') return { label: 'P2 · Ops VA', cls: 'bg-[#D4960A] text-[#111111]' };
  return { label: 'Edge · Safety', cls: 'bg-red-100 text-red-800 border border-red-300' };
}

export default function EvalBench() {
  const [activeId, setActiveId] = useState(EVAL_CASES[0]?.id);
  const active = EVAL_CASES.find((c) => c.id === activeId) ?? EVAL_CASES[0];
  const live = EVAL_REPORT.liveTier;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Case catalog */}
      <aside className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: BRAND_BLUE }}>
          Eval cases ({EVAL_CASES.length})
        </h2>
        {EVAL_CASES.map((c) => {
          const pb = personaBadge(c.persona);
          const on = c.id === active?.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`w-full rounded-lg border p-3 text-left transition ${on ? 'border-[#D4960A] bg-amber-50' : 'hover:bg-muted/50'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold" style={{ color: BRAND_BLUE }}>{c.title}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${pb.cls}`}>{pb.label}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.category}</span>
              </div>
            </button>
          );
        })}
      </aside>

      {/* Case detail */}
      {active && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: BRAND_BLUE }}>{active.title}</h2>
            <p className="mt-1 text-muted-foreground">{active.description}</p>
          </div>

          <Section icon={<FileText className="h-4 w-4" />} title="Supplied context">
            <div className="text-sm">
              <span className="font-semibold">{active.context.brand}</span>
              {active.context.product && <span className="text-muted-foreground"> — {active.context.product}</span>}
              {active.context.avatarId && (
                <Badge className="ml-2 border" style={{ borderColor: BRAND_GOLD, color: BRAND_BLUE }}>{active.context.avatarId}</Badge>
              )}
            </div>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {active.context.fields.map((f) => (
                <div key={f.label} className="rounded border p-2">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                  <dd className="text-sm">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section icon={<Brain className="h-4 w-4" />} title="Seeded memory">
            <ul className="space-y-2">
              {active.memory.map((m, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Badge variant="secondary" className="shrink-0">{m.kind}</Badge>
                  <span>{m.note}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={<Upload className="h-4 w-4" />} title="Sample uploads">
            <div className="space-y-3">
              {active.uploads.map((u) => (
                <div key={u.name} className="rounded border">
                  <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                    <Badge variant="outline">{u.kind}</Badge>
                    <span className="font-mono text-xs">{u.name}</span>
                    <span className="text-xs text-muted-foreground">— {u.description}</span>
                  </div>
                  {u.content && (
                    <pre className="overflow-x-auto whitespace-pre-wrap p-3 text-xs text-slate-700">{u.content}</pre>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section icon={<Sparkles className="h-4 w-4" />} title="Practice conversation">
            <div className="space-y-3">
              {active.conversation.map((t, i) => (
                <div key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${t.role === 'user' ? 'rounded-br-sm bg-[#111111] text-white' : 'rounded-bl-sm border bg-white'}`}
                  >
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-70">
                      {t.role === 'user' ? 'User' : 'Coach'}
                    </div>
                    <div>{t.text}</div>
                    {(t.tools?.length || t.skills?.length) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.tools?.map((tool) => (
                          <span key={tool} className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] text-amber-900">⚙ {tool}</span>
                        ))}
                        {t.skills?.map((s) => (
                          <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">S{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={<Wrench className="h-4 w-4" />} title="Expected outcome">
            <div className="grid gap-3 sm:grid-cols-2">
              <Expect label="Tools" items={active.expected.tools} mono />
              <Expect label="Skills" items={active.expected.skills.map((s) => `S${s}`)} />
              <Expect label="Oracle" items={active.expected.oracle} />
              {active.expected.primaryTrigger && <Expect label="Primary trigger" items={[active.expected.primaryTrigger]} />}
            </div>
            <p className="mt-3 rounded-lg border-l-4 p-3 text-sm" style={{ borderColor: BRAND_GOLD, background: '#FEF5DC' }}>
              <span className="font-semibold">Deliverable: </span>{active.expected.outcome}
            </p>
          </Section>

          <Separator />

          {/* Run live (gated) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base" style={{ color: BRAND_BLUE }}>
                <Play className="h-4 w-4" /> Run live
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className={live.available ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700 border border-slate-300'}>
                  {live.available ? 'Live tier available' : 'Gated'}
                </Badge>
                <Button size="sm" disabled={!live.available} title={live.available ? 'Replay this case through the live coach' : 'Configure the live tier to enable'}>
                  Run this case
                </Button>
              </div>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" /> {live.reason}
              </p>
              {(live.metrics ?? []).length > 0 && (
                <div className="grid gap-2 sm:grid-cols-3">
                  {live.metrics!.map((m) => (
                    <div key={m.id} className="rounded border p-2 text-xs">
                      <div className="font-semibold" style={{ color: BRAND_BLUE }}>{m.display} <span className="font-normal text-muted-foreground">{m.label}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base" style={{ color: BRAND_BLUE }}>
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Expect({ label, items, mono }: { label: string; items: string[]; mono?: boolean }) {
  return (
    <div className="rounded border p-2">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.length ? (
          items.map((it) => (
            <span key={it} className={`rounded bg-muted px-1.5 py-0.5 text-[11px] ${mono ? 'font-mono' : ''}`}>{it}</span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">— (none expected)</span>
        )}
      </div>
    </div>
  );
}

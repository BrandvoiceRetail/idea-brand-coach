/**
 * FocusWorkspace — the interactive single-focus body (queue → focus → ideation → deliverable).
 * Pure presentational: takes a BrandSnapshot prop (seeded or live). The page (FocusSurface)
 * owns data loading + the header/banners and keys this by snapshot so a live load remounts cleanly.
 */
import { useMemo, useState } from 'react';
import { Check, CircleDot, Brain } from 'lucide-react';
import { FocusCard } from './FocusCard';
import { IdeationPanel } from './IdeationPanel';
import { DeliverablePanel } from './DeliverablePanel';
import { buildFocusQueue, composeDeliverable } from './engine';
import type { BrandSnapshot, Deliverable, DeliverableMode, FocusItem, Pillar } from './types';
import { Button } from '@/components/ui/button';

const BRAND_BLUE = '#1A3557';
const BRAND_GOLD = '#C9A84C';
const PILLARS: Pillar[] = ['insight', 'distinctive', 'empathetic', 'authentic'];
const PILLAR_SHORT: Record<Pillar, string> = { insight: 'I', distinctive: 'D', empathetic: 'E', authentic: 'A' };

function defaultMode(focus: FocusItem, ownerMode: DeliverableMode): DeliverableMode {
  return focus.modes.includes(ownerMode) ? ownerMode : focus.modes[0];
}

export function FocusWorkspace({ snapshot }: { snapshot: BrandSnapshot }) {
  const queue = useMemo(() => buildFocusQueue(snapshot), [snapshot]);

  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState(queue[0]?.id);
  const active = queue.find((f) => f.id === activeId) ?? queue[0];
  const [mode, setMode] = useState<DeliverableMode>(defaultMode(active, snapshot.ownerMode));
  const [idea, setIdea] = useState('');
  const [deliverable, setDeliverable] = useState<Deliverable | null>(null);

  const selectFocus = (f: FocusItem) => {
    setActiveId(f.id);
    setMode(defaultMode(f, snapshot.ownerMode));
    setIdea('');
    setDeliverable(null);
  };
  // Deterministic composer over the owner's LIVE snapshot (specific, instant, free). Seam: swap to
  // the credit-metered LLM edge fns (generate-brief / brand-canvas / brand-copy-generator) for the
  // paid tier — composeDeliverable documents the `generate` hook.
  const produce = () => setDeliverable(composeDeliverable({ focus: active, snapshot, mode, idea }));
  const changeMode = (m: DeliverableMode) => {
    setMode(m);
    setDeliverable((d) => (d ? composeDeliverable({ focus: active, snapshot, mode: m, idea }) : null));
  };
  const markDone = () => {
    const next = new Set(doneIds);
    next.add(active.id);
    setDoneIds(next);
    const upcoming = queue.find((f) => !next.has(f.id));
    if (upcoming) selectFocus(upcoming);
    else setDeliverable(null);
  };

  const activePos = queue.filter((f) => !doneIds.has(f.id)).findIndex((f) => f.id === active?.id) + 1;
  const remaining = queue.length - doneIds.size;
  const tg = snapshot.trustGap;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      {/* Main column — the single focus */}
      <div className="space-y-5">
        {active ? (
          <>
            <FocusCard focus={active} position={activePos} total={remaining} />
            <IdeationPanel value={idea} onChange={setIdea} onProduce={produce} producing={false} />
            <DeliverablePanel deliverable={deliverable} mode={mode} modes={active.modes} onModeChange={changeMode} />
            <div className="flex justify-end">
              <Button variant="outline" onClick={markDone}>
                <Check className="mr-1 h-4 w-4" /> Mark done · next focus
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border p-10 text-center text-muted-foreground" style={{ borderColor: '#E4E7EC' }}>
            You’re all caught up. Nothing needs you right now.
          </div>
        )}
      </div>

      {/* Right rail — what the coach knows + the queue */}
      <aside className="space-y-5">
        {tg && (
          <div className="rounded-2xl border p-4" style={{ borderColor: '#E4E7EC' }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Trust Gap™</span>
              <span className="text-2xl font-extrabold" style={{ color: BRAND_BLUE }}>{tg.overall}<span className="text-sm text-slate-400">/100</span></span>
            </div>
            <div className="mt-3 space-y-2">
              {PILLARS.map((p) => {
                const primary = p === tg.primaryGap;
                return (
                  <div key={p} className="flex items-center gap-2">
                    <span className="w-4 text-xs font-bold" style={{ color: primary ? '#B42318' : BRAND_BLUE }}>{PILLAR_SHORT[p]}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${(tg.pillars[p] / 25) * 100}%`, background: primary ? '#B42318' : BRAND_BLUE }} />
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums text-slate-500">{tg.pillars[p]}/25</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {snapshot.avatar && (
          <div className="rounded-2xl border p-4" style={{ borderColor: '#E4E7EC' }}>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <Brain className="h-3.5 w-3.5" /> Your customer
            </div>
            <p className="mt-2 text-xs text-slate-600"><span className="font-semibold text-slate-800">Why now:</span> {snapshot.avatar.whyBuyingToday}</p>
            <p className="mt-1.5 text-xs text-slate-600"><span className="font-semibold text-slate-800">What stops them:</span> {snapshot.avatar.topObjection}</p>
          </div>
        )}

        <div className="rounded-2xl border p-4" style={{ borderColor: '#E4E7EC' }}>
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">The queue</div>
          <ul className="mt-2 space-y-1">
            {queue.map((f) => {
              const done = doneIds.has(f.id);
              const isActive = f.id === active?.id;
              return (
                <li key={f.id}>
                  <button
                    onClick={() => selectFocus(f)}
                    className={`flex w-full items-start gap-2 rounded-lg p-2 text-left text-xs transition ${isActive ? 'bg-amber-50' : 'hover:bg-muted/50'} ${done ? 'opacity-50' : ''}`}
                  >
                    {done ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: isActive ? BRAND_GOLD : '#CBD5E1' }} />}
                    <span className={done ? 'line-through' : 'font-medium text-slate-700'}>{f.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}

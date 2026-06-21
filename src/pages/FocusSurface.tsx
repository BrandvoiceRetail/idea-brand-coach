/**
 * Focus Surface — the single-focus "what needs you" workspace for the busy brand owner.
 *
 * The coach uses the Trust Gap™ to pick the ONE highest-leverage thing, the owner reacts/dictates,
 * and the coach produces a stage-adaptive deliverable. Data is seeded today (SEED_SNAPSHOT) behind
 * a clean seam — swap in a hook that loads the user's real brand + diagnostic to go live.
 */
import { useMemo, useState } from 'react';
import { Check, CircleDot, Brain } from 'lucide-react';
import { FocusCard } from '@/components/v2/focus/FocusCard';
import { IdeationPanel } from '@/components/v2/focus/IdeationPanel';
import { DeliverablePanel } from '@/components/v2/focus/DeliverablePanel';
import { buildFocusQueue, composeDeliverable, SEED_SNAPSHOT } from '@/components/v2/focus/engine';
import type { Deliverable, DeliverableMode, FocusItem, Pillar } from '@/components/v2/focus/types';
import { Button } from '@/components/ui/button';

const BRAND_BLUE = '#1A3557';
const BRAND_GOLD = '#C9A84C';
const PILLARS: Pillar[] = ['insight', 'distinctive', 'empathetic', 'authentic'];
const PILLAR_SHORT: Record<Pillar, string> = { insight: 'I', distinctive: 'D', empathetic: 'E', authentic: 'A' };

function defaultMode(focus: FocusItem, ownerMode: DeliverableMode): DeliverableMode {
  return focus.modes.includes(ownerMode) ? ownerMode : focus.modes[0];
}

export default function FocusSurface() {
  const snapshot = SEED_SNAPSHOT; // seam: replace with useBrandSnapshot()
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

  const activePos = queue.filter((f) => !doneIds.has(f.id)).findIndex((f) => f.id === active.id) + 1;
  const remaining = queue.length - doneIds.size;
  const tg = snapshot.trustGap;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5">
        <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: BRAND_GOLD }}>Brand HQ · {snapshot.brand}</div>
        <p className="text-sm text-muted-foreground">One focus at a time. The coach points you at what moves the needle — you steer, it produces. <span className="text-slate-500">It remembers your brand between visits.</span></p>
      </header>

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
    </div>
  );
}

/**
 * FocusCard — the ONE thing that needs the owner now. Evidence-led, plain language,
 * no framework jargon or buyer-state names in what the owner reads.
 */
import { Sparkles, Quote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { FocusItem } from './types';

const BRAND_BLUE = '#111111';
const BRAND_GOLD = '#FFB627';

export function FocusCard({ focus, position, total }: { focus: FocusItem; position: number; total: number }) {
  return (
    <section
      className="rounded-2xl border p-6 shadow-sm"
      style={{ borderColor: '#E4E7EC', background: 'linear-gradient(180deg,#FFFFFF,#FBFAF7)' }}
      aria-label="Your current focus"
    >
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: BRAND_GOLD }}>
        <Sparkles className="h-4 w-4" /> What needs you now
        <span className="ml-auto font-semibold text-muted-foreground">{position} of {total}</span>
      </div>

      <h1 className="mt-2 text-2xl font-extrabold leading-tight md:text-3xl" style={{ color: BRAND_BLUE }}>
        {focus.title}
      </h1>
      <p className="mt-2 max-w-2xl text-[15px] text-slate-600">{focus.why}</p>

      {focus.trigger && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge className="border bg-amber-50 text-[#111111]" style={{ borderColor: BRAND_GOLD }}>
            Decision Trigger™ · {focus.trigger}
          </Badge>
          {focus.anchor && <span className="text-xs text-muted-foreground">like {focus.anchor}</span>}
        </div>
      )}

      {focus.evidence.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Your customers’ own words</div>
          <ul className="mt-2 space-y-1.5">
            {focus.evidence.map((e) => (
              <li key={e} className="flex items-start gap-2 text-sm italic text-slate-700">
                <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: BRAND_GOLD }} />
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

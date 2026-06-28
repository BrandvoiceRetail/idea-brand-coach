/**
 * IdeationPanel — the owner gets their idea down; the coach focuses it toward the deliverable.
 * Capture is low-friction (type or dictate); the coach does the structuring.
 */
import { Mic, Wand2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const BRAND_BLUE = '#111111';

export function IdeationPanel({
  value,
  onChange,
  onProduce,
  producing,
}: {
  value: string;
  onChange: (v: string) => void;
  onProduce: () => void;
  producing: boolean;
}) {
  return (
    <section className="rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }} aria-label="Get your idea down">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: BRAND_BLUE }}>
          Your steer (optional)
        </h2>
        <Button variant="ghost" size="sm" disabled title="Voice capture coming soon">
          <Mic className="mr-1 h-4 w-4" /> Dictate
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        React, add what you know, or say where you want to take this. The coach focuses it into the deliverable — you don’t have to structure it.
      </p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. lean into the lifetime warranty; my buyers are competitive players who travel to tournaments…"
        className="mt-3 min-h-[88px] text-sm"
        aria-label="Your steer"
      />
      <div className="mt-3 flex justify-end">
        <Button onClick={onProduce} disabled={producing} style={{ backgroundColor: BRAND_BLUE }}>
          <Wand2 className="mr-1.5 h-4 w-4" />
          {producing ? 'Focusing…' : 'Produce the deliverable'}
        </Button>
      </div>
    </section>
  );
}

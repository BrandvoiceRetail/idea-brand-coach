/**
 * DeliverablePanel — the stage-adaptive output. The owner picks how they work (DIY listing copy,
 * a designer brief + image prompt, a brand canvas, or a competitor response) and gets a ready
 * artifact, with a compliance gate on risky claims. Copy buttons make it paste-ready.
 */
import { useState } from 'react';
import { Copy, Check, ShieldAlert, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Deliverable, DeliverableMode } from './types';
import { DELIVERABLE_LABELS } from './types';

const BRAND_BLUE = '#1A3557';
const BRAND_GOLD = '#C9A84C';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? <Check className="mr-1 h-4 w-4 text-emerald-600" /> : <Copy className="mr-1 h-4 w-4" />}
      {done ? 'Copied' : label}
    </Button>
  );
}

export function DeliverablePanel({
  deliverable,
  mode,
  modes,
  onModeChange,
}: {
  deliverable: Deliverable | null;
  mode: DeliverableMode;
  modes: DeliverableMode[];
  onModeChange: (m: DeliverableMode) => void;
}) {
  return (
    <section className="rounded-2xl border" style={{ borderColor: '#E4E7EC' }} aria-label="Deliverable">
      <div className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: '#E4E7EC' }}>
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Make it:</span>
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${m === mode ? 'text-white' : 'text-slate-600 hover:bg-muted'}`}
            style={m === mode ? { backgroundColor: BRAND_BLUE } : undefined}
            aria-pressed={m === mode}
          >
            {DELIVERABLE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="p-5">
        {!deliverable ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <FileText className="h-7 w-7" style={{ color: BRAND_GOLD }} />
            Add your steer (optional) and hit <strong>Produce the deliverable</strong> — the coach turns this focus into something you can use today.
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-base font-bold" style={{ color: BRAND_BLUE }}>{deliverable.title}</h3>

            {deliverable.claimFlags && deliverable.claimFlags.length > 0 && (
              <Alert style={{ borderColor: BRAND_GOLD, background: '#FDF8EE' }}>
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-semibold">Confirm before publishing:</span>
                  <ul className="mt-1 list-disc pl-5">
                    {deliverable.claimFlags.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed text-slate-800">
              {deliverable.body}
            </pre>

            {deliverable.pasteablePrompt && (
              <div className="rounded-lg border" style={{ borderColor: '#E4E7EC' }}>
                <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-semibold" style={{ color: BRAND_BLUE }}>
                  Paste-ready image prompt
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap p-3 font-mono text-xs text-slate-700">{deliverable.pasteablePrompt}</pre>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <CopyButton text={deliverable.body} label="Copy deliverable" />
              {deliverable.pasteablePrompt && <CopyButton text={deliverable.pasteablePrompt} label="Copy image prompt" />}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

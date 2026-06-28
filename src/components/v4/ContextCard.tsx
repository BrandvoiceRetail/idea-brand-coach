/**
 * ContextCard — the "I won't ask twice" surface. Renders what the coach already
 * knows (filled slots) and lets the user fill / confirm anything still missing.
 * Reads + writes through the V4ContextStore (get_context_status / provide_context
 * pattern), so once a slot is stated it is never re-asked.
 */
import { useState } from 'react';
import { Check, PencilLine } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useV4Context } from '@/contexts/V4ContextStore';
import { CompletenessRing } from './CompletenessRing';

export function ContextCard(): JSX.Element {
  const { contextCard, needsInput, allFilled, provideContext, fillMap } = useV4Context();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  /** Effective draft = explicit edit, else the coach's inferred guess (editable). */
  const draftValue = (slotKey: string): string => {
    if (drafts[slotKey] !== undefined) return drafts[slotKey];
    return fillMap.find((s) => s.key === slotKey)?.value ?? '';
  };

  const submit = (key: string): void => {
    const value = draftValue(key).trim();
    if (!value) return;
    provideContext([{ key, value, source: 'manual' }]);
    setDrafts((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Check className="h-5 w-5 text-idea-d" />
              What I know about your brand
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              I won't ask twice — once it's here, it carries through every step.
            </p>
          </div>
          <CompletenessRing filled={contextCard.length} total={fillMap.length} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {contextCard.length > 0 && (
          <dl className="space-y-2">
            {contextCard.map((slot) => (
              <div
                key={slot.key}
                className="flex items-start justify-between gap-3 rounded-md bg-muted/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {slot.name}
                  </dt>
                  <dd className="break-words text-sm text-foreground">{slot.value}</dd>
                </div>
                <Check className="mt-1 h-4 w-4 shrink-0 text-idea-d" aria-hidden="true" />
              </div>
            ))}
          </dl>
        )}

        {needsInput.length > 0 ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <PencilLine className="h-4 w-4 text-gold-warm" />
              A few things to fill in
            </p>
            {needsInput.map((slot) => (
              <div key={slot.key} className="space-y-1">
                <label htmlFor={`ctx-${slot.key}`} className="text-sm text-muted-foreground">
                  {slot.askQuestion}
                </label>
                <div className="flex gap-2">
                  <Input
                    id={`ctx-${slot.key}`}
                    value={draftValue(slot.key)}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [slot.key]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submit(slot.key);
                    }}
                    placeholder={slot.name}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => submit(slot.key)}
                    disabled={!draftValue(slot.key).trim()}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          allFilled && (
            <p className="text-sm text-idea-d">
              Got everything I need to get started.
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}

/**
 * V5BriefScreen — /v5 step ⑤: the design brief. REUSES MoveBriefClaimGate
 * (the shared BriefSlots contract from src/types/v4Analyse, re-exported by
 * v4Fix) so the claim gate, loading, error and empty states are the proven
 * ones. This wrapper owns the /v5 framing, the honest needs_input state, and
 * a plain-text export download. Never fakes a brief.
 */
import { Button } from '@/components/ui/button';
import { GlassEyebrow, GlassPanel } from '@/components/v2/problem-solver/glass';
import { MoveBriefClaimGate } from '@/components/v4/analyse/MoveBriefClaimGate';
import type { BriefSlots } from '@/types/v4Fix';
import type { ClaimGateItem } from '@/types/v4Analyse';
import type { NeedsInputItem } from '@/types/forensicBuild';
import { V5Stage } from './V5Chrome';

export interface V5BriefScreenProps {
  brief: BriefSlots | null;
  claims: ClaimGateItem[];
  isLoading: boolean;
  error: string | null;
  /** The engine's honest "I still need…" demand (null = none). */
  needsInput: NeedsInputItem[] | null;
  onConfirmClaim: (claim: ClaimGateItem, index: number) => void;
  onExport: () => void;
  onRetry: () => void;
  onContinue: () => void;
  onBack: () => void;
}

export function V5BriefScreen({
  brief,
  claims,
  isLoading,
  error,
  needsInput,
  onConfirmClaim,
  onExport,
  onRetry,
  onContinue,
  onBack,
}: V5BriefScreenProps): JSX.Element {
  return (
    <V5Stage wide>
      <div className="mb-7 text-center">
        <GlassEyebrow>Your alpha output</GlassEyebrow>
        <h1 className="font-display text-3xl font-extrabold text-foreground">Design brief</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          One fix, one score, one brief you can hand off today, grounded in your reviews.
        </p>
      </div>

      {needsInput && needsInput.length > 0 ? (
        <GlassPanel className="p-6">
          <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
            Before I write this brief
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            I won&apos;t guess my way through a brief. Here is what I still need:
          </p>
          <ul className="mb-4 space-y-2.5">
            {needsInput.map((item) => (
              <li key={`${item.slot}-${item.question}`} className="text-sm leading-relaxed">
                <span className="font-semibold text-foreground">{item.question}</span>
                {item.why && <span className="block text-xs text-muted-foreground">{item.why}</span>}
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" className="rounded-xl" onClick={onRetry}>
            Try again
          </Button>
        </GlassPanel>
      ) : (
        <MoveBriefClaimGate
          brief={brief}
          claims={claims}
          onConfirmClaim={onConfirmClaim}
          onExport={onExport}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
        />
      )}

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
        {brief && !isLoading && !error && (
          <Button
            type="button"
            variant="brand"
            className="min-h-12 rounded-xl px-6 font-extrabold"
            onClick={onContinue}
          >
            This is my plan. What&apos;s next? →
          </Button>
        )}
        <Button type="button" variant="ghost" className="rounded-xl text-muted-foreground" onClick={onBack}>
          ← Back to profile
        </Button>
      </div>
    </V5Stage>
  );
}

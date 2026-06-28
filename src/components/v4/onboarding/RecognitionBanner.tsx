/**
 * RecognitionBanner — the "I heard you" moment at the top of the read-it-back run.
 * Renders ONLY when the run produced at least one real finding; the copy is
 * generic recognition, never a fabricated brand claim.
 */
import { Sparkles } from 'lucide-react';

interface RecognitionBannerProps {
  /** How many steps returned a grounded finding (drives the count + visibility). */
  findingCount: number;
}

export function RecognitionBanner({ findingCount }: RecognitionBannerProps): JSX.Element | null {
  if (findingCount <= 0) return null;
  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-gold-light bg-gold-light/40 px-4 py-3"
      data-testid="recognition-banner"
    >
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-gold-warm" />
      <div>
        <p className="font-semibold text-foreground">Here's what I heard.</p>
        <p className="text-sm text-muted-foreground">
          Read it back below — it's all from your own words. Tell me if I've got it right.
        </p>
      </div>
    </div>
  );
}

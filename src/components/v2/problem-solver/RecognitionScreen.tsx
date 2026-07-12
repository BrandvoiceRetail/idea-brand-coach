/**
 * Movement 1 — Recognition. The opening of the diagnostic entry experience.
 *
 * Source of truth: IDEA-APP-ENTRY-001 v1.1 + ux-design-entry-experience.md. The
 * product's own Decision Trigger is Recognition, so the entry MUST mirror the
 * customer's experience before it says one word about itself — the neurological
 * precondition for a tired, sceptical brand owner to hear anything that follows.
 *
 * Visual language: "dark liquid glass" — a glass mirror panel floating over the
 * cinematic cliff/chasm image (the Trust Gap made literal). The image is decorative
 * (aria-hidden) and fades behind the glass.
 *
 * Hard rules (acceptance criteria 1, 8, 9), enforced here:
 *   • NO product references, NO framework vocabulary, NO "Trust Gap" terminology.
 *   • NO CAPTURE element names, NO buyer-state names. Entirely about the customer.
 *   • The product does not exist yet on this screen — hence no BrandBar / Stepper.
 *
 * Pure presentational — no state, no engine calls. The shell owns analytics + the
 * entry→flow transition (here: advance to Movement 2 — Diagnosis).
 */

import { ArrowDown } from 'lucide-react';
import { CinematicHero, GlassPanel } from './glass';

/** The cinematic Recognition backdrop — the cliff/chasm (stand-in until Trevor's hi-res asset). */
const RECOGNITION_IMAGE = '/idea-cliff-hero.jpg';

interface RecognitionScreenProps {
  /** Advance to Movement 2 (Diagnosis). */
  onContinue: () => void;
  /**
   * Render without the full-page frame so the screen flows inside a host shell that
   * already provides the page chrome (the /v4 surface). Off by default.
   */
  embedded?: boolean;
}

export function RecognitionScreen({ onContinue, embedded = false }: RecognitionScreenProps): JSX.Element {
  return (
    <div className={embedded ? undefined : 'min-h-screen bg-background'}>
      <CinematicHero image={RECOGNITION_IMAGE}>
        <GlassPanel strong className="px-7 py-9">
          <p className="font-display mb-3 text-[1.5rem] font-bold leading-tight text-foreground">
            You&rsquo;ve looked at your listing more times than you can count.{' '}
            <span className="font-normal text-muted-foreground">
              You&rsquo;ve changed the images, the headline, the bullets. Maybe the price. You asked the AI
              tools and used what they gave you.
            </span>
          </p>
          <p className="font-display mb-3 text-[1.5rem] font-bold leading-tight text-foreground">
            And the number is still wrong.
          </p>
          <p className="text-[1rem] leading-relaxed text-muted-foreground">
            Not dramatically. Persistently, stubbornly below where it should be for the product you&rsquo;ve
            built &mdash; and nobody has been able to tell you why.
          </p>
        </GlassPanel>

        <div className="mt-7 flex justify-center">
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-foreground/[0.05] px-6 py-3 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-foreground/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-warm"
          >
            Show me why
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
      </CinematicHero>
    </div>
  );
}

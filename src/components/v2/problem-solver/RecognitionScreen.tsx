/**
 * Movement 1 — Recognition. The opening of the diagnostic entry experience.
 *
 * Mounted on the /v3/diagnostic review route (via ProblemSolverDiagnostic's
 * `showRecognition` prop) while Trevor signs off on Movement 1; /v2/diagnostic
 * stays as the untouched live baseline until then.
 *
 * Source of truth: IDEA-APP-ENTRY-001 v1.1 (Revised Entry Experience Brief).
 * The product's own Decision Trigger is Recognition, so the entry experience must
 * MIRROR the customer's experience before it says one word about itself. This is
 * the neurological precondition for the (tired, sceptical) brand owner to hear
 * anything that follows — not a warm-up, the most important thing on the page.
 *
 * Hard rules from the brief, enforced here (acceptance criteria 1, 8, 9):
 *   • NO product references, NO framework vocabulary, NO "Trust Gap" terminology.
 *   • NO CAPTURE element names, NO buyer-state names. Entirely about the customer.
 *   • The product does not exist yet on this screen — hence no BrandBar / Stepper.
 *
 * Sequence note: Movement 2 (Diagnosis) and Movement 3 (Prescription) are NOT
 * built yet — Trevor's gate is "show me Movement 1 before you move to Movement 2"
 * (AC #7). Until they exist, the continue affordance ("Show me why") enters the
 * existing diagnostic flow directly; Movements 2 & 3 will slot in between later.
 *
 * Pure presentational — no state, no engine calls. The shell owns analytics + the
 * entry→flow transition.
 *
 * ── Visual brief for the recognition image (from §3 of IDEA-APP-ENTRY-001 v1.1) ──
 * The image does NOT show the product, a score, a dashboard, or an outcome. It
 * shows the EMOTIONAL EXPERIENCE of the person the copy describes: someone who has
 * worked hard on the right problem and not yet found the answer. Not dramatic
 * failure — the specific, quiet exhaustion of having tried the right things and
 * watched the number stay wrong. It must NOT be aspirational and must NOT show
 * success (aspiration speaks to the wrong buyer state). The test: does a tired
 * brand owner look at it and think "that is where I am right now"? If yes, it is
 * right. If it makes them think about where they want to be, it is wrong.
 * Matthew brings the creative instinct — drop the chosen asset into
 * RECOGNITION_IMAGE below and it replaces the placeholder slot.
 */

import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { PS_COLORS } from './theme';

/**
 * The recognition image. Interim free-license photo (Pexels by Mikael Blomkvist —
 * free for commercial use, cropped to 16:10) chosen against the visual brief above:
 * a founder at her desk, quiet weariness, muted warm palette, no product / screen /
 * text, landscape with negative space. To swap (e.g. for a Nano Banana generated
 * version once approved), replace public/recognition-mvmt1.jpg or repoint src.
 */
const RECOGNITION_IMAGE: { src: string; alt: string } | null = {
  src: '/recognition-mvmt1.jpg',
  alt: 'A brand owner at her desk, eyes closed with both hands pressed to her temples, worn down from trying to fix what is not working.',
};

interface RecognitionScreenProps {
  /** Enter the diagnostic flow. (Later: advance to Movement 2 — Diagnosis.) */
  onContinue: () => void;
}

export function RecognitionScreen({ onContinue }: RecognitionScreenProps): JSX.Element {
  // Keep the recognition moment at the top of the viewport on arrival.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: PS_COLORS.g100 }}>
      <div className="mx-auto flex max-w-[640px] flex-col items-center px-5 py-10 text-center sm:py-16">
        {/* The recognition image — the mirror that lands before a word is read. */}
        <div className="mb-7 w-full">
          {RECOGNITION_IMAGE ? (
            <img
              src={RECOGNITION_IMAGE.src}
              alt={RECOGNITION_IMAGE.alt}
              className="mx-auto max-h-[200px] w-full rounded-2xl object-cover sm:max-h-[300px]"
            />
          ) : (
            <div
              className="mx-auto grid aspect-[16/10] w-full place-items-center rounded-2xl border"
              style={{ background: PS_COLORS.navyLight, borderColor: PS_COLORS.line }}
              aria-hidden="true"
            >
              <span className="px-6 text-[13px] italic" style={{ color: PS_COLORS.g500 }}>
                Recognition image — to be provided
              </span>
            </div>
          )}
        </div>

        <h1
          className="mb-4 text-[24px] font-extrabold leading-tight tracking-tight sm:text-[30px]"
          style={{ color: PS_COLORS.navy }}
        >
          You&rsquo;ve looked at that listing more times than you can count.
        </h1>

        <p className="mb-4 text-[16px] leading-relaxed" style={{ color: PS_COLORS.g900 }}>
          You&rsquo;ve changed the images. Rewritten the headline. Reworked the bullets. Maybe dropped the
          price. You asked ChatGPT and used what it gave you. You read the threads, sat through the
          huddles, maybe paid someone who promised they&rsquo;d seen this before.
        </p>

        <p className="mb-6 text-[16px] leading-relaxed" style={{ color: PS_COLORS.g900 }}>
          And the number is still wrong. Not dramatically wrong &mdash; just stubbornly, quietly below
          where it should be for the product you built and the work you&rsquo;ve put in.
        </p>

        <p
          className="mb-9 text-[19px] font-extrabold leading-snug sm:text-[21px]"
          style={{ color: PS_COLORS.navy }}
        >
          Nobody has been able to tell you why.
        </p>

        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center justify-center gap-2 rounded-[10px] px-7 py-3.5 text-sm font-extrabold text-white transition-opacity hover:opacity-90"
          style={{ background: PS_COLORS.navy }}
        >
          Show me why
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

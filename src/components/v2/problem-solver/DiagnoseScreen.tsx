/**
 * S1 — Diagnose (FREE).
 *
 * The four evidence-based questions + scoring math, rendered in the dark-liquid-glass
 * language: ONE question at a time (QuestionScale) under a slim gold progress hairline,
 * with the AC#4 instruction verbatim. On the fourth answer the self-report Trust Gap
 * is computed (computeSelfReport → buildTrustGap) and the results resequence per AC#5/6:
 * Component 0 finding (largest) → Trust Gap Score + pillar breakdown → Defence loop →
 * "Upload my listing and find the fix" (AC#10).
 *
 * LIVE-WIRED: the question set + scoring are the real diagnostic engine; the reveal
 * numbers come from the user's own answers. The engine contract (onAnswer / onReveal /
 * onContinue / answers) is unchanged — only the visual layer is new.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { buildTrustGap, type TrustGapInputScores } from '@/lib/trustGap';
import {
  Component0Hero,
  DefenceLoop,
  GlassEyebrow,
  ProgressHairline,
  QuestionScale,
  ScorePillars,
  type PillarRow,
} from './glass';
import { GoldButton } from './primitives';
import { PROBLEM_SOLVER_QUESTIONS, computeSelfReport } from './diagnosticQuestions';

interface DiagnoseScreenProps {
  /** Persisted answers (so returning to S1 keeps the selections). */
  answers: Record<string, string>;
  onAnswer: (questionId: string, value: string) => void;
  /** Fired with the computed self-report on reveal; the shell stores it. */
  onReveal: (scores: TrustGapInputScores) => void;
  /** Advance to S2 (Upload). */
  onContinue: () => void;
  /**
   * Embedded in the /v4 spine (chrome supplied by the host). Off by default so the
   * standalone /v2·/v3 routes keep their own eyebrow.
   */
  embedded?: boolean;
}

/** "1 — All specs and claims" → "All specs and claims" for the scale-end captions. */
function endLabel(raw: string): string {
  return raw.replace(/^\s*\d+\s*[—–-]\s*/, '');
}

export function DiagnoseScreen({
  answers,
  onAnswer,
  onReveal,
  onContinue,
  embedded = false,
}: DiagnoseScreenProps): JSX.Element {
  const total = PROBLEM_SOLVER_QUESTIONS.length;
  // Start on the first unanswered question so a returning user resumes where they were.
  const firstUnanswered = PROBLEM_SOLVER_QUESTIONS.findIndex((q) => !answers[q.id]);
  const [qIndex, setQIndex] = useState(firstUnanswered === -1 ? total - 1 : firstUnanswered);
  const [revealed, setRevealed] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  const current = PROBLEM_SOLVER_QUESTIONS[qIndex];
  const selected = answers[current.id]
    ? Number(answers[current.id])
    : undefined;

  const handleAnswer = (value: number): void => {
    onAnswer(current.id, String(value));
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    // Brief beat so the selection registers, then advance / reveal (mock parity).
    advanceTimer.current = setTimeout(() => {
      if (qIndex < total - 1) {
        setQIndex((i) => i + 1);
      } else {
        const scores = computeSelfReport({ ...answers, [current.id]: String(value) });
        onReveal(scores);
        setRevealed(true);
      }
    }, 280);
  };

  // progress: completed questions over total, nudged so q1 shows a sliver.
  const progress = revealed ? 100 : (qIndex / total) * 100 + 8;

  if (revealed) {
    const model = buildTrustGap(computeSelfReport(answers));
    const pillars: PillarRow[] = model.dimensions.map((d) => ({
      name: d.label,
      value: (d.score / 25) * 100,
      weak: d.key === model.primaryGap,
      display: `${d.score}/25`,
    }));

    return (
      <div className="glass-stage mx-auto w-full max-w-[460px] py-2">
        <Component0Hero>
          Your widest gap is <span className="text-gold-warm">{model.primaryGapMeta.label}</span> —{' '}
          {model.primaryGapMeta.measures} That is where buyers lose confidence first.
        </Component0Hero>

        <ScorePillars score={model.overall} pillars={pillars} />

        <ScorePillarsCta onContinue={onContinue} />

        <DefenceLoop active="Diagnose" />
      </div>
    );
  }

  return (
    <div className="glass-stage mx-auto w-full max-w-[460px] py-2">
      <div className="mb-1">
        {!embedded && <GlassEyebrow>Free Trust Gap Diagnostic</GlassEyebrow>}
        <div className="text-[0.76rem] font-bold uppercase tracking-wide text-gold-warm">
          Four questions · each looks at a dimension of the gap
        </div>
        <div className="font-display mt-2.5 text-[1.18rem] font-medium leading-snug text-foreground">
          Look at your listing as a first-time shopper would. Score what you actually see, not what you
          intended to show.
        </div>
      </div>

      <ProgressHairline value={progress} />

      <QuestionScale
        key={current.id}
        index={qIndex}
        total={total}
        question={current.question}
        hint={current.pillarLabel}
        ends={[endLabel(current.scaleLow), endLabel(current.scaleHigh)]}
        value={selected}
        onAnswer={handleAnswer}
      />

      {qIndex > 0 && (
        <button
          type="button"
          onClick={() => setQIndex((i) => Math.max(0, i - 1))}
          className="mt-4 text-[0.82rem] text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          ← Previous question
        </button>
      )}
    </div>
  );
}

/** The upgrade CTA block between the score and the Defence loop (AC#10). */
function ScorePillarsCta({ onContinue }: { onContinue: () => void }): JSX.Element {
  return (
    <div className="glass sheen mt-4 p-6">
      <p className="mb-4 text-[0.96rem] leading-relaxed text-muted-foreground">
        The score shows you <b className="text-foreground">where</b> the gap is. The full analysis shows
        what is causing it in <b className="text-foreground">your</b> listing, in the language of{' '}
        <b className="text-foreground">your</b> customers. That is where the fix comes from.
      </p>
      <GoldButton onClick={onContinue} className="w-full">
        Upload my listing and find the fix
        <ArrowRight className="h-4 w-4" />
      </GoldButton>
    </div>
  );
}

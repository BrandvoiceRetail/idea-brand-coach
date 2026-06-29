/**
 * S1 — Diagnose (FREE).
 *
 * The four evidence-based questions + scoring math from FreeDiagnostic, rendered
 * in the demo's look. Picking answers and hitting "Reveal" computes the self-report
 * Trust Gap (computeSelfReport) and shows the score reveal (dial + per-dimension
 * /25 rows via buildTrustGap). On "Find out what to fix" the flow advances to S2.
 *
 * LIVE-WIRED: the question set + scoring are the real diagnostic engine. The
 * reveal numbers are computed from the user's own answers (not the demo's static 58).
 */

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { buildTrustGap, type TrustGapInputScores } from '@/lib/trustGap';
import { PS_COLORS } from './theme';
import { Eyebrow, ScreenHeading, Lede, PSCard, GoldButton } from './primitives';
import { PROBLEM_SOLVER_QUESTIONS, computeSelfReport } from './diagnosticQuestions';

interface DiagnoseScreenProps {
  /** Persisted answers (so returning to S1 keeps the selections). */
  answers: Record<string, string>;
  onAnswer: (questionId: string, value: string) => void;
  /** Fired with the computed self-report on reveal; the shell stores it. */
  onReveal: (scores: TrustGapInputScores) => void;
  /** Advance to S2 (Unlock). */
  onContinue: () => void;
  /**
   * Drop the screen's own "Free Trust Gap Diagnostic" eyebrow when embedded in a
   * host shell (the /v4 spine) that already supplies page chrome. Off by default,
   * so standalone /v2·/v3 keep the eyebrow.
   */
  embedded?: boolean;
}

export function DiagnoseScreen({ answers, onAnswer, onReveal, onContinue, embedded = false }: DiagnoseScreenProps): JSX.Element {
  const [revealed, setRevealed] = useState(false);
  const allAnswered = PROBLEM_SOLVER_QUESTIONS.every((q) => !!answers[q.id]);

  const handleReveal = (): void => {
    const scores = computeSelfReport(answers);
    onReveal(scores);
    setRevealed(true);
  };

  const model = revealed ? buildTrustGap(computeSelfReport(answers)) : null;

  return (
    <div>
      {!embedded && <Eyebrow>Free Trust Gap Diagnostic™</Eyebrow>}
      <ScreenHeading accent="working.">You already know something isn&rsquo;t</ScreenHeading>
      <Lede>
        Your numbers are off and you don&rsquo;t know what to fix first. Four quick questions give you a fast
        read on where customers lose confidence — then the full analysis confirms it against your own
        listing and reviews.
      </Lede>

      {!revealed && (
      <PSCard>
        <div
          className="mb-3 text-[11px] font-extrabold uppercase tracking-wide"
          style={{ color: PS_COLORS.g500 }}
        >
          Look at your listing as a first-time shopper would. Score what you actually see — not what you
          intended to show. 1 = not visible · 5 = unmistakable
        </div>

        {PROBLEM_SOLVER_QUESTIONS.map((q) => (
          <div key={q.id} className="mb-4">
            <div className="mb-2 flex items-center gap-2.5">
              <span
                className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg text-[15px]"
                style={{ background: PS_COLORS.goldLight }}
              >
                {q.icon}
              </span>
              <div>
                <div
                  className="text-[10px] font-extrabold uppercase tracking-wide"
                  style={{ color: PS_COLORS.gold }}
                >
                  {q.pillarLabel}
                </div>
                <div className="text-sm font-bold leading-tight" style={{ color: PS_COLORS.navy }}>
                  {q.question}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={q.pillarLabel}>
              {q.options.map((opt) => {
                const sel = answers[q.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    title={opt.label}
                    onClick={() => onAnswer(q.id, opt.value)}
                    className="rounded-lg border-[1.5px] px-1 py-2.5 text-center transition-colors"
                    style={{
                      background: sel ? PS_COLORS.navy : PS_COLORS.g100,
                      borderColor: sel ? PS_COLORS.navy : '#D0D5DD',
                      color: sel ? '#fff' : PS_COLORS.navy,
                    }}
                  >
                    <span className="block text-base font-extrabold">{opt.value}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between gap-3 text-[11px]" style={{ color: PS_COLORS.g500 }}>
              <span>{q.scaleLow}</span>
              <span className="text-right">{q.scaleHigh}</span>
            </div>
          </div>
        ))}

        {!revealed && (
          <button
            type="button"
            disabled={!allAnswered}
            onClick={handleReveal}
            className="mt-1.5 w-full rounded-[10px] px-5 py-3 text-sm font-extrabold text-white transition-opacity disabled:opacity-50"
            style={{ background: PS_COLORS.navy }}
          >
            Find my Trust Gap →
          </button>
        )}
      </PSCard>
      )}

      {model && (
        <PSCard>
          {/* Finding first — the plain-language read leads; the score supports it. */}
          <div
            className="mb-4 rounded-[10px] border p-4"
            style={{ background: PS_COLORS.redLight, borderColor: '#FDA29B' }}
          >
            <div
              className="text-[11px] font-extrabold uppercase tracking-wide"
              style={{ color: PS_COLORS.red }}
            >
              What this means
            </div>
            <p className="mt-1 text-[15px] font-bold leading-snug" style={{ color: PS_COLORS.navy }}>
              Your widest gap is {model.primaryGapMeta.label} — {model.primaryGapMeta.measures}
            </p>
          </div>
          <div className="py-1 text-center">
            <div className="text-[60px] font-extrabold leading-none" style={{ color: PS_COLORS.navy }}>
              {model.overall}
              <span className="text-2xl" style={{ color: '#D0D5DD' }}>
                /100
              </span>
            </div>
            <div
              className="mb-3.5 mt-0.5 text-xs font-extrabold uppercase tracking-wide"
              style={{ color: PS_COLORS.g500 }}
            >
              Trust Gap Score™
            </div>
            <div className="mb-1.5 h-2.5 overflow-hidden rounded-full" style={{ background: PS_COLORS.g100 }}>
              <span
                className="block h-full"
                style={{
                  width: `${model.overall}%`,
                  background: 'linear-gradient(90deg,#B42318,#B54708 35%,#D4960A 60%,#027A48 100%)',
                }}
              />
            </div>
            <div className="flex justify-between text-[11px]" style={{ color: PS_COLORS.g500 }}>
              <span>Wide gap</span>
              <span>Moderate</span>
              <span>Strong</span>
            </div>
          </div>

          <div
            className="mt-4 text-[11px] font-extrabold uppercase tracking-wide"
            style={{ color: PS_COLORS.g500 }}
          >
            Score by dimension
          </div>
          {model.dimensions.map((d) => {
            const isGap = d.key === model.primaryGap;
            return (
              <div
                key={d.key}
                className="mb-2 flex items-center gap-3 rounded-[10px] border bg-white p-3"
                style={{ borderColor: PS_COLORS.line }}
              >
                <span
                  className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md text-[13px] font-extrabold"
                  style={
                    isGap
                      ? { background: PS_COLORS.redLight, color: PS_COLORS.red }
                      : { background: PS_COLORS.navyLight, color: PS_COLORS.navy }
                  }
                >
                  {d.label[0]}
                </span>
                <span className="flex-1 text-[13.5px] font-bold" style={{ color: PS_COLORS.navy }}>
                  {d.label}
                </span>
                <span
                  className="text-sm font-extrabold"
                  style={{ color: isGap ? PS_COLORS.red : PS_COLORS.navy }}
                >
                  {d.score}/25
                </span>
              </div>
            );
          })}

          <div className="mt-4 flex justify-end">
            <GoldButton onClick={onContinue}>
              Upload my listing and find the fix
              <ArrowRight className="h-4 w-4" />
            </GoldButton>
          </div>
        </PSCard>
      )}
    </div>
  );
}

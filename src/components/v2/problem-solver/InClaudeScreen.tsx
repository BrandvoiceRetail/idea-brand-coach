/**
 * S8 — Inside Claude (Claude Connector showcase).
 *
 * STATIC showcase screen, faithful to the demo's S8 (already reworded from "MCP"
 * to "Claude Connector"). It illustrates the IDEA Brand Coach rendering as a
 * native panel inside Claude. The score panel here is illustrative, not a live
 * read. "Restart" resets the whole flow back to S1.
 */

import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { PS_COLORS } from './theme';
import { Eyebrow, ScreenHeading, Lede, GhostButton, GoldButton } from './primitives';

interface InClaudeScreenProps {
  onBack: () => void;
  onRestart: () => void;
  /**
   * Exit forward into the main app (e.g. the next spine stage). Optional: only
   * callers with a "next" destination — the /v4 spine — pass it.
   */
  onContinue?: () => void;
  /** Label for the forward-exit CTA, e.g. "Continue to Analyse". */
  continueLabel?: string;
  /**
   * Return to the app home/dashboard. Always provided by the flow so the
   * terminal screen is never a dead-end (the original bug: Back/Restart only).
   */
  onHome?: () => void;
}

const DIMS: ReadonlyArray<{ label: string; pct: number; color: string }> = [
  { label: 'I', pct: 76, color: '#D89B0D' },
  { label: 'D', pct: 60, color: '#54B657' },
  { label: 'E', pct: 36, color: '#3BA0D1' },
  { label: 'A', pct: 60, color: '#F08A00' },
];

export function InClaudeScreen({
  onBack,
  onRestart,
  onContinue,
  continueLabel,
  onHome,
}: InClaudeScreenProps): JSX.Element {
  return (
    <div>
      <Eyebrow>Every surface · same engine</Eyebrow>
      <ScreenHeading accent="too.">It runs inside Claude</ScreenHeading>
      <Lede>
        Through the Claude Connector, IDEA Brand Coach renders as a native panel with working buttons — and
        remembers your brand between sessions.
      </Lede>
      <Lede>
        Your competitors are asking plain Claude about their branding. You&rsquo;ve got the actual engine —
        your brand, your reviews, your Trust Gap — wired into every thread.
      </Lede>

      <div
        className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide"
        style={{ color: PS_COLORS.g500 }}
      >
        ⌘ IDEA Brand Coach — Claude Connector
      </div>

      <div
        className="mb-4 overflow-hidden rounded-2xl border bg-white"
        style={{ borderColor: PS_COLORS.line, boxShadow: '0 1px 3px rgba(16,24,40,.10)' }}
      >
        <div
          className="flex items-center gap-2.5 border-b px-3.5 py-2 text-xs font-bold"
          style={{ background: PS_COLORS.g100, borderColor: PS_COLORS.line, color: PS_COLORS.g500 }}
        >
          <span className="flex gap-1.5">
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: '#ff5f57' }} />
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: '#febc2e' }} />
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: '#28c840' }} />
          </span>
          Claude
          <span className="ml-auto text-[11px]">IDEA Brand Coach · Claude Connector</span>
        </div>

        <div className="p-3.5" style={{ background: '#fbfbfa' }}>
          <div
            className="ml-auto mb-2.5 max-w-[82%] rounded-xl rounded-br px-3 py-2 text-[12.5px] text-white"
            style={{ background: PS_COLORS.navy }}
          >
            Run my Trust Gap diagnostic in IDEA Brand Coach
          </div>
          <div className="mb-2 text-[12.5px]" style={{ color: PS_COLORS.g500 }}>
            Done — here&rsquo;s your Trust Gap, as a panel you can act on:
          </div>

          <div className="overflow-hidden rounded-xl border" style={{ borderColor: '#d9d4c4' }}>
            <div
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-white"
              style={{ background: PS_COLORS.navy }}
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-md text-[11px] font-black"
                style={{ background: PS_COLORS.gold, color: PS_COLORS.navy }}
              >
                IB
              </span>
              <span className="text-[13px] font-extrabold">IDEA Brand Coach</span>
              <span
                className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-extrabold"
                style={{ background: PS_COLORS.gold, color: PS_COLORS.navy }}
              >
                Claude Connector
              </span>
            </div>
            <div className="p-3.5">
              <div className="mb-3 flex items-center gap-3">
                <div className="text-[28px] font-extrabold" style={{ color: PS_COLORS.navy }}>
                  58<span className="text-sm" style={{ color: '#aab2c0' }}>/100</span>
                </div>
                <div>
                  <div
                    className="text-[10px] font-extrabold uppercase tracking-wide"
                    style={{ color: PS_COLORS.g500 }}
                  >
                    Trust Gap Score™
                  </div>
                  <span
                    className="mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: PS_COLORS.redLight, color: PS_COLORS.red, borderColor: '#FDA29B' }}
                  >
                    ⚠ Primary gap: Empathetic
                  </span>
                </div>
              </div>
              <div className="mb-3 grid grid-cols-4 gap-2">
                {DIMS.map((d) => (
                  <div key={d.label} className="text-center">
                    <div className="text-[11px] font-extrabold" style={{ color: d.color }}>
                      {d.label}
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: '#eee' }}>
                      <span className="block h-full" style={{ width: `${d.pct}%`, background: d.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled
                className="w-full cursor-default rounded-lg py-2.5 text-[12.5px] font-extrabold"
                style={{ background: PS_COLORS.gold, color: PS_COLORS.navy }}
              >
                Upload your listing for the fix →
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex items-start gap-2.5 rounded-[10px] border p-3.5 text-[12.5px]"
        style={{ background: PS_COLORS.goldLight, borderColor: '#efe0bf', color: PS_COLORS.navy }}
      >
        🧠{' '}
        <span>
          <b>The app remembers.</b> Upload your brand + listing once; every future session — web or in
          Claude — builds on it. You&rsquo;re never asked to re-enter what you&rsquo;ve already given.
        </span>
      </div>

      <div className="mt-4 flex justify-between">
        <GhostButton onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Stay ahead
        </GhostButton>
        <GhostButton onClick={onRestart}>
          <RotateCcw className="h-4 w-4" />
          Restart
        </GhostButton>
      </div>

      {/* Forward / home exit — the diagnostic's terminal screen must lead back
          into the main app, not dead-end on Back/Restart. */}
      {(onContinue || onHome) && (
        <div className="mt-3 flex flex-col items-center gap-2.5">
          {onContinue ? (
            <>
              <GoldButton onClick={onContinue} className="w-full sm:w-auto">
                {continueLabel ?? 'Continue'}
                <ArrowRight className="h-4 w-4" />
              </GoldButton>
              {onHome && (
                <button
                  type="button"
                  onClick={onHome}
                  className="text-xs font-bold underline-offset-2 hover:underline"
                  style={{ color: PS_COLORS.g500 }}
                >
                  Back to home
                </button>
              )}
            </>
          ) : (
            onHome && (
              <GoldButton onClick={onHome} className="w-full sm:w-auto">
                Done — back to home
                <ArrowRight className="h-4 w-4" />
              </GoldButton>
            )
          )}
        </div>
      )}
    </div>
  );
}

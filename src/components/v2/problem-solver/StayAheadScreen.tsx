/**
 * S7 — Stay ahead (Brand Defense · Beta).
 *
 * STATIC showcase screen, faithful to the demo's re-scan / Brand-Defense panel.
 * It is clearly presented as a Beta/aspirational feature — the re-scan numbers
 * and competitor alert are illustrative, not a live read. No engine call.
 */

import { useState } from 'react';
import { ArrowLeft, ArrowRight, TrendingUp, Loader2 } from 'lucide-react';
import { PS_COLORS } from './theme';
import { Eyebrow, ScreenHeading, Lede, PSCard, GhostButton, GoldButton } from './primitives';

interface StayAheadScreenProps {
  onBack: () => void;
  onContinue: () => void;
}

const LOOP = ['Diagnose', 'Analyse', 'Fix', 'Re-measure', 'Defend'];

export function StayAheadScreen({ onBack, onContinue }: StayAheadScreenProps): JSX.Element {
  const [rescanned, setRescanned] = useState(false);
  const [rescanning, setRescanning] = useState(false);

  const runRescan = (): void => {
    setRescanning(true);
    window.setTimeout(() => {
      setRescanning(false);
      setRescanned(true);
    }, 1100);
  };

  return (
    <div>
      <Eyebrow>Brand Defense · Beta</Eyebrow>
      <ScreenHeading accent="edge.">Keep your</ScreenHeading>
      <Lede>
        Fixing your gap is step one. The loop — re-measure, then watch your rivals — is what earns the
        return visit.
      </Lede>

      <div
        className="mb-4 rounded-2xl border bg-white p-4"
        style={{ borderColor: PS_COLORS.line, boxShadow: '0 1px 3px rgba(16,24,40,.10)' }}
      >
        <div className="flex flex-wrap items-center gap-2.5 text-sm font-extrabold" style={{ color: PS_COLORS.navy }}>
          <TrendingUp className="h-4 w-4" />
          Day 14 — automatic re-scan
          <button
            type="button"
            onClick={runRescan}
            disabled={rescanning}
            className="ml-auto rounded-lg border bg-white px-3 py-1.5 text-xs font-extrabold disabled:opacity-60"
            style={{ borderColor: '#D0D5DD', color: PS_COLORS.navy }}
          >
            {rescanning ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> re-scanning…
              </span>
            ) : rescanned ? (
              '✓ re-scanned'
            ) : (
              '↻ Run re-scan'
            )}
          </button>
        </div>

        {rescanned && (
          <div className="mt-3 space-y-2.5">
            <div
              className="rounded-[10px] border p-3"
              style={{ background: PS_COLORS.greenLight, borderColor: '#a6e0bf' }}
            >
              <div className="flex items-baseline gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: PS_COLORS.g500 }}
                >
                  Example
                </span>
                <span className="text-[22px] font-extrabold" style={{ color: PS_COLORS.navy }}>
                  58 → <span style={{ color: PS_COLORS.green }}>71</span>{' '}
                  <span className="text-[13px] font-bold" style={{ color: PS_COLORS.green }}>
                    ▲ +13
                  </span>
                </span>
              </div>
              <div className="mt-0.5 text-xs" style={{ color: PS_COLORS.g500 }}>
                Illustrative only — once you ship a fix and re-scan, your <b>real</b> Trust Gap
                movement shows here, measured from your own before/after scores.
              </div>
            </div>
            <div
              className="rounded-[10px] border p-3 text-[12.5px]"
              style={{ background: PS_COLORS.redLight, borderColor: '#FDA29B', color: PS_COLORS.red }}
            >
              ⚔️ <b>Heads up:</b> a rival just added a lifetime-warranty badge — they&rsquo;re closing your
              gap. <span style={{ color: PS_COLORS.g500 }}>2 new fixes ready.</span>
            </div>
          </div>
        )}

        <div
          className="mt-3 rounded-lg p-2.5 text-[11px]"
          style={{ background: PS_COLORS.g100, color: PS_COLORS.g500 }}
        >
          Brand Defense / Market Watch is a <b>Beta</b> feature — weekly cadence, not always-on. This is an
          illustrative preview. Competitor Trust Gap comparison ships alongside it.
        </div>
      </div>

      <PSCard>
        <div
          className="mb-3 text-[11px] font-extrabold uppercase tracking-wide"
          style={{ color: PS_COLORS.g500 }}
        >
          Your loop
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 text-[12.5px] font-bold">
          {LOOP.map((step, i) => (
            <span key={step} className="flex items-center gap-1.5">
              <span
                className="rounded-full border bg-white px-3 py-1.5"
                style={{ borderColor: PS_COLORS.line, color: step === 'Fix' ? PS_COLORS.navy : PS_COLORS.g500 }}
              >
                {step}
              </span>
              {i < LOOP.length - 1 && <span style={{ color: PS_COLORS.gold }}>→</span>}
            </span>
          ))}
        </div>
      </PSCard>

      <div className="flex justify-between">
        <GhostButton onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Your fix
        </GhostButton>
        <GoldButton onClick={onContinue}>
          Inside Claude
          <ArrowRight className="h-4 w-4" />
        </GoldButton>
      </div>
    </div>
  );
}
